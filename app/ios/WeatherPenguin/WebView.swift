import SwiftUI
import WebKit

/// Shows the bundled web UI (web/app in the repository).
struct WebView: UIViewRepresentable {
  let model: AppModel

  func makeUIView(context: Context) -> WKWebView {
    let config = WKWebViewConfiguration()
    // ES modules don't load from file:// URLs, so the files are served from a
    // private scheme instead.
    config.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: BundleSchemeHandler.scheme)
    config.userContentController.add(WeakMessageHandler(model), name: "wp")
    // What the app offers the page (window.WPApp in web/app/main.js), before its scripts run.
    config.userContentController.addUserScript(
      WKUserScript(source: "window.WPApp={reminders:true};", injectionTime: .atDocumentStart, forMainFrameOnly: true))

    let webView = LayoutReportingWebView(frame: .zero, configuration: config)
    webView.onLayout = { [weak model] in model?.sendFold() }
    webView.isOpaque = false
    webView.backgroundColor = UIColor(named: "Sky")
    webView.scrollView.backgroundColor = UIColor(named: "Sky")
    webView.scrollView.contentInsetAdjustmentBehavior = .never
    webView.scrollView.bounces = false
    // an app screen, not a web page: no pinch or double-tap zoom
    webView.scrollView.minimumZoomScale = 1
    webView.scrollView.maximumZoomScale = 1
    webView.scrollView.pinchGestureRecognizer?.isEnabled = false
    // The person's text size (Settings › Display & Brightness › Text Size, and Accessibility's Larger Text): the
    // page is drawn larger or smaller to match, the way Safari's page zoom works, and follows changes live.
    webView.pageZoom = TextSize.zoom(for: webView.traitCollection.preferredContentSizeCategory)
    webView.registerForTraitChanges([UITraitPreferredContentSizeCategory.self]) { (view: WKWebView, _) in
      view.pageZoom = TextSize.zoom(for: view.traitCollection.preferredContentSizeCategory)
    }
    webView.navigationDelegate = model
    #if DEBUG
    webView.isInspectable = true
    #endif

    model.webView = webView
    webView.load(URLRequest(url: URL(string: "\(BundleSchemeHandler.scheme)://app/index.html")!))
    return webView
  }

  func updateUIView(_ uiView: WKWebView, context: Context) {}
}

/// A web view that says when its layout changes (turning, Split View, opening or folding an iPhone Duo).
final class LayoutReportingWebView: WKWebView {
  var onLayout: (@MainActor () -> Void)?

  override func layoutSubviews() {
    super.layoutSubviews()
    onLayout?()
  }
}

/// Serves files from the app bundle's "app" folder at wp-app://app/<path>.
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
  static let scheme = "wp-app"

  private static let types = [
    "html": "text/html", "js": "text/javascript", "css": "text/css",
    "png": "image/png", "svg": "image/svg+xml", "json": "application/json", "woff2": "font/woff2",
  ]

  func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
    guard
      let url = task.request.url,
      let root = Bundle.main.resourceURL?.appendingPathComponent("app", isDirectory: true)
    else {
      return task.didFailWithError(URLError(.badURL))
    }
    let file = root.appendingPathComponent(url.path).standardizedFileURL
    guard file.path.hasPrefix(root.standardizedFileURL.path), let data = try? Data(contentsOf: file) else {
      return task.didFailWithError(URLError(.fileDoesNotExist))
    }
    let type = Self.types[file.pathExtension.lowercased()] ?? "application/octet-stream"
    task.didReceive(URLResponse(url: url, mimeType: type, expectedContentLength: data.count, textEncodingName: "utf-8"))
    task.didReceive(data)
    task.didFinish()
  }

  func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}

/// WKUserContentController keeps its handlers alive; this avoids a retain cycle.
final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
  private weak var target: WKScriptMessageHandler?

  init(_ target: WKScriptMessageHandler) {
    self.target = target
  }

  func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
    target?.userContentController(controller, didReceive: message)
  }
}

/// How much to scale the page for each iOS text size. The default (Large) is 1; the largest accessibility sizes
/// stop at 1.5 so Today, Tomorrow and Settings still fit on an iPhone.
enum TextSize {
  static func zoom(for size: UIContentSizeCategory) -> CGFloat {
    switch size {
    case .extraSmall: 0.88
    case .small: 0.92
    case .medium: 0.96
    case .extraLarge: 1.08
    case .extraExtraLarge: 1.16
    case .extraExtraExtraLarge: 1.25
    case .accessibilityMedium: 1.35
    case .accessibilityLarge: 1.42
    case .accessibilityExtraLarge, .accessibilityExtraExtraLarge, .accessibilityExtraExtraExtraLarge: 1.5
    default: 1
    }
  }
}
