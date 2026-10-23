import Foundation

/// Mirrors `lib/sitting-break-ideas.ts`. IDs start at 46 and are never recycled.
enum SittingBreaks {
    private struct Row {
        let key: String; let title: String; let category: IdeaCategory; let usual: String; let action: String
        let minutes: Int; let intensity: IdeaIntensity; let outdoor: Bool; let enjoy: [String]; let safety: String; let social: Bool
        init(_ key: String, _ title: String, _ category: IdeaCategory, _ usual: String, _ action: String, _ minutes: Int, _ intensity: IdeaIntensity, _ outdoor: Bool, _ enjoy: [String], _ safety: String, _ social: Bool = false) {
            self.key = key; self.title = title; self.category = category; self.usual = usual; self.action = action; self.minutes = minutes; self.intensity = intensity; self.outdoor = outdoor; self.enjoy = enjoy; self.safety = safety; self.social = social
        }
    }

    private static let rows: [Row] = [
        Row("ad-break-wall-pushups", "Ad break + Wall push-ups", .other, "Stay seated through the ad break", "Walk to a clear wall, take a comfortable step back and slowly bend and straighten your arms against it. Take a few easy steps before sitting again.", 2, .strength, false, ["TV / streaming"], "Use a stable wall and a comfortable angle. Leave this out with pain, recovery needs or balance concerns."),
        Row("kettle-calf-raises", "Kettle pause + Calf raises", .chores, "Sit while the kettle boils", "Walk to a stable bench clear of the kettle, hold it lightly and slowly raise and lower your heels. Take a few comfortable steps back to your cup.", 1, .strength, false, ["Coffee"], "Keep clear of hot water. Use stable support; stop for pain or unsteadiness."),
        Row("shopping-stairs-carry", "Shopping + A light carry upstairs", .shopping, "Leave the shopping at the foot of the stairs", "Walk a familiar flight of stairs with one light bag, put it away and return at a comfortable pace.", 3, .strength, false, ["Accomplishment"], "Only if light carrying and stairs already suit you. Keep one hand free for the rail and the route clear."),
        Row("walk-to-colleague", "A question + Walk to a colleague", .work, "Send a message from your desk", "Walk to a nearby colleague to ask your question, then walk back when the conversation is finished.", 2, .light, false, ["Conversation", "Accomplishment"], "Check that they are available; use a clear, accessible route.", true),
        Row("short-call-pace", "A quick call + Pace", .call, "Stay seated for a short call", "Pace slowly along a clear indoor route during a short audio call. Return to your seat whenever you like.", 3, .light, false, ["Conversation"], "Keep the floor clear and watch where you are going.", true),
        Row("one-flight-instead", "One flight + Stairs instead", .travel, "Take the lift for one floor", "Walk one familiar flight of stairs at a comfortable pace while going to the floor you need.", 2, .moderate, false, ["Accomplishment"], "Use the handrail. Choose the lift if stairs do not suit you today."),
        Row("park-short-loop", "While they play + A small loop", .family, "Sit on the park bench", "Walk a small familiar loop beside the play area while keeping the children in sight, then return to the bench.", 2, .light, true, ["Family", "Nature"], "Stay close enough to supervise throughout. Leave this out if supervision needs your full attention.", true),
        Row("library-easy-run", "Library visit + An easy run", .errand, "Sit while someone chooses a book", "Walk outside together, try a short easy jog on a familiar level path and walk back to the library.", 3, .vigorousBurst, true, ["Reading", "Learning", "Family"], "Only if jogging already feels comfortable. Keep children supervised, avoid traffic and stop for pain or breathlessness.", true),
        Row("brisk-corridor-loop", "Screen pause + A brisk loop", .work, "Keep sitting between tasks", "Walk a clear familiar corridor loop at a brisk pace, slowing down before returning to your desk.", 2, .vigorousBurst, false, ["Solitude", "Accomplishment"], "Brisk walking should already suit you. Keep clear of others; choose a slow version on another day."),
        Row("short-brisk-stairs", "A floor change + A brisk flight", .travel, "Wait for the lift", "Walk one familiar flight of stairs briskly while changing floors, using the rail and slowing on the landing.", 1, .vigorousBurst, false, ["Accomplishment"], "Only if brisk stairs already suit you. No running, heavy loads or crowded stairs."),
        Row("bench-rise-steps", "A seated pause + Sit-to-stand", .waiting, "Stay seated during an existing pause", "Walk a few steps to a stable chair, slowly rise and sit a few times using support if needed, then walk a few comfortable steps.", 2, .strength, false, ["Solitude"], "Use a stable chair without wheels. Only use a familiar comfortable movement; stop with pain or unsteadiness."),
        Row("evening-room-lap", "Episode ends + A room lap", .other, "Start the next episode seated", "Walk a comfortable lap of a clear room between episodes, then return to your seat.", 1, .light, false, ["TV / streaming", "Music"], "Keep the route clear. Sit again whenever you need."),
        Row("parked-driving-pause", "A parked stop + A short stroll", .waiting, "Stay seated during a planned driving stop", "Walk a short loop in a safe rest area after parking, then return to the vehicle.", 3, .light, true, ["Solitude", "Nature"], "Park safely and switch off first. Never use this while driving or on a road shoulder."),
        Row("settled-room-walk", "A settled moment + A room walk", .family, "Remain seated after feeding and settling", "Walk a few slow steps in the same clear room after feeding and settling, staying beside the person you care for.", 2, .light, false, ["Family"], "Only when care and supervision allow. Avoid carrying a baby for this movement and sit again when needed."),
        Row("commute-wait-loop", "Commute wait + A short loop", .travel, "Sit through a short wait", "Walk a short loop in a clear waiting area before your connection, then return in time to board.", 3, .light, false, ["Podcasts", "Music"], "Stay well away from platform edges and traffic. Keep your connection and belongings in view.")
    ]

    static let ideas: [Idea] = rows.enumerated().map { n, r in
        var exclude: [String] = []
        if r.intensity == .strength || r.intensity == .vigorousBurst { exclude += ["Physical limitations", "Recovery needs", "Fatigue"] }
        if r.outdoor { exclude += ["Safety", "Weather", "Walkability"] }
        let output = [IdeaCategory.chores, .shopping, .errand, .work].contains(r.category) ? r.title : ""
        let movementMode = (r.key.contains("stairs") || r.key == "one-flight-instead") ? "stairs" : r.intensity == .strength ? "task" : "walk"
        var idea = Idea(intensity: r.intensity, breaksSitting: true, id: 46 + n, key: r.key, title: r.title, category: r.category, usual: r.usual, body: r.action, minutes: r.minutes, extraMin: 0, moneyCents: 0, moneySource: .none, enjoy: r.enjoy, outdoor: r.outdoor, effort: r.intensity == .light ? .gentle : .moderate, exclude: exclude, safety: r.safety, social: r.social, output: output, family: r.category.rawValue, mechanism: "combine", movementMode: movementMode, movement: IdeaMovementSpec(action: r.action, activityMinutes: r.minutes), source: .library)
        if r.key == "ad-break-wall-pushups" { idea.image = "welcome-ad-break-strength"; idea.alt = "A person doing supported wall push-ups during a television ad break" }
        if r.key == "library-easy-run" { idea.image = "welcome-library-run"; idea.alt = "A parent and child moving together on a path by a library" }
        return idea
    }
}
