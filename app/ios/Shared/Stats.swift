import Foundation

/// Anonymous usage counts from the native parts (widgets, the watch, Siri, the morning notification): the same
/// kind of GoatCounter event web/app/stats.js sends, an event name only, with nothing that identifies anyone.
/// Sent only when the build has a GoatCounter address (Info.plist WPGoatCounter, from the GOATCOUNTER_URL Actions
/// variable; empty in local and simulator builds). docs/STATS.md lists the events; web/privacy.html says what's counted.
enum Stats {
  private static let lock = NSLock()
  private static var sent = Set<String>()

  /// Counts an event, e.g. Stats.count("watch/open"). once: at most once per launch of this process.
  static func count(_ name: String, once: Bool = true) {
    guard
      let base = Bundle.main.object(forInfoDictionaryKey: "WPGoatCounter") as? String,
      base.hasPrefix("https://"), var url = URLComponents(string: base)
    else { return }
    if once {
      lock.lock()
      let first = sent.insert(name).inserted
      lock.unlock()
      guard first else { return }
    }
    url.queryItems = [
      URLQueryItem(name: "p", value: "weatherpenguin-ios/" + name),
      URLQueryItem(name: "t", value: name),
      URLQueryItem(name: "e", value: "true"),
      URLQueryItem(name: "rnd", value: String(Int.random(in: 0..<1_000_000))),
    ]
    guard let address = url.url else { return }
    var request = URLRequest(url: address, timeoutInterval: 10)
    // a browser-style user agent, as the app's web view sends, so GoatCounter doesn't take the count for a bot
    request.setValue("Mozilla/5.0 (iPhone; CPU iPhone OS like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile WeatherPenguin",
                      forHTTPHeaderField: "User-Agent")
    URLSession.shared.dataTask(with: request).resume()   // fire and forget: a lost count doesn't matter
  }
}
