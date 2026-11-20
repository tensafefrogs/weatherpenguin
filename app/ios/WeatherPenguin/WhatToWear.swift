import AppIntents
import SwiftUI

/// "What should I wear?" for Siri, Shortcuts, Spotlight and the Action button: the penguin's advice for today where
/// the person is, said and shown (the drawing, the number, the advice), without opening the app. Uses the same
/// rules as the watch and widgets (Shared/), the app's own settings, and the location permission the app already has.
struct WhatToWearIntent: AppIntent {
  static let title = LocalizedStringResource("What should I wear?", table: "Intents")
  static let description = IntentDescription(LocalizedStringResource("The penguin dressed for today's weather where you are.", table: "Intents"))
  static let openAppWhenRun = false

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
    Stats.count("siri/what-to-wear", once: false)
    let settings = PenguinSettings.fromApp()
    do {
      // Siri may run this while the app is in the background, where a new fix can be refused: a fix the
      // system already has from the last few hours is close enough for the weather.
      let here = try await OneShotLocation().current(asks: false, maxAge: 3 * 3600)
      let today = try await PenguinWeather.load(at: here, settings: settings).today
      let said = [today.outfit.advice, today.temperature(settings), today.summary].filter { !$0.isEmpty }.joined(separator: " ")
      return .result(dialog: IntentDialog("\(said)"), view: PenguinSnippet(day: today, settings: settings))
    } catch OneShotLocation.Failure.denied {
      let said = String(localized: "Please enable location services so the penguin can check your weather.")
      return .result(dialog: IntentDialog("\(said)"), view: PenguinSnippet(day: nil, settings: settings))
    } catch {
      let said = String(localized: "Couldn't get the weather. Please try again in a moment.")
      return .result(dialog: IntentDialog("\(said)"), view: PenguinSnippet(day: nil, settings: settings))
    }
  }
}

/// The phrases Siri knows without setup, and the shortcut in the Shortcuts app, Spotlight and the Action button list.
struct PenguinShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: WhatToWearIntent(),
      phrases: ["What should I wear in \(.applicationName)", "Ask \(.applicationName) what to wear"],
      shortTitle: LocalizedStringResource("What to wear", table: "Intents"),
      systemImageName: "tshirt"
    )
  }
}

/// What Siri and Shortcuts show: the drawing on the pale blue, with the number and the advice.
struct PenguinSnippet: View {
  let day: DaySummary?
  let settings: PenguinSettings

  var body: some View {
    let outfit = day?.outfit ?? .naked
    HStack(spacing: 14) {
      Image(outfit.imageName)
        .resizable()
        .scaledToFit()
        .frame(height: 120)
        .accessibilityLabel(outfit.accessibilityLabel)
      VStack(alignment: .leading, spacing: 2) {
        Text(day?.temperature(settings) ?? "").font(.system(size: 40, weight: .thin))
        Text(day?.detail(settings) ?? "").font(.system(size: 14, weight: .light)).foregroundStyle(PenguinStyle.soft)
        Text(outfit.advice).font(.system(size: 16)).padding(.top, 6)
      }
      .foregroundStyle(.black)
      Spacer(minLength: 0)
    }
    .padding(16)
    .background(PenguinStyle.sky)
  }
}

extension PenguinSettings {
  /// The app's own settings (Settings.swift: UserDefaults, v1.3's keys), for code that runs inside the app.
  static func fromApp() -> PenguinSettings {
    let s = Settings.load()
    var p = PenguinSettings()
    if let v = s["coldUpper"] as? Double { p.coldUpper = v }
    if let v = s["warmLower"] as? Double { p.warmLower = v }
    if let v = s["hotLower"] as? Double { p.hotLower = v }
    if let v = s["celsius"] as? Bool { p.celsius = v }
    return p
  }
}
