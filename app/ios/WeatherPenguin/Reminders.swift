import UserNotifications

/// The optional morning notification (Settings → Morning penguin). The page sends the next ones with
/// their text in the user's language (web/app/morning.js) each time it gets a forecast, and these
/// replace whatever was scheduled. Local notifications only: nothing goes through a server.
@MainActor
enum Reminders {
  nonisolated private static let prefix = "morning-"
  /// Counts calls, so an earlier call that finishes late doesn't schedule over a later one (turning it off, say).
  private static var generation = 0

  /// items: [{date: "yyyy-MM-dd", time: "HH:mm", title, body, outfit}]. No time turns them off.
  /// Calls back on the main thread with whether notifications are allowed.
  static func schedule(time: String?, items: [[String: Any]], allowed: @escaping @MainActor (Bool) -> Void) {
    generation += 1
    let call = generation
    let center = UNUserNotificationCenter.current()
    center.getPendingNotificationRequests { pending in
      center.removePendingNotificationRequests(withIdentifiers: pending.map(\.identifier).filter { $0.hasPrefix(prefix) })
      guard time != nil else {
        Task { @MainActor in allowed(true) }
        return
      }
      center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
        Task { @MainActor in
          allowed(granted)
          guard granted, call == generation else { return }
          for item in items.prefix(4) {
            guard
              let date = item["date"] as? String, let at = item["time"] as? String,
              let title = item["title"] as? String, let body = item["body"] as? String
            else { continue }
            let d = date.split(separator: "-").compactMap { Int($0) }
            let t = at.split(separator: ":").compactMap { Int($0) }
            guard d.count == 3, t.count == 2 else { continue }
            let content = UNMutableNotificationContent()
            content.title = title
            content.body = body
            content.sound = .default
            content.threadIdentifier = "morning"
            if let outfit = item["outfit"] as? String, let picture = penguin(outfit) { content.attachments = [picture] }
            let when = DateComponents(year: d[0], month: d[1], day: d[2], hour: t[0], minute: t[1])
            let trigger = UNCalendarNotificationTrigger(dateMatching: when, repeats: false)
            center.add(UNNotificationRequest(identifier: prefix + date, content: content, trigger: trigger))
          }
        }
      }
    }
  }

  /// The day's drawing (from the bundled web UI), shown with the notification. iOS moves an attachment's file into
  /// its own store, so a copy goes in.
  nonisolated private static func penguin(_ outfit: String) -> UNNotificationAttachment? {
    guard outfit.range(of: #"^[a-z_]+$"#, options: .regularExpression) != nil,
          let source = Bundle.main.url(forResource: outfit, withExtension: "png", subdirectory: "app/images")
    else { return nil }
    let copy = FileManager.default.temporaryDirectory.appendingPathComponent("penguin-\(UUID().uuidString).png")
    guard (try? FileManager.default.copyItem(at: source, to: copy)) != nil else { return nil }
    return try? UNNotificationAttachment(identifier: "penguin", url: copy)
  }
}
