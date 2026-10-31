import Foundation

/// Mirrors `lib/move-memories.ts`: voluntary name exchanges when people meet.
enum CompanionSource: String, Codable { case qr, manual }

struct Companion: Codable, Identifiable, Equatable {
    var id: String
    var name: String
    var source: CompanionSource
    var metAt: String
}

enum MeetingCode {
    private struct Payload: Codable { var app: String; var version: Int; var name: String }

    /// The text encoded in a name QR. It contains only the chosen name.
    static func make(name: String) throws -> String {
        let n = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !n.isEmpty, n.count <= 60 else { throw EnoughError.message("Use a first name or nickname, up to 60 characters.") }
        let data = try JSONEncoder().encode(Payload(app: "ENOUGH", version: 1, name: n))
        return String(decoding: data, as: UTF8.self)
    }

    static func read(_ raw: String) throws -> String {
        guard raw.count <= 500, let data = raw.data(using: .utf8), let payload = try? JSONDecoder().decode(Payload.self, from: data) else { throw EnoughError.message("This is not an ENOUGH name QR.") }
        let name = payload.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard payload.app == "ENOUGH", payload.version == 1, !name.isEmpty, payload.name.count <= 60 else { throw EnoughError.message("Ask them to show their ENOUGH name QR.") }
        return name
    }

    static func add(_ list: [Companion], name: String, source: CompanionSource) throws -> [Companion] {
        let n = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !n.isEmpty, n.count <= 60 else { throw EnoughError.message("Use a first name or nickname, up to 60 characters.") }
        if list.contains(where: { $0.name.lowercased() == n.lowercased() }) { throw EnoughError.message("That name is already recorded for this move.") }
        if list.count >= 10 { throw EnoughError.message("You can record up to ten people per move.") }
        return list + [Companion(id: UUID().uuidString.lowercased(), name: n, source: source, metAt: ISO.string())]
    }
}
