import Foundation

/// Settings in UserDefaults under the v1.3 keys, so existing users keep their temperature bands and
/// °C/°F choice after updating. The bands and °C/°F are also kept in iCloud key-value storage, so they
/// follow the user to their other devices; the last change wins. The morning notification stays on
/// this device (it needs this device's permission to notify).
enum Settings {
  private enum Key {
    static let coldUpper = "wpColdUpperTempKey"
    static let jacketLower = "wpJacketLowerTempKey"
    static let jacketUpper = "wpJacketUpperTempKey"
    static let warmLower = "wpWarmLowerTempKey"
    static let warmUpper = "wpWarmUpperTempKey"
    static let hotLower = "wpHotLowerTempKey"
    static let celsius = "tempDisplayCelcius" // sic, as in v1
    static let morning = "wpMorningTime" // "HH:mm", or absent when off
    static let climate = "wpClimateDefaults" // the defaults ClimateDefaults chose for here, for Reset to defaults
  }

  /// The keys shared through iCloud.
  private static let synced = [Key.coldUpper, Key.jacketLower, Key.jacketUpper, Key.warmLower, Key.warmUpper, Key.hotLower, Key.celsius]

  /// v1 defaults (°C).
  private static let defaults: [String: Any] = [
    Key.coldUpper: 7.2, Key.jacketLower: 7.3, Key.jacketUpper: 20.0,
    Key.warmLower: 20.1, Key.warmUpper: 32.2, Key.hotLower: 32.3,
  ]

  private static var cloud: NSUbiquitousKeyValueStore { .default }

  static func load() -> [String: Any] {
    let d = UserDefaults.standard
    d.register(defaults: defaults)
    // Never set on this device or in iCloud: what the person chose in iOS (Settings › General › Language &
    // Region › Temperature), which is their region's custom unless they changed it.
    let celsius = d.object(forKey: Key.celsius) as? Bool ?? PenguinUnits.systemPrefersCelsius
    var s: [String: Any] = [
      "coldUpper": d.double(forKey: Key.coldUpper),
      "warmLower": d.double(forKey: Key.warmLower),
      "hotLower": d.double(forKey: Key.hotLower),
      "celsius": celsius,
    ]
    s["morning"] = d.string(forKey: Key.morning) ?? NSNull()
    // the page's Reset to defaults goes back to these when the app moved them for the local climate
    s["defaults"] = d.dictionary(forKey: Key.climate) ?? NSNull()
    return s
  }

  /// Writes all six v1 values, derived the way v1's sliders kept them in step, and copies them to iCloud.
  static func save(_ s: [String: Any]) {
    let d = UserDefaults.standard
    if let cold = s["coldUpper"] as? Double, let warm = s["warmLower"] as? Double, let hot = s["hotLower"] as? Double,
       cold < warm, warm < hot {
      d.set(cold, forKey: Key.coldUpper)
      d.set(cold + 0.01, forKey: Key.jacketLower)
      d.set(warm - 0.01, forKey: Key.jacketUpper)
      d.set(warm, forKey: Key.warmLower)
      d.set(hot - 0.01, forKey: Key.warmUpper)
      d.set(hot, forKey: Key.hotLower)
    }
    if let celsius = s["celsius"] as? Bool { d.set(celsius, forKey: Key.celsius) }
    if let morning = s["morning"] as? String, morning.range(of: #"^\d{2}:\d{2}$"#, options: .regularExpression) != nil {
      d.set(morning, forKey: Key.morning)
    } else {
      d.removeObject(forKey: Key.morning)
    }
    for key in synced where d.object(forKey: key) != nil { cloud.set(d.object(forKey: key), forKey: key) }
  }

  /// True until the temperatures have been set anywhere (this device, iCloud) or moved for the climate once.
  static var needsClimateDefaults: Bool {
    let d = UserDefaults.standard
    let stored = Bundle.main.bundleIdentifier.flatMap { d.persistentDomain(forName: $0) } ?? [:]
    return stored[Key.coldUpper] == nil && stored[Key.climate] == nil && cloud.object(forKey: Key.coldUpper) == nil
  }

  /// Moves 1.3's defaults by `shift` °C, saves them like a choice the person made (so the watch and widgets get them
  /// through iCloud) and remembers them for Reset to defaults. Returns the new values.
  @discardableResult
  static func applyClimateDefaults(shift: Double) -> [String: Double] {
    let v = [
      "coldUpper": 7.2 + shift,
      "warmLower": 20.1 + shift,
      "hotLower": min(37.5, 32.3 + shift), // the slider ends at 37.7 °C (100 °F)
    ]
    var all: [String: Any] = v
    all["morning"] = UserDefaults.standard.string(forKey: Key.morning) as Any // save() turns it off when missing
    save(all)
    UserDefaults.standard.set(v, forKey: Key.climate)
    return v
  }

  /// Takes iCloud's copy when another device changed it, or on a new install that has none of its own.
  /// Returns whether anything changed here.
  @discardableResult
  static func pullFromCloud(onlyIfEmpty: Bool = false) -> Bool {
    let d = UserDefaults.standard
    cloud.synchronize()
    // registered defaults count as set for object(forKey:), so look at what's actually stored
    let stored = Bundle.main.bundleIdentifier.flatMap { d.persistentDomain(forName: $0) } ?? [:]
    if onlyIfEmpty && stored[Key.coldUpper] != nil { return false }
    var changed = false
    for key in synced {
      guard let value = cloud.object(forKey: key) else { continue }
      if (d.object(forKey: key) as? NSObject) != (value as? NSObject) {
        d.set(value, forKey: key)
        changed = true
      }
    }
    return changed
  }
}

enum PenguinUnits {
  /// iOS's own temperature unit for weather: the Temperature setting, else the region's custom.
  static var systemPrefersCelsius: Bool { UnitTemperature(forLocale: .current, usage: .weather) != .fahrenheit }
}
