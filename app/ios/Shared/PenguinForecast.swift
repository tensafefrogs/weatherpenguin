import CoreLocation
import Foundation
import WeatherKit

/// Today and Tomorrow as the penguin sees them: pages() in web/app/rules.js, in Swift for the watch.
struct DaySummary: Codable, Equatable {
  /// The current temperature (Today) or the high (Tomorrow): the big number.
  var temp: Double?
  /// Today's high, shown as "High of"; nil on Tomorrow, which shows its low instead.
  var high: Double?
  var low: Double?
  var outfit: Outfit
  var rain: Bool
  /// WeatherKit's text, already in the user's language.
  var condition: String
  /// Whether the condition already says it's wet (so "Rain likely." isn't added).
  var rainyCondition: Bool

  /// The line under the numbers: the condition, plus "Rain likely." when the penguin dresses for rain.
  var summary: String {
    guard rain, !rainyCondition else { return condition }
    return condition.isEmpty ? String(localized: "Rain likely.") : "\(condition). \(String(localized: "Rain likely."))"
  }
}

struct PenguinForecast: Codable, Equatable {
  var asOf: Date
  var today: DaySummary
  var tomorrow: DaySummary
}

enum PenguinWeather {
  private static let wet: Set<String> = ["rain", "mixed", "sleet", "hail"]

  static func load(at location: CLLocation, settings: PenguinSettings) async throws -> PenguinForecast {
    let (current, hourly, daily) = try await WeatherService.shared.weather(for: location, including: .current, .hourly, .daily)
    let now = Date()
    let startOfToday = Calendar.current.startOfDay(for: now)
    let nextHour = hourly.forecast.first { $0.date > now.addingTimeInterval(-3600) }
    let days = daily.forecast.filter { $0.date >= startOfToday.addingTimeInterval(-3600) }
    let today = days.first
    let tomorrow = days.dropFirst().first

    func c(_ m: Measurement<UnitTemperature>) -> Double { m.converted(to: .celsius).value }
    func wetType(_ p: Precipitation) -> Bool { wet.contains(name(p)) }
    func rainyCode(_ code: String) -> Bool { code.range(of: "rain|drizzle|shower|storm", options: [.regularExpression, .caseInsensitive]) != nil }

    // rainToday in rules.js: raining now, or ≥25% in the next hour, or ≥35% today
    let mmPerHour = current.precipitationIntensity.converted(to: .metersPerSecond).value * 3_600_000
    let nowTemp = c(current.temperature)
    var rainToday = mmPerHour >= 0.1 && nowTemp > 0
    if let h = nextHour, h.precipitationChance >= 0.25, wetType(h.precipitation) { rainToday = true }
    if let d = today, d.precipitationChance >= 0.35, wetType(d.precipitation) { rainToday = true }
    // rainTomorrow: ≥35%
    let rainTomorrow = tomorrow.map { $0.precipitationChance >= 0.35 && wetType($0.precipitation) } ?? false

    let todaySummary = DaySummary(
      temp: nowTemp, high: today.map { c($0.highTemperature) }, low: today.map { c($0.lowTemperature) },
      outfit: Outfit.pick(tempC: nowTemp, rain: rainToday, settings: settings), rain: rainToday,
      condition: current.condition.description, rainyCondition: rainyCode(current.condition.rawValue))
    let tomorrowHigh = tomorrow.map { c($0.highTemperature) }
    let tomorrowSummary = DaySummary(
      temp: tomorrowHigh, high: nil, low: tomorrow.map { c($0.lowTemperature) },
      outfit: Outfit.pick(tempC: tomorrowHigh, rain: rainTomorrow, settings: settings), rain: rainTomorrow,
      condition: tomorrow?.condition.description ?? "", rainyCondition: rainyCode(tomorrow?.condition.rawValue ?? ""))
    return PenguinForecast(asOf: now, today: todaySummary, tomorrow: tomorrowSummary)
  }

  private static func name(_ p: Precipitation) -> String {
    switch p {
    case .hail: "hail"
    case .mixed: "mixed"
    case .rain: "rain"
    case .sleet: "sleet"
    case .snow: "snow"
    default: "clear"
    }
  }

  /// Fixed weather for screenshots and previews (the "rainLater" sample in web/app/samples.js), °C.
  static func sample(settings: PenguinSettings) -> PenguinForecast {
    PenguinForecast(
      asOf: Date(),
      today: DaySummary(temp: 15, high: 17, low: 11, outfit: Outfit.pick(tempC: 15, rain: true, settings: settings),
                        rain: true, condition: String(localized: "Mostly Cloudy"), rainyCondition: false),
      tomorrow: DaySummary(temp: 12, high: nil, low: 7, outfit: Outfit.pick(tempC: 12, rain: false, settings: settings),
                           rain: false, condition: String(localized: "Partly Cloudy"), rainyCondition: false))
  }
}

/// One location fix, about 1 km accurate, for the watch app and its complications.
@MainActor
final class OneShotLocation: NSObject, CLLocationManagerDelegate {
  enum Failure: Error { case denied, failed }

  private let manager = CLLocationManager()
  private var authorization: CheckedContinuation<Void, Never>?
  private var fix: CheckedContinuation<CLLocation, Error>?

  override init() {
    super.init()
    manager.delegate = self
    manager.desiredAccuracy = kCLLocationAccuracyKilometer
  }

  /// asks: request permission if it hasn't been asked (the app; a complication never asks).
  /// maxAge: how old a fix the system already has may be before a new one is requested.
  func current(asks: Bool = true, maxAge: TimeInterval = 15 * 60) async throws -> CLLocation {
    if manager.authorizationStatus == .notDetermined {
      guard asks else { throw Failure.denied }
      await withCheckedContinuation { continuation in
        authorization = continuation
        manager.requestWhenInUseAuthorization()
      }
    }
    switch manager.authorizationStatus {
    case .denied, .restricted: throw Failure.denied
    default: break
    }
    if let recent = manager.location, recent.timestamp.timeIntervalSinceNow > -maxAge { return recent }
    fix?.resume(throwing: Failure.failed)
    return try await withCheckedThrowingContinuation { continuation in
      fix = continuation
      manager.requestLocation()
    }
  }

  nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    let status = manager.authorizationStatus
    Task { @MainActor in
      guard status != .notDetermined else { return }
      authorization?.resume()
      authorization = nil
    }
  }

  nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let last = locations.last else { return }
    Task { @MainActor in
      fix?.resume(returning: last)
      fix = nil
    }
  }

  nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    let denied = (error as? CLError)?.code == .denied
    Task { @MainActor in
      fix?.resume(throwing: denied ? Failure.denied : Failure.failed)
      fix = nil
    }
  }
}
