import Foundation

/// Mirrors `lib/idea-movement.ts`: an AI idea only counts as a movement
/// suggestion when its action text describes actual movement.
enum IdeaMovement {
    static let modes = ["walk", "cycle", "stairs", "wheel", "task", "play", "dance", "seated"]

    private static let bodyParts = "\\b(?:arms?|shoulders?|torso|upper body|lower body|whole body|neck|back|legs?|knees?|ankles?|hips?|elbows?)\\b"
    private static let mobility = "\\b(?:stretch(?:es|ing)?|reach(?:es|ing)?|rais(?:e|es|ing)|lift(?:s|ing)?|lower(?:s|ing)?|circl(?:e|es|ing)|roll(?:s|ing)?|rotat(?:e|es|ing)|turn(?:s|ing)?|bend(?:s|ing)?|extend(?:s|ing)?|march(?:es|ing)?|pedal(?:s|ling|ing)?)\\b"
    private static let patterns: [String: String] = [
        "walk": "\\b(?:walk(?:s|ing)?|stroll(?:s|ing)?|pac(?:e|es|ing)|take (?:a few |some |short |comfortable )?steps)\\b",
        "cycle": "\\b(?:cycl(?:e|es|ing)|bik(?:e|es|ing)|pedal(?:s|ling|ing)?)\\b",
        "stairs": "\\b(?:stairs?|staircase|steps? up|steps? down)\\b",
        "wheel": "\\b(?:wheel(?:s|ing)?|propel(?:s|ling)?|push(?:ing)? (?:your |the |a )?wheelchair)\\b",
        "task": "\\b(?:walk(?:s|ing)?|trips?|sweep(?:s|ing)?|mop(?:s|ping)?|rak(?:e|es|ing)|dig(?:s|ging)?|weed(?:s|ing)?|scrub(?:s|bing)?)\\b",
        "play": "\\b(?:walk(?:s|ing)?|danc(?:e|es|ing)|kick(?:s|ing)?|throw(?:s|ing)?|toss(?:es|ing)?|catch(?:es|ing)?|jump(?:s|ing)?|hop(?:s|ping)?|chase|chasing)\\b",
        "dance": "\\b(?:danc(?:e|es|ing)|sway(?:s|ing)?|step(?:s|ping)? to (?:the |your )?music)\\b",
        "seated": mobility
    ]
    private static let startsWithVerb = "^(?:walk|stroll|pace|take|cycle|bike|pedal|ride|climb|wheel|propel|push|sweep|mop|rake|dig|weed|scrub|carry|lift|play|join|kick|throw|toss|catch|jump|hop|chase|dance|sway|step|stretch|reach|raise|lower|circle|roll|rotate|turn|bend|extend|march)\\b"

    static func normalise(_ text: String) -> String {
        text.lowercased().replacingOccurrences(of: "’", with: "'").replacingOccurrences(of: "‘", with: "'").replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespaces)
    }

    private static func firstMatch(_ pattern: String, in text: String) -> Range<String.Index>? {
        text.range(of: pattern, options: .regularExpression)
    }
    private static func matches(_ pattern: String, _ text: String) -> Bool { firstMatch(pattern, in: text) != nil }

    static func describesMovement(mode: String, text: String, legacy: Bool = false) -> Bool {
        guard modes.contains(mode), let pattern = patterns[mode] else { return false }
        let action = normalise(text)
        if !legacy && !matches(startsWithVerb, action) { return false }
        var match = firstMatch(pattern, in: action)
        if match == nil, mode == "task", matches(bodyParts, action) { match = firstMatch(mobility, in: action) }
        guard let found = match else { return false }
        let index = action.distance(from: action.startIndex, to: found.lowerBound)
        let before = String(action[action.index(action.startIndex, offsetBy: max(0, index - 32))..<found.lowerBound])
        if matches("\\b(?:no|not|don't|avoid|without|skip|instead of|rather than)\\b[^.!;]{0,24}$", before) { return false }
        if mode == "stairs" && !matches("\\b(?:climb(?:ing)?|walk(?:ing)?|take|go)\\b", action) { return false }
        let prefix = String(action[..<found.lowerBound])
        if matches("\\b(?:read|watch|listen|learn|talk|think)\\b[^.!;]*\\babout\\b[^.!;]*$", prefix) { return false }
        if mode == "seated" || mode == "task" {
            if mode == "seated" && !matches(bodyParts, action) { return legacy && matches("\\bseated stretch(?:es|ing)?\\b", action) }
            if matches("\\b(?:fingers?|thumbs?|typing|knitting|sewing)\\b", action) && !matches(bodyParts, action) { return false }
        }
        return true
    }

    static func hasMovement(_ idea: Idea) -> Bool {
        if idea.source == .library { return true }
        guard let movement = idea.movement else { return describesMovement(mode: idea.movementMode, text: idea.body, legacy: true) }
        return movement.version == 1 && idea.minutes >= 1 && idea.minutes <= 60 && movement.activityMinutes >= idea.minutes && movement.activityMinutes <= 240 && normalise(idea.body).contains(normalise(movement.action)) && describesMovement(mode: idea.movementMode, text: movement.action)
    }
}
