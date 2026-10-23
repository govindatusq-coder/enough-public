import Foundation

/// Mirrors `lib/ideas.ts`. Field names and JSON encoding match the web
/// account format so an idea generated on the website decodes here unchanged.
enum IdeaCategory: String, Codable, CaseIterable {
    case call, listen, coffee, errand, think, family, chores, shopping, travel, work, waiting, other
}

enum IdeaIntensity: String, Codable, CaseIterable {
    case light, moderate, vigorousBurst = "vigorous-burst", strength

    var label: String {
        switch self {
        case .light: return "Light movement"
        case .moderate: return "Moderate movement"
        case .vigorousBurst: return "Brisk burst"
        case .strength: return "Strength"
        }
    }
}

enum MoneySource: String, Codable {
    case none, feeAvoided = "fee_avoided", transportAvoided = "transport_avoided", purchaseAvoided = "purchase_avoided"
}

enum Effort: String, Codable { case gentle, moderate }

enum ValueType: String, Codable, CaseIterable {
    case movement, moneySaved = "money_saved", social, experience, taskCompleted = "task_completed", timeSaved = "time_saved", timeCombined = "time_combined"
}

enum IdeaSource: String, Codable { case library, ai }

struct IdeaMovementSpec: Codable, Equatable {
    var version: Int = 1
    var action: String
    var activityMinutes: Int
}

struct Idea: Codable, Identifiable, Equatable {
    var intensity: IdeaIntensity = .light
    var breaksSitting: Bool = false
    var id: Int
    var key: String
    var title: String
    var category: IdeaCategory
    var usual: String
    var body: String
    var minutes: Int
    var extraMin: Int
    var moneyCents: Int
    var moneySource: MoneySource
    var enjoy: [String]
    var outdoor: Bool
    var effort: Effort
    var exclude: [String]
    var safety: String
    var social: Bool
    var output: String
    var family: String
    var mechanism: String
    var movementMode: String
    var movement: IdeaMovementSpec?
    var source: IdeaSource
    var image: String?
    var alt: String?
    var brief: String?

    enum CodingKeys: String, CodingKey {
        case intensity, breaksSitting, id, key, title, category, usual, body, minutes, extraMin, moneyCents, moneySource, enjoy, outdoor, effort, exclude, safety, social, output, family, mechanism, movementMode, movement, source, image, alt, brief
    }

    init(intensity: IdeaIntensity = .light, breaksSitting: Bool = false, id: Int, key: String, title: String, category: IdeaCategory, usual: String, body: String, minutes: Int, extraMin: Int, moneyCents: Int, moneySource: MoneySource, enjoy: [String], outdoor: Bool, effort: Effort, exclude: [String], safety: String, social: Bool, output: String, family: String, mechanism: String, movementMode: String, movement: IdeaMovementSpec? = nil, source: IdeaSource, image: String? = nil, alt: String? = nil, brief: String? = nil) {
        self.intensity = intensity; self.breaksSitting = breaksSitting; self.id = id; self.key = key; self.title = title; self.category = category; self.usual = usual; self.body = body; self.minutes = minutes; self.extraMin = extraMin; self.moneyCents = moneyCents; self.moneySource = moneySource; self.enjoy = enjoy; self.outdoor = outdoor; self.effort = effort; self.exclude = exclude; self.safety = safety; self.social = social; self.output = output; self.family = family; self.mechanism = mechanism; self.movementMode = movementMode; self.movement = movement; self.source = source; self.image = image; self.alt = alt; self.brief = brief
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        intensity = try c.decodeIfPresent(IdeaIntensity.self, forKey: .intensity) ?? .light
        breaksSitting = try c.decodeIfPresent(Bool.self, forKey: .breaksSitting) ?? false
        id = try c.decode(Int.self, forKey: .id)
        key = try c.decode(String.self, forKey: .key)
        title = try c.decode(String.self, forKey: .title)
        category = try c.decode(IdeaCategory.self, forKey: .category)
        usual = try c.decode(String.self, forKey: .usual)
        body = try c.decode(String.self, forKey: .body)
        minutes = try c.decode(Int.self, forKey: .minutes)
        extraMin = try c.decode(Int.self, forKey: .extraMin)
        moneyCents = try c.decode(Int.self, forKey: .moneyCents)
        moneySource = try c.decode(MoneySource.self, forKey: .moneySource)
        enjoy = try c.decode([String].self, forKey: .enjoy)
        outdoor = try c.decode(Bool.self, forKey: .outdoor)
        effort = try c.decode(Effort.self, forKey: .effort)
        exclude = try c.decode([String].self, forKey: .exclude)
        safety = try c.decode(String.self, forKey: .safety)
        social = try c.decode(Bool.self, forKey: .social)
        output = try c.decode(String.self, forKey: .output)
        family = try c.decode(String.self, forKey: .family)
        mechanism = try c.decode(String.self, forKey: .mechanism)
        movementMode = try c.decode(String.self, forKey: .movementMode)
        movement = try c.decodeIfPresent(IdeaMovementSpec.self, forKey: .movement)
        source = try c.decode(IdeaSource.self, forKey: .source)
        image = try c.decodeIfPresent(String.self, forKey: .image)
        alt = try c.decodeIfPresent(String.self, forKey: .alt)
        brief = try c.decodeIfPresent(String.self, forKey: .brief)
    }

    /// The value types an idea promises before it is tried (`promised()` in the web).
    var promised: [ValueType] {
        var values: [ValueType] = [.movement]
        if moneySource != .none && moneyCents > 0 { values.append(.moneySaved) }
        values.append(social ? .social : .experience)
        if !output.isEmpty { values.append(.taskCompleted) }
        if extraMin < 0 { values.append(.timeSaved) } else if extraMin == 0 { values.append(.timeCombined) }
        return values
    }

    var tagLabels: [String] { [intensity.label] + (breaksSitting ? ["Breaks up sitting"] : []) }

    var extraTimeLabel: String {
        extraMin > 0 ? "\(extraMin) extra min" : extraMin < 0 ? "\(-extraMin) min reclaimed" : "No extra time"
    }
}

/// Explicit template tags for the original library (`lib/idea-tags.ts`).
private let libraryMovementTags: [String: (IdeaIntensity, Bool)] = [
    "call-family-walk": (.light, true), "call-pace-indoors": (.light, true), "call-friend-loop": (.light, true), "call-work-standing": (.light, true),
    "podcast-outside": (.light, true), "music-album-walk": (.light, true), "audiobook-chores": (.light, true), "podcast-commute-stop": (.light, true),
    "coffee-walk-further": (.light, true), "coffee-walk-home": (.light, true), "coffee-catchup-walk": (.light, true), "collect-dinner": (.light, true),
    "post-walk": (.light, true), "pharmacy-park-far": (.light, true), "bank-bike": (.moderate, false), "problem-walk": (.light, true),
    "plan-week-walk": (.light, true), "decompress-walk": (.light, true), "playground-laps": (.light, true), "school-walk": (.light, true),
    "after-dinner-stroll": (.light, true), "video-call-overseas": (.light, true), "kids-garden-play": (.moderate, true), "laundry-stairs": (.light, true),
    "garden-podcast": (.moderate, false), "cooking-music": (.light, true), "bins-loop": (.light, true), "groceries-walk": (.light, true),
    "market-explore": (.light, true), "basket-not-trolley": (.light, true), "commute-stop-early": (.light, true), "park-and-walk": (.light, true),
    "bike-commute-sometimes": (.moderate, false), "station-stairs": (.moderate, true), "walking-1on1": (.light, true), "lunch-walk-out": (.light, true),
    "break-stretch": (.light, false), "water-refill-far": (.moderate, true), "wait-appointment": (.light, true), "wait-pickup": (.light, true),
    "wait-laundry": (.light, true), "photo-walk": (.light, true), "dog-longer": (.light, true), "visit-friend-walk": (.light, true)
]

private struct LibraryRow {
    let key: String; let category: IdeaCategory; let title: String; let usual: String
    let minutes: Int; let extraMin: Int; let moneyCents: Int; let enjoy: [String]
    let outdoor: Bool; let effort: Effort; let exclude: [String]; let safety: String?; let social: Bool
    init(_ key: String, _ category: IdeaCategory, _ title: String, _ usual: String, _ minutes: Int, _ extraMin: Int, _ moneyCents: Int, _ enjoy: [String], _ outdoor: Bool, _ effort: Effort, _ exclude: [String], _ safety: String? = nil, _ social: Bool = false) {
        self.key = key; self.category = category; self.title = title; self.usual = usual; self.minutes = minutes; self.extraMin = extraMin; self.moneyCents = moneyCents; self.enjoy = enjoy; self.outdoor = outdoor; self.effort = effort; self.exclude = exclude; self.safety = safety; self.social = social
    }
}

private let libraryRows: [LibraryRow] = [
    LibraryRow("call-family-walk", .call, "Call family + Walk", "Call from the sofa", 24, 0, 0, ["Family", "Conversation"], true, .gentle, ["Safety"], "Stay on familiar, well-lit routes.", true),
    LibraryRow("call-pace-indoors", .call, "Call + Pace indoors", "Seated call", 15, 0, 0, ["Conversation"], false, .gentle, [], "Clear the floor of trip hazards."),
    LibraryRow("call-friend-loop", .call, "Catch up + Loop the block", "Catch-up call at home", 20, 0, 0, ["Friends", "Conversation"], true, .gentle, ["Safety", "Walkability"], "Use one earbud near traffic.", true),
    LibraryRow("call-work-standing", .call, "Work call + Walk", "Audio-only meeting at the desk", 25, 0, 0, ["Accomplishment"], true, .gentle, ["Unpredictable work"], "Pick a quiet route for audio."),
    LibraryRow("podcast-outside", .listen, "Podcast + Walk", "Finish the episode on the sofa", 18, 0, 0, ["Podcasts", "Learning"], true, .gentle, ["Safety"], "Keep volume low enough to hear traffic."),
    LibraryRow("music-album-walk", .listen, "One album side + Stroll", "Music in the background", 20, 0, 0, ["Music"], true, .gentle, ["Safety"]),
    LibraryRow("audiobook-chores", .listen, "Audiobook + Tidy", "Audiobook while sitting", 15, -10, 0, ["Learning", "Accomplishment"], false, .gentle, [], "Lift with care."),
    LibraryRow("podcast-commute-stop", .listen, "Podcast + Earlier stop", "Ride to your usual stop", 10, 4, 0, ["Podcasts"], true, .gentle, ["Walkability", "Limited time", "Physical limitations"], "Only on routes you know well."),
    LibraryRow("coffee-walk-further", .coffee, "Coffee + The nicer café", "Closest coffee", 12, 6, 0, ["Coffee", "Exploring"], true, .gentle, ["Limited time", "Walkability"]),
    LibraryRow("coffee-walk-home", .coffee, "Make coffee at home + Walk to drink it", "Buy a coffee on the way", 10, 3, 500, ["Coffee", "Solitude"], true, .gentle, [], "Use a lidded cup."),
    LibraryRow("coffee-catchup-walk", .coffee, "Coffee catch-up + Walk", "Sit-down coffee with a friend", 25, 0, 0, ["Friends", "Coffee", "Conversation"], true, .gentle, ["Weather"], "", true),
    LibraryRow("collect-dinner", .errand, "Collect dinner instead", "Order delivery", 18, -2, 700, ["Food"], true, .gentle, ["Walkability", "Safety"], "Avoid poorly-lit routes after dark."),
    LibraryRow("post-walk", .errand, "Post office on foot", "Drive to the post office", 16, 4, 300, ["Accomplishment"], true, .gentle, ["Walkability", "Limited time"]),
    LibraryRow("pharmacy-park-far", .errand, "Park at the quiet end", "Circle for the closest space", 6, -1, 0, ["Accomplishment"], true, .gentle, ["Physical limitations"]),
    LibraryRow("bank-bike", .errand, "Errand by bike", "Short drive", 14, 0, 200, ["Exploring"], true, .moderate, ["Physical limitations", "Fatigue", "Safety"], "Helmet and lights."),
    LibraryRow("problem-walk", .think, "Take the problem for a walk", "Stare at the screen", 15, 2, 0, ["Solitude", "Accomplishment"], true, .gentle, ["Unpredictable work"]),
    LibraryRow("plan-week-walk", .think, "Plan the week + Stroll", "Plan the week at a table", 15, 0, 0, ["Accomplishment", "Solitude"], true, .gentle, []),
    LibraryRow("decompress-walk", .think, "Decompress on foot", "Scroll to unwind", 12, 0, 0, ["Solitude", "Nature"], true, .gentle, ["Recovery needs", "Fatigue"]),
    LibraryRow("playground-laps", .family, "A few laps while they play", "Sit on the bench", 15, 0, 0, ["Family"], true, .gentle, [], "Keep them in sight throughout.", true),
    LibraryRow("school-walk", .family, "Walk the school run", "Drive to school", 20, 5, 200, ["Family", "Conversation"], true, .gentle, ["Walkability", "Limited time", "Safety"], "Only on safe crossings.", true),
    LibraryRow("after-dinner-stroll", .family, "After-dinner family stroll", "TV straight after dinner", 12, 0, 0, ["Family", "Conversation"], true, .gentle, ["Recovery needs", "Weather"], "", true),
    LibraryRow("video-call-overseas", .family, "Video call + Slow walk", "Video call at home", 20, 0, 0, ["Family", "Conversation"], true, .gentle, ["Safety"], "Watch your step on screen.", true),
    LibraryRow("kids-garden-play", .family, "Join the game", "Watch them play", 15, 0, 0, ["Family"], true, .moderate, ["Physical limitations", "Fatigue"], "", true),
    LibraryRow("laundry-stairs", .chores, "Laundry in small loads", "One heavy trip", 6, 2, 0, ["Accomplishment"], false, .gentle, ["Physical limitations"], "Lift light loads only."),
    LibraryRow("garden-podcast", .chores, "Garden + Podcast", "Podcast on the sofa, garden later", 25, -15, 0, ["Gardening", "Podcasts", "Nature"], true, .moderate, ["Physical limitations", "Fatigue", "Recovery needs"], "Kneel on padding."),
    LibraryRow("cooking-music", .chores, "Cook standing + Music", "Ready meal", 8, 10, 600, ["Food", "Music", "Creativity"], false, .gentle, ["Limited time", "Fatigue"]),
    LibraryRow("bins-loop", .chores, "Bins + Round the block", "Bins out, straight back in", 7, 7, 0, ["Solitude"], true, .gentle, ["Limited time", "Recovery needs"]),
    LibraryRow("groceries-walk", .shopping, "Top-up shop on foot", "Drive for a few items", 20, 5, 300, ["Accomplishment"], true, .gentle, ["Walkability", "Limited time"], "Keep the load light."),
    LibraryRow("market-explore", .shopping, "Market instead of online", "Order online", 30, 15, 0, ["Shopping", "Exploring", "Food"], true, .gentle, ["Limited time", "Financial pressure"]),
    LibraryRow("basket-not-trolley", .shopping, "Full-loop shop", "Same aisles every time", 6, 4, 0, ["Shopping"], false, .gentle, ["Limited time", "Financial pressure"]),
    LibraryRow("commute-stop-early", .travel, "One stop early", "Ride to the door", 10, 3, 0, ["Podcasts", "Music"], true, .gentle, ["Walkability", "Physical limitations", "Recovery needs"], "Only on routes you know."),
    LibraryRow("park-and-walk", .travel, "Park cheaper, walk in", "Pay for the closest car park", 12, 5, 900, ["Accomplishment"], true, .gentle, ["Limited time", "Physical limitations"], "Well-lit car parks only."),
    LibraryRow("bike-commute-sometimes", .travel, "Cycle when the weather’s kind", "Bus fare", 30, 5, 400, ["Exploring", "Nature"], true, .moderate, ["Physical limitations", "Fatigue", "Safety", "Weather", "Recovery needs"], "Helmet, lights, safe lanes."),
    LibraryRow("station-stairs", .travel, "Stairs when it’s quiet", "Escalator", 2, 0, 0, [], false, .moderate, ["Physical limitations", "Fatigue", "Recovery needs"], "Use the handrail."),
    LibraryRow("walking-1on1", .work, "Walking one-to-one", "Meeting-room one-to-one", 25, 0, 0, ["Conversation", "Accomplishment"], true, .gentle, ["Unpredictable work"], "", true),
    LibraryRow("lunch-walk-out", .work, "Walk to get lunch", "Eat at the desk", 15, 0, 0, ["Food", "Solitude"], true, .gentle, ["Unpredictable work", "Financial pressure"]),
    LibraryRow("break-stretch", .work, "Break + Gentle stretch", "Sit through the break", 3, 0, 0, ["Solitude"], false, .gentle, [], "Stop if anything hurts."),
    LibraryRow("water-refill-far", .work, "Water refill + Stairs", "Nearest refill", 3, 1, 0, [], false, .moderate, ["Already physically active", "Physical limitations", "Fatigue", "Recovery needs"], "Use familiar stairs and the handrail. Choose a level route on another day."),
    LibraryRow("wait-appointment", .waiting, "Wait on your feet", "Sit in the waiting room", 2, 0, 0, ["Solitude"], false, .gentle, ["Physical limitations"], "Stay within earshot and keep the route clear."),
    LibraryRow("wait-pickup", .waiting, "Pickup wait + Stroll", "Wait in the car", 10, 0, 0, ["Solitude"], true, .gentle, ["Weather"]),
    LibraryRow("wait-laundry", .waiting, "Wash cycle walk", "Wait for the cycle", 15, 0, 0, ["Nature", "Solitude"], true, .gentle, ["Weather"]),
    LibraryRow("photo-walk", .other, "Photo walk", "Scroll photos on the sofa", 25, 10, 0, ["Photography", "Exploring", "Nature"], true, .gentle, ["Limited time"]),
    LibraryRow("dog-longer", .other, "The longer dog walk", "Usual short loop", 10, 10, 0, ["Animals", "Nature"], true, .gentle, ["Limited time", "Recovery needs"]),
    LibraryRow("visit-friend-walk", .other, "Walk to a friend’s", "Drive round", 20, 8, 200, ["Friends"], true, .gentle, ["Walkability", "Limited time", "Safety"], "", true)
]

private let libraryInstructions: [String: String] = [
    "audiobook-chores": "Walk between the basket and storage while putting things away during your audiobook. Count the active trips and comfortable whole-body movement, rather than standing still or sorting small objects.",
    "coffee-walk-further": "Walk to a café a little farther along a familiar route instead of the closest one. The estimated 12 minutes are the walk, rather than time drinking your coffee.",
    "pharmacy-park-far": "Park at the quiet end and walk the remaining short distance to collect what you need. Choose a safe, accessible route; the movement estimate is the walk.",
    "laundry-stairs": "Put laundry away in a couple of light trips rather than one heavy carry. Walk between the basket and storage; use a handrail if your familiar route includes stairs.",
    "cooking-music": "Prepare your meal with music playing, taking comfortable steps between the bench and ingredients and reaching for what you need. Count the active preparation (about 8 minutes), rather than standing still or waiting for food to cook.",
    "basket-not-trolley": "Walk a full loop of the shop while collecting the items already on your list. The movement estimate is time walking through the aisles, rather than browsing or queueing.",
    "water-refill-far": "Walk to a water fountain on a nearby floor using a familiar flight of stairs. Use the handrail and count the walking and stairs, rather than time at the fountain.",
    "wait-appointment": "During an existing wait, take a short, comfortable two-minute stroll in a clear area within earshot. Return to your seat whenever it suits you; standing still is not included in the movement estimate."
]

private func lowerFirst(_ text: String) -> String {
    guard let first = text.first else { return text }
    return first.lowercased() + text.dropFirst()
}

enum Catalogue {
    /// The full library: 46 original ideas plus 15 sitting breaks, in web ID order.
    static let ideas: [Idea] = {
        var list: [Idea] = []
        for (n, r) in libraryRows.enumerated() {
            let tags = libraryMovementTags[r.key] ?? (.light, true)
            let id = n == 0 ? 1 : n == 11 ? 0 : n + 2
            let title = n == 11 ? "Dinner, with a little fresh air." : n == 0 ? "Your next catch-up. Out in the world." : r.title
            let moneyCents = n == 11 ? 699 : r.moneyCents
            let moneySource: MoneySource = r.moneyCents != 0 ? (n == 11 ? .feeAvoided : [9, 25].contains(n) ? .purchaseAvoided : .transportAvoided) : .none
            let safety = (r.safety?.isEmpty == false ? r.safety! : "Choose a setting, pace and movement that are comfortable for you.")
            let output = [IdeaCategory.errand, .chores, .shopping, .work].contains(r.category) ? String(r.title.components(separatedBy: " + ").first ?? r.title) : ""
            let mechanism = r.extraMin <= 0 ? "combine" : "substitute"
            let movementMode: String
            if r.key == "break-stretch" { movementMode = "seated" }
            else if r.key.contains("bike") || r.key.contains("cycle") { movementMode = "cycle" }
            else if r.key.contains("stretch") { movementMode = "stretch" }
            else if r.key.contains("stairs") || r.key == "water-refill-far" { movementMode = "stairs" }
            else if r.key.contains("garden") || r.key.contains("cooking") || r.key.contains("laundry") || r.key.contains("chores") { movementMode = "task" }
            else { movementMode = "walk" }
            let body: String
            if let instruction = libraryInstructions[r.key] { body = instruction }
            else if r.key == "break-stretch" { body = "Use an existing pause for a familiar, comfortable seated stretch. Leave it out if it does not suit you." }
            else if n == 11 { body = "Walk to pick up your takeaway. A little fresh air, and the delivery fee stays with you." }
            else if n == 0 { body = "Walk a short, familiar route during your next family call. Keep the conversation; add a little room to breathe." }
            else { body = "Instead of \(lowerFirst(r.usual)), try \(lowerFirst(r.title)). Keep what matters; choose a size that fits your day." }
            var idea = Idea(intensity: tags.0, breaksSitting: tags.1, id: id, key: r.key, title: title, category: r.category, usual: r.usual, body: body, minutes: r.minutes, extraMin: r.extraMin, moneyCents: moneyCents, moneySource: moneySource, enjoy: r.enjoy, outdoor: r.outdoor, effort: r.effort, exclude: r.exclude, safety: safety, social: r.social, output: output, family: r.category.rawValue, mechanism: mechanism, movementMode: movementMode, source: .library)
            if n == 11 { idea.image = "dinner"; idea.alt = "A woman carrying takeaway dinner along a neighbourhood street at dusk" }
            if n == 0 { idea.minutes = 12; idea.image = "call"; idea.alt = "A man enjoying a phone conversation on a leafy park path" }
            list.append(idea)
        }
        return list + SittingBreaks.ideas
    }()

    static func byId(_ id: Int, generated: [Idea] = []) -> Idea? {
        ideas.first { $0.id == id } ?? generated.first { $0.id == id }
    }
}
