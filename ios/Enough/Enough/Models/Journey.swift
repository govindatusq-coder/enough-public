import Foundation

/// Mirrors `lib/journey.ts`. The JSON shape is the web account format
/// (`enough.stage2.v1`), so exports and cloud snapshots are interchangeable.

struct PinGroup {
    let key: PinCategory
    let title: String
    let description: String
    let options: [String]
}

enum PinCategory: String, CaseIterable, Codable {
    case preferences, interests, needs, strengths
}

enum Pins {
    static let groups: [PinGroup] = [
        PinGroup(key: .preferences, title: "How do you like things?", description: "Choose what feels comfortable. You can change this later.", options: ["Outside", "Indoors", "Alone", "With someone", "Quiet", "Music", "Morning", "Afternoon", "Evening", "Planned", "Spontaneous", "Short bursts", "Take my time", "Familiar places", "New places"]),
        PinGroup(key: .interests, title: "What do you enjoy?", description: "Start with things that already make your day better.", options: ["Podcasts", "Music", "Coffee", "Family time", "Friends / talking", "Nature", "Animals", "Shopping / browsing", "Photography", "Exploring new places", "Learning", "Gardening", "Making things", "Audiobooks", "TV / streaming", "Sport", "Food", "Markets", "Community activities", "Creative hobbies", "Reading", "Gaming", "Listening to something", "Solving problems"]),
        PinGroup(key: .needs, title: "What should we work around?", description: "Your needs set the boundaries. Choose any that fit, or “Nothing to add”.", options: ["Not enough time", "Save money", "Low energy / tired", "Family or caring", "Work / shifts", "Need recovery", "Safety matters", "Weather / heat", "Hard to walk where I live", "Physical comfort / accessibility", "Need flexibility", "Already active at work", "Sleep matters", "Pain / discomfort", "Unpredictable day", "Transport limitations", "Money is tight", "Privacy matters", "I don’t enjoy exercise"]),
        PinGroup(key: .strengths, title: "What already works for you?", description: "There is no right answer. Start with a strength you recognise.", options: ["I keep routines", "I like getting things done", "I walk when there’s a reason", "I enjoy company", "I can do things independently", "I like exploring", "I solve problems", "I care for others", "I know my neighbourhood", "I use public transport", "I’m already on my feet", "I’m willing to try small changes", "I know what works for me", "I enjoy learning", "I’m good at planning", "I adapt when plans change", "I have supportive people", "I like challenges", "I notice patterns"])
    ]
    static let activityOptions = ["Mostly seated", "On my feet", "A mix of both", "Every day is different"]
    static let rhythmOptions = ["Work or study", "School run", "Calls", "Takeaway", "Groceries", "Podcasts or music", "Caring for someone", "Household tasks", "No regular routine"]
    static let windowOptions = ["Morning", "Daytime", "Evening", "It varies"]
    static let visualOptions = ["City streets", "Suburban neighbourhoods", "Small towns", "Country settings", "Coastal places", "Mix it up"]
    static let customPrefix = "Something else: "
}

struct Profile: Codable, Equatable {
    var sittingContexts: [String]?
    var country: String?
    var name: String = ""
    var preferences: [String] = []
    var interests: [String] = []
    var needs: [String] = []
    var strengths: [String] = []
    var activity: String = ""
    var rhythms: [String] = []
    var window: String = ""
    var currency: String = "AUD"
    var visual: [String] = []
    var complete: Bool = false

    subscript(category: PinCategory) -> [String] {
        get {
            switch category {
            case .preferences: return preferences
            case .interests: return interests
            case .needs: return needs
            case .strengths: return strengths
            }
        }
        set {
            switch category {
            case .preferences: preferences = newValue
            case .interests: interests = newValue
            case .needs: needs = newValue
            case .strengths: strengths = newValue
            }
        }
    }

    /// `completeProfile()` in the web.
    var isComplete: Bool {
        PinCategory.allCases.allSatisfy { !self[$0].isEmpty } && !activity.isEmpty && !rhythms.isEmpty && !window.isEmpty
    }

    var hasFreeTextNeed: Bool { needs.contains { $0.hasPrefix(Pins.customPrefix) } }
}

enum EntryStatus: String, Codable { case accepted, completed, notToday = "not-today" }
enum PlanMoment: String, Codable, CaseIterable {
    case yes, differentTime = "different-time", no
    var label: String { self == .yes ? "Yes" : self == .no ? "No" : "Different time" }
}
enum BrokeSitting: String, Codable, CaseIterable { case yes, no, unsure }
enum AdditionalMovement: String, Codable, CaseIterable { case more, same, less, unsure }

struct MovementWindow: Codable, Equatable {
    var start: String
    var end: String?
}

struct Entry: Codable, Identifiable, Equatable {
    var id: String
    var ideaId: Int
    var status: EntryStatus
    var acceptedAt: String
    var completedAt: String?
    var minutes: Int?
    var outside: Bool?
    var connecting: Bool?
    var worthwhile: Bool?
    var moneyCents: Int?
    var currency: String
    var support: SupportPlan?
    var companions: [Companion]?
    var predicted: [ValueType]?
    var gave: [ValueType]?
    var timeCombined: Int?
    var movementWindow: MovementWindow?
    var movementEvidence: MovementEvidence?
    var planMoment: PlanMoment?
    var brokeSitting: BrokeSitting?
    var additionalMovement: AdditionalMovement?

    var completedDate: Date? { completedAt.flatMap(ISO.date) }
}

struct TodayNote: Codable, Equatable {
    var date: String = ""
    var context: String = ""
}

struct Pass: Codable, Equatable {
    var ideaId: Int
    var at: String
}

enum TravelHabit: String, Codable, CaseIterable {
    case walk, drive, transit, varies
    var label: String {
        switch self {
        case .walk: return "Walk already"
        case .drive: return "Drive"
        case .transit: return "Public transport"
        case .varies: return "It varies / not set"
        }
    }
}

struct Tuning: Codable, Equatable {
    var extraMinutes: Int = 15
    var travel: TravelHabit = .varies
    var hidden: [Int] = []
}

struct AppState: Codable, Equatable {
    var version: Int = 1
    var weeklyReviews: [WeeklyReview]?
    var aiConsent: AIConsent?
    var costs: [Cost]?
    var movementSettings: MovementSettings?
    var profile: Profile = Profile()
    var saved: [Int] = []
    var entries: [Entry] = []
    var demo: Bool = false
    var today: TodayNote = TodayNote()
    var generated: [Idea]?
    var passes: [Pass]?
    var tuning: Tuning?

    static let empty = AppState()

    var tuningOrDefault: Tuning { tuning ?? Tuning() }
    var allIdeas: [Idea] { Catalogue.ideas + (generated ?? []) }
    func idea(_ id: Int) -> Idea { Catalogue.byId(id, generated: generated ?? []) ?? Catalogue.ideas[0] }
    var plannedEntries: [Entry] { entries.filter { $0.status == .accepted } }

    /// Only ideas referenced by bookmarks, plans, outcomes or costs plus the
    /// most recent hundred generated ideas are written to the account.
    func accountSnapshot() -> AppState {
        guard let generated else { return self }
        var required = Set(saved)
        entries.forEach { required.insert($0.ideaId) }
        (costs ?? []).forEach { required.insert($0.ideaId) }
        let recent = Set(generated.suffix(100).map(\.id))
        var copy = self
        copy.generated = generated.filter { required.contains($0.id) || recent.contains($0.id) }
        return copy
    }
}

/// `localDate()` in the web: a calendar day in the device's timezone.
func localDate(_ date: Date = Date()) -> String {
    let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = .current; f.dateFormat = "yyyy-MM-dd"
    return f.string(from: date)
}

enum ISO {
    private static let fractional: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f }()
    private static let plain: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime]; return f }()
    /// JavaScript's `toISOString()` shape, so account JSON matches the web.
    static func string(_ date: Date = Date()) -> String { fractional.string(from: date) }
    static func date(_ text: String) -> Date? { fractional.date(from: text) ?? plain.date(from: text) }
}

struct Receipt {
    var rows: [Entry]
    var money: Int
    var outside: Int
    var connecting: Int
    var worthwhile: Int
}

enum ReturnPeriod: String, CaseIterable, Identifiable {
    case today = "Today", thisWeek = "This week", thisMonth = "This month", allTime = "All time"
    var id: String { rawValue }
}

enum Journey {
    static func periodStart(_ period: ReturnPeriod, now: Date) -> Date {
        let cal = Calendar.current
        var start = cal.startOfDay(for: now)
        switch period {
        case .today: break
        case .thisWeek:
            let weekday = cal.component(.weekday, from: start) // 1 = Sunday
            let back = (weekday + 5) % 7 // days since Monday
            start = cal.date(byAdding: .day, value: -back, to: start)!
        case .thisMonth:
            start = cal.date(from: cal.dateComponents([.year, .month], from: start))!
        case .allTime:
            start = Date(timeIntervalSince1970: 0)
        }
        return start
    }

    /// `receipt()` in the web.
    static func receipt(_ entries: [Entry], period: ReturnPeriod, currency: String, now: Date = Date()) -> Receipt {
        let start = periodStart(period, now: now)
        let rows = entries.filter { e in
            guard e.status == .completed, let d = e.completedDate else { return false }
            return d >= start && d <= now
        }
        return Receipt(rows: rows,
                       money: rows.filter { $0.currency == currency }.reduce(0) { $0 + ($1.moneyCents ?? 0) },
                       outside: rows.reduce(0) { $0 + (($1.outside ?? false) ? ($1.minutes ?? 0) : 0) },
                       connecting: rows.reduce(0) { $0 + (($1.connecting ?? false) ? ($1.minutes ?? 0) : 0) },
                       worthwhile: rows.filter { $0.worthwhile == true }.count)
    }

    /// `accept()` in the web. Records intent only.
    static func accept(_ s: AppState, ideaId: Int) -> AppState {
        guard s.demo, s.profile.isComplete else { return s }
        if s.entries.contains(where: { $0.ideaId == ideaId && $0.status == .accepted }) { return s }
        var next = s
        let idea = s.idea(ideaId)
        next.entries.append(Entry(id: UUID().uuidString.lowercased(), ideaId: ideaId, status: .accepted, acceptedAt: ISO.string(), currency: s.profile.currency, predicted: idea.promised))
        return next
    }

    struct Outcome {
        var minutes: Int
        var outside: Bool
        var connecting: Bool
        var worthwhile: Bool
        var moneyCents: Int
        var gave: [ValueType]?
        var timeCombined: Int?
        var additionalMovement: AdditionalMovement?
        var brokeSitting: BrokeSitting?
        var planMoment: PlanMoment?
    }

    /// `finish()` in the web.
    static func finish(_ s: AppState, entryId: String, outcome: Outcome) throws -> AppState {
        guard (0...240).contains(outcome.minutes), (0...100_000).contains(outcome.moneyCents) else { throw EnoughError.message("Check your minutes and saving.") }
        var next = s
        next.entries = s.entries.map { e in
            guard e.id == entryId, e.status == .accepted else { return e }
            var done = e
            done.status = .completed
            done.completedAt = ISO.string()
            done.minutes = outcome.minutes; done.outside = outcome.outside; done.connecting = outcome.connecting; done.worthwhile = outcome.worthwhile; done.moneyCents = outcome.moneyCents
            done.gave = outcome.gave; done.timeCombined = outcome.timeCombined; done.additionalMovement = outcome.additionalMovement; done.brokeSitting = outcome.brokeSitting; done.planMoment = outcome.planMoment
            return done
        }
        return next
    }

    /// `restore()`-equivalent sanity checks for a decoded state.
    static func validate(_ s: AppState) throws -> AppState {
        guard s.version == 1 else { throw EnoughError.message("Stored preview could not be read.") }
        guard Regions.currencyCodes.contains(s.profile.currency) else { throw EnoughError.message("Stored preview could not be read.") }
        for id in s.saved where Catalogue.byId(id, generated: s.generated ?? []) == nil { throw EnoughError.message("Stored preview could not be read.") }
        for e in s.entries {
            guard Catalogue.byId(e.ideaId, generated: s.generated ?? []) != nil, Regions.currencyCodes.contains(e.currency) else { throw EnoughError.message("Stored moves could not be read.") }
            if e.status == .completed {
                guard let m = e.minutes, (0...240).contains(m), let money = e.moneyCents, (0...100_000).contains(money), e.completedAt != nil, e.outside != nil, e.connecting != nil, e.worthwhile != nil else { throw EnoughError.message("Stored moves could not be read.") }
            }
        }
        var copy = s
        copy.profile.complete = s.profile.isComplete
        return copy
    }
}

enum EnoughError: LocalizedError {
    case message(String)
    var errorDescription: String? { if case .message(let m) = self { return m }; return nil }
}

enum Onboarding {
    /// `resumeSetup()`: which step to open when editing or continuing a profile.
    static func resumeStep(_ p: Profile) -> Int {
        if p.isComplete { return 0 }
        let categories = PinCategory.allCases
        if p.name.isEmpty && !categories.contains(where: { !p[$0].isEmpty }) && p.activity.isEmpty && p.rhythms.isEmpty && p.window.isEmpty { return 0 }
        if let missing = categories.firstIndex(where: { p[$0].isEmpty }) { return missing + 1 }
        return 5
    }

    static func instruction(step: Int) -> String {
        if (1...4).contains(step) { return "Choose at least one answer. “Nothing to add” is an answer too." }
        if step == 5 { return "Answer all three routine questions. “Every day is different”, “No regular routine” and “It varies” are valid choices." }
        return ""
    }
}
