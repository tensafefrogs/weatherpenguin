import SwiftUI
import WidgetKit

/// Watch face complications: the penguin dressed for today, with the temperature. They fetch their own
/// forecast about once an hour (and whenever the watch app gets a fresh one), using the watch's location
/// permission (NSWidgetWantsLocation). Tapping one opens the watch app.
@main
struct PenguinComplications: WidgetBundle {
  var body: some Widget {
    PenguinComplication()
  }
}

struct PenguinComplication: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "PenguinComplication", provider: PenguinProvider()) { entry in
      PenguinComplicationView(entry: entry)
        .containerBackground(for: .widget) { Color.clear }
    }
    .configurationDisplayName("Weather Penguin")
    .description(String(localized: "Today"))
    .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryCorner, .accessoryInline])
  }
}

struct PenguinEntry: TimelineEntry {
  let date: Date
  /// nil before the first forecast (or without location permission): the plain penguin, no number
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
      return PenguinEntry(date: Date(), forecast: try await PenguinWeather.load(at: here, settings: settings), settings: settings)
    } catch {
      return PenguinEntry(date: Date(), forecast: nil, settings: settings)
    }
  }
}

struct PenguinComplicationView: View {
  let entry: PenguinEntry
  @Environment(\.widgetFamily) private var family

  private var today: DaySummary? { entry.forecast?.today }
  private var outfit: Outfit { today?.outfit ?? .naked }
  private var temp: String {
    guard let t = today?.temp else { return "" }
    return entry.settings.format(t) + "°"
  }

  var body: some View {
    switch family {
    case .accessoryCircular:
      ZStack(alignment: .bottom) {
        AccessoryWidgetBackground()
        penguin.padding(.horizontal, 6).padding(.top, 3).padding(.bottom, 12)
        Text(temp).font(.system(size: 12, weight: .semibold)).padding(.bottom, 2)
      }
    case .accessoryRectangular:
      HStack(spacing: 6) {
        penguin
        VStack(alignment: .leading, spacing: 0) {
          Text(temp).font(.system(size: 24, weight: .light))
          Text(outfit.advice).font(.system(size: 13)).lineLimit(2).minimumScaleFactor(0.8)
        }
        Spacer(minLength: 0)
      }
    case .accessoryCorner:
      penguin
        .widgetLabel(temp)
    default: // inline: text only
      Text(temp.isEmpty ? "Weather Penguin" : "\(temp) \(outfit.advice)")
    }
  }

  private var penguin: some View {
    Image(outfit.imageName)
      .resizable()
      .scaledToFit()
      .widgetAccentable(false)
      .accessibilityLabel(outfit.accessibilityLabel)
  }
}
