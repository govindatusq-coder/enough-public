import Foundation

/// Mirrors `lib/discovery.ts` and `lib/moves.ts`. Every control only narrows
/// the already eligible feed; nothing here can broaden PINS boundaries.
enum DiscoveryFilter: String, CaseIterable, Identifiable {
    case forYou = "For you", free = "Free", quickWins = "Quick wins", lowEnergy = "Low energy", outside = "Outside", withFamily = "With family", saveMoney = "Save money"
    var id: String { rawValue }
}

enum DashboardFilter: String, CaseIterable, Identifiable {
    case forYou = "For you", nearby = "Nearby", saveMoney = "Save money", withFamily = "With family", quickWins = "Quick wins", lowEnergy = "Low energy", surpriseMe = "Surprise me"
    var id: String { rawValue }
}

enum MoveFilter: String, CaseIterable, Identifiable {
    case forYou = "For you", nearMe = "Near me", free = "Free", saveMoney = "Save money", withFamily = "With family", nature = "Nature", quickWins = "Quick wins", lowEnergy = "Low energy", breaksUpSitting = "Breaks up sitting", strength = "Strength", briskBurst = "Brisk burst", surpriseMe = "Surprise me"
    var id: String { rawValue }
}

enum Setting: String, CaseIterable, Identifiable {
    case any, indoors, outside
    var id: String { rawValue }
    var label: String { self == .any ? "Any setting" : rawValue.capitalized }
}

struct MoveOptions: Equatable {
    var query = ""
    var maxMinutes = 0
    var setting: Setting = .any
    var gentle = false
    var category: IdeaCategory? = nil
    var noExtra = false
    var breaksSitting = false
    var intensity: IdeaIntensity? = nil
    static let `default` = MoveOptions()
}

struct MoveCollection: Identifiable {
    let key: String
    let title: String
    let art: String
    let image: String?
    let ideas: [Idea]
    let reason: String
    let personal: Bool
    var id: String { key }
}

enum Discovery {
    private static let freeKeys: Set<String> = [
        "call-family-walk", "call-pace-indoors", "call-friend-loop", "call-work-standing", "podcast-outside", "music-album-walk", "audiobook-chores", "problem-walk",
        "plan-week-walk", "decompress-walk", "playground-laps", "after-dinner-stroll", "video-call-overseas", "kids-garden-play", "laundry-stairs", "garden-podcast",
        "bins-loop", "walking-1on1", "break-stretch", "water-refill-far", "wait-appointment", "wait-pickup", "wait-laundry", "photo-walk", "dog-longer"
    ]
    static func isFreeMove(_ idea: Idea) -> Bool { idea.source == .library && freeKeys.contains(idea.key) }

    static func greeting(_ now: Date = Date()) -> String {
        let hour = Calendar.current.component(.hour, from: now)
        return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
    }

    static func filterIdeas(_ ideas: [Idea], filter: DiscoveryFilter, query: String, state: AppState) -> [Idea] {
        let terms = query.trimmingCharacters(in: .whitespaces).lowercased().split(separator: " ").map(String.init).filter { !$0.isEmpty }
        return ideas.filter { i in
            let text = ([i.title, i.body, i.category.rawValue, i.usual] + i.enjoy).joined(separator: " ").lowercased()
            if !terms.allSatisfy({ text.contains($0) }) { return false }
            switch filter {
            case .free: return isFreeMove(i)
            case .quickWins: return i.minutes <= 10
            case .lowEnergy: return i.effort == .gentle && i.minutes <= 15
            case .outside: return i.outdoor
            case .withFamily: return i.category == .family
            case .saveMoney: return (Recommendations.moneyValue(i, state)?.cents ?? 0) > 0
            case .forYou: return true
            }
        }
    }

    /// Free ideas for the home dashboard, one category first for variety.
    static func dashboardIdeas(_ ideas: [Idea], filter: DashboardFilter, state: AppState, query: String, maxMinutes: Int, setting: Setting, gentle: Bool) -> [Idea] {
        let selected: DiscoveryFilter = {
            switch filter {
            case .nearby, .surpriseMe, .forYou: return .forYou
            case .saveMoney: return .saveMoney
            case .withFamily: return .withFamily
            case .quickWins: return .quickWins
            case .lowEnergy: return .lowEnergy
            }
        }()
        let pool = filterIdeas(ideas.filter(isFreeMove), filter: selected, query: query, state: state).filter { i in
            (maxMinutes == 0 || i.minutes <= maxMinutes) && (setting == .any || i.outdoor == (setting == .outside)) && (!gentle || i.effort == .gentle)
        }
        var seen = Set<IdeaCategory>()
        let varied = pool.filter { seen.insert($0.category).inserted }
        return varied + pool.filter { v in !varied.contains { $0.id == v.id } }
    }

    static func surpriseIdeaId(_ ideas: [Idea], currentId: Int?) -> Int? {
        let alternatives = ideas.filter { $0.id != currentId }
        return alternatives.randomElement()?.id ?? ideas.first?.id
    }

    static func movesIdeas(_ ideas: [Idea], filter: MoveFilter, state: AppState, options: MoveOptions) -> [Idea] {
        let base: DiscoveryFilter = {
            switch filter {
            case .breaksUpSitting, .strength, .briskBurst, .nature, .forYou: return .forYou
            case .nearMe, .surpriseMe, .free: return .free
            case .saveMoney: return .saveMoney
            case .withFamily: return .withFamily
            case .quickWins: return .quickWins
            case .lowEnergy: return .lowEnergy
            }
        }()
        let natureTags = ["Nature", "Exploring", "Gardening", "Photography", "Animals"]
        return filterIdeas(ideas, filter: base, query: options.query, state: state).filter { i in
            (options.maxMinutes == 0 || i.minutes <= options.maxMinutes) &&
            (options.setting == .any || i.outdoor == (options.setting == .outside)) &&
            (!options.gentle || i.effort == .gentle) &&
            (options.category == nil || i.category == options.category) &&
            (!options.noExtra || i.extraMin <= 0) &&
            (!options.breaksSitting || i.breaksSitting) &&
            (options.intensity == nil || i.intensity == options.intensity) &&
            (filter != .breaksUpSitting || i.breaksSitting) &&
            (filter != .strength || i.intensity == .strength) &&
            (filter != .briskBurst || i.intensity == .vigorousBurst) &&
            (filter != .nearMe || i.outdoor) &&
            (filter != .nature || (i.outdoor && i.enjoy.contains { natureTags.contains($0) }))
        }
    }

    static func feedback(ideaId: Int, state: AppState, now: Date = Date()) -> (tries: Int, worthwhile: Int) {
        let rows = Wins.confirmed(state.entries, now: now).filter { $0.ideaId == ideaId }
        return (rows.count, rows.filter { $0.worthwhile == true }.count)
    }

    private struct Topic { let key: String; let title: String; let art: String; let image: String?; let interests: [String]; let matches: (Idea) -> Bool }
    private static let topics: [Topic] = [
        Topic(key: "break-the-sit", title: "Break the sit", art: "Short bursts", image: nil, interests: [], matches: { $0.breaksSitting && $0.minutes >= 1 && $0.minutes <= 3 }),
        Topic(key: "outside", title: "A little fresh air", art: "Outside", image: "welcome-coast", interests: ["Nature", "Exploring new places", "Gardening", "Photography", "Animals"], matches: { $0.outdoor && isFreeMove($0) }),
        Topic(key: "listen", title: "Listen and move", art: "Podcasts", image: "welcome-podcast", interests: ["Podcasts", "Music", "Audiobooks", "Listening to something", "Reading"], matches: { $0.category == .listen }),
        Topic(key: "family", title: "With the family", art: "Family time", image: "welcome-school", interests: ["Family time", "Family"], matches: { $0.category == .family }),
        Topic(key: "calls", title: "Catch-ups and conversations", art: "Calls", image: "welcome-catchup-walk", interests: ["Friends / talking", "Friends", "Conversation"], matches: { $0.category == .call || $0.social }),
        Topic(key: "tasks", title: "Everyday tasks", art: "Household tasks", image: nil, interests: ["Making things", "Solving problems", "Gardening"], matches: { [.chores, .work, .errand, .shopping].contains($0.category) }),
        Topic(key: "pauses", title: "Useful little pauses", art: "Short bursts", image: "welcome-ad-break-strength", interests: ["Solving problems"], matches: { $0.category == .waiting || $0.category == .think || ($0.category == .work && $0.minutes <= 10) })
    ]

    static func collections(_ ideas: [Idea], state: AppState, now: Date = Date()) -> [MoveCollection] {
        let liked = Set(Wins.confirmed(state.entries, now: now).filter { $0.worthwhile == true }.map(\.ideaId))
        let personal = state.profile.isComplete
        return topics.map { topic -> MoveCollection in
            let matches = ideas.filter(topic.matches)
            let pin = personal ? state.profile.interests.first { topic.interests.contains($0) } : nil
            let tried = matches.contains { liked.contains($0.id) }
            let preferred = personal && topic.key == "outside" && state.profile.preferences.contains("Outside")
            let reason = pin.map { "You chose \($0.lowercased())." } ?? (tried ? "Includes an idea you found worthwhile." : preferred ? "You prefer being outside." : "A collection to explore.")
            return MoveCollection(key: topic.key, title: topic.title, art: topic.art, image: topic.image, ideas: matches, reason: reason, personal: pin != nil || tried || preferred)
        }.filter { !$0.ideas.isEmpty }.sorted { $0.personal && !$1.personal }
    }

    static func favouriteCollections(_ ideas: [Idea], state: AppState) -> [MoveCollection] {
        let saved = Set(state.saved)
        return topics.map { t in MoveCollection(key: t.key, title: t.title, art: t.art, image: t.image, ideas: ideas.filter { saved.contains($0.id) && t.matches($0) }, reason: "", personal: false) }.filter { !$0.ideas.isEmpty }
    }

    /// `ideaCover()`: a bundled scene for library ideas.
    static func cover(_ i: Idea) -> String {
        if let image = i.image { return image }
        switch i.category {
        case .call, .work: return "welcome-call"
        case .listen: return "welcome-podcast"
        case .family: return "welcome-school"
        case .coffee, .errand, .chores, .shopping: return "welcome-dinner"
        default: return "welcome-coast"
        }
    }

    /// `moveVisual()`: known scenes only; other ideas use a relevant illustration.
    static func visual(_ idea: Idea) -> (image: String?, art: String) {
        if let image = idea.image { return (image, "Outside") }
        if idea.movementMode == "seated" || idea.movementMode == "stretch" { return (nil, "Physical comfort / accessibility") }
        if idea.movementMode == "cycle" { return (nil, "Cycling") }
        if idea.movementMode == "stairs" { return ("welcome-refill-stairs", "Short bursts") }
        if idea.key == "video-call-overseas" { return (nil, "Video call") }
        if idea.key == "kids-garden-play" { return (nil, "Active play") }
        if idea.key == "garden-podcast" { return (nil, "Garden + Podcast") }
        if idea.category == .call { return idea.outdoor ? ("welcome-catchup-walk", "Calls") : (nil, "Calls") }
        if idea.category == .listen { return (nil, idea.key.contains("music") ? "Music" : idea.key.contains("audiobook") ? "Audiobooks" : "Podcasts") }
        if idea.category == .family { return idea.outdoor ? ("welcome-school", "Family time") : (nil, "Family time") }
        if idea.category == .chores { return (nil, "Household tasks") }
        if idea.key.contains("photo") { return (nil, "Photography") }
        if idea.key.contains("dog") { return (nil, "Animals") }
        if idea.category == .coffee { return (nil, "Coffee") }
        if idea.outdoor { return ("welcome-coast", "Outside") }
        return (nil, idea.category == .work ? "Work or study" : idea.category == .shopping ? "Groceries" : "Short bursts")
    }

    static func placeSearchURL(query: String, locality: String) -> URL? {
        let place = locality.trimmingCharacters(in: .whitespaces)
        guard !place.isEmpty else { return nil }
        var components = URLComponents(string: "https://www.google.com/maps/search/")!
        components.queryItems = [URLQueryItem(name: "api", value: "1"), URLQueryItem(name: "query", value: "\(query) in \(place)")]
        return components.url
    }
}
