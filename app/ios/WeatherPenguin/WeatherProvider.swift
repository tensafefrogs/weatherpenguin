import CoreLocation
import WeatherKit

/// Fetches from Apple WeatherKit and converts to the JSON the web UI reads
/// (see web/app/samples.js for the shape). Temperatures in °C.
enum WeatherProvider {
  static func payload(for location: CLLocation) async throws -> [String: Any] {
    let service = WeatherService.shared
    let (current, hourly, daily) = try await service.weather(for: location, including: .current, .hourly, .daily)
    let attribution = try? await service.attribution
    let now = Date()
    let today = Calendar.current.startOfDay(for: now)

    let hours = hourly.forecast
      .filter { $0.date > now.addingTimeInterval(-3600) }
      .prefix(24)
      .map { hour -> [String: Any] in
        [
          "date": iso(hour.date),
          "temperature": celsius(hour.temperature),
          "precipitationChance": hour.precipitationChance,
          "precipitationType": name(hour.precipitation),
        ]
      }

    let days = daily.forecast
      .filter { $0.date >= today.addingTimeInterval(-3600) }
      .prefix(3)
      .map { day -> [String: Any] in
        [
          "date": iso(day.date),
          "high": celsius(day.highTemperature),
          "low": celsius(day.lowTemperature),
          "precipitationChance": day.precipitationChance,
          "precipitationType": name(day.precipitation),
          "condition": day.condition.description,
          "conditionCode": day.condition.rawValue,
        ]
      }

    var payload: [String: Any] = [
      "asOf": iso(current.date),
      "current": [
        "temperature": celsius(current.temperature),
        "condition": current.condition.description,
        "conditionCode": current.condition.rawValue,
        // mm per hour
        "precipitationIntensity": current.precipitationIntensity.converted(to: .metersPerSecond).value * 3_600_000,
      ],
      "hourly": Array(hours),
      "daily": Array(days),
    ]
    if let attribution {
      payload["attribution"] = [
        "markLight": attribution.combinedMarkLightURL.absoluteString,
        "markDark": attribution.combinedMarkDarkURL.absoluteString,
        "legal": attribution.legalPageURL.absoluteString,
      ]
    }
    return payload
  }

  private static func celsius(_ t: Measurement<UnitTemperature>) -> Double {
    t.converted(to: .celsius).value
  }

  private static func iso(_ date: Date) -> String {
    ISO8601DateFormatter().string(from: date)
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
}
