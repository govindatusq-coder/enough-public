import Foundation

/// Mirrors `lib/move-support.ts`. Every field is kept so a plan written on the
/// website round-trips through the app unchanged.
enum GoalType: String, Codable { case open, smart }
enum ReminderKind: String, Codable { case none, inApp = "in-app", calendar }

struct SupportPlan: Codable, Equatable {
    var routineAnchor: String?
    var paused: Bool?
    var goalType: GoalType = .open
    var goal: String = ""
    var target: String = ""
    var reason: String = ""
    var deadline: String = ""
    var confidence: String = ""
    var when: String = ""
    var cue: String = ""
    var place: String = ""
    var placeType: String = "Familiar streets"
    var barriers: [String] = []
    var fallback: String = ""
    var prep: [String] = []
    var commitment: String = "Keep it private"
    var buddy: String = ""
    var qrMeet: Bool?
    var reward: String = ""
    var reminder: ReminderKind = .none
    var remindAt: String = ""
    var reminderDismissed: Bool?
    var updatedAt: String = ""

    /// `newPlan()` in the web.
    static func new(ideaId: Int, title: String) -> SupportPlan {
        var plan = SupportPlan()
        plan.goal = ideaId == 0 ? "Explore whether collecting dinner on foot fits my evening." : ideaId == 1 ? "See how a short walk feels during a family call." : "Explore whether \(title.lowercased()) fits my day."
        return plan
    }

    static let barrierTips: [(String, String)] = [
        ("Not enough time", "Try a smaller version inside the time you already have. Decide what you will leave out, rather than adding another task."),
        ("Low energy", "Make the first step smaller. You can shorten, adapt or leave the move for another day."),
        ("Weather", "Choose a sheltered or indoor alternative, or another time. Check actual conditions before leaving."),
        ("Access or discomfort", "Choose a familiar, accessible option that works for you. A seated call or a comfortable indoor alternative is valid."),
        ("Forgetting", "Attach the move to something already happening: finishing work, starting a call, or collecting dinner."),
        ("Caring responsibilities", "Use an existing gap or agree cover beforehand. Avoid making a plan that depends on leaving someone unsupported."),
        ("Feeling awkward", "Try a familiar place, a quieter moment or someone you feel comfortable with."),
        ("Cost or transport", "Check the actual route and costs before committing. Skip it if the trip would cost more than it gives back.")
    ]

    static func tip(for barrier: String) -> String { barrierTips.first { $0.0 == barrier }?.1 ?? "" }

    /// The reminder time as a `Date`. Web plans store a local `YYYY-MM-DDTHH:mm`
    /// string; the app stores the same shape so both clients agree.
    var remindDate: Date? { SupportPlan.parseLocal(remindAt) }
    var deadlineDate: Date? { SupportPlan.parseLocal(deadline) }

    static func parseLocal(_ text: String) -> Date? {
        if text.isEmpty { return nil }
        if let d = ISO.date(text) { return d }
        let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = .current
        for format in ["yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd'T'HH:mm"] { f.dateFormat = format; if let d = f.date(from: text) { return d } }
        return nil
    }

    static func localString(_ date: Date) -> String {
        let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = .current; f.dateFormat = "yyyy-MM-dd'T'HH:mm"
        return f.string(from: date)
    }

    /// `planError()` in the web: an empty string means the plan can be saved.
    func validationError(now: Date = Date()) -> String {
        if goal.trimmingCharacters(in: .whitespaces).isEmpty { return "Add a goal in your own words." }
        if goalType == .smart && (target.trimmingCharacters(in: .whitespaces).isEmpty || reason.trimmingCharacters(in: .whitespaces).isEmpty || deadline.isEmpty || confidence.isEmpty) { return "For a clear target, add a measure, a reason, a date and an achievable size." }
        if goalType == .smart && deadlineDate == nil { return "Choose a valid date for your target." }
        if reminder != .none {
            guard let at = remindDate, at > now else { return "Choose a future reminder time, or turn reminders off." }
        }
        return ""
    }

    /// `calendarEvent()` in the web: a small ICS file with a display alarm.
    func calendarEvent(title: String, id: String) throws -> String {
        guard let start = remindDate else { throw EnoughError.message("Choose a reminder date.") }
        func escape(_ s: String) -> String {
            s.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\r\n", with: "\\n").replacingOccurrences(of: "\n", with: "\\n").replacingOccurrences(of: ";", with: "\\;").replacingOccurrences(of: ",", with: "\\,")
        }
        let stamp: (Date) -> String = { d in
            let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = TimeZone(identifier: "UTC"); f.dateFormat = "yyyyMMdd'T'HHmmss'Z'"
            return f.string(from: d)
        }
        let description = goal + "\n" + (cue.isEmpty ? "" : "After \(cue). ") + (fallback.isEmpty ? "" : "If plans change: \(fallback)")
        let lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ENOUGH//Move Support//EN", "BEGIN:VEVENT", "UID:\(id)@enough.local", "DTSTAMP:\(stamp(Date()))", "DTSTART:\(stamp(start))", "DTEND:\(stamp(start.addingTimeInterval(15 * 60)))", "SUMMARY:\(escape(title))", "DESCRIPTION:\(escape(description))", "LOCATION:\(escape(place))", "BEGIN:VALARM", "TRIGGER:PT0M", "ACTION:DISPLAY", "DESCRIPTION:Your ENOUGH plan", "END:VALARM", "END:VEVENT", "END:VCALENDAR"]
        return lines.map { line -> String in
            var result = "", chunk = "", bytes = 0
            for ch in line {
                let n = String(ch).utf8.count
                if bytes + n > 73 { result += chunk + "\r\n "; chunk = ""; bytes = 1 }
                chunk.append(ch); bytes += n
            }
            return result + chunk
        }.joined(separator: "\r\n")
    }
}
