import Foundation
import HealthKit

/// Read-only Apple Health access to steps and exercise time, mirroring the
/// Capacitor bridge in `native/ios/App/App/EnoughMovementPlugin.swift`.
/// Daily totals stay in memory; nothing is written to Health.
@MainActor
final class HealthService: ObservableObject {
    @Published private(set) var enabled = false
    private let store = HKHealthStore()
    private let steps = HKQuantityType(.stepCount)
    private let exercise = HKQuantityType(.appleExerciseTime)
    private var generation = 0

    var isAvailable: Bool { HKHealthStore.isHealthDataAvailable() }

    /// Finishing the permission sheet does NOT prove read access was granted.
    func authorize() async throws {
        guard isAvailable else { throw EnoughError.message("Health data unavailable") }
        do {
            try await store.requestAuthorization(toShare: [], read: [steps, exercise])
        } catch {
            throw EnoughError.message("Health authorization did not finish")
        }
        enabled = true
    }

    func disconnect() {
        enabled = false
        generation += 1
    }

    private func sum(_ type: HKQuantityType, unit: HKUnit, start: Date, end: Date) async -> Double? {
        guard enabled else { return nil }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [.strictStartDate, .strictEndDate])
        return await withCheckedContinuation { continuation in
            let query = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, result, _ in
                continuation.resume(returning: result?.sumQuantity()?.doubleValue(for: unit))
            }
            store.execute(query)
        }
    }

    /// The last fifteen days, including today so far.
    func readSnapshot() async throws -> MovementSnapshot {
        guard enabled else { throw EnoughError.message("Connect health data first") }
        let current = generation, now = Date(), readAt = ISO.string(now)
        var calendar = Calendar.current; calendar.timeZone = .current
        let today = calendar.startOfDay(for: now)
        var days: [MovementDay] = []
        for offset in -14...0 {
            guard enabled, current == generation else { throw EnoughError.message("Reading cancelled") }
            let start = calendar.date(byAdding: .day, value: offset, to: today)!
            let end = min(calendar.date(byAdding: .day, value: 1, to: start)!, now)
            let stepTotal = await sum(steps, unit: .count(), start: start, end: end)
            let minutes = await sum(exercise, unit: .minute(), start: start, end: end)
            days.append(MovementDay(date: localDate(start), steps: stepTotal, exerciseMinutes: minutes))
        }
        return MovementSnapshot(source: .appleHealth, timezone: TimeZone.current.identifier, readAt: readAt, days: days)
    }

    /// Totals during one activity window of up to a day, within the last fortnight.
    func readWindow(start startText: String, end endText: String) async throws -> MovementEvidence {
        guard enabled else { throw EnoughError.message("Connect health data first") }
        let now = Date()
        guard let start = ISO.date(startText), let end = ISO.date(endText), start < end, end <= now, end.timeIntervalSince(start) <= 86400, now.timeIntervalSince(start) <= 15 * 86400 else { throw EnoughError.message("Invalid movement window") }
        let current = generation
        let stepTotal = await sum(steps, unit: .count(), start: start, end: end)
        let minutes = await sum(exercise, unit: .minute(), start: start, end: end)
        guard enabled, current == generation else { throw EnoughError.message("Reading cancelled") }
        return MovementEvidence(source: .appleHealth, start: startText, end: endText, readAt: ISO.string(now), steps: stepTotal, exerciseMinutes: minutes)
    }

    /// Safe recovery copy without raw diagnostics (`movementReadError()` in the web).
    static func readError(_ error: Error) -> (retryConnect: Bool, message: String) {
        let raw = error.localizedDescription.lowercased()
        if raw.contains("not granted") || raw.contains("denied") || raw.contains("permission") || raw.contains("authoriz") || raw.contains("connect health data first") {
            return (true, "Health access could not be confirmed. Check ENOUGH’s read permissions in Settings → Health, then retry. Manual check-ins are available.")
        }
        if raw.contains("unavailable") || raw.contains("not implemented") {
            return (true, "Health data is unavailable on this device. Manual check-ins are available.")
        }
        return (false, "Movement data could not be read. Check health permissions in Settings → Health, then retry. Manual check-ins are available.")
    }
}
