import SwiftUI
import WidgetKit

/// Not shipped: a simulator-only app that lays the Home Screen widgets out at their real sizes with the
/// sample forecast, for the Widget screenshots workflow (widgets can't be put on a simulator's Home Screen
/// from a script). Launch argument -page 1 shows the second sheet; -page 2 the App Store's widgets screenshot.
@main
struct WidgetPreviewApp: App {
  var body: some Scene {
    WindowGroup { WidgetSheet(page: UserDefaults.standard.integer(forKey: "page")) }
  }
}

struct WidgetSheet: View {
  let page: Int
  private let settings: PenguinSettings = {
    var s = PenguinSettings()
    s.celsius = UserDefaults.standard.bool(forKey: "celsius")   // -celsius true
    return s
  }()

  // iPhone 6.3"/6.9" Home Screen sizes (pt)
  private let small = CGSize(width: 170, height: 170)
  private let medium = CGSize(width: 364, height: 170)

  var body: some View {
    let rainy = PenguinWeather.sample(settings: settings)
    var dry = rainy
    dry.today = DaySummary(temp: 27, high: 29, low: 18, outfit: Outfit.pick(tempC: 27, rain: false, settings: settings),
                           rain: false, condition: String(localized: "Mostly Sunny"), rainyCondition: false)
    dry.tomorrow = DaySummary(temp: 34, high: nil, low: 22, outfit: Outfit.pick(tempC: 34, rain: false, settings: settings),
                              rain: false, condition: String(localized: "Clear"), rainyCondition: false)
    return ScrollView {
      VStack(spacing: 22) {
        if page == 0 {
          HStack(spacing: 24) {
            tile(small, rain: true) { SmallPenguinView(day: rainy.today, settings: settings) }
            tile(small, rain: false) { SmallPenguinView(day: dry.today, settings: settings) }
          }
          tile(medium, rain: true) { MediumPenguinView(day: rainy.today, settings: settings, header: AnyView(DaySwitch(tomorrow: false))) }
          tile(medium, rain: false) { TwoDayPenguinView(forecast: rainy, settings: settings) }
        } else if page == 2 {
          // The App Store's widgets screenshot (store-widgets workflow, iPhone Pro Max): the Home Screen and Lock Screen.
          HStack(spacing: 24) {
            tile(small, rain: true) { SmallPenguinView(day: rainy.today, settings: settings) }
            tile(small, rain: false) { SmallPenguinView(day: dry.today, settings: settings) }
          }
          tile(medium, rain: true) { MediumPenguinView(day: rainy.today, settings: settings, header: AnyView(DaySwitch(tomorrow: false))) }
          tile(medium, rain: false) { TwoDayPenguinView(forecast: dry, settings: settings) }
          lockScreen(rainy.today)
        } else {
          // (the plain penguin before a forecast is the first sheet's job no more: room for the Lock Screen)
          tile(medium, rain: false) { MediumPenguinView(day: dry.tomorrow, settings: settings, header: AnyView(DaySwitch(tomorrow: true))) }
          tile(medium, rain: false) { TwoDayPenguinView(forecast: dry, settings: settings) }
          lockScreen(rainy.today)
        }
      }
      .padding(.top, 70)
      .frame(maxWidth: .infinity)
    }
    .background(LinearGradient(colors: [Color(red: 0.36, green: 0.45, blue: 0.62), Color(red: 0.55, green: 0.42, blue: 0.55)],
                               startPoint: .top, endPoint: .bottom).ignoresSafeArea())
  }

  /// The Lock Screen spots, on a dark wallpaper, drawn white the way iOS tints them by default.
  private func lockScreen(_ day: DaySummary) -> some View {
    VStack(spacing: 14) {
      LockScreenPenguinView(family: .accessoryInline, day: day, settings: settings).font(.system(size: 15, weight: .medium))
      HStack(spacing: 18) {
        LockScreenPenguinView(family: .accessoryCircular, day: day, settings: settings).frame(width: 72, height: 72)
        LockScreenPenguinView(family: .accessoryRectangular, day: day, settings: settings).frame(width: 172, height: 76)
      }
    }
    .foregroundStyle(.white)
    .padding(18)
    .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Color(white: 0.12)))
  }

  /// One widget: its background, the system's 16 pt content margins, and the Home Screen's corner radius.
  private func tile<V: View>(_ size: CGSize, rain: Bool, @ViewBuilder _ content: () -> V) -> some View {
    content()
      .padding(16)
      .frame(width: size.width, height: size.height)
      .background(PenguinSky(rain: rain))
      .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
  }
}
