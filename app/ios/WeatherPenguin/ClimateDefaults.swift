import CoreLocation
import WeatherKit

/// 1.3's clothing temperatures (45, 68 and 90 °F) suit a mild climate like San Francisco's. People used to a hot
/// climate reach for a jacket sooner, and people used to a cold one later. The adaptive comfort model (ASHRAE 55)
/// puts that at about 0.31° of comfortable temperature per degree of local average. So the first time the app knows
/// where it is, and only if the person has never set the temperatures (here or in iCloud), it moves the three
/// defaults by that much for the place's yearly average from WeatherKit. Needs iOS 18 (WeatherKit statistics);
/// before that, or if the request fails, 1.3's defaults stay.
enum ClimateDefaults {
  /// °C: San Francisco's yearly average, the climate 1.3's defaults were made for
  static let reference = 14.0
  static let rate = 0.31
  static let maxShift = 5.0

  /// How far to move the defaults (°C), to the nearest half degree: about +4 in Singapore, -2.5 in Oslo.
  static func shift(forYearlyMean mean: Double) -> Double {
    let s = min(maxShift, max(-maxShift, rate * (mean - reference)))
    return (s * 2).rounded() / 2
  }

  /// The place's yearly average temperature (°C): the mean of each month's average high and low.
  @available(iOS 18, *)
  static func yearlyMean(at location: CLLocation) async throws -> Double? {
    let stats = try await WeatherService.shared.monthlyStatistics(for: location, including: .temperature)
    let months = stats.months.map {
      ($0.averageHighTemperature.converted(to: .celsius).value + $0.averageLowTemperature.converted(to: .celsius).value) / 2
    }
    return months.isEmpty ? nil : months.reduce(0, +) / Double(months.count)
  }
}
