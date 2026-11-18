import SwiftUI

@main
struct WeatherPenguinApp: App {
  @State private var model = AppModel()
  @Environment(\.scenePhase) private var scenePhase

  var body: some Scene {
    WindowGroup {
      WebView(model: model)
        .ignoresSafeArea()
        .background(Color("Sky"))
        .onChange(of: scenePhase) { _, phase in
          if phase == .active { model.refreshIfStale() }
        }
    }
  }
}
