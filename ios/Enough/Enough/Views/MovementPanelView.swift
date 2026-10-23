import SwiftUI

/// Apple Health: read-only steps and exercise minutes, plus the user's own
/// chosen "enough" (`components/health-panel.tsx`). Lives under My Pins.
struct MovementPanelView: View {
    let now: Date
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var health: HealthService
    @State private var busy = false
    @State private var message = ""
    @State private var retryConnect = false
    @State private var failed = false
    @State private var threshold = ""

    private var settings: MovementSettings { store.state.movementSettings ?? MovementSettings() }
    private var today: MovementDay? { Movement.todayMovement(store.movementSnapshot, now: now) }
    private var suggested: Int? { store.movementSnapshot.flatMap { Movement.suggestedThreshold($0, metric: settings.metric, now: now) } }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Metric(value: today?.steps.map { String(Int($0)) } ?? "—", label: "Steps today")
                Metric(value: today?.exerciseMinutes.map { String(Int($0.rounded())) } ?? "—", label: "Exercise minutes")
            }
            if health.isAvailable {
                Note("Read only. Today’s readings stay in the app’s memory and are forgotten when you leave it.")
                Button(busy ? "Reading…" : health.connected ? "Read again" : "Connect Apple Health") { Task { await refresh() } }.buttonStyle(.secondary).disabled(busy)
                if health.connected { Button("Stop reading") { disconnect() }.buttonStyle(.text).disabled(busy) }
            } else {
                Note("Apple Health isn’t available on this device. You can still plan and confirm moves yourself.")
            }
            if health.connected || failed {
                Note("Last read: \(health.lastRead.flatMap(ISO.date).map { $0.formatted(date: .abbreviated, time: .shortened) } ?? "none yet"). \(health.permission.label)")
            }
            if !message.isEmpty { Text(message).font(Theme.body(13)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true) }
            if failed { Button(busy ? "Trying again…" : "Try again") { Task { await refresh(forceConnect: retryConnect) } }.buttonStyle(.secondary).disabled(busy) }
            DisclosureGroup("My enough for today") { settingsPanel.padding(.top, 8) }.font(Theme.body(14, weight: .medium)).foregroundStyle(Theme.ink).tint(Theme.ink)
            if Movement.enoughToday(store.movementSnapshot, settings: settings, now: now) {
                Text("You’ve had your enough today. New ideas are quiet\(settings.keepSittingBreaksAfterEnough == false ? "." : ", apart from short sitting breaks."). Browse whenever you like.").font(Theme.body(13)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.top, 8)
        .onAppear { threshold = settings.threshold.map(String.init) ?? "" }
        .onChange(of: settings.threshold) { _, t in threshold = t.map(String.init) ?? "" }
    }

    private func refresh(forceConnect: Bool = false) async {
        guard !busy else { return }
        busy = true; message = ""; failed = false
        if !health.connected || forceConnect { health.permission = .requested }
        defer { busy = false }
        do {
            if !health.connected || forceConnect { try await health.authorize() }
            let next = try await health.readSnapshot()
            store.movementSnapshot = next; health.connected = true; health.lastRead = next.readAt
            health.permission = next.hasReadableRecords ? .readable : .unconfirmed
            if !next.hasReadableRecords { message = "No readable records yet. Access may be off, or Health may have nothing recorded. You can still confirm moves yourself." }
        } catch {
            store.movementSnapshot = nil; health.permission = .unconfirmed; failed = true
            let problem = HealthService.readError(error)
            retryConnect = problem.retryConnect; message = problem.message
        }
    }

    private func disconnect() {
        health.disconnect()
        store.movementSnapshot = nil; failed = false
        message = "Reading stopped. To take away permission entirely, use Settings → Health → Data Access & Devices."
    }

    private func change(_ update: (inout MovementSettings) -> Void) {
        var next = settings
        update(&next)
        store.update { $0.movementSettings = next }
    }

    private var settingsPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("When should new ideas go quiet for the day? This is your preference, not a target. Browsing is always open.").font(Theme.body(13)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
            LabeledPicker(label: "Measure", selection: Binding(get: { settings.metric }, set: { m in change { $0.metric = m; $0.threshold = nil; $0.quietChoice = nil } }), options: MovementMetric.allCases.map { ($0, $0.label) })
            Note(suggested.map { "Your usual day is about \($0) \(settings.metric.unit), from the last fortnight. Nothing is chosen for you." } ?? "With at least seven readable days from the last fortnight, ENOUGH can show your usual amount. You can also type your own, or choose no limit.")
            if let suggested {
                Chip(label: "My usual day · about \(suggested) \(settings.metric.unit)", selected: settings.quietChoice == .amount && settings.threshold == suggested) { change { $0.quietChoice = .amount; $0.threshold = suggested }; message = "Your usual amount is kept." }
            }
            Chip(label: "No limit", selected: settings.quietChoice == QuietChoice.none) { change { $0.quietChoice = QuietChoice.none; $0.threshold = nil }; message = "No limit is kept." }
            FieldLabel("My own amount", optional: true)
            HStack { TextField("", text: $threshold).keyboardType(.numberPad).fieldBox(); Text(settings.metric.unit).font(Theme.body(13)).foregroundStyle(Theme.muted) }
            Button("Use this amount") {
                if let n = Int(threshold), n > 0, n <= settings.metric.maximum { change { $0.quietChoice = .amount; $0.threshold = n }; message = "Your amount is kept." }
                else { message = "Enter a positive whole number, or choose No limit." }
            }
            .buttonStyle(.secondary)
            Toggle("Keep short sitting breaks after my enough", isOn: Binding(get: { settings.keepSittingBreaksAfterEnough != false }, set: { on in change { $0.keepSittingBreaksAfterEnough = on } })).font(Theme.body(14)).tint(Theme.accent)
            Note("On by default. Only one-to-three-minute ideas that break up sitting stay in view, within your needs.")
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
        DisclosureGroup("Health check · optional") {
            VStack(alignment: .leading, spacing: 8) {
                Text("Read movement from Apple Health during this move. Other movement may overlap; you decide what happened.").font(Theme.body(13)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
                if health.isAvailable {
                    VStack(alignment: .leading, spacing: 8) {
                        Button(entry.movementWindow != nil ? "Start a new check" : "Start a check") { start() }.buttonStyle(.secondary).disabled(busy)
                        if let window = entry.movementWindow, window.end == nil { Button(busy ? "Reading…" : "Finish the check") { Task { await finish() } }.buttonStyle(.secondary).disabled(busy) }
                    }
                } else {
                    Note("Apple Health isn’t available on this device. Your own confirmation is all that is needed.")
                }
                if let window = entry.movementWindow { Note("Started \(ISO.date(window.start)?.formatted(date: .abbreviated, time: .shortened) ?? "")\(window.end.flatMap(ISO.date).map { " · ended \($0.formatted(date: .omitted, time: .shortened))" } ?? "")") }
                MovementEvidenceText(entry: previewEntry)
                if let preview {
                    Button("Keep this reading with the move") { store.updateEntry(entry.id) { $0.movementEvidence = preview }; self.preview = nil; message = "Reading kept with this move. You still say what happened." }.buttonStyle(.secondary)
                }
                if entry.movementEvidence != nil { Button("Remove the saved reading") { store.updateEntry(entry.id) { $0.movementEvidence = nil } }.buttonStyle(.text) }
                if !message.isEmpty { Text(message).font(Theme.body(13)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true) }
            }
            .padding(.top, 6)
        }
        .font(Theme.body(14, weight: .medium)).foregroundStyle(Theme.ink).tint(Theme.ink)
    }

    private var previewEntry: Entry { var copy = entry; if let preview { copy.movementEvidence = preview }; return copy }

    private func start() {
        preview = nil
        store.updateEntry(entry.id) { $0.movementWindow = MovementWindow(start: ISO.string()); $0.movementEvidence = nil }
        message = "Check started. Finish it when the move ends."
    }

    private func finish() async {
        guard let beginning = entry.movementWindow?.start, let start = ISO.date(beginning) else { return }
        let end = Date()
        if end.timeIntervalSince(start) > 86400 { message = "This check is more than a day old. Start a new one, or confirm the move yourself."; return }
        let finish = ISO.string(end)
        store.updateEntry(entry.id) { $0.movementWindow = MovementWindow(start: beginning, end: finish); $0.movementEvidence = nil }
        busy = true
        defer { busy = false }
        do {
            if !health.enabled { try await health.authorize() }
            preview = try await health.readWindow(start: beginning, end: finish)
            message = "Movement read. Keep it with this move only if you want to."
        } catch {
            message = "No reading was available. Your own confirmation still works. Connect Apple Health under My Pins, or check the phone’s Health permissions."
        }
    }
}

struct MovementEvidenceText: View {
    let entry: Entry
    var body: some View {
        if let data = entry.movementEvidence {
            Note("\(data.source == .appleHealth ? "Apple Health" : "Health Connect") recorded \(data.steps.map { "\(Int($0.rounded())) steps" } ?? "no readable steps") and \(data.exerciseMinutes.map { "\(Int($0.rounded())) exercise minutes" } ?? "no readable exercise time") during this check. It supports what you say happened; it doesn’t decide it.")
        }
    }
}
