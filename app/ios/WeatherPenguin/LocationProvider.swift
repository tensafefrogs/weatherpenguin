import CoreLocation
import MapKit

/// One-shot location, about 1 km accurate, as in v1.
@MainActor
final class LocationProvider: NSObject, CLLocationManagerDelegate {
  enum Failure: Error { case denied, failed }

  private let manager = CLLocationManager()
  private var authorization: CheckedContinuation<Void, Never>?
  private var fix: CheckedContinuation<CLLocation, Error>?

  override init() {
    super.init()
    manager.delegate = self
    manager.desiredAccuracy = kCLLocationAccuracyKilometer
  }

  func current() async throws -> CLLocation {
    if manager.authorizationStatus == .notDetermined {
      await withCheckedContinuation { continuation in
        authorization = continuation
        manager.requestWhenInUseAuthorization()
      }
    }
    switch manager.authorizationStatus {
    case .denied, .restricted: throw Failure.denied
    default: break
    }
    if let recent = manager.location, recent.timestamp.timeIntervalSinceNow > -10 * 60 { return recent }
    fix?.resume(throwing: Failure.failed)
    return try await withCheckedThrowingContinuation { continuation in
      fix = continuation
      manager.requestLocation()
    }
  }

  /// The city name, or nil. It's a nicety; the forecast works without it. MapKit's reverse geocoding from iOS 26;
  /// CLGeocoder, which it replaces (and which iOS 26 deprecates), on older versions. Apple's service either way,
  /// in the person's language.
  func placeName(for location: CLLocation) async -> String? {
    if #available(iOS 26, *) {
      guard let request = MKReverseGeocodingRequest(location: location),
            let item = try? await request.mapItems.first,
            let address = item.addressRepresentations
      else { return nil }
      return address.cityName ?? address.regionName
    }
    let marks = try? await CLGeocoder().reverseGeocodeLocation(location)
    return marks?.first.flatMap { $0.locality ?? $0.subAdministrativeArea ?? $0.administrativeArea }
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
