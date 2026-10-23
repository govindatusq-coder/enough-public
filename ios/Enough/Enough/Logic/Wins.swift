import Foundation

/// Mirrors `lib/wins.ts` and `lib/dashboard.ts`. Only confirmed outcomes count.
enum MomentFilter: String, CaseIterable, Identifiable {
    case all = "All", outside = "Outside", withFamily = "With family", together = "Together", everydayTasks = "Everyday tasks", workDay = "Work day", worthwhile = "Worthwhile"
    var id: String { rawValue }
}

struct ActivityDay: Identifiable {
    let date: String, label: String, count: Int, today: Bool, future: Bool
    var id: String { date }
}

struct DashboardActivity {
    var pinsAnswered: Int, routinesAnswered: Int, today: Int, todayMinutes: Int, planned: Int, month: Int
    var days: [ActivityDay], activeDays: Int, confirmed: Int, worthwhile: Int, worthwhileOutside: Int, worthwhileTogether: Int
}

struct Milestone: Identifiable {
    let key: String, title: String, description: String, earnedAt: String?
    var id: String { key }
}

struct TopMoment: Identifiable {
    var ideaId: Int, entryId: String, worthwhile: Int, minutes: Int, money: [String: Int], latest: String
    var id: Int { ideaId }
}

struct MonthDay: Identifiable {
    let date: String, number: Int, count: Int, today: Bool, future: Bool
    var id: String { date }
}

struct MonthCollection {
    var label: String, offset: Int, days: [MonthDay], total: Int, activeDays: Int
}

struct MonthCount: Identifiable {
    let key: String, label: String, count: Int, current: Bool
    var id: String { key }
}

enum Wins {
    static func confirmed(_ entries: [Entry], now: Date = Date()) -> [Entry] {
        entries.filter { e in e.status == .completed && (e.completedDate.map { $0 <= now } ?? false) }
            .sorted { ($0.completedDate ?? .distantPast) > ($1.completedDate ?? .distantPast) }
    }

    static func filterMoments(_ entries: [Entry], filter: MomentFilter, query: String, generated: [Idea], day: String?, now: Date = Date()) -> [Entry] {
        let terms = query.trimmingCharacters(in: .whitespaces).lowercased().split(separator: " ").map(String.init)
        return confirmed(entries, now: now).filter { e in
            if let day, e.completedDate.map(localDate) != day { return false }
            let idea = Catalogue.byId(e.ideaId, generated: generated)
            let text = ([idea?.title ?? "Confirmed move"] + (e.companions ?? []).map(\.name)).joined(separator: " ").lowercased()
            if !terms.allSatisfy({ text.contains($0) }) { return false }
            switch filter {
            case .outside: return e.outside == true
            case .together: return e.connecting == true
            case .withFamily: return idea?.category == .family
            case .everydayTasks: return (e.gave ?? []).contains(.taskCompleted) || [IdeaCategory.chores, .errand, .shopping].contains(idea?.category ?? .other)
            case .workDay: return idea?.category == .work
            case .worthwhile: return e.worthwhile == true
            case .all: return true
            }
        }
    }

    static func artwork(_ idea: Idea?) -> String {
        guard let idea else { return "Outside" }
        if idea.movementMode == "seated" || idea.movementMode == "stretch" { return "Physical comfort / accessibility" }
        if idea.category == .listen { return idea.key.contains("music") ? "Music" : idea.key.contains("audiobook") ? "Audiobooks" : "Podcasts" }
        if idea.key.contains("garden") { return "Gardening" }
        if idea.key.contains("photo") { return "Photography" }
        if idea.key.contains("dog") { return "Animals" }
        switch idea.category {
        case .call: return "Calls"
        case .family: return "Family time"
        case .work: return "Work or study"
        case .chores: return "Household tasks"
        case .think: return "Solving problems"
        case .waiting: return "Short bursts"
        default: return "Outside"
        }
    }

    static func collectionMonths(_ entries: [Entry], now: Date = Date()) -> [String] {
        var months = Set([String(localDate(now).prefix(7))])
        for e in confirmed(entries, now: now) { if let d = e.completedDate { months.insert(String(localDate(d).prefix(7))) } }
        return months.sorted().reversed()
    }

    static func monthCollection(_ entries: [Entry], month: String, now: Date = Date()) -> MonthCollection {
        let cal = Calendar.current
        let parts = month.split(separator: "-").compactMap { Int($0) }
        let year = parts.first ?? cal.component(.year, from: now), number = parts.count > 1 ? parts[1] : cal.component(.month, from: now)
        let start = cal.date(from: DateComponents(year: year, month: number, day: 1)) ?? now
        let length = cal.range(of: .day, in: .month, for: start)?.count ?? 30
        let rows = confirmed(entries, now: now).filter { $0.completedDate.map { localDate($0).hasPrefix(month + "-") } ?? false }
        let days = (0..<length).map { index -> MonthDay in
            let date = cal.date(byAdding: .day, value: index, to: start)!, key = localDate(date)
            return MonthDay(date: key, number: index + 1, count: rows.filter { $0.completedDate.map(localDate) == key }.count, today: key == localDate(now), future: date > now)
        }
        let f = DateFormatter(); f.dateFormat = "LLLL yyyy"
        return MonthCollection(label: f.string(from: start), offset: (cal.component(.weekday, from: start) + 5) % 7, days: days, total: rows.count, activeDays: days.filter { $0.count > 0 }.count)
    }

    static func milestones(_ entries: [Entry], now: Date = Date()) -> [Milestone] {
        let rows = Array(confirmed(entries, now: now).reversed())
        return [
            Milestone(key: "first", title: "A first moment", description: "Your first confirmed move", earnedAt: rows.first?.completedAt),
            Milestone(key: "combined", title: "Time combined", description: "Movement alongside an existing task", earnedAt: rows.first { ($0.timeCombined ?? 0) > 0 }?.completedAt),
            Milestone(key: "connection", title: "Room for connection", description: "You reported time connecting", earnedAt: rows.first { $0.connecting == true && ($0.minutes ?? 0) > 0 }?.completedAt),
            Milestone(key: "money", title: "Money kept", description: "You confirmed a real saving", earnedAt: rows.first { ($0.moneyCents ?? 0) > 0 }?.completedAt)
        ]
    }

    static func topWorthwhile(_ entries: [Entry], now: Date = Date()) -> [TopMoment] {
        var groups: [Int: TopMoment] = [:]
        for e in confirmed(entries, now: now) where e.worthwhile == true {
            var group = groups[e.ideaId] ?? TopMoment(ideaId: e.ideaId, entryId: e.id, worthwhile: 0, minutes: 0, money: [:], latest: e.completedAt ?? "")
            group.worthwhile += 1; group.minutes += e.minutes ?? 0; group.money[e.currency, default: 0] += e.moneyCents ?? 0
            groups[e.ideaId] = group
        }
        return Array(groups.values.sorted { a, b in
            if a.worthwhile != b.worthwhile { return a.worthwhile > b.worthwhile }
            if a.latest != b.latest { return a.latest > b.latest }
            return a.ideaId < b.ideaId
        }.prefix(3))
    }

    static func recentMonths(_ entries: [Entry], now: Date = Date()) -> [MonthCount] {
        let cal = Calendar.current, rows = confirmed(entries, now: now)
        let f = DateFormatter(); f.dateFormat = "LLL"
        return (0..<5).map { index in
            let date = cal.date(byAdding: .month, value: -4 + index, to: cal.date(from: cal.dateComponents([.year, .month], from: now))!)!
            let key = String(localDate(date).prefix(7))
            return MonthCount(key: key, label: f.string(from: date), count: rows.filter { $0.completedDate.map { localDate($0).hasPrefix(key + "-") } ?? false }.count, current: index == 4)
        }
    }

    /// `dashboardActivity()` in `lib/dashboard.ts`.
    static func dashboardActivity(_ state: AppState, now: Date = Date()) -> DashboardActivity {
        let rows = confirmed(state.entries, now: now)
        let today = Journey.receipt(rows, period: .today, currency: state.profile.currency, now: now)
        let monday = Journey.periodStart(.thisWeek, now: now), cal = Calendar.current
        let days = (0..<7).map { index -> ActivityDay in
            let date = cal.date(byAdding: .day, value: index, to: monday)!, key = localDate(date)
            return ActivityDay(date: key, label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index], count: rows.filter { $0.completedDate.map(localDate) == key }.count, today: key == localDate(now), future: date > now)
        }
        return DashboardActivity(
            pinsAnswered: PinCategory.allCases.filter { !state.profile[$0].isEmpty }.count,
            routinesAnswered: [!state.profile.activity.isEmpty, !state.profile.rhythms.isEmpty, !state.profile.window.isEmpty].filter { $0 }.count,
            today: today.rows.count, todayMinutes: today.rows.reduce(0) { $0 + ($1.minutes ?? 0) },
            planned: state.entries.filter { $0.status == .accepted && (ISO.date($0.acceptedAt).map { $0 <= now } ?? true) }.count,
            month: Journey.receipt(rows, period: .thisMonth, currency: state.profile.currency, now: now).rows.count,
            days: days, activeDays: days.filter { $0.count > 0 }.count,
            confirmed: rows.count, worthwhile: rows.filter { $0.worthwhile == true }.count,
            worthwhileOutside: rows.filter { $0.worthwhile == true && $0.outside == true }.count,
            worthwhileTogether: rows.filter { $0.worthwhile == true && $0.connecting == true }.count)
    }

    /// `previousReturns()`: the whole previous calendar period, labelled explicitly.
    static func previousReturns(_ entries: [Entry], period: ReturnPeriod, currency: String, now: Date = Date()) -> (label: String, money: Int)? {
        if period == .allTime { return nil }
        let cal = Calendar.current
        let end = Journey.periodStart(period, now: now)
        let start: Date = period == .today ? cal.date(byAdding: .day, value: -1, to: end)! : period == .thisWeek ? cal.date(byAdding: .day, value: -7, to: end)! : cal.date(byAdding: .month, value: -1, to: end)!
        let rows = confirmed(entries, now: now).filter { e in e.currency == currency && (e.completedDate.map { $0 >= start && $0 < end } ?? false) }
        guard !rows.isEmpty else { return nil }
        return (period == .today ? "Yesterday" : period == .thisWeek ? "Last week" : "Last month", rows.reduce(0) { $0 + ($1.moneyCents ?? 0) })
    }

    static func returnCurrencies(_ state: AppState, now: Date = Date()) -> [String] {
        var seen: [String] = [state.profile.currency]
        for e in confirmed(state.entries, now: now) where !seen.contains(e.currency) { seen.append(e.currency) }
        return seen
    }

    static func durationLabel(_ minutes: Int) -> String {
        minutes < 60 ? "\(minutes) min" : "\(minutes / 60)h" + (minutes % 60 != 0 ? " \(minutes % 60)m" : "")
    }

    static func momentDateLabel(_ at: String, now: Date = Date()) -> String {
        guard let date = ISO.date(at) else { return "" }
        let cal = Calendar.current
        let days = cal.dateComponents([.day], from: cal.startOfDay(for: date), to: cal.startOfDay(for: now)).day ?? 0
        if days == 0 { return "Today" }
        if days == 1 { return "Yesterday" }
        if days > 1 && days < 7 { return "\(days) days ago" }
        let f = DateFormatter(); f.dateFormat = cal.component(.year, from: date) == cal.component(.year, from: now) ? "d MMM" : "d MMM yyyy"
        return f.string(from: date)
    }
}
