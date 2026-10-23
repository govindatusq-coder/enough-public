import Foundation
import SwiftUI
import Combine

/// The single source of truth for the journey, mirroring `app/page.tsx` and
/// `hooks/use-cloud-account.ts`. Local-only until an account is attached;
/// after that every change is saved to the website's account API.
enum CloudStatus: Equatable { case checking, local, saved, saving, waiting, error, conflict, unavailable }

enum ActionGate { case done, needsSetup, needsAccount }

@MainActor
final class AppStore: ObservableObject {
    @Published var state: AppState = .empty { didSet { if ready && state != oldValue { changed() } } }
    @Published private(set) var ready = false
    @Published var notice = ""
    @Published var storageError = ""

    /// Today's Apple Health reading, shared by the home card and My Pins.
    /// It lives only in memory and is dropped when the app goes to the background.
    @Published var movementSnapshot: MovementSnapshot?

    // Cloud account
    @Published private(set) var cloud = false
    @Published private(set) var cloudStatus: CloudStatus = .local
    @Published var cloudError = ""
    @Published private(set) var accountEmail: String?
    @Published private(set) var accountHasCloudProfile = false
    /// True while the account on the server matches what is on this device.
    @Published private(set) var synced = false
    private(set) var revision = 0
    private var pending: AppState?
    private var pumping = false
    private var blocked = false
    private var saveTimer: Task<Void, Never>?
    private var cancellables: Set<AnyCancellable> = []

    // AI suggestions
    @Published private(set) var aiAvailable = false
    @Published private(set) var aiBusy = false
    @Published var aiError = ""
    @Published private(set) var freshIds: [Int] = []
    @Published private(set) var historyHasMore = false
    @Published private(set) var historyLoading = false
    @Published var historyError = ""
    private var historyCursor: String?
    private var pendingAiRequest = false

    let auth: AuthService
    let api: EnoughAPI
    let health = HealthService()
    let config: Config
    private let fileURL: URL

    init(auth: AuthService? = nil, config: Config = .shared) {
        self.config = config
        let auth = auth ?? AuthService(config: config)
        self.auth = auth
        self.api = EnoughAPI(auth: auth, config: config)
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("ENOUGH", isDirectory: true)
        try? FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
        fileURL = support.appendingPathComponent("enough-state.json")
        // A session that ends on its own (an expired refresh token) must not
        // leave the app believing it is still saving to the account.
        auth.$session.dropFirst().removeDuplicates().sink { [weak self] session in
            guard let self, session == nil, self.cloud || self.accountEmail != nil else { return }
            self.detachAccount()
            self.notice = "Your session has ended. Sign in again to keep saving to your account."
        }.store(in: &cancellables)
    }

    // MARK: Lifecycle

    func start() async {
        guard !ready else { return }
        loadLocal()
        ready = true
        if auth.isSignedIn { await loadAccount() }
        aiAvailable = await api.aiAvailable()
    }

    private func loadLocal() {
        guard let data = try? Data(contentsOf: fileURL) else { state = .empty; return }
        do { state = try Journey.validate(try JSONDecoder().decode(AppState.self, from: data)) }
        catch { storageError = "What was saved on this device couldn’t be read. Nothing has been overwritten. You can start again from My Pins." }
    }

    private func changed() {
        if cloud {
            pending = state
            synced = false
            // After an error or a conflict the user chooses when to retry; the
            // status keeps saying so instead of pretending to save.
            guard !blocked else { return }
            cloudStatus = .waiting
            saveTimer?.cancel()
            saveTimer = Task { [weak self] in
                try? await Task.sleep(nanoseconds: 600_000_000)
                guard !Task.isCancelled else { return }
                await self?.pump()
            }
        } else if storageError.isEmpty {
            saveLocal()
        }
    }

    private func saveLocal() {
        do {
            let data = try JSONEncoder.account.encode(state)
            try data.write(to: fileURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        } catch {
            storageError = "This device couldn’t save your changes. You can keep exploring, but changes may be lost when you leave."
        }
    }

    func update(_ change: (inout AppState) -> Void) {
        var next = state
        change(&next)
        next.profile.complete = next.profile.isComplete
        state = next
    }

    func exportData() -> Data {
        let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        return (try? encoder.encode(state)) ?? Data()
    }

    // MARK: Derived journey data

    var profile: Profile { state.profile }
    var isComplete: Bool { state.profile.isComplete }

    func feed(now: Date = Date()) -> [Ranked] {
        if isComplete { return Recommendations.recommend(state, now: now) }
        return Catalogue.ideas.filter { Recommendations.eligible($0, state, now: now) }.map { Ranked(idea: $0, score: 0, told: [], learned: [], protects: []) }
    }

    func dueReminders(now: Date = Date()) -> [Entry] {
        state.entries.filter { e in
            guard e.status == .accepted, let s = e.support, s.reminder == .inApp, s.paused != true, s.reminderDismissed != true, let at = s.remindDate else { return false }
            return at <= now
        }
    }

    func enoughReached(now: Date = Date()) -> Bool {
        guard let settings = state.movementSettings else { return false }
        return Movement.enoughToday(movementSnapshot, settings: settings, now: now)
    }

    // MARK: Ideas: save, accept, pass, hide, tune

    func isSaved(_ id: Int) -> Bool { state.saved.contains(id) }
    func isPlanned(_ id: Int) -> Bool { state.entries.contains { $0.ideaId == id && $0.status == .accepted } }

    /// Mirrors `act()`: saving or accepting needs a complete profile and, for
    /// cloud users, a synced account. Local previews turn on demo mode.
    func gate(for ideaId: Int, now: Date = Date()) -> ActionGate {
        guard feed(now: now).contains(where: { $0.idea.id == ideaId }) else { return .done }
        if !isComplete { return .needsSetup }
        if !cloud { return .needsAccount }
        return .done
    }

    func save(_ ideaId: Int) {
        update { s in
            if !s.saved.contains(ideaId) { s.saved.append(ideaId) }
            s.demo = !self.cloud
        }
        notice = "Saved for later."
    }

    func unsave(_ ideaId: Int) {
        update { $0.saved.removeAll { $0 == ideaId } }
        notice = "Removed from Saved."
    }

    @discardableResult
    func accept(_ ideaId: Int) -> Entry? {
        var accepted: Entry?
        update { s in
            s.demo = true
            s = Journey.accept(s, ideaId: ideaId)
            s.demo = !self.cloud
            accepted = s.entries.first { $0.ideaId == ideaId && $0.status == .accepted }
        }
        notice = "It’s in Planned. Add a little support if it would help."
        return accepted
    }

    func pass(_ ideaId: Int) {
        update { s in
            var passes = s.passes ?? []
            passes.append(Pass(ideaId: ideaId, at: ISO.string()))
            s.passes = Array(passes.suffix(200))
        }
    }

    func hide(_ ideaId: Int) {
        update { s in
            var tuning = s.tuningOrDefault
            if !tuning.hidden.contains(ideaId) { tuning.hidden.append(ideaId) }
            s.tuning = tuning
        }
        notice = "Hidden. You can bring it back under Tune my ideas."
    }

    func setTuning(_ change: (inout Tuning) -> Void) {
        update { s in var t = s.tuningOrDefault; change(&t); s.tuning = t }
    }

    func setToday(_ context: String) {
        update { $0.today = TodayNote(date: localDate(), context: context) }
        notice = context.isEmpty ? "Today’s note is cleared." : "Today’s note is kept."
    }

    func setCost(_ cost: Cost) {
        update { s in
            var costs = (s.costs ?? []).filter { !($0.ideaId == cost.ideaId && $0.currency == cost.currency) }
            costs.append(cost)
            s.costs = Array(costs.suffix(200))
        }
        notice = "Your own costs are saved. Confirm what you actually kept after the move."
    }

    func removeCost(ideaId: Int, currency: String) {
        update { s in s.costs = (s.costs ?? []).filter { !($0.ideaId == ideaId && $0.currency == currency) } }
    }

    // MARK: Plans and outcomes

    func updateEntry(_ id: String, _ change: (inout Entry) -> Void) {
        update { s in s.entries = s.entries.map { e in guard e.id == id else { return e }; var copy = e; change(&copy); return copy } }
    }

    func setSupport(_ plan: SupportPlan, for entryId: String) {
        updateEntry(entryId) { $0.support = plan }
        notice = "Your plan is saved."
        let title = state.entries.first { $0.id == entryId }.map { state.idea($0.ideaId).title } ?? "Your ENOUGH plan"
        if plan.reminder == .inApp, let at = plan.remindDate, plan.paused != true {
            Task { await NotificationService.schedule(entryId: entryId, title: title, at: at) }
        } else {
            NotificationService.cancel(entryId: entryId)
        }
    }

    func confirm(entryId: String, outcome: Journey.Outcome) throws {
        let next = try Journey.finish(state, entryId: entryId, outcome: outcome)
        state = next
        NotificationService.cancel(entryId: entryId)
        notice = "Kept in My Wins."
    }

    func notToday(entryId: String) {
        updateEntry(entryId) { $0.status = .notToday }
        NotificationService.cancel(entryId: entryId)
        notice = "No problem. Nothing to make up."
    }

    /// Returns a completed move to Planned, dropping the recorded outcome.
    func undoOutcome(entryId: String) {
        update { s in
            s.entries = s.entries.map { e in
                guard e.id == entryId else { return e }
                return Entry(id: e.id, ideaId: e.ideaId, status: .accepted, acceptedAt: e.acceptedAt, currency: e.currency, support: e.support, companions: e.companions, predicted: e.predicted)
            }
        }
        notice = "Outcome removed. The move is back in Planned."
    }

    func snoozeReminder(entryId: String, minutes: Int = 15) {
        let at = Date().addingTimeInterval(Double(minutes) * 60)
        updateEntry(entryId) { $0.support?.remindAt = SupportPlan.localString(at) }
        let title = state.entries.first { $0.id == entryId }.map { state.idea($0.ideaId).title } ?? "Your ENOUGH plan"
        Task { await NotificationService.schedule(entryId: entryId, title: title, at: at) }
    }

    func dismissReminder(entryId: String) {
        updateEntry(entryId) { $0.support?.reminderDismissed = true }
        NotificationService.cancel(entryId: entryId)
    }

    func saveWeeklyReview(worked: String, barrier: String, smallFix: String, plans: [ReviewedPlan]) throws {
        state = try WeeklyReviews.save(state, worked: worked, barrier: barrier, smallFix: smallFix, plans: plans)
        notice = "This week’s review is kept."
    }

    // MARK: Profile and consent

    func saveProfile(_ draft: Profile, finished: Bool) {
        update { s in
            s.profile = draft
            s.profile.name = draft.name.trimmingCharacters(in: .whitespaces)
            s.profile.complete = draft.isComplete
        }
        if finished { notice = "Your answers are saved." }
    }

    func chooseAIConsent(_ choice: AIConsentChoice) {
        if choice == .declined { pendingAiRequest = false }
        update { $0.aiConsent = AIConsent.make(choice) }
        notice = choice == .declined ? "Your choice is saved. The library is still here." : "Your AI choice is saved."
        if pendingAiRequest && choice != .declined {
            pendingAiRequest = false
            Task { await freshIdeasAfterSync() }
        }
    }

    var hasAIConsent: Bool { state.aiConsent?.allowsRequests == true }

    func resetLocal() {
        try? FileManager.default.removeItem(at: fileURL)
        state = .empty
        storageError = ""
        notice = "This device has been reset."
    }

    // MARK: Cloud account (use-cloud-account.ts)

    func loadAccount() async {
        guard auth.isSignedIn else { cloud = false; cloudStatus = .local; accountEmail = nil; accountHasCloudProfile = false; synced = false; return }
        cloudStatus = .checking
        do {
            let account = try await api.account()
            accountEmail = account.user?.email ?? auth.email
            revision = account.revision
            if let remote = account.state {
                let validated = try Journey.validate(remote)
                cloud = true
                accountHasCloudProfile = true
                ready = false; state = validated; ready = true
                pending = nil
                synced = true
                cloudStatus = .saved
            } else {
                cloud = false
                accountHasCloudProfile = false
                synced = false
                cloudStatus = .local
            }
            cloudError = ""
            blocked = false
        } catch {
            cloudStatus = .unavailable
            cloudError = error.localizedDescription
        }
    }

    private func pump() async {
        guard !pumping, !blocked, pending != nil else { return }
        pumping = true
        cloudStatus = .saving
        while let next = pending, !blocked {
            pending = nil
            var snapshot = next.accountSnapshot()
            snapshot.demo = false
            do {
                revision = try await api.saveAccount(snapshot, revision: revision)
                cloudError = ""
                if pending == nil { synced = true; cloudStatus = .saved }
            } catch {
                pending = state
                blocked = true
                cloudStatus = (error as? APIError)?.code == 409 ? .conflict : .error
                cloudError = error.localizedDescription
                break
            }
        }
        pumping = false
    }

    /// Create the account's cloud profile from the local preview or from scratch.
    func attach(importLocal: Bool) async -> Bool {
        guard auth.isSignedIn else { cloudError = "Sign in to keep your ENOUGH in your account."; return false }
        cloudStatus = .saving; cloudError = ""
        do {
            let fresh = try await api.account()
            if fresh.state != nil {
                cloudError = "This account already has an ENOUGH. Open it instead of replacing it."
                cloudStatus = .conflict
                return false
            }
            var snapshot = importLocal ? state.accountSnapshot() : AppState.empty
            snapshot.demo = false
            revision = try await api.saveAccount(snapshot, revision: 0)
            blocked = false; pending = nil
            cloud = true; accountHasCloudProfile = true
            ready = false; state = snapshot; ready = true
            synced = true
            cloudStatus = .saved
            return true
        } catch {
            cloudStatus = .error
            cloudError = error.localizedDescription
            return false
        }
    }

    func retryCloud() async {
        if !cloud { await loadAccount(); return }
        if cloudStatus == .conflict { return }
        blocked = false
        pending = state
        await pump()
    }

    /// Replace this device's view with the cloud version after a conflict.
    func loadCloudVersion() async { blocked = false; pending = nil; await loadAccount() }

    func deleteCloudData() async -> Bool {
        if pumping || pending != nil { cloudError = "Wait for your changes to finish saving before deleting."; return false }
        do {
            try await api.deleteAccount(revision: revision)
            blocked = true; pending = nil; revision = 0
            cloud = false; accountHasCloudProfile = false; synced = false
            try? FileManager.default.removeItem(at: fileURL)
            ready = false; state = .empty; ready = true
            cloudStatus = .local; cloudError = ""
            blocked = false
            notice = "Your ENOUGH account data has been deleted."
            return true
        } catch {
            cloudError = error.localizedDescription
            return false
        }
    }

    func signOut() async {
        await auth.signOut()
        detachAccount()
    }

    /// Back to the device-only state, showing what this device held before sign-in.
    private func detachAccount() {
        saveTimer?.cancel()
        cloud = false; accountHasCloudProfile = false; accountEmail = nil
        cloudStatus = .local; cloudError = ""; synced = false
        revision = 0; pending = nil; blocked = false; pumping = false
        freshIds = []; historyCursor = nil; historyHasMore = false; historyError = ""
        ready = false; loadLocal(); ready = true
    }

    // MARK: AI suggestions (freshIdeas in page.tsx)

    /// Returns a gate when the request cannot start yet.
    enum AIGate { case started, needsAccount, needsConsent, quiet }

    func requestFreshIdeas(enoughReached: Bool) -> AIGate {
        if aiBusy { return .started }
        if enoughReached { notice = "You’ve had your enough today. Short sitting breaks are still in My Moves; new ideas wait until tomorrow."; return .quiet }
        if !cloud { return .needsAccount }
        if !hasAIConsent { pendingAiRequest = true; return .needsConsent }
        Task { await freshIdeasAfterSync() }
        return .started
    }

    private func freshIdeasAfterSync() async {
        for _ in 0..<40 where !synced { try? await Task.sleep(nanoseconds: 250_000_000) }
        guard synced else { aiError = "Wait for your changes to save, then ask again."; return }
        await freshIdeas()
    }

    private func freshIdeas() async {
        guard !aiBusy else { return }
        aiBusy = true; aiError = ""
        defer { aiBusy = false }
        do {
            let result = try await api.freshIdeas(timezone: TimeZone.current.identifier)
            guard let ideas = result.ideas, !ideas.isEmpty else {
                notice = result.imageWarning == true ? "Your ideas are here. Some pictures couldn’t be painted this time." : (result.picturesPrepared ?? 0) > 0 ? "Pictures for your ideas are ready. No new ideas fitted your needs this time." : "No new ideas fitted your needs this time. Your existing ideas are still here; you can ask again."
                return
            }
            update { s in s.generated = AppStore.mergeIdeas(s.generated ?? [], ideas) }
            freshIds = ideas.map(\.id)
            notice = result.imageWarning == true ? "Your new ideas are ready. Some pictures couldn’t be painted this time." : "Your new ideas are ready, alongside the library."
        } catch let error as APIError where error.errorDescription == "consent-required" {
            pendingAiRequest = false
            aiError = "Choose whether AI can prepare ideas and pictures first, under AI and privacy in My Pins."
        } catch {
            aiError = error.localizedDescription
        }
    }

    static func mergeIdeas(_ earlier: [Idea], _ later: [Idea]) -> [Idea] {
        var seen = Set<Int>()
        return (earlier + later).filter { seen.insert($0.id).inserted }
    }

    func loadHistory(reset: Bool = false) async {
        guard cloud, !historyLoading else { return }
        if reset { historyCursor = nil; historyHasMore = false; historyError = "" }
        historyLoading = true
        defer { historyLoading = false }
        do {
            let page = try await api.history(before: historyCursor)
            update { s in s.generated = AppStore.mergeIdeas(page.ideas, s.generated ?? []) }
            historyCursor = page.nextCursor
            historyHasMore = page.hasMore
            historyError = ""
        } catch {
            historyError = error.localizedDescription
        }
    }
}
