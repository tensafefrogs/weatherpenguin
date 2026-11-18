import Foundation

/// The penguin's outfits and v1.3's rules for picking one: the Swift copy of web/app/rules.js, for the
/// Apple Watch app and its complications. Keep the two in step.
enum Outfit: String, CaseIterable, Codable {
  case naked, cold, jacket, jacketRain = "jacket_rain", warm, warmRain = "warm_rain", hot, hotRain = "hot_rain"

  var imageName: String { "penguin-\(rawValue)" }

  /// What the penguin says about it (ADVICE in rules.js).
  var advice: String {
    switch self {
    case .naked: ""
    case .cold: String(localized: "Bundle up: sweater, scarf and hat.")
    case .jacket: String(localized: "Grab a jacket.")
    case .jacketRain: String(localized: "Raincoat and rain hat today.")
    case .warm: String(localized: "T-shirt weather!")
    case .warmRain: String(localized: "Warm, but bring a rain poncho.")
    case .hot: String(localized: "Hot! Bikini weather.")
    case .hotRain: String(localized: "Hot and showery. Swim cap on.")
    }
  }

  /// The drawing, for VoiceOver (OUTFITS in rules.js).
  var accessibilityLabel: String {
    switch self {
    case .naked: String(localized: "A penguin wearing nothing at all")
    case .cold: String(localized: "A penguin in a red sweater, striped scarf and yellow hat")
    case .jacket: String(localized: "A penguin in a green jacket")
    case .jacketRain: String(localized: "A penguin in a yellow raincoat and rain hat")
    case .warm: String(localized: "A penguin in a striped T-shirt with a heart")
    case .warmRain: String(localized: "A penguin in a blue hooded poncho")
    case .hot: String(localized: "A penguin in a polka-dot bikini")
    case .hotRain: String(localized: "A penguin in a polka-dot bikini, swim cap and goggles")
    }
  }

  /// outfitFor in rules.js: the bands overlap at their edges and the earlier band wins, as in v1.
  static func pick(tempC: Double?, rain: Bool, settings: PenguinSettings) -> Outfit {
    guard let t = tempC else { return .naked }
    if t < settings.coldUpper { return .cold } // there is no cold-and-rainy drawing
    if t <= settings.warmLower { return rain ? .jacketRain : .jacket }
    if t <= settings.hotLower { return rain ? .warmRain : .warm }
    return rain ? .hotRain : .hot
  }
}

/// The user's temperature bands and °C/°F, read from the iCloud key-value store the iPhone app writes
/// (app/ios/WeatherPenguin/Settings.swift, v1.3's keys). The watch has no settings screen of its own.
struct PenguinSettings: Codable, Equatable {
  var coldUpper = 7.2
  var warmLower = 20.1
  var hotLower = 32.3
  /// iOS's own unit for weather (Settings › General › Language & Region › Temperature) until the app says otherwise
  var celsius = UnitTemperature(forLocale: .current, usage: .weather) != .fahrenheit

  static func current() -> PenguinSettings {
    let cloud = NSUbiquitousKeyValueStore.default
    cloud.synchronize()
    var s = PenguinSettings()
    if let v = cloud.object(forKey: "wpColdUpperTempKey") as? Double { s.coldUpper = v }
    if let v = cloud.object(forKey: "wpWarmLowerTempKey") as? Double { s.warmLower = v }
    if let v = cloud.object(forKey: "wpHotLowerTempKey") as? Double { s.hotLower = v }
    if let v = cloud.object(forKey: "tempDisplayCelcius") as? Bool { s.celsius = v }
    return s
  }

  /// formatTemp in rules.js: whole °F, or °C to one decimal in the user's number format.
  func format(_ tempC: Double?) -> String {
    guard let c = tempC else { return "" }
    // the same rounding as formatTemp: Math.round goes half up (-8.5 → -8), Intl.NumberFormat half away from zero
    if !celsius { return String(Int((c * 9 / 5 + 32 + 0.5).rounded(.down))) }
    return c.formatted(.number.precision(.fractionLength(1)).rounded(rule: .toNearestOrAwayFromZero).grouping(.never))
  }
}
