import SwiftUI
import WidgetKit

/// The Apple Watch app: Today and Tomorrow, one above the other (turn the Digital Crown or swipe up).
/// Gets its own location and WeatherKit forecast, and reads the temperature bands and °C/°F the iPhone app
/// keeps in iCloud. Launch arguments for screenshots, in debug builds only: -sample 1 (fixed weather), -page 1 (start on
/// Tomorrow).
@main
struct WeatherPenguinWatchApp: App {
  @StateObject private var model = WatchModel()
  @Environment(\.scenePhase) private var scenePhase

  var body: some Scene {
    WindowGroup {
      ContentView(model: model)
        .onChange(of: scenePhase) { _, phase in
          if phase == .active { Task { await model.refreshIfStale() } }
        }
    }
  }
}

@MainActor
final class WatchModel: ObservableObject {
  enum State: Equatable { case loading, ready(PenguinForecast), failed(String) }

  @Published var state: State = .loading
  @Published var settings = PenguinSettings.current()
  private let location = OneShotLocation()
  private var lastLoaded: Date?
  private var loading = false

  /// Screenshots only (the Watch screenshots workflow builds Debug): -sample 1 shows fixed weather.
  var isSample: Bool {
    #if DEBUG
    UserDefaults.standard.bool(forKey: "sample")
    #else
    false
    #endif
  }

  func refreshIfStale() async {
    if let lastLoaded, Date().timeIntervalSince(lastLoaded) < 10 * 60 { return }
    await refresh()
  }

  func refresh() async {
    guard !loading else { return }   // at launch, the first appearance and becoming active both ask
    loading = true
    defer { loading = false }
    settings = PenguinSettings.current()
    if isSample {
      state = .ready(PenguinWeather.sample(settings: settings))
      return
    }
    if case .ready = state {} else { state = .loading }
    do {
      let here = try await location.current()
      state = .ready(try await PenguinWeather.load(at: here, settings: settings))
      lastLoaded = Date()
      WidgetCenter.shared.reloadAllTimelines() // the complications follow the app's fresh forecast
    } catch OneShotLocation.Failure.denied {
      state = .failed(String(localized: "Location Access Denied"))
    } catch OneShotLocation.Failure.failed {
      state = .failed(String(localized: "Failed to get location."))
    } catch {
      state = .failed(String(localized: "Couldn't get the weather. Please try again in a moment."))
    }
  }
}
