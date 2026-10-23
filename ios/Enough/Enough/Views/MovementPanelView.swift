import SwiftUI

/// "Your movement today": read-only Apple Health steps and exercise time, plus
/// the user's own chosen "enough" (`components/health-panel.tsx`).
struct MovementPanelView: View {
    @Binding var snapshot: MovementSnapshot?
    let now: Date
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var health: HealthService
    @Environment(\.scenePhase) private var scenePhase
    @State private var busy = false
    @State private var message = ""
    @State private var connected = false
    @State private var lastRead: String?
    @State private var permission: HealthPermissionState = .notRequested
    @State private var retryConnect = false
    @State private var failed = false
    @State private var threshold = ""

    private var settings: MovementSettings { store.state.movementSettings ?? MovementSettings() }
    private var today: MovementDay? { Movement.todayMovement(snapshot, now: now) }
    private var suggested: Int? { snapshot.flatMap { Movement.suggestedThreshold($0, metric: settings.metric, now: now) } }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Metric(icon: "figure.walk", value: today?.steps.map { String(Int($0)) } ?? "—", label: "Daily steps")
                Metric(icon: "flame", value: today?.exerciseMinutes.map { String(Int($0.rounded())) } ?? "—", label: "Exercise Minutes")
            }
            if health.isAvailable {
                Note("Read-only access to steps and exercise time. Your daily readings stay in app memory and clear when you leave or hide the app.")
                HStack {
                    Button(busy ? "Reading…" : connected ? "Refresh movement" : "Connect health data") { Task { await refresh() } }.buttonStyle(.secondary).disabled(busy)
                    if connected { Button("Disconnect") { disconnect() }.buttonStyle(.text).disabled(busy) }
                }
            } else {
                Note("Apple Health is not available on this device. You can still plan and confirm your moves here.")
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Last successful read").font(Theme.body(12, weight: .semibold)).foregroundStyle(Theme.muted)
                Text(lastRead.flatMap(ISO.date).map { $0.formatted(date: .abbreviated, time: .shortened) } ?? "No successful read in this app session.").font(Theme.body(13)).foregroundStyle(Theme.ink)
                Text("Read permission").font(Theme.body(12, weight: .semibold)).foregroundStyle(Theme.muted)
                Text(permission.label).font(Theme.body(13)).foregroundStyle(Theme.ink)
            }
            Note("Apple Health does not reveal whether each read permission was refused. An empty result is not proof of permission or a zero total.")
            if !message.isEmpty { Text(message).font(Theme.body(13)).foregroundStyle(Theme.ink) }
            if failed { Button(busy ? "Retrying…" : "Retry health reading") { Task { await refresh(forceConnect: retryConnect) } }.buttonStyle(.secondary).disabled(busy) }
            if let snapshot, let readAt = ISO.date(snapshot.readAt) { Note("Apple Health exercise time · updated \(readAt.formatted(date: .omitted, time: .shortened)). These measures differ between devices and may not include everyday movement.") }
            DisclosureGroup("Your enough for today") { settingsPanel.padding(.top, 8) }.font(Theme.body(14, weight: .semibold)).foregroundStyle(Theme.ink)
            if Movement.enoughToday(snapshot, settings: settings, now: now) {
                Text("You’ve reached your chosen amount today. New suggestions are quiet\(settings.keepSittingBreaksAfterEnough == false ? "." : ", with short sitting breaks still available."). Explore whenever you feel like it.").font(Theme.body(13)).foregroundStyle(Theme.ink)
            }
        }
        .padding(.top, 8)
        .onAppear { threshold = settings.threshold.map(String.init) ?? "" }
        .onChange(of: scenePhase) { _, phase in if phase != .active { snapshot = nil; busy = false } }
        .onChange(of: settings.threshold) { _, t in threshold = t.map(String.init) ?? "" }
    }

    private func refresh(forceConnect: Bool = false) async {
        busy = true; message = ""; failed = false
        if !connected || forceConnect { permission = .requested }
        defer { busy = false }
        do {
            if !connected || forceConnect { try await health.authorize() }
            let next = try await health.readSnapshot()
            snapshot = next; connected = true; lastRead = next.readAt
            permission = next.hasReadableRecords ? .readable : .unconfirmed
            if !next.hasReadableRecords { message = "No readable records yet. Access may be off, or your Health app may have no records. You can still confirm moves yourself." }
        } catch {
            snapshot = nil; permission = .unconfirmed; failed = true
            let problem = HealthService.readError(error)
            retryConnect = problem.retryConnect; message = problem.message
        }
    }

    private func disconnect() {
        health.disconnect()
        snapshot = nil; connected = false; permission = .stopped; failed = false
        message = "Reading stopped. To revoke health permission, use Settings → Health → Data Access & Devices."
    }

    private func change(_ update: (inout MovementSettings) -> Void) {
        var next = settings
        update(&next)
        store.update { $0.movementSettings = next }
    }

    private var settingsPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Choose when ENOUGH should quiet new suggestions. This is your preference, not a health target. You can keep browsing at any time.").font(Theme.body(13)).foregroundStyle(Theme.muted)
            LabeledPicker(label: "Measure", selection: Binding(get: { settings.metric }, set: { m in change { $0.metric = m; $0.threshold = nil; $0.quietChoice = nil } }), options: MovementMetric.allCases.map { ($0, $0.label) })
            Text(suggested.map { "Your usual day is about \($0) \(settings.metric.unit) (median of readable days). Nothing is selected automatically." } ?? "At least seven readable days from the last fortnight can suggest a usual amount. You can enter your own or choose no limit.").font(Theme.body(13)).foregroundStyle(Theme.ink)
            FieldLabel("When would you like new suggestions to quieten?")
            if let suggested {
                Chip(label: "My usual day is about \(suggested) \(settings.metric.unit)", selected: settings.quietChoice == .amount && settings.threshold == suggested) { change { $0.quietChoice = .amount; $0.threshold = suggested }; message = "Your usual amount is saved." }
            }
            Chip(label: "No limit", selected: settings.quietChoice == QuietChoice.none) { change { $0.quietChoice = QuietChoice.none; $0.threshold = nil }; message = "No limit is saved." }
            FieldLabel("My usual day is about", optional: true)
            HStack { TextField("", text: $threshold).keyboardType(.numberPad).fieldBox(); Text(settings.metric.unit).font(Theme.body(13)).foregroundStyle(Theme.muted) }
            Button("Choose this usual amount") {
                if let n = Int(threshold), n > 0, n <= settings.metric.maximum { change { $0.quietChoice = .amount; $0.threshold = n }; message = "Your chosen usual amount is saved." }
                else { message = "Enter a positive whole number within the field limits, or choose No limit." }
            }
            .buttonStyle(.secondary)
            Toggle("Keep short sitting-break ideas after my enough", isOn: Binding(get: { settings.keepSittingBreaksAfterEnough != false }, set: { on in change { $0.keepSittingBreaksAfterEnough = on } })).font(Theme.body(14)).tint(Theme.accent)
            Note("On by default. Only one-to-three-minute ideas that break up sitting remain on new-suggestion surfaces, within your needs.")
        }
    }
}

/// "Movement check · optional": read Health totals during one activity window
/// (`components/activity-movement.tsx`). Saved only by explicit choice.
struct ActivityMovementView: View {
    let entry: Entry
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var health: HealthService
    @State private var preview: MovementEvidence?
    @State private var busy = false
    @State private var message = ""

    var body: some View {
        DisclosureGroup("Movement check · optional") {
            VStack(alignment: .leading, spacing: 8) {
                Text("Read movement during this activity. Overlapping movement may belong to something else; you decide what happened.").font(Theme.body(13)).foregroundStyle(Theme.muted)
                if health.isAvailable {
                    HStack {
                        Button(entry.movementWindow != nil ? "Start a new check" : "Start movement check") { start() }.buttonStyle(.secondary).disabled(busy)
                        if let window = entry.movementWindow, window.end == nil { Button(busy ? "Reading…" : "Finish movement check") { Task { await finish() } }.buttonStyle(.secondary).disabled(busy) }
                    }
                } else {
                    Note("Apple Health is not available on this device. Use your own confirmation.")
                }
                if let window = entry.movementWindow { Note("Started \(ISO.date(window.start)?.formatted(date: .abbreviated, time: .shortened) ?? "")\(window.end.flatMap(ISO.date).map { " · ended \($0.formatted(date: .omitted, time: .shortened))" } ?? "")") }
                MovementEvidenceText(entry: previewEntry)
                if let preview {
                    Button("Save reading with this activity") { store.updateEntry(entry.id) { $0.movementEvidence = preview }; self.preview = nil; message = "Reading saved with this activity. You still need to confirm what happened." }.buttonStyle(.secondary)
                }
                if entry.movementEvidence != nil { Button("Remove saved movement reading") { store.updateEntry(entry.id) { $0.movementEvidence = nil } }.buttonStyle(.text) }
                if !message.isEmpty { Text(message).font(Theme.body(13)).foregroundStyle(Theme.ink) }
            }
            .padding(.top, 6)
        }
        .font(Theme.body(14, weight: .semibold)).foregroundStyle(Theme.ink)
    }

    private var previewEntry: Entry { var copy = entry; if let preview { copy.movementEvidence = preview }; return copy }

    private func start() {
        preview = nil
        store.updateEntry(entry.id) { $0.movementWindow = MovementWindow(start: ISO.string()); $0.movementEvidence = nil }
        message = "Movement check started. Finish it when your activity ends."
    }

    private func finish() async {
        guard let beginning = entry.movementWindow?.start, let start = ISO.date(beginning) else { return }
        let end = Date()
        if end.timeIntervalSince(start) > 86400 { message = "This check is more than a day old. Start a new one or confirm your activity yourself."; return }
        let finish = ISO.string(end)
        store.updateEntry(entry.id) { $0.movementWindow = MovementWindow(start: beginning, end: finish); $0.movementEvidence = nil }
        busy = true
        defer { busy = false }
        do {
            if !health.enabled { try await health.authorize() }
            preview = try await health.readWindow(start: beginning, end: finish)
            message = "Movement read. Save it with this activity only if you want to keep it."
        } catch {
            message = "No movement reading available. Your check-in still works. Connect health data on My Enough or check your phone permissions."
        }
    }
}

struct MovementEvidenceText: View {
    let entry: Entry
    var body: some View {
        if let data = entry.movementEvidence {
            Note("\(data.source == .appleHealth ? "Apple Health" : "Health Connect") recorded \(data.steps.map { "\(Int($0.rounded())) steps" } ?? "no readable step total") and \(data.exerciseMinutes.map { "\(Int($0.rounded())) exercise minutes" } ?? "no readable exercise time") during your check. This supports your own confirmation; it does not verify completion.")
        }
    }
}
