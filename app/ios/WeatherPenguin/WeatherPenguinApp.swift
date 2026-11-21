import SwiftUI
import UserNotifications
import UIKit

@main
struct WeatherPenguinApp: App {
  @State private var model = AppModel()
  @Environment(\.scenePhase) private var scenePhase

  init() {
    UNUserNotificationCenter.current().delegate = MorningTaps.shared
  }

  var body: some Scene {
    WindowGroup {
      WebView(model: model)
        .ignoresSafeArea()
        .background(Color("Sky"))
        .onChange(of: scenePhase) { _, phase in
          if phase == .active { model.refreshIfStale() }
        }
        #if DEBUG
        // -rotate first: sideways from the start, before the page has drawn (iPad screenshots workflow)
        .onAppear {
          guard UserDefaults.standard.string(forKey: "rotate") == "first" else { return }
          let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene
          scene?.requestGeometryUpdate(.iOS(interfaceOrientations: .landscapeRight))
        }
        #endif
    }
  }
}

/// Counts a tap on the morning notification (docs/STATS.md). Only taps: nothing runs when one is merely delivered.
/// Without willPresent, a notification that arrives while the app is open isn't shown, as before.
final class MorningTaps: NSObject, UNUserNotificationCenterDelegate {
  static let shared = MorningTaps()

  func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
    if response.notification.request.identifier.hasPrefix("morning-") { Stats.count("morning/opened", once: false) }
  }
}
