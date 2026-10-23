import Foundation

/// Mirrors `lib/discovery.ts` and `lib/moves.ts`. Every control only narrows
/// the already eligible feed; nothing here can broaden the user's needs.
enum DiscoveryFilter: String, CaseIterable, Identifiable {
    case forYou = "For you", free = "No cost", quickWins = "Quick wins", lowEnergy = "Low energy", outside = "Outside", withFamily = "With family"
    var id: String { rawValue }
}

enum MoveFilter: String, CaseIterable, Identifiable {
    case forYou = "For you", free = "No cost", quickWins = "Quick wins", lowEnergy = "Low energy", outside = "Outside", withFamily = "With family", nature = "Nature", breaksUpSitting = "Breaks up sitting", strength = "Strength", briskBurst = "Brisk burst", surpriseMe = "Surprise me"
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
    let image: String
    let ideas: [Idea]
    let reason: String
    let personal: Bool
    var id: String { key }
}

enum Discovery {
    /// Library ideas that need nothing bought: no fee, ticket or purchase.
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
            case .forYou: return true
            }
        }
    }

    /// Ideas for the home card: no-cost ideas first, one per category for variety.
    static func homeIdeas(_ ideas: [Idea], state: AppState, setting: Setting) -> [Idea] {
        let pool = filterIdeas(ideas, filter: .forYou, query: "", state: state).filter { setting == .any || $0.outdoor == (setting == .outside) }
        let free = pool.filter(isFreeMove), rest = pool.filter { !isFreeMove($0) }
        var seen = Set<IdeaCategory>()
        let varied = (free + rest).filter { seen.insert($0.category).inserted }
        return varied + (free + rest).filter { v in !varied.contains { $0.id == v.id } }
    }

    static func surpriseIdeaId(_ ideas: [Idea], currentId: Int?) -> Int? {
        let alternatives = ideas.filter { $0.id != currentId }
        return alternatives.randomElement()?.id ?? ideas.first?.id
    }

    static func movesIdeas(_ ideas: [Idea], filter: MoveFilter, state: AppState, options: MoveOptions) -> [Idea] {
        let base: DiscoveryFilter = {
            switch filter {
            case .breaksUpSitting, .strength, .briskBurst, .nature, .forYou: return .forYou
            case .surpriseMe, .free: return .free
            case .withFamily: return .withFamily
            case .quickWins: return .quickWins
            case .lowEnergy: return .lowEnergy
            case .outside: return .outside
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
            (filter != .nature || (i.outdoor && i.enjoy.contains { natureTags.contains($0) }))
        }
    }

    static func feedback(ideaId: Int, state: AppState, now: Date = Date()) -> (tries: Int, worthwhile: Int) {
        let rows = Wins.confirmed(state.entries, now: now).filter { $0.ideaId == ideaId }
        return (rows.count, rows.filter { $0.worthwhile == true }.count)
    }

    private struct Topic { let key: String; let title: String; let image: String; let interests: [String]; let matches: (Idea) -> Bool }
    private static let topics: [Topic] = [
        Topic(key: "break-the-sit", title: "Break the sit", image: "welcome-ad-break-strength", interests: [], matches: { $0.breaksSitting && $0.minutes >= 1 && $0.minutes <= 3 }),
        Topic(key: "outside", title: "A little fresh air", image: "welcome-coast", interests: ["Nature", "Exploring new places", "Gardening", "Photography", "Animals"], matches: { $0.outdoor && isFreeMove($0) }),
        Topic(key: "listen", title: "Listen and move", image: "welcome-podcast", interests: ["Podcasts", "Music", "Audiobooks", "Listening to something", "Reading"], matches: { $0.category == .listen }),
        Topic(key: "family", title: "With the family", image: "welcome-school", interests: ["Family time", "Family"], matches: { $0.category == .family }),
        Topic(key: "calls", title: "Catch-ups and conversations", image: "welcome-catchup-walk", interests: ["Friends / talking", "Friends", "Conversation"], matches: { $0.category == .call || $0.social }),
        Topic(key: "tasks", title: "Everyday tasks", image: "welcome-kitchen-dance", interests: ["Making things", "Solving problems", "Gardening"], matches: { [.chores, .work, .errand, .shopping].contains($0.category) }),
        Topic(key: "pauses", title: "Useful little pauses", image: "welcome-refill-stairs", interests: ["Solving problems"], matches: { $0.category == .waiting || $0.category == .think || ($0.category == .work && $0.minutes <= 10) })
    ]

    static func collections(_ ideas: [Idea], state: AppState, now: Date = Date()) -> [MoveCollection] {
        let liked = Set(Wins.confirmed(state.entries, now: now).filter { $0.worthwhile == true }.map(\.ideaId))
        let personal = state.profile.isComplete
        return topics.map { topic -> MoveCollection in
            let matches = ideas.filter(topic.matches)
            let pin = personal ? state.profile.interests.first { topic.interests.contains($0) } : nil
            let tried = matches.contains { liked.contains($0.id) }
            let preferred = personal && topic.key == "outside" && state.profile.preferences.contains("Outside")
            let reason = pin.map { "You chose \($0.lowercased())." } ?? (tried ? "Includes one you found worthwhile." : preferred ? "You prefer being outside." : "A collection to explore.")
            return MoveCollection(key: topic.key, title: topic.title, image: topic.image, ideas: matches, reason: reason, personal: pin != nil || tried || preferred)
        }.filter { !$0.ideas.isEmpty }.sorted { $0.personal && !$1.personal }
    }

    /// The painting for an idea. Every library idea maps to one of the bundled
    /// scenes by what it is; AI ideas use this while their own picture loads.
    static func cover(_ i: Idea) -> String {
        if let image = i.image { return image }
        if i.movementMode == "stairs" { return "welcome-refill-stairs" }
        if i.intensity == .strength { return i.key.contains("kettle") || i.key.contains("bench") ? "welcome-upload-strength" : "welcome-ad-break-strength" }
        if i.key.contains("run") { return "welcome-library-run" }
        if i.key.contains("cook") || i.key.contains("kitchen") || i.key.contains("music") { return "welcome-kitchen-dance" }
        switch i.category {
        case .call: return i.social ? "welcome-catchup-walk" : "call"
        case .work: return i.outdoor ? "welcome-call" : "welcome-refill-stairs"
        case .listen: return "welcome-podcast"
        case .family: return "welcome-school"
        case .errand, .shopping: return "dinner"
        case .coffee: return "welcome-hero"
        case .chores: return "welcome-kitchen-dance"
        case .think, .waiting, .other: return i.outdoor ? "welcome-coast" : "welcome-podcast"
        case .travel: return i.outdoor ? "welcome-podcast" : "welcome-refill-stairs"
        }
    }

    /// An Apple Maps search for a place the user typed.
    static func mapsURL(_ place: String) -> URL? {
        let trimmed = place.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, var components = URLComponents(string: "maps://") else { return nil }
        components.queryItems = [URLQueryItem(name: "q", value: trimmed)]
        return components.url
    }
}
