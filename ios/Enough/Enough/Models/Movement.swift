import Foundation

/// Mirrors `lib/movement.ts`. Daily readings never enter the saved state;
/// only an explicitly saved activity window becomes `MovementEvidence`.
enum MovementSource: String, Codable { case appleHealth = "apple-health", healthConnect = "health-connect" }
enum MovementMetric: String, Codable, CaseIterable {
    case steps, exerciseMinutes
    var label: String { self == .steps ? "Daily steps" : "Exercise Minutes" }
    var unit: String { self == .steps ? "steps" : "minutes" }
    var maximum: Int { self == .steps ? 100_000 : 1440 }
}
enum QuietChoice: String, Codable { case amount, none }

struct MovementDay: Codable, Equatable {
    var date: String
    var steps: Double?
    var exerciseMinutes: Double?
    func value(_ metric: MovementMetric) -> Double? { metric == .steps ? steps : exerciseMinutes }
}

struct MovementSnapshot: Codable, Equatable {
    var source: MovementSource
    var timezone: String
    var readAt: String
    var days: [MovementDay]
    var hasReadableRecords: Bool { days.contains { $0.steps != nil || $0.exerciseMinutes != nil } }
}

struct MovementEvidence: Codable, Equatable {
    var source: MovementSource
    var start: String
    var end: String
    var readAt: String
    var steps: Double?
    var exerciseMinutes: Double?

    enum CodingKeys: String, CodingKey { case source, start, end, readAt, steps, exerciseMinutes }
    init(source: MovementSource, start: String, end: String, readAt: String, steps: Double?, exerciseMinutes: Double?) {
        self.source = source; self.start = start; self.end = end; self.readAt = readAt; self.steps = steps; self.exerciseMinutes = exerciseMinutes
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        source = try c.decode(MovementSource.self, forKey: .source); start = try c.decode(String.self, forKey: .start); end = try c.decode(String.self, forKey: .end); readAt = try c.decode(String.self, forKey: .readAt)
        steps = try c.decodeIfPresent(Double.self, forKey: .steps); exerciseMinutes = try c.decodeIfPresent(Double.self, forKey: .exerciseMinutes)
    }
    /// The web schema requires both keys, with `null` for unreadable totals.
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(source, forKey: .source); try c.encode(start, forKey: .start); try c.encode(end, forKey: .end); try c.encode(readAt, forKey: .readAt)
        try c.encode(steps, forKey: .steps); try c.encode(exerciseMinutes, forKey: .exerciseMinutes)
    }
}

struct MovementSettings: Codable, Equatable {
    var metric: MovementMetric = .steps
    var threshold: Int?
    var quietChoice: QuietChoice?
    var keepSittingBreaksAfterEnough: Bool?

    enum CodingKeys: String, CodingKey { case metric, threshold, quietChoice, keepSittingBreaksAfterEnough }
    init(metric: MovementMetric = .steps, threshold: Int? = nil, quietChoice: QuietChoice? = nil, keepSittingBreaksAfterEnough: Bool? = nil) {
        self.metric = metric; self.threshold = threshold; self.quietChoice = quietChoice; self.keepSittingBreaksAfterEnough = keepSittingBreaksAfterEnough
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        metric = try c.decode(MovementMetric.self, forKey: .metric)
        threshold = try c.decodeIfPresent(Int.self, forKey: .threshold)
        quietChoice = try c.decodeIfPresent(QuietChoice.self, forKey: .quietChoice)
        keepSittingBreaksAfterEnough = try c.decodeIfPresent(Bool.self, forKey: .keepSittingBreaksAfterEnough)
    }
    /// `threshold` is required by the web schema and may be `null`.
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(metric, forKey: .metric)
        try c.encode(threshold, forKey: .threshold)
        try c.encodeIfPresent(quietChoice, forKey: .quietChoice)
        try c.encodeIfPresent(keepSittingBreaksAfterEnough, forKey: .keepSittingBreaksAfterEnough)
    }
}

enum Movement {
    /// `dateAt()`: the calendar day of `now` in the snapshot's timezone.
    static func dateAt(_ now: Date, timezone: String) -> String {
        let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = TimeZone(identifier: timezone) ?? .current; f.dateFormat = "yyyy-MM-dd"
        return f.string(from: now)
    }

    /// Median of at least seven readable days from the previous fortnight.
    static func suggestedThreshold(_ s: MovementSnapshot, metric: MovementMetric, now: Date = Date()) -> Int? {
        let today = dateAt(now, timezone: s.timezone)
        let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = TimeZone(identifier: "UTC"); f.dateFormat = "yyyy-MM-dd"
        guard let todayDate = f.date(from: today), let oldest = Calendar(identifier: .gregorian).date(byAdding: .day, value: -14, to: todayDate) else { return nil }
        let lower = f.string(from: oldest)
        var unique: [String: Double?] = [:]
        for d in s.days where d.date < today && d.date >= lower { unique[d.date] = d.value(metric) }
        let values = unique.values.compactMap { $0 }.filter { $0.isFinite && $0 >= 0 }.sorted()
        guard values.count >= 7 else { return nil }
        let middle = values.count / 2
        let median = values.count % 2 == 1 ? values[middle] : (values[middle - 1] + values[middle]) / 2
        return median > 0 ? max(1, Int(median.rounded())) : nil
    }

    /// Today's totals, only while the snapshot is at most fifteen minutes old.
    static func todayMovement(_ s: MovementSnapshot?, now: Date = Date()) -> MovementDay? {
        guard let s, let readAt = ISO.date(s.readAt) else { return nil }
        if readAt.timeIntervalSince(now) > 60 || now.timeIntervalSince(readAt) > 15 * 60 { return nil }
        let today = dateAt(now, timezone: s.timezone)
        return s.days.first { $0.date == today }
    }

    static func enoughToday(_ s: MovementSnapshot?, settings: MovementSettings, now: Date = Date()) -> Bool {
        guard settings.quietChoice != QuietChoice.none, let threshold = settings.threshold, let value = todayMovement(s, now: now)?.value(settings.metric) else { return false }
        return value >= Double(threshold)
    }

    /// New-suggestion surfaces quieten after the chosen amount; browsing stays open.
    static func suggestionsAfterEnough(_ ideas: [Idea], reached: Bool, settings: MovementSettings?) -> [Idea] {
        if !reached { return ideas }
        if settings?.keepSittingBreaksAfterEnough == false { return [] }
        return ideas.filter { $0.breaksSitting && $0.minutes >= 1 && $0.minutes <= 3 }
    }
}

enum HealthPermissionState: String {
    case notRequested, requested, readable, unconfirmed, stopped
    var label: String {
        switch self {
        case .notRequested: return "Not requested in this app session."
        case .requested: return "Permission requested. Waiting for a readable result."
        case .readable: return "Readable records returned. Only those data types can be confirmed; permissions may change in Settings → Health."
        case .unconfirmed: return "No readable result to confirm access. Your Health app may have no records, or permission may be off."
        case .stopped: return "Reading stopped in ENOUGH. Revoke health permission in Settings → Health if you want to."
        }
    }
}
