import SwiftUI
import WidgetKit

/// What the Home Screen widgets show. Shared by the widget extension (PenguinWidgets.swift) and the
/// screenshot-only WidgetPreview app, so the screenshots are the real views.

enum PenguinStyle {
  static let sky = Color(red: 0xD8 / 255, green: 0xE2 / 255, blue: 0xFF / 255)   // --sky in web/app/style.css
  static let soft = Color(red: 0x3C / 255, green: 0x41 / 255, blue: 0x50 / 255)  // --soft
}

/// The pale blue, with the hand-drawn raindrops fading down from the top when the penguin dresses for rain.
struct PenguinSky: View {
  let rain: Bool

  var body: some View {
    ZStack {
      PenguinStyle.sky
      if rain {
        GeometryReader { g in
          // the phone's tile (53 x 71 pt), drawn at half size: drawn at double the area, then scaled down
          Image("raindrop")
            .resizable(resizingMode: .tile)
            .frame(width: g.size.width * 2, height: g.size.height * 2)
            .scaleEffect(0.5, anchor: .topLeading)
            .opacity(0.55)
        }
        .mask(LinearGradient(stops: [.init(color: .black, location: 0), .init(color: .black, location: 0.35),
                                     .init(color: .clear, location: 0.75)], startPoint: .top, endPoint: .bottom))
        .accessibilityHidden(true)
      }
    }
  }
}

struct PenguinPicture: View {
  let outfit: Outfit

  var body: some View {
    let image = Image(outfit.imageName).resizable()
    Group {
      if #available(iOS 18, *) {
        image.widgetAccentedRenderingMode(.fullColor)   // stays in colour on a tinted Home Screen
      } else {
        image
      }
    }
    .scaledToFit()
    .accessibilityLabel(outfit.accessibilityLabel)
  }
}

extension DaySummary {
  func temperature(_ s: PenguinSettings) -> String { temp == nil ? "" : s.format(temp) + "°" }
  /// "High of 63" on Today, "Low of 45" on Tomorrow
  func detail(_ s: PenguinSettings) -> String {
    if let high { return String(localized: "High of \(s.format(high))") }
    if let low { return String(localized: "Low of \(s.format(low))") }
    return ""
  }
}

/// Small: the big number top left, the penguin standing bottom right.
struct SmallPenguinView: View {
  let day: DaySummary?
  let settings: PenguinSettings

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      Text(day?.temperature(settings) ?? "")
        .font(.system(size: 40, weight: .thin))
        .lineLimit(1).minimumScaleFactor(0.6)
      Text(day?.detail(settings) ?? "")
        .font(.system(size: 12, weight: .light))
        .foregroundStyle(PenguinStyle.soft)
        .lineLimit(1).minimumScaleFactor(0.8)
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(alignment: .bottomTrailing) {
      PenguinPicture(outfit: day?.outfit ?? .naked)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
        .padding(.top, 34)
        .padding(.leading, 34)
        .offset(x: 4, y: 6)
    }
    .foregroundStyle(.black)
  }
}

/// Medium: the penguin on the left; Today, the numbers, the weather and what to wear on the right.
struct MediumPenguinView: View {
  let day: DaySummary?
  let settings: PenguinSettings
  /// Replaces the "Today" label: the widget's Today / Tomorrow switch (DaySwitch.swift)
  var header: AnyView? = nil

  var body: some View {
    HStack(spacing: 14) {
      PenguinPicture(outfit: day?.outfit ?? .naked)
        .frame(maxHeight: .infinity)
        .padding(.vertical, -4)
      VStack(alignment: .leading, spacing: 0) {
        if let header {
          header
        } else {
          Text(String(localized: "Today"))
            .font(.system(size: 13, weight: .regular))
            .foregroundStyle(PenguinStyle.soft)
        }
        HStack(alignment: .firstTextBaseline, spacing: 6) {
          Text(day?.temperature(settings) ?? "")
            .font(.system(size: 42, weight: .thin))
          Text(day?.detail(settings) ?? "")
            .font(.system(size: 13, weight: .light))
            .foregroundStyle(PenguinStyle.soft)
        }
        .lineLimit(1).minimumScaleFactor(0.7)
        Text(day?.summary ?? "")
          .font(.system(size: 13, weight: .light))
          .foregroundStyle(PenguinStyle.soft)
          .lineLimit(2)
        Spacer(minLength: 4)
        Text(day?.outfit.advice ?? "")
          .font(.system(size: 15, weight: .regular))
          .lineLimit(2).minimumScaleFactor(0.85)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
    .foregroundStyle(.black)
  }
}

/// Medium, the other widget: Today and Tomorrow side by side.
struct TwoDayPenguinView: View {
  let forecast: PenguinForecast?
  let settings: PenguinSettings

  var body: some View {
    HStack(spacing: 10) {
      column(String(localized: "Today"), forecast?.today)
      Rectangle().fill(PenguinStyle.soft.opacity(0.25)).frame(width: 1).padding(.vertical, 8)
      column(String(localized: "Tomorrow"), forecast?.tomorrow)
    }
    .foregroundStyle(.black)
  }

  private func column(_ title: String, _ day: DaySummary?) -> some View {
    HStack(alignment: .bottom, spacing: 4) {
      VStack(alignment: .leading, spacing: 0) {
        Text(title)
          .font(.system(size: 13, weight: .regular))
          .foregroundStyle(PenguinStyle.soft)
          .lineLimit(1).minimumScaleFactor(0.8)
        Text(day?.temperature(settings) ?? "")
          .font(.system(size: 34, weight: .thin))
          .lineLimit(1).minimumScaleFactor(0.6)
        Text(day?.detail(settings) ?? "")
          .font(.system(size: 11, weight: .light))
          .foregroundStyle(PenguinStyle.soft)
          .lineLimit(2).minimumScaleFactor(0.8)
        Spacer(minLength: 0)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      PenguinPicture(outfit: day?.outfit ?? .naked)
        .frame(maxHeight: .infinity, alignment: .bottom)
        .padding(.top, 10)
    }
    .frame(maxWidth: .infinity)
  }
}

/// Lock Screen: the penguin and the number in the round spot, the penguin with the number and advice in the
/// rectangle, and words only on the line above the clock. iOS tints these to suit the wallpaper.
struct LockScreenPenguinView: View {
  let family: WidgetFamily
  let day: DaySummary?
  let settings: PenguinSettings

  private var outfit: Outfit { day?.outfit ?? .naked }
  private var temp: String { day?.temperature(settings) ?? "" }

  var body: some View {
    switch family {
    case .accessoryCircular:
      ZStack {
        AccessoryWidgetBackground()
        VStack(spacing: 0) {
          PenguinPicture(outfit: outfit).padding(.top, 5)
          Text(temp).font(.system(size: 12, weight: .semibold)).padding(.bottom, 4)
        }
      }
    case .accessoryRectangular:
      HStack(spacing: 6) {
        PenguinPicture(outfit: outfit)
        VStack(alignment: .leading, spacing: 0) {
          // the number a little smaller than in the app's widgets, so the advice gets three lines: "Bundle up: sweater,
          // scarf and hat." (and longer translations) cut off at two
          Text(temp).font(.system(size: 20, weight: .light))
          Text(outfit.advice).font(.system(size: 12.5)).lineLimit(3).minimumScaleFactor(0.75).allowsTightening(true)
        }
        Spacer(minLength: 0)
      }
    default: // inline: words only
      Text(temp.isEmpty ? "Weather Penguin" : "\(temp) \(outfit.advice)")
    }
  }
}
