import Foundation

/// Mirrors `lib/ai-consent.ts`. Fresh OpenAI ideas need an explicit, versioned choice.
enum AIConsentChoice: String, Codable, CaseIterable {
    case full, withoutHealth = "without-health", declined
    var label: String {
        switch self {
        case .full: return "Use AI ideas"
        case .withoutHealth: return "Use AI ideas without my health needs"
        case .declined: return "Not now"
        }
    }
    var detail: String {
        switch self {
        case .full: return "Include my needs to help OpenAI shape ideas."
        case .withoutHealth: return "Send approved non-health choices only. Leave out health needs, usual-day activity, written notes and earlier AI text. ENOUGH still checks every idea against all my needs before showing it."
        case .declined: return "Keep using the library without new OpenAI requests."
        }
    }
}

struct AIConsent: Codable, Equatable {
    static let currentVersion = 1
    var choice: AIConsentChoice
    var version: Int
    var decidedAt: String

    static func make(_ choice: AIConsentChoice, now: Date = Date()) -> AIConsent {
        AIConsent(choice: choice, version: currentVersion, decidedAt: ISO.string(now))
    }
    var isCurrent: Bool { version == AIConsent.currentVersion }
    /// `hasAiConsent()`: a current, non-declined choice.
    var allowsRequests: Bool { isCurrent && choice != .declined }
}
