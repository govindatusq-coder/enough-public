import Foundation

/// The website's own API routes, called with a bearer token instead of the
/// browser cookie. All validation, consent checks, quotas and OpenAI calls stay
/// on the server exactly as they do for the web app.
struct AccountResponse: Decodable {
    struct User: Decodable { var email: String?; var name: String? }
    var user: User?
    var state: AppState?
    var revision: Int
    var updatedAt: String?
    /// Top-level account fields this version of the app doesn't model (for
    /// example the website's Life Map). Kept and sent back untouched on save.
    var stateExtras: [String: Any] = [:]

    enum CodingKeys: String, CodingKey { case user, state, revision, updatedAt }
}

/// Account fields the app understands. Anything else in the saved account is
/// preserved rather than silently dropped when the app saves.
enum AccountFields {
    static var known: Set<String> { Set(Mirror(reflecting: AppState.empty).children.compactMap(\.label)) }

    static func extras(fromAccountJSON data: Data) -> [String: Any] {
        guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let state = root["state"] as? [String: Any] else { return [:] }
        let known = AccountFields.known
        return state.filter { !known.contains($0.key) }
    }

    /// The state the app encodes, plus preserved fields it doesn't model. The app's own fields always win.
    static func merged(_ encoded: Data, extras: [String: Any]) throws -> [String: Any] {
        guard var object = try JSONSerialization.jsonObject(with: encoded) as? [String: Any] else { throw EnoughError.message("Your changes could not be prepared.") }
        for (key, value) in extras where object[key] == nil { object[key] = value }
        return object
    }
}

struct SaveResponse: Decodable { var revision: Int }

struct IdeasResponse: Decodable {
    var ideas: [Idea]?
    var picturesPrepared: Int?
    var imageWarning: Bool?
    var error: String?
    var consentRequired: Bool?
}

struct HistoryPage: Decodable {
    var ideas: [Idea]
    var hasMore: Bool
    var nextCursor: String?
}

struct IdeaImageCredit: Decodable, Equatable {
    var image: String
    var alt: String?
    var kind: String?
    var creator: String?
    var license: String?
    var sourceUrl: String?
}

struct ActivityPhoto: Decodable, Identifiable, Equatable {
    var id: String
    var entry_id: String
    var caption: String
    var created_at: String
}

enum APIError: LocalizedError {
    case status(Int, String)
    case offline
    var errorDescription: String? {
        switch self {
        case .status(_, let message): return message
        case .offline: return "ENOUGH could not reach its server. Check your connection and try again."
        }
    }
    var code: Int { if case .status(let c, _) = self { return c }; return 0 }
}

@MainActor
final class EnoughAPI {
    private let auth: AuthService
    private let origin: URL
    private let session: URLSession

    init(auth: AuthService, config: Config = .shared) {
        self.auth = auth
        self.origin = config.webOrigin
        let configuration = URLSessionConfiguration.default
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.timeoutIntervalForRequest = 60
        session = URLSession(configuration: configuration)
    }

    private struct ErrorBody: Decodable { var error: String?; var consentRequired: Bool? }

    /// Strict percent-encoding for a query value: `+`, `&` and `=` are escaped
    /// too, so an ISO timestamp with a `+00:00` offset survives the round trip.
    static func queryValue(_ value: String) -> String? {
        value.addingPercentEncoding(withAllowedCharacters: CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-._~")))
    }

    private func request(_ path: String, method: String = "GET", body: Data? = nil, contentType: String? = nil, timeout: TimeInterval = 60) async throws -> (Data, HTTPURLResponse) {
        let token = try await auth.accessToken()
        var request = URLRequest(url: URL(string: path, relativeTo: origin)!.absoluteURL)
        request.httpMethod = method
        request.timeoutInterval = timeout
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let contentType { request.setValue(contentType, forHTTPHeaderField: "Content-Type") }
        request.httpBody = body
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else { throw APIError.offline }
            return (data, http)
        } catch let error as APIError { throw error } catch { throw APIError.offline }
    }

    private func failure(_ data: Data, _ http: HTTPURLResponse, fallback: String) -> APIError {
        let message = (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error ?? fallback
        return .status(http.statusCode, message)
    }

    func account() async throws -> AccountResponse {
        let (data, http) = try await request("/api/account")
        guard http.statusCode == 200 else { throw failure(data, http, fallback: "Your account could not be loaded. Please try again.") }
        var account = try JSONDecoder().decode(AccountResponse.self, from: data)
        account.stateExtras = AccountFields.extras(fromAccountJSON: data)
        return account
    }

    func saveAccount(_ state: AppState, revision: Int, extras: [String: Any] = [:]) async throws -> Int {
        let stateObject = try AccountFields.merged(JSONEncoder.account.encode(state), extras: extras)
        let body = try JSONSerialization.data(withJSONObject: ["revision": revision, "state": stateObject], options: [.sortedKeys, .withoutEscapingSlashes])
        let (data, http) = try await request("/api/account", method: "PUT", body: body, contentType: "application/json")
        guard http.statusCode == 200 else { throw failure(data, http, fallback: "Your changes could not be saved. Please try again.") }
        return try JSONDecoder().decode(SaveResponse.self, from: data).revision
    }

    func deleteAccount(revision: Int) async throws {
        let body = try JSONSerialization.data(withJSONObject: ["revision": revision, "confirmation": "DELETE ENOUGH DATA"])
        let (data, http) = try await request("/api/account", method: "DELETE", body: body, contentType: "application/json")
        guard http.statusCode == 200 else { throw failure(data, http, fallback: "Could not delete your data.") }
    }

    /// `GET /api/ideas` needs no sign-in; it only says whether OpenAI is connected.
    func aiAvailable() async -> Bool {
        var request = URLRequest(url: URL(string: "/api/ideas", relativeTo: origin)!.absoluteURL)
        request.timeoutInterval = 20
        guard let (data, _) = try? await session.data(for: request), let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return false }
        return json["available"] as? Bool == true
    }

    func freshIdeas(timezone: String) async throws -> IdeasResponse {
        let body = try JSONSerialization.data(withJSONObject: ["timezone": timezone])
        let (data, http) = try await request("/api/ideas", method: "POST", body: body, contentType: "application/json", timeout: 300)
        let decoded = (try? JSONDecoder().decode(IdeasResponse.self, from: data)) ?? IdeasResponse()
        if http.statusCode != 200 { throw APIError.status(http.statusCode, decoded.consentRequired == true ? "consent-required" : (decoded.error ?? "New ideas are unavailable.")) }
        return decoded
    }

    func history(before: String?) async throws -> HistoryPage {
        var path = "/api/ideas/history"
        if let before, let encoded = EnoughAPI.queryValue(before) { path += "?before=\(encoded)" }
        let (data, http) = try await request(path)
        guard http.statusCode == 200 else { throw failure(data, http, fallback: "Earlier suggestions could not be loaded.") }
        return try JSONDecoder().decode(HistoryPage.self, from: data)
    }

    enum ImageResult { case ready(IdeaImageCredit), pending(Int), unavailable(String) }

    func ideaImage(id: Int) async throws -> ImageResult {
        let (data, http) = try await request("/api/idea-image?id=\(id)", timeout: 30)
        if http.statusCode == 202 {
            let retry = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["retryAfter"] as? Int ?? 3
            return .pending(max(1, min(10, retry)))
        }
        guard http.statusCode == 200, let credit = try? JSONDecoder().decode(IdeaImageCredit.self, from: data) else {
            return .unavailable((try? JSONDecoder().decode(ErrorBody.self, from: data))?.error ?? "The picture is not ready. Your idea is still available.")
        }
        return .ready(credit)
    }

    /// Bytes for an image path returned by the API or a licensed external photo.
    func imageData(_ path: String) async throws -> Data {
        if path.hasPrefix("https://") {
            guard let url = URL(string: path) else { throw APIError.offline }
            let (data, _) = try await session.data(from: url)
            return data
        }
        let (data, http) = try await request(path, timeout: 30)
        guard http.statusCode == 200 else { throw failure(data, http, fallback: "The picture could not be loaded.") }
        return data
    }

    func photos() async throws -> [ActivityPhoto] {
        struct Body: Decodable { var photos: [ActivityPhoto] }
        let (data, http) = try await request("/api/photos")
        guard http.statusCode == 200 else { throw failure(data, http, fallback: "Your photos could not be loaded. Try again.") }
        return try JSONDecoder().decode(Body.self, from: data).photos
    }

    func photoData(id: String) async throws -> Data {
        try await imageData("/api/photos?id=\(EnoughAPI.queryValue(id) ?? id)")
    }

    func uploadPhoto(entryId: String, caption: String, jpeg: Data) async throws -> ActivityPhoto {
        struct Body: Decodable { var photo: ActivityPhoto }
        let boundary = "enough-\(UUID().uuidString)"
        var body = Data()
        func field(_ name: String, _ value: String) {
            body.append("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(name)\"\r\n\r\n\(value)\r\n".data(using: .utf8)!)
        }
        field("entryId", entryId)
        field("caption", caption)
        body.append("--\(boundary)\r\nContent-Disposition: form-data; name=\"photo\"; filename=\"move.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
        body.append(jpeg)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        let (data, http) = try await request("/api/photos", method: "POST", body: body, contentType: "multipart/form-data; boundary=\(boundary)", timeout: 120)
        guard http.statusCode == 201 else { throw failure(data, http, fallback: "Your photo could not be saved. Please try again.") }
        return try JSONDecoder().decode(Body.self, from: data).photo
    }

    func deletePhoto(id: String) async throws {
        let body = try JSONSerialization.data(withJSONObject: ["id": id])
        let (data, http) = try await request("/api/photos", method: "DELETE", body: body, contentType: "application/json")
        guard http.statusCode == 200 else { throw failure(data, http, fallback: "Your photo could not be removed. Try again.") }
    }
}
