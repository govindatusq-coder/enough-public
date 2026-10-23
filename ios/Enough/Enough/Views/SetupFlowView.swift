import SwiftUI

/// "Your starting point": the eight-step PINS and routines setup.
struct SetupFlowView: View {
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation
    @Environment(\.dismiss) private var dismiss
    @State private var draft = Profile()
    @State private var step = 0

    private var group: PinGroup? { (1...4).contains(step) ? Pins.groups[step - 1] : nil }

    private var valid: Bool {
        switch step {
        case 1...4: return !draft[Pins.groups[step - 1].key].isEmpty
        case 5: return !draft.activity.isEmpty && !draft.rhythms.isEmpty && !draft.window.isEmpty
        default: return true
        }
    }

    private var heading: String {
        switch step {
        case 0: return "A little about your life."
        case 1...4: return Pins.groups[step - 1].title
        case 5: return "The shape of your day."
        case 6: return "A familiar feeling."
        default: return "Your starting point."
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        Eyebrow("Your starting point · \(step + 1) of 8")
                        Spacer()
                        Button("Save and leave") { store.saveProfile(draft, finished: false); dismiss() }.buttonStyle(.text)
                    }
                    HStack(spacing: 4) {
                        ForEach(0..<8, id: \.self) { i in Capsule().fill(i <= step ? Theme.accent : Theme.border).frame(height: 4) }
                    }
                    .accessibilityLabel("Setup step \(step + 1) of 8")
                    Text(heading).font(Theme.display(32)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
                    stepContent
                    HStack {
                        if step > 0 { Button("Back") { step -= 1 }.buttonStyle(.secondary) }
                        Spacer()
                        Button(step == 7 ? "Continue to your ideas" : (step == 6 && draft.visual.isEmpty) ? "Skip for now" : "Continue") {
                            if step == 7 { finish() } else { step += 1 }
                        }
                        .buttonStyle(.primary).disabled(!valid)
                    }
                    if !valid { Note(Onboarding.instruction(step: step)) }
                }
                .padding(16)
            }
            .background(Theme.paper)
            .scrollDismissesKeyboard(.interactively)
            .onAppear { draft = store.profile; step = Onboarding.resumeStep(store.profile) }
        }
        .interactiveDismissDisabled()
    }

    @ViewBuilder private var stepContent: some View {
        switch step {
        case 0:
            Text("Only your PINS and life routines are required. \(store.cloud ? "We’ll keep your answers in your account." : "We’ll keep your answers on this device while you try ENOUGH.")").font(Theme.body(15)).foregroundStyle(Theme.muted)
            VStack(alignment: .leading, spacing: 6) {
                FieldLabel("What should we call you?", optional: true)
                TextField("Your first name", text: $draft.name).textContentType(.givenName).fieldBox()
                    .onChange(of: draft.name) { _, v in if v.count > 40 { draft.name = String(v.prefix(40)) } }
            }
            Note("You can leave this blank. No account is needed to explore.")
        case 1...4:
            if let group {
                Text((step == 1 && !draft.name.trimmingCharacters(in: .whitespaces).isEmpty ? "Nice to meet you, \(draft.name.trimmingCharacters(in: .whitespaces)). " : "") + group.description).font(Theme.body(15)).foregroundStyle(Theme.muted)
                Note("Choose what fits, or choose “Nothing to add”.")
                PinsOptions(options: group.options, values: Binding(get: { draft[group.key] }, set: { draft[group.key] = $0 }), lifestyle: group.key == .preferences)
                    .id(group.key)
            }
        case 5:
            routines
        case 6:
            Text("Optional: which settings feel familiar? These answers are kept for future imagery only. They never change an idea’s value or suitability.").font(Theme.body(15)).foregroundStyle(Theme.muted)
            ChoiceTiles(options: Pins.visualOptions, values: draft.visual) { v in
                if draft.visual.contains(v) { draft.visual.removeAll { $0 == v } } else { draft.visual.append(v) }
            }
            Note("Optional. These choices are for imagery, and never change which ideas suit your needs.")
        default:
            summary
        }
    }

    private var routines: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 8) {
                FieldLabel("How active is a usual day?")
                ChoiceTiles(options: Pins.activityOptions, values: [draft.activity]) { draft.activity = $0 }
            }
            VStack(alignment: .leading, spacing: 8) {
                FieldLabel("What already happens in your week?")
                ChoiceTiles(options: Pins.rhythmOptions, values: draft.rhythms) { v in
                    if v == "No regular routine" { draft.rhythms = draft.rhythms.contains(v) ? [] : [v] }
                    else if draft.rhythms.contains(v) { draft.rhythms.removeAll { $0 == v } }
                    else { draft.rhythms = draft.rhythms.filter { $0 != "No regular routine" } + [v] }
                }
            }
            VStack(alignment: .leading, spacing: 8) {
                FieldLabel("When is there usually a little room?")
                ChoiceTiles(options: Pins.windowOptions, values: [draft.window]) { draft.window = $0 }
            }
            VStack(alignment: .leading, spacing: 8) {
                FieldLabel("When do you usually sit for long stretches?", optional: true)
                ChoiceTiles(options: DailyContexts.sittingContexts, values: draft.sittingContexts ?? []) { v in
                    var current = draft.sittingContexts ?? []
                    if v == "It varies" { current = current.contains(v) ? [] : [v] }
                    else if current.contains(v) { current.removeAll { $0 == v } }
                    else { current = current.filter { $0 != "It varies" } + [v] }
                    draft.sittingContexts = current
                }
                Note("You can skip this. Short breaks around these moments may appear more often.")
            }
            RegionSettings(country: $draft.country, currency: $draft.currency)
        }
    }

    private var summary: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Check your answers. You can revisit any step or edit your profile in My Pins.").font(Theme.body(15)).foregroundStyle(Theme.muted)
            ForEach(Pins.groups, id: \.key) { g in
                VStack(alignment: .leading, spacing: 4) {
                    Text(g.key.rawValue.capitalized).font(Theme.body(14, weight: .semibold)).foregroundStyle(Theme.ink)
                    Text(draft[g.key].joined(separator: " · ")).font(Theme.body(14)).foregroundStyle(Theme.muted)
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Life routines").font(Theme.body(14, weight: .semibold)).foregroundStyle(Theme.ink)
                Text("\(draft.activity) · \(draft.rhythms.joined(separator: ", ")) · \(draft.window)").font(Theme.body(14)).foregroundStyle(Theme.muted)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Country & currency").font(Theme.body(14, weight: .semibold)).foregroundStyle(Theme.ink)
                Text("\(Regions.region(for: draft.country)?.name ?? "Country not set") · \(draft.currency)").font(Theme.body(14)).foregroundStyle(Theme.muted)
            }
        }
        .glassPanel()
    }

    private func finish() {
        guard draft.isComplete else { return }
        store.saveProfile(draft, finished: true)
        dismiss()
        navigation.go(.moves, moves: .explore)
    }
}

/// Country and currency (`components/region-settings.tsx`).
struct RegionSettings: View {
    @Binding var country: String?
    @Binding var currency: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            LabeledPicker(label: "Country · optional", selection: Binding(get: { country ?? "" }, set: { code in
                if code.isEmpty { country = nil } else if let region = Regions.region(for: code) { country = region.code; currency = region.currency }
            }), options: [("", "Choose a country")] + Regions.all.map { ($0.code, $0.name) })
            LabeledPicker(label: "Currency for new moves", selection: $currency, options: Regions.currencyCodes.map { ($0, $0) })
            Note("Changing country selects its usual currency. You can change that separately. Existing moves keep their original currency. ENOUGH never converts or combines currencies.")
        }
    }
}
