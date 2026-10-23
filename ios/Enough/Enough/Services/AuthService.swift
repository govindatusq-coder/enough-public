import Foundation
import AuthenticationServices
import CryptoKit

/// Email and password sign-in against the same Supabase project as the
/// website, using the GoTrue REST API directly. The session is kept in the
/// Keychain and refreshed before it expires.
struct AuthUser: Codable, Equatable {
    var id: String
    var email: String?
}

struct AuthSession: Codable, Equatable {
    var accessToken: String
    var refreshToken: String
    var expiresAt: Date
    var user: AuthUser
}

struct AuthProviders: Equatable {
    var google = false
    var apple = false
}

@MainActor
final class AuthService: ObservableObject {
    @Published private(set) var session: AuthSession?
    @Published private(set) var providers = AuthProviders()
    private let config: Config
    private let keychainAccount = "session"
    private var refreshing: Task<AuthSession, Error>?

    init(config: Config = .shared) {
        self.config = config
        if let data = Keychain.read(keychainAccount), let saved = try? JSONDecoder.iso.decode(AuthSession.self, from: data) {
            session = saved
        }
    }

    var isSignedIn: Bool { session != nil }
    var email: String { session?.user.email ?? "" }
    var available: Bool { config.accountsAvailable }

    private struct TokenResponse: Decodable {
        var access_token: String?
        var refresh_token: String?
        var expires_in: Double?
        var user: AuthUser?
    }
    private struct ErrorBody: Decodable {
        var msg: String?
        var error_description: String?
        var error: String?
        var error_code: String?
    }

    private func endpoint(_ path: String, query: [String: String] = [:]) throws -> URL {
        guard let base = config.supabaseURL, var components = URLComponents(url: base.appendingPathComponent("auth/v1/\(path)"), resolvingAgainstBaseURL: false) else { throw EnoughError.message("Accounts are not configured in this build.") }
        if !query.isEmpty { components.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) } }
        guard let url = components.url else { throw EnoughError.message("Accounts are not configured in this build.") }
        return url
    }

    private func post(_ path: String, query: [String: String] = [:], body: [String: Any], bearer: String? = nil) async throws -> (Data, HTTPURLResponse) {
        var request = URLRequest(url: try endpoint(path, query: query))
        request.httpMethod = "POST"
        request.setValue(config.supabasePublishableKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let bearer { request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization") }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        request.timeoutInterval = 30
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw EnoughError.message("The account service did not respond.") }
        return (data, http)
    }

    private func store(_ token: TokenResponse) throws -> AuthSession {
        guard let access = token.access_token, let refresh = token.refresh_token, let user = token.user else { throw EnoughError.message("No session was returned.") }
        let next = AuthSession(accessToken: access, refreshToken: refresh, expiresAt: Date().addingTimeInterval(token.expires_in ?? 3600), user: user)
        session = next
        if let data = try? JSONEncoder.iso.encode(next) { Keychain.write(keychainAccount, data: data) }
        return next
    }

    private func message(_ data: Data, fallback: String) -> String {
        if let body = try? JSONDecoder().decode(ErrorBody.self, from: data) {
            if body.error_code == "invalid_credentials" { return "Sign-in failed. Check your email and password." }
            if body.error_code == "email_not_confirmed" { return "Confirm your email first, then sign in." }
            if body.error_code == "user_already_exists" { return "An account already uses this email. Sign in instead." }
            if body.error_code == "over_email_send_rate_limit" || body.error_code == "over_request_rate_limit" { return "Too many attempts for now. Try again in a few minutes." }
            if body.error_code == "weak_password" { return "Choose a longer password, at least 8 characters." }
        }
        return fallback
    }

    func signIn(email: String, password: String) async throws {
        let (data, http) = try await post("token", query: ["grant_type": "password"], body: ["email": email, "password": password])
        guard http.statusCode == 200 else { throw EnoughError.message(message(data, fallback: "Sign-in failed. Check your email and password.")) }
        _ = try store(try JSONDecoder().decode(TokenResponse.self, from: data))
    }

    /// Returns true when a session was created immediately; false when the
    /// account must be confirmed by email first.
    func signUp(email: String, password: String) async throws -> Bool {
        let redirect = config.webOrigin.appendingPathComponent("auth/callback").absoluteString
        let (data, http) = try await post("signup", query: ["redirect_to": redirect], body: ["email": email, "password": password])
        guard http.statusCode == 200 else { throw EnoughError.message(message(data, fallback: "Your account could not be created. Check your details and try again.")) }
        let token = try JSONDecoder().decode(TokenResponse.self, from: data)
        if token.access_token != nil { _ = try store(token); return true }
        return false
    }

    func recover(email: String) async throws {
        let redirect = config.webOrigin.appendingPathComponent("auth/callback").absoluteString + "?next=%2Fupdate-password"
        let (data, http) = try await post("recover", query: ["redirect_to": redirect], body: ["email": email])
        guard http.statusCode == 200 else { throw EnoughError.message(message(data, fallback: "The reset link could not be sent. Try again later.")) }
    }

    func signOut() async {
        if let current = session { _ = try? await post("logout", body: [:], bearer: current.accessToken) }
        session = nil
        Keychain.delete(keychainAccount)
    }

    /// Google or Apple sign-in through Supabase's hosted flow in a system web
    /// session, with PKCE, returning to the app on its custom URL scheme.
    func signIn(provider: String) async throws {
        guard config.supabaseURL != nil else { throw EnoughError.message("Accounts are not configured in this build.") }
        let verifier = AuthService.randomString(64)
        let challenge = Data(SHA256.hash(data: Data(verifier.utf8))).base64URL()
        let callback = "\(AuthService.urlScheme)://auth-callback"
        let authorize = try endpoint("authorize", query: ["provider": provider, "redirect_to": callback, "code_challenge": challenge, "code_challenge_method": "s256"])
        let returned = try await WebAuthSession.shared.run(url: authorize, scheme: AuthService.urlScheme)
        guard let code = URLComponents(url: returned, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "code" })?.value else {
            let description = URLComponents(url: returned, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "error_description" })?.value
            throw EnoughError.message(description ?? "Sign-in did not complete. Try again or use your email.")
        }
        let (data, http) = try await post("token", query: ["grant_type": "pkce"], body: ["auth_code": code, "code_verifier": verifier])
        guard http.statusCode == 200 else { throw EnoughError.message(message(data, fallback: "Sign-in did not complete. Try again or use your email.")) }
        _ = try store(try JSONDecoder().decode(TokenResponse.self, from: data))
    }

    static let urlScheme = "app.enough.movement"
    private static func randomString(_ length: Int) -> String {
        let alphabet = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")
        return String((0..<length).map { _ in alphabet.randomElement()! })
    }

    func loadProviders() async {
        guard let url = try? endpoint("settings") else { return }
        var request = URLRequest(url: url)
        request.setValue(config.supabasePublishableKey, forHTTPHeaderField: "apikey")
        guard let (data, _) = try? await URLSession.shared.data(for: request), let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let external = json["external"] as? [String: Any] else { return }
        providers = AuthProviders(google: external["google"] as? Bool == true, apple: external["apple"] as? Bool == true)
    }

    /// A bearer token for the website's API, refreshed when it is about to expire.
    func accessToken() async throws -> String {
        guard let current = session else { throw EnoughError.message("Sign in to ENOUGH first.") }
        if current.expiresAt.timeIntervalSinceNow > 60 { return current.accessToken }
        if let task = refreshing { return try await task.value.accessToken }
        let task = Task<AuthSession, Error> { [weak self] in
            guard let self else { throw EnoughError.message("Sign in to ENOUGH first.") }
            let (data, http) = try await self.post("token", query: ["grant_type": "refresh_token"], body: ["refresh_token": current.refreshToken])
            guard http.statusCode == 200 else {
                self.session = nil
                Keychain.delete(self.keychainAccount)
                throw EnoughError.message("Your session has ended. Sign in again to keep saving.")
            }
            return try self.store(try JSONDecoder().decode(TokenResponse.self, from: data))
        }
        refreshing = task
        defer { refreshing = nil }
        return try await task.value.accessToken
    }
}

extension Data {
    func base64URL() -> String { base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "") }
}

/// Presents the system sign-in sheet and hands back the callback URL.
@MainActor
final class WebAuthSession: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = WebAuthSession()
    private var session: ASWebAuthenticationSession?

    func run(url: URL, scheme: String) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: scheme) { callback, error in
                if let callback { continuation.resume(returning: callback) }
                else if let error as? ASWebAuthenticationSessionError, error.code == .canceledLogin { continuation.resume(throwing: EnoughError.message("Sign-in was cancelled.")) }
                else { continuation.resume(throwing: EnoughError.message("Sign-in did not complete. Try again or use your email.")) }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.session = session
            if !session.start() { continuation.resume(throwing: EnoughError.message("Sign-in could not open. Try again or use your email.")) }
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first ?? ASPresentationAnchor()
    }
}

extension JSONDecoder {
    static let iso: JSONDecoder = { let d = JSONDecoder(); d.dateDecodingStrategy = .iso8601; return d }()
}
extension JSONEncoder {
    static let iso: JSONEncoder = { let e = JSONEncoder(); e.dateEncodingStrategy = .iso8601; return e }()
    /// Stable, compact output for comparing and uploading account snapshots.
    static let account: JSONEncoder = { let e = JSONEncoder(); e.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]; return e }()
}
