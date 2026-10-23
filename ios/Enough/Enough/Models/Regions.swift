import Foundation

/// Mirrors `lib/regions.ts`. Currencies are never converted or combined.
struct Region: Identifiable {
    let code: String, name: String, currency: String, locale: String
    var id: String { code }
}

struct Cost: Codable, Equatable {
    var ideaId: Int
    var currency: String
    var usualCents: Int
    var moveCents: Int
    var updatedAt: String

    var saving: Int { max(0, usualCents - moveCents) }
}

enum Regions {
    static let currencyCodes = ["AUD", "NZD", "USD", "GBP", "CAD", "EUR", "SGD", "ZAR"]
    static let all: [Region] = [
        Region(code: "AU", name: "Australia", currency: "AUD", locale: "en_AU"),
        Region(code: "NZ", name: "New Zealand", currency: "NZD", locale: "en_NZ"),
        Region(code: "US", name: "United States", currency: "USD", locale: "en_US"),
        Region(code: "GB", name: "United Kingdom", currency: "GBP", locale: "en_GB"),
        Region(code: "CA", name: "Canada", currency: "CAD", locale: "en_CA"),
        Region(code: "IE", name: "Ireland", currency: "EUR", locale: "en_IE"),
        Region(code: "SG", name: "Singapore", currency: "SGD", locale: "en_SG"),
        Region(code: "ZA", name: "South Africa", currency: "ZAR", locale: "en_ZA")
    ]

    static func region(for country: String?) -> Region? { all.first { $0.code == country } }

    /// Formats cents with the ISO code, as the website does (`currencyDisplay: 'code'`).
    static func formatMoney(_ cents: Int, currency: String, country: String? = nil) -> String {
        let f = NumberFormatter()
        f.numberStyle = .currencyISOCode
        f.currencyCode = currency
        f.locale = Locale(identifier: region(for: country)?.locale ?? "en")
        return f.string(from: NSNumber(value: Double(cents) / 100)) ?? "\(currency) \(String(format: "%.2f", Double(cents) / 100))"
    }

    /// `parseMoney()`: up to four whole digits and two decimals, at most 1,000.00.
    static func parseMoney(_ text: String) -> Int? {
        let value = text.trimmingCharacters(in: .whitespaces)
        guard value.range(of: "^\\d{1,4}(\\.\\d{1,2})?$", options: .regularExpression) != nil else { return nil }
        let parts = value.split(separator: ".", omittingEmptySubsequences: false)
        let whole = Int(parts[0]) ?? 0
        var fraction = parts.count > 1 ? String(parts[1]) : ""
        while fraction.count < 2 { fraction += "0" }
        let cents = whole * 100 + (Int(fraction) ?? 0)
        return cents <= 100_000 ? cents : nil
    }
}
