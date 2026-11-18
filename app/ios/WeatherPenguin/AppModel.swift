import CoreLocation
import UIKit
import WebKit
import WidgetKit

/// Connects the web UI to location, WeatherKit and settings.
/// The message protocol is documented in web/app/bridge.js.
@MainActor
final class AppModel: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
  weak var webView: WKWebView?
  private let location = LocationProvider()
  private var loading = false
  private var lastLoaded: Date?
  private var pageReady = false

  override init() {
    super.init()
    // A new install takes the bands and °C/°F from iCloud; later changes on another device arrive here.
    Settings.pullFromCloud(onlyIfEmpty: true)
    NotificationCenter.default.addObserver(
      forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification, object: NSUbiquitousKeyValueStore.default, queue: .main
    ) { [weak self] _ in
      MainActor.assumeIsolated {
        guard let self, Settings.pullFromCloud(), self.pageReady else { return }
        self.send("onSettings", Settings.load())
      }
    }
  }

  /// Forecasts older than this are refreshed when the app comes back.
  private let staleAfter: TimeInterval = 10 * 60

  func refreshIfStale() {
    guard pageReady else { return }
    if let lastLoaded, Date().timeIntervalSince(lastLoaded) < staleAfter { return }
    refresh()
  }

  func refresh() {
    #if DEBUG
    // The App Review video (review-video workflow, debug simulator builds only): launch argument -sample rainLater
    // shows the page's sample weather instead of asking for location and WeatherKit; -tour true plays the tour.
    if let sample = UserDefaults.standard.string(forKey: "sample"), sample.allSatisfy({ $0.isLetter }) {
      guard lastLoaded == nil else { return }   // once: coming to the foreground mustn't restart the tour
      lastLoaded = Date()
      webView?.evaluateJavaScript("WP.demo('\(sample)', \(UserDefaults.standard.bool(forKey: "tour")))")
      return
    }
    #endif
    guard !loading else { return }
    loading = true
    send("onLoading")
    Task {
      defer { loading = false }
      do {
        let here = try await location.current()
        adjustDefaultsForClimate(at: here)
        async let place = location.placeName(for: here)
        let weather = try await WeatherProvider.payload(for: here)
        var payload = weather
        payload["place"] = await place
        lastLoaded = Date()
        send("onWeather", payload)
        WidgetCenter.shared.reloadAllTimelines() // the Home Screen widgets follow the app's fresh forecast
      } catch let error as LocationProvider.Failure {
        send("onError", ["code": error == .denied ? "locationDenied" : "locationFailed"])
      } catch {
        // Apple's error domain and number, shown small under the message so a tester can report it
        let ns = error as NSError
        send("onError", ["code": Self.isOffline(error) ? "offline" : "weatherFailed", "detail": "\(ns.domain) \(ns.code)"])
      }
    }
  }

  /// Once, before the person has set them: the clothing temperatures for the local climate (ClimateDefaults).
  private func adjustDefaultsForClimate(at here: CLLocation) {
    guard #available(iOS 18, *), Settings.needsClimateDefaults else { return }
    Task {
      guard let mean = try? await ClimateDefaults.yearlyMean(at: here), Settings.needsClimateDefaults else { return }
      Settings.applyClimateDefaults(shift: ClimateDefaults.shift(forYearlyMean: mean))
      send("onSettings", Settings.load())
      WidgetCenter.shared.reloadAllTimelines()
    }
  }

  // MARK: Web → native

  func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
    guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
    switch type {
    case "ready":
      pageReady = true
      sendFold(force: true)
      send("onSettings", Settings.load())
      refresh()
    case "refresh":
      refresh()
    case "saveSettings":
      if let settings = body["settings"] as? [String: Any] {
        Settings.save(settings)
        WidgetCenter.shared.reloadAllTimelines() // new temperature bands or °C/°F
      }
    case "reminders":
      Reminders.schedule(time: body["time"] as? String, items: body["items"] as? [[String: Any]] ?? []) { [weak self] allowed in
        self?.send("onReminders", allowed)
      }
    case "openAppSettings":
      if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
    case "openURL":
      if let string = body["url"] as? String, let url = URL(string: string), url.scheme == "https" {
        UIApplication.shared.open(url)
      }
    default:
      break
    }
  }

  // MARK: Navigation: only the bundled UI loads in the web view.

  func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
    guard let url = action.request.url else { return .cancel }
    if url.scheme == BundleSchemeHandler.scheme { return .allow }
    if url.scheme == "https" { await UIApplication.shared.open(url) }
    return .cancel
  }

  // MARK: iPhone Duo fold

  private var lastFold = ""

  /// Half open, the fold divides the inner screen. Tells the page where it is (window.WP.onFold in
  /// web/app/layout.js) so each half gets its own layout: held like a book, Today on one page and Tomorrow on
  /// the other; propped up like a laptop, the penguins above the fold and the words below. In points, which are
  /// the page's CSS pixels (the page isn't zoomed). As in tensafefrogs/king-walk.
  func sendFold(force: Bool = false) {
    guard pageReady, let webView else { return }
    var fold: CGRect?
    #if WEATHERPENGUIN_SDK_27_1   // set by the build when Xcode 27.1 or later is used (.github/workflows/ios.yml)
    if #available(iOS 27.1, *) { fold = webView.reservedRegions(kind: .division).first?.frame }
    #endif
    let js = fold.map { String(format: "window.WP&&WP.onFold&&WP.onFold({x:%.1f,y:%.1f,w:%.1f,h:%.1f})", $0.minX, $0.minY, $0.width, $0.height) }
      ?? "window.WP&&WP.onFold&&WP.onFold(null)"
    guard force || js != lastFold else { return }
    lastFold = js
    webView.evaluateJavaScript(js)
  }

  // MARK: Native → web

  private func send(_ function: String, _ argument: Any? = nil) {
    var json = ""
    if let argument, let data = try? JSONSerialization.data(withJSONObject: argument, options: .fragmentsAllowed), let text = String(data: data, encoding: .utf8) {
      json = text
    }
    webView?.evaluateJavaScript("window.WP && window.WP.\(function)(\(json))")
  }

  private static func isOffline(_ error: Error) -> Bool {
    let codes: Set<URLError.Code> = [.notConnectedToInternet, .networkConnectionLost, .timedOut, .cannotConnectToHost, .dataNotAllowed]
    var current: Error? = error
    while let e = current {
      if let url = e as? URLError, codes.contains(url.code) { return true }
      current = (e as NSError).userInfo[NSUnderlyingErrorKey] as? Error
    }
    return false
  }
}
