import Foundation

/// What an idea gives back, as one definite money figure and one time figure.
///
/// Money kept = direct saving (a fee, fare or purchase the idea avoids, or the
/// user's own cost calculation) + the cost of buying the same minutes of
/// movement as a casual gym or class visit, which this idea makes unnecessary.
/// Time = minutes of movement, and how many minutes of the day the idea takes
/// beyond what was already happening. The workings are shown in the app.
struct IdeaValue {
    struct Line: Identifiable { let label: String; let cents: Int; var id: String { label } }
    let currency: String
    let directCents: Int
    let directSource: String?
    let equivalentCents: Int
    let minutes: Int
    let extraMinutes: Int

    var totalCents: Int { directCents + equivalentCents }
    var lines: [Line] {
        var out: [Line] = []
        if directCents > 0 { out.append(Line(label: directSource ?? "Cost avoided", cents: directCents)) }
        out.append(Line(label: "\(minutes) minutes of movement you would otherwise buy as a casual visit", cents: equivalentCents))
        return out
    }
    /// Minutes of movement gained for no extra time in the day.
    var minutesForFree: Int { max(0, minutes - max(0, extraMinutes)) }
    var timeLabel: String {
        extraMinutes > 0 ? "\(extraMinutes) min of your day" : extraMinutes < 0 ? "\(-extraMinutes) min given back" : "0 min of your day"
    }
}

enum Economics {
    /// Typical casual gym or class visit, per currency, and the minutes it buys.
    /// Assumptions, not quotes; the workings sheet says so and invites the user
    /// to confirm real savings after the move.
    static let casualVisit: [String: (cents: Int, minutes: Int)] = [
        "AUD": (2000, 45), "NZD": (2000, 45), "USD": (1500, 45), "GBP": (1200, 45), "CAD": (1800, 45), "EUR": (1400, 45), "SGD": (2000, 45), "ZAR": (15000, 45)
    ]

    static func value(of idea: Idea, in state: AppState) -> IdeaValue {
        let currency = state.profile.currency
        let direct = Recommendations.moneyValue(idea, state)
        let visit = casualVisit[currency] ?? casualVisit["AUD"]!
        let equivalent = Int((Double(visit.cents) / Double(visit.minutes) * Double(idea.minutes)).rounded())
        let directCents = direct?.currency == currency ? direct!.cents : 0
        let directLabel: String? = {
            guard directCents > 0 else { return nil }
            if (state.costs ?? []).contains(where: { $0.ideaId == idea.id && $0.currency == currency }) { return "Your own cost calculation" }
            if direct?.source.hasPrefix("You confirmed") == true { return "What you kept last time" }
            switch idea.moneySource {
            case .feeAvoided: return "Delivery or service fee avoided"
            case .transportAvoided: return "Fare, fuel or parking avoided"
            case .purchaseAvoided: return "Purchase avoided"
            case .none: return "Cost avoided"
            }
        }()
        return IdeaValue(currency: currency, directCents: directCents, directSource: directLabel, equivalentCents: equivalent, minutes: idea.minutes, extraMinutes: idea.extraMin)
    }

    static func money(_ cents: Int, _ state: AppState) -> String {
        Regions.formatMoney(cents, currency: state.profile.currency, country: state.profile.country)
    }
}
