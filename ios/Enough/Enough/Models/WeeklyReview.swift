import Foundation

/// Mirrors `lib/weekly-review.ts`.
enum PlanChoice: String, Codable, CaseIterable {
    case keep, change, pause
    var label: String { rawValue.capitalized }
}

struct ReviewedPlan: Codable, Equatable {
    var entryId: String
    var choice: PlanChoice
}

struct WeeklyReview: Codable, Equatable {
    var week: String
    var reviewedAt: String
    var worked: String
    var barrier: String
    var smallFix: String
    var plans: [ReviewedPlan]
}

enum WeeklyReviews {
    /// `localWeek()`: the local Monday of the week containing `now`.
    static func localWeek(_ now: Date = Date()) -> String {
        let cal = Calendar.current
        var start = cal.date(bySettingHour: 12, minute: 0, second: 0, of: now) ?? now
        let back = (cal.component(.weekday, from: start) + 5) % 7
        start = cal.date(byAdding: .day, value: -back, to: start) ?? start
        return localDate(start)
    }

    static func activePlans(_ state: AppState) -> [Entry] {
        state.entries.filter { $0.status == .accepted && $0.support != nil && $0.support?.paused != true }
    }

    static func save(_ state: AppState, worked: String, barrier: String, smallFix: String, plans: [ReviewedPlan], now: Date = Date()) throws -> AppState {
        for text in [worked, barrier, smallFix] where text.count > 240 { throw EnoughError.message("Keep each note to 240 characters.") }
        let active = Set(activePlans(state).map(\.id))
        if plans.contains(where: { !active.contains($0.entryId) }) { throw EnoughError.message("A plan has changed. Reopen the review to use the current plans.") }
        if Set(plans.map(\.entryId)).count != plans.count { throw EnoughError.message("Choose each plan once.") }
        let review = WeeklyReview(week: localWeek(now), reviewedAt: ISO.string(now), worked: worked.trimmingCharacters(in: .whitespacesAndNewlines), barrier: barrier.trimmingCharacters(in: .whitespacesAndNewlines), smallFix: smallFix.trimmingCharacters(in: .whitespacesAndNewlines), plans: plans)
        var next = state
        next.weeklyReviews = (state.weeklyReviews ?? []).filter { $0.week != review.week } + [review]
        let paused = Set(plans.filter { $0.choice == .pause }.map(\.entryId))
        next.entries = state.entries.map { e in
            guard paused.contains(e.id), var support = e.support else { return e }
            support.paused = true; support.reminderDismissed = true; support.updatedAt = review.reviewedAt
            var copy = e; copy.support = support; return copy
        }
        return next
    }
}
