import SwiftUI
import WidgetKit

/// Home Screen widgets: "Weather Penguin" (small and medium: today's penguin) and "Today & Tomorrow"
/// (medium). Like the watch complications they get their own forecast about once an hour, with the app's
/// location permission (NSWidgetWantsLocation), and the temperature bands and °C/°F from the iCloud
/// key-value store the app writes. Tapping one opens the app.
@main
struct PenguinWidgets: WidgetBundle {
  var body: some Widget {
    TodayWidget()
    TwoDayWidget()
  }
}

struct TodayWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "Today", provider: PenguinProvider()) { entry in
      TodayWidgetView(entry: entry)
    }
    .configurationDisplayName("Weather Penguin")
    .description(String(localized: "Today"))
    // Home Screen (and StandBy) sizes, and the Lock Screen's round, rectangular and one-line spots
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
  }
}

struct TodayWidgetView: View {
  let entry: PenguinEntry
  @Environment(\.widgetFamily) private var family

  var body: some View {
    let day = entry.forecast?.today
    switch family {
    case .systemSmall:
      SmallPenguinView(day: day, settings: entry.settings)
        .containerBackground(for: .widget) { PenguinSky(rain: day?.rain ?? false) }
    case .systemMedium:
      // Today unless Tomorrow was tapped in the last few hours (DaySwitch.swift)
      let tomorrow = DayChoice.showsTomorrow && entry.forecast != nil
      let shown = tomorrow ? entry.forecast?.tomorrow : day
      MediumPenguinView(day: shown, settings: entry.settings, header: AnyView(DaySwitch(tomorrow: tomorrow)))
        .containerBackground(for: .widget) { PenguinSky(rain: shown?.rain ?? false) }
    default: // the Lock Screen draws its own background
      LockScreenPenguinView(family: family, day: day, settings: entry.settings)
        .containerBackground(for: .widget) { Color.clear }
    }
  }
}

struct TwoDayWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "TodayTomorrow", provider: PenguinProvider()) { entry in
      TwoDayPenguinView(forecast: entry.forecast, settings: entry.settings)
        .containerBackground(for: .widget) { PenguinSky(rain: false) }
    }
    .configurationDisplayName("Weather Penguin")
    .description(Text(verbatim: "\(String(localized: "Today")) · \(String(localized: "Tomorrow"))"))
    .supportedFamilies([.systemMedium])
  }
}

struct PenguinEntry: TimelineEntry {
  let date: Date
  /// nil before the first forecast (or without location permission): the plain penguin, no numbers
  let forecast: PenguinForecast?
  let settings: PenguinSettings
}

struct PenguinProvider: TimelineProvider {
  func placeholder(in context: Context) -> PenguinEntry {
    let settings = PenguinSettings()
    return PenguinEntry(date: Date(), forecast: PenguinWeather.sample(settings: settings), settings: settings)
  }

  func getSnapshot(in context: Context, completion: @escaping (PenguinEntry) -> Void) {
    if context.isPreview { return completion(placeholder(in: context)) }
    Task { completion(await load()) }
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<PenguinEntry>) -> Void) {
    Task {
      let entry = await load()
      // hourly with a forecast; sooner without one, in case permission or the network comes back
      let next = Date().addingTimeInterval(entry.forecast == nil ? 20 * 60 : 60 * 60)
      completion(Timeline(entries: [entry], policy: .after(next)))
    }
  }

  @MainActor
  private func load() async -> PenguinEntry {
    let settings = PenguinSettings.current()
    do {
      let here = try await OneShotLocation().current(asks: false)
      let forecast = try await PenguinWeather.load(at: here, settings: settings)
      ForecastCache.save(forecast)
      return PenguinEntry(date: Date(), forecast: forecast, settings: settings)
    } catch {
      // offline or no fix right now: the last forecast, if it's from the last few hours
      return PenguinEntry(date: Date(), forecast: ForecastCache.recent(), settings: settings)
    }
  }
}

/// The last forecast, in the widget extension's own storage (on this device only).
enum ForecastCache {
  private static let key = "lastForecast"

  static func save(_ f: PenguinForecast) {
    if let data = try? JSONEncoder().encode(f) { UserDefaults.standard.set(data, forKey: key) }
  }

  static func recent(maxAge: TimeInterval = 4 * 3600) -> PenguinForecast? {
    guard let data = UserDefaults.standard.data(forKey: key),
          let f = try? JSONDecoder().decode(PenguinForecast.self, from: data),
          Date().timeIntervalSince(f.asOf) < maxAge,
          Calendar.current.isDateInToday(f.asOf)
    else { return nil }
    return f
  }
}
