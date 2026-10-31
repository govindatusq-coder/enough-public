import Foundation

/// Values from `Resources/EnoughConfig.plist`. The Supabase publishable key is
/// a public key (the website ships the same one as `NEXT_PUBLIC_...`); the
/// server-only OpenAI key never reaches the app.
struct Config {
    let supabaseURL: URL?
    let supabasePublishableKey: String
    let webOrigin: URL

    static let shared: Config = {
        var values: [String: Any] = [:]
        if let url = Bundle.main.url(forResource: "EnoughConfig", withExtension: "plist"), let data = try? Data(contentsOf: url), let plist = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any] {
            values = plist
        }
        let supabase = (values["SupabaseURL"] as? String).flatMap { Config.origin($0) }
        let key = (values["SupabasePublishableKey"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let web = (values["WebOrigin"] as? String).flatMap { Config.origin($0) } ?? URL(string: "https://enough-public.vercel.app")!
        return Config(supabaseURL: supabase, supabasePublishableKey: key, webOrigin: web)
    }()

    /// Accounts need both a Supabase origin and its publishable key.
    var accountsAvailable: Bool { supabaseURL != nil && !supabasePublishableKey.isEmpty }

    /// Only a bare HTTPS origin is accepted, matching `native/configure.mjs`.
    static func origin(_ text: String) -> URL? {
        guard let url = URL(string: text.trimmingCharacters(in: .whitespacesAndNewlines)), url.scheme == "https", let host = url.host, !host.isEmpty, url.user == nil, url.password == nil, url.port == nil, url.query == nil, url.fragment == nil, url.path == "" || url.path == "/" else { return nil }
        return URL(string: "https://\(host)")
    }

    var privacyURL: URL { webOrigin.appendingPathComponent("privacy") }
}
