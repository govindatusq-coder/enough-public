import Foundation

/// Mirrors `lib/recommendations.ts`. PINS needs are hard boundaries; everything
/// else only ranks the ideas that cleared them.
struct Ranked: Identifiable {
    let idea: Idea
    let score: Double
    let told: [String]
    let learned: [String]
    let protects: [String]
    var id: Int { idea.id }
}

struct LearnedWeight { var weight: Double; var promised: Int; var got: Int }

struct MoneyEstimate {
    var cents: Int
    var currency: String
    var source: String
}

enum Recommendations {
    static let needsMap: [String: String] = [
        "Not enough time": "Limited time", "Save money": "Financial pressure", "Money is tight": "Financial pressure", "Low energy / tired": "Fatigue",
        "Family or caring": "Caring responsibilities", "Work / shifts": "Unpredictable work", "Unpredictable day": "Unpredictable work", "Need flexibility": "Unpredictable work",
        "Need recovery": "Recovery needs", "Sleep matters": "Recovery needs", "Safety matters": "Safety", "Weather / heat": "Weather",
        "Hard to walk where I live": "Walkability", "Transport limitations": "Walkability", "Physical comfort / accessibility": "Physical limitations",
        "Pain / discomfort": "Physical limitations", "Already active at work": "Already physically active"
    ]
    private static let interestAliases: [String: [String]] = [
        "Family time": ["Family"], "Friends / talking": ["Friends", "Conversation"], "Shopping / browsing": ["Shopping"], "Exploring new places": ["Exploring"],
        "Audiobooks": ["Learning", "Podcasts"], "Making things": ["Creativity", "Accomplishment"], "Markets": ["Food", "Shopping", "Exploring"], "Creative hobbies": ["Creativity"],
        "Reading": ["Learning", "Solitude"], "Listening to something": ["Podcasts", "Music"], "Solving problems": ["Accomplishment"], "Community activities": ["Friends", "Conversation"]
    ]
    private static let routineCategories: [String: [IdeaCategory]] = [
        "Calls": [.call], "Work": [.work], "Errands": [.errand, .shopping], "Cooking": [.chores], "Cleaning": [.chores], "School run": [.family], "Podcasts": [.listen], "Shopping": [.shopping], "Commute": [.travel], "Family": [.family]
    ]

    static func constraints(_ s: AppState, now: Date = Date()) -> Set<String> {
        var keys = Set(s.profile.needs.map { needsMap[$0] ?? $0 })
        let todayNote = s.today.date == localDate(now) ? s.today.context : ""
        if ["Less time", "Tired after a shift"].contains(todayNote) { keys.insert("Limited time") }
        if ["Lower energy", "Tired after a shift"].contains(todayNote) { keys.insert("Fatigue") }
        return keys
    }

    static func eligible(_ i: Idea, _ s: AppState, now: Date = Date()) -> Bool {
        if !IdeaMovement.hasMovement(i) { return false }
        if s.profile.hasFreeTextNeed { return false }
        let keys = constraints(s, now: now), hour = Calendar.current.component(.hour, from: now), extra = max(0, i.extraMin)
        if i.exclude.contains(where: { keys.contains($0) }) { return false }
        if (i.intensity == .strength || i.intensity == .vigorousBurst) && (keys.contains("Physical limitations") || keys.contains("Recovery needs") || keys.contains("Fatigue")) { return false }
        if keys.contains("Safety") && i.outdoor { return false }
        if keys.contains("Weather") && i.outdoor { return false }
        if keys.contains("Walkability") && i.outdoor && ["walk", "cycle"].contains(i.movementMode) { return false }
        if keys.contains("Physical limitations") && i.movementMode != "seated" { return false }
        if (keys.contains("Fatigue") || keys.contains("Recovery needs")) && (i.effort == .moderate || i.minutes > 20) { return false }
        if (hour >= 19 || s.profile.activity == "Very physical") && i.effort == .moderate { return false }
        if keys.contains("Recovery needs") && hour >= 20 && extra > 0 { return false }
        if keys.contains("Caring responsibilities") && hour >= 18 && i.category != .family && extra > 0 { return false }
        if keys.contains("Limited time") && extra > 5 { return false }
        if extra > (s.tuning?.extraMinutes ?? 15) { return false }
        let usual = i.usual.lowercased()
        if s.tuning?.travel == .walk && (usual.contains("drive") || usual.contains("delivery") || usual.contains("parking") || usual.contains("car park")) { return false }
        if s.tuning?.travel == .transit && usual.contains("drive") { return false }
        return true
    }

    static func learnedWeights(_ s: AppState) -> [ValueType: LearnedWeight] {
        var result: [ValueType: LearnedWeight] = [:]
        for type in ValueType.allCases {
            let events = s.entries.filter { e in
                e.status == .completed && (e.predicted ?? []).contains(type) && ([.moneySaved, .social, .movement].contains(type) || e.gave != nil || (type == .timeCombined && e.timeCombined != nil))
            }
            let liked = events.filter { e in
                guard e.worthwhile == true else { return false }
                switch type {
                case .moneySaved: return (e.moneyCents ?? 0) > 0
                case .social: return e.connecting == true || (e.gave ?? []).contains(type)
                case .movement: return (e.minutes ?? 0) > 0
                case .timeCombined: return (e.timeCombined ?? 0) > 0 || (e.gave ?? []).contains(type)
                default: return (e.gave ?? []).contains(type)
                }
            }.count
            result[type] = LearnedWeight(weight: Double(liked + 1) / Double(events.count + 2), promised: events.count, got: liked)
        }
        return result
    }

    static func recommend(_ s: AppState, now: Date = Date()) -> [Ranked] {
        guard s.profile.isComplete else { return [] }
        let keys = constraints(s, now: now), weights = learnedWeights(s)
        let hidden = Set(s.tuning?.hidden ?? [])
        var ranked: [Ranked] = s.allIdeas.filter { eligible($0, s, now: now) && !hidden.contains($0.id) }.map { idea in
            var score = Double(idea.minutes) / (1 + Double(max(0, idea.extraMin)) * 0.6)
            var told: [String] = [], learned: [String] = [], protects: [String] = []
            for pin in s.profile.interests {
                let tags = interestAliases[pin] ?? [pin]
                if tags.contains(where: { idea.enjoy.contains($0) }) { score += 6; told.append("You enjoy \(pin).") }
            }
            for pin in s.profile.preferences {
                if (pin == "Outside" && idea.outdoor) || (pin == "Indoors" && !idea.outdoor) || (pin == "With someone" && idea.social) || (pin == "Alone" && !idea.social) || (pin == "Short bursts" && idea.minutes <= 15) || (pin == "Take my time" && idea.minutes >= 20) {
                    score += 1.5; told.append("You prefer \(pin.lowercased()).")
                }
            }
            if s.profile.rhythms.contains(where: { routineCategories[$0]?.contains(idea.category) == true }) { score += 1; told.append("This connects with a routine you selected.") }
            for pin in s.profile.strengths {
                if (pin.contains("getting things done") && !idea.output.isEmpty) || (pin.contains("company") && idea.social) || (pin.contains("exploring") && idea.enjoy.contains("Exploring")) || (pin.contains("care for others") && idea.category == .family) || (pin.contains("independently") && !idea.social) || (pin.contains("small changes") && idea.minutes <= 3) || (pin.contains("learning") && idea.enjoy.contains("Learning")) {
                    score += 2.5; told.append("It builds on: \(pin).")
                }
            }
            if let sitting = (s.profile.sittingContexts ?? []).first(where: { DailyContexts.matchesSittingContext(idea, context: $0) }) { score += 3; told.append("A short sitting break around \(sitting.lowercased()).") }
            if s.today.date == localDate(now) && s.today.context == "Feeling stressed" && idea.movementMode == "walk" && idea.minutes <= 15 {
                score += 3 + (idea.outdoor ? 2 : 0) + (s.profile.preferences.contains("Familiar places") ? 1 : 0); told.append("A short familiar walk for the kind of day you noted.")
            }
            if idea.breaksSitting && idea.minutes <= 3 { score += 2; protects.append("A short break from sitting, if it fits.") }
            if idea.extraMin <= 0 { score += 4; protects.append("It combines with something already happening.") }
            if idea.moneyCents == 0 { protects.append("No financial saving is assumed.") }
            if keys.contains("Physical limitations") && idea.movementMode == "seated" { told.append("You asked us to work around physical comfort; this version can be seated.") }
            if idea.effort == .gentle { protects.append("A gentle version, with room to adapt.") }
            if keys.contains("Fatigue") && idea.minutes > 15 { score -= 4 }
            if keys.contains("Privacy matters") && idea.social { score -= 2 }
            if keys.contains("Caring responsibilities") { score += idea.category == .family ? 2 : idea.extraMin > 0 ? -2 : 0 }
            let history = s.entries.filter { $0.ideaId == idea.id && $0.status == .completed }
            let worthwhile = history.filter { $0.worthwhile == true }.count, notWorthwhile = history.count - worthwhile
            score += Double(min(6, worthwhile * 2)) - Double(min(8, notWorthwhile * 4))
            let added = history.filter { $0.additionalMovement == .more && $0.worthwhile == true }.count
            if added > 0 { score += Double(min(2, added)); learned.append("You said this idea added movement on \(added) worthwhile tries.") }
            if !history.isEmpty { learned.append("\(worthwhile) of your \(history.count) confirmed tries felt worthwhile.") }
            for value in idea.promised where value != .movement && value != .moneySaved {
                if let w = weights[value], w.promised > 0 { score += (w.weight - 0.5) * 3 }
            }
            let recentPasses = (s.passes ?? []).filter { $0.ideaId == idea.id && (ISO.date($0.at).map { now.timeIntervalSince($0) < 12 * 3600 } ?? false) }
            if !recentPasses.isEmpty { score -= 1 }
            return Ranked(idea: idea, score: score, told: Array(told.prefix(4)), learned: learned, protects: protects)
        }.filter { $0.score >= 6 }

        var result: [Ranked] = []
        while !ranked.isEmpty {
            var best = 0, bestScore = -Double.infinity
            for (n, r) in ranked.enumerated() {
                let walksSoFar = result.filter { $0.idea.movementMode == "walk" }.count
                if result.count < 5 && r.idea.movementMode == "walk" && walksSoFar >= 2 && ranked.contains(where: { $0.idea.movementMode != "walk" }) { continue }
                let similarity = result.suffix(4).reduce(0.0) { sum, p in sum + (p.idea.category == r.idea.category ? 1 : 0) + (p.idea.family == r.idea.family ? 2 : 0) + (p.idea.mechanism == r.idea.mechanism ? 1 : 0) }
                let walkPenalty: Double = (result.count < 5 && r.idea.movementMode == "walk" && walksSoFar >= 2) ? 20 : 0
                let score = r.score - similarity * 1.2 - walkPenalty
                if score > bestScore { best = n; bestScore = score }
            }
            result.append(ranked.remove(at: best))
        }
        return result
    }

    /// `moneyValue()`: an estimate, never money already kept.
    static func moneyValue(_ idea: Idea, _ s: AppState) -> MoneyEstimate? {
        if let cost = (s.costs ?? []).first(where: { $0.ideaId == idea.id && $0.currency == s.profile.currency }) {
            let usual = String(format: "%.2f", Double(cost.usualCents) / 100), move = String(format: "%.2f", Double(cost.moveCents) / 100)
            return MoneyEstimate(cents: cost.saving, currency: cost.currency, source: "Your entered usual cost (\(usual) \(cost.currency)) minus this move’s total cost (\(move) \(cost.currency)), including extra costs. This is a calculated saving if you make that swap; only the amount you confirm afterwards enters My Wins.")
        }
        if let last = s.entries.reversed().first(where: { $0.ideaId == idea.id && $0.status == .completed && $0.currency == s.profile.currency && ($0.moneyCents ?? 0) > 0 }) {
            return MoneyEstimate(cents: last.moneyCents ?? 0, currency: last.currency, source: "You confirmed this saving on a previous try.")
        }
        if idea.moneySource != .none && idea.moneyCents > 0 && s.profile.currency == "AUD" {
            return MoneyEstimate(cents: idea.moneyCents, currency: "AUD", source: "\(idea.source == .ai ? "AI" : "Library") assumption: \(idea.moneySource.rawValue.replacingOccurrences(of: "_", with: " ")) against “\(idea.usual)”. Not money already kept. Check the actual cost; only your confirmation enters My Wins.")
        }
        return nil
    }
}
