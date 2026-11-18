import AppIntents
import SwiftUI
import WidgetKit

/// Tap "Tomorrow" on the medium Weather Penguin widget to see tomorrow's penguin there, "Today" to go back
/// (interactive widgets, iOS 17). The choice lasts a few hours, then the widget is back on Today.
/// Lives in the widget extension (and the screenshot-only WidgetPreview app), so its storage is the extension's own.
struct ShowDayIntent: AppIntent {
  static let title: LocalizedStringResource = "Show Today or Tomorrow"
  static let isDiscoverable = false

  @Parameter(title: "Tomorrow") var tomorrow: Bool

  init() {}
  init(tomorrow: Bool) { self.tomorrow = tomorrow }

  func perform() async throws -> some IntentResult {
    DayChoice.set(tomorrow: tomorrow)
    return .result() // WidgetKit redraws the widget after a widget button's intent
  }
}

enum DayChoice {
  private static let key = "showTomorrowSince"
  private static let lasts: TimeInterval = 3 * 3600

  static func set(tomorrow: Bool) {
    if tomorrow { UserDefaults.standard.set(Date(), forKey: key) } else { UserDefaults.standard.removeObject(forKey: key) }
  }

  /// Tomorrow was picked in the last few hours, and today is still the same day
  static var showsTomorrow: Bool {
    guard let since = UserDefaults.standard.object(forKey: key) as? Date else { return false }
    return Date().timeIntervalSince(since) < lasts && Calendar.current.isDateInToday(since)
  }
}

/// "Today  Tomorrow" in the medium widget's corner: the day shown in ink, the other in Soft; each a button.
struct DaySwitch: View {
  let tomorrow: Bool

  var body: some View {
    HStack(spacing: 10) {
      label(String(localized: "Today"), on: !tomorrow, intent: ShowDayIntent(tomorrow: false))
      label(String(localized: "Tomorrow"), on: tomorrow, intent: ShowDayIntent(tomorrow: true))
    }
    .buttonStyle(.plain)
  }

  private func label(_ text: String, on: Bool, intent: ShowDayIntent) -> some View {
    Button(intent: intent) {
      Text(text)
        .font(.system(size: 13, weight: on ? .semibold : .regular))
        .foregroundStyle(on ? Color.black : PenguinStyle.soft)
        .underline(on)
    }
    .accessibilityAddTraits(on ? .isSelected : [])
  }
}
