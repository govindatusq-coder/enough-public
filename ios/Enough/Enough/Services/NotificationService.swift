import Foundation
import UserNotifications

/// Local reminders for support plans. The website can only show a note while
/// it is open; the app can also deliver one when it is closed, with permission.
enum NotificationService {
    static func requestPermission() async -> Bool {
        (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])) ?? false
    }

    static func schedule(entryId: String, title: String, at date: Date) async {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [entryId])
        guard date > Date(), await requestPermission() else { return }
        let content = UNMutableNotificationContent()
        content.title = "Your requested reminder"
        content.body = "\(title) · only if it still fits your day."
        content.sound = .default
        let components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: date)
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
        try? await center.add(UNNotificationRequest(identifier: entryId, content: content, trigger: trigger))
    }

    static func cancel(entryId: String) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [entryId])
    }
}
