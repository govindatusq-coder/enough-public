import Foundation
import Capacitor
import HealthKit

@objc(EnoughViewController)
class EnoughViewController: CAPBridgeViewController {
    override func capacitorDidLoad() { bridge?.registerPluginInstance(EnoughMovementPlugin()) }
}

@objc(EnoughMovementPlugin)
public class EnoughMovementPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "EnoughMovementPlugin"
    public let jsName = "EnoughMovement"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise)
    ]
    private let store = HKHealthStore()
    private var enabled = false
    private var generation = 0
    private var activeQueries: [HKQuery] = []
    private let steps = HKQuantityType.quantityType(forIdentifier: .stepCount)!
    private let exercise = HKQuantityType.quantityType(forIdentifier: .appleExerciseTime)!
    private func trusted() -> Bool {
        guard let url = bridge?.webView?.url else { return false }
        return url.scheme == "https" && url.host == "enough-movement.govindatusq.chatgpt.site" && (url.port == nil || url.port == 443)
    }
    @objc func authorize(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.trusted(), HKHealthStore.isHealthDataAvailable() else { call.reject("Health data unavailable"); return }
            // Success means the permission sheet finished, NOT that read access was granted.
            self.store.requestAuthorization(toShare: [], read: Set([self.steps, self.exercise])) { success, error in
                DispatchQueue.main.async {
                    guard self.trusted(), success, error == nil else { call.reject("Health authorization did not finish"); return }
                    self.enabled = true; call.resolve(["available": true])
                }
            }
        }
    }
    @objc func disconnect(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.trusted() else { call.reject("Untrusted origin"); return }
            self.enabled = false; self.generation += 1
            self.activeQueries.removeAll()
            call.resolve()
        }
    }
    private func sum(_ type: HKQuantityType, unit: HKUnit, start: Date, end: Date, completion: @escaping (Double?) -> Void) {
        guard enabled, trusted() else { completion(nil); return }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [.strictStartDate, .strictEndDate])
        let query = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, result, _ in
            DispatchQueue.main.async { completion(result?.sumQuantity()?.doubleValue(for: unit)) }
        }
        activeQueries.append(query); store.execute(query)
    }
    private func totals(start: Date, end: Date, completion: @escaping ([String: Any]) -> Void) {
        sum(steps, unit: .count(), start: start, end: end) { steps in
            self.sum(self.exercise, unit: .minute(), start: start, end: end) { minutes in
                completion(["steps": steps.map { $0 as Any } ?? NSNull(), "exerciseMinutes": minutes.map { $0 as Any } ?? NSNull()])
            }
        }
    }
    @objc func read(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.trusted(), self.enabled else { call.reject("Connect health data first"); return }
            let currentGeneration = self.generation
            let now = Date(), formatter = ISO8601DateFormatter()
            let readAt = formatter.string(from: now)
            if let startString = call.getString("start"), let endString = call.getString("end") {
                formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                guard let start = formatter.date(from: startString), let end = formatter.date(from: endString), start < end, end <= now, end.timeIntervalSince(start) <= 86400, now.timeIntervalSince(start) <= 15 * 86400 else { call.reject("Invalid movement window"); return }
                self.totals(start: start, end: end) { totals in
                    guard self.trusted(), self.enabled, currentGeneration == self.generation else { call.reject("Reading cancelled"); return }
                    self.activeQueries.removeAll()
                    call.resolve(totals.merging(["source": "apple-health", "start": startString, "end": endString, "readAt": readAt]) { _, new in new })
                }
                return
            }
            var days: [[String: Any]] = [], calendar = Calendar.current
            calendar.timeZone = .current
            let today = calendar.startOfDay(for: now)
            let dayFormatter = DateFormatter(); dayFormatter.calendar = Calendar(identifier: .gregorian); dayFormatter.locale = Locale(identifier: "en_US_POSIX"); dayFormatter.timeZone = .current; dayFormatter.dateFormat = "yyyy-MM-dd"
            func next(_ offset: Int) {
                guard self.trusted(), self.enabled, currentGeneration == self.generation else { call.reject("Reading cancelled"); return }
                if offset > 0 {
                    self.activeQueries.removeAll()
                    call.resolve(["source": "apple-health", "timezone": TimeZone.current.identifier, "readAt": readAt, "days": days]); return
                }
                let start = calendar.date(byAdding: .day, value: offset, to: today)!
                let end = min(calendar.date(byAdding: .day, value: 1, to: start)!, now)
                self.totals(start: start, end: end) { totals in
                    days.append(totals.merging(["date": dayFormatter.string(from: start)]) { _, new in new }); next(offset + 1)
                }
            }
            next(-14)
        }
    }
}
