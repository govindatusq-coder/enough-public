import Foundation

/// Mirrors `lib/daily-contexts.ts`.
enum DailyContexts {
    static let todayContexts = ["Less time", "Lower energy", "Feeling stressed", "Tired after a shift", "Plans changed", "Nothing different"]
    static let sittingContexts = ["Desk work", "Driving", "Evenings", "Feeding and settling", "Commute", "It varies"]

    static func matchesSittingContext(_ idea: Idea, context: String) -> Bool {
        if !idea.breaksSitting || idea.minutes > 3 { return false }
        switch context {
        case "It varies": return true
        case "Desk work": return idea.category == .work || idea.key == "short-call-pace"
        case "Driving": return idea.key == "parked-driving-pause"
        case "Evenings": return ["evening-room-lap", "ad-break-wall-pushups", "kettle-calf-raises"].contains(idea.key)
        case "Feeding and settling": return idea.key == "settled-room-walk"
        default: return idea.category == .travel
        }
    }
}
