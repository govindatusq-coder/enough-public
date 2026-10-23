import SwiftUI

/// My Pins: the answers that shape every match, plus health, AI and account
/// settings (the pins branch of `app/page.tsx`).
struct PinsTabView: View {
    let now: Date
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation
    @State private var regionOpen = false
    @State private var healthOpen = false
    @State private var confirmReset = false
    @State private var confirmDelete = false
    @State private var showPrivacy = false

    private var profile: Profile { store.profile }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Eyebrow("My Pins")
                Text("Your life is the starting point.").font(Theme.display(26)).foregroundStyle(Theme.ink)
                Text(store.isComplete ? "Your answers are in. Change them whenever life changes." : "A few answers about your life, and the ideas become yours.").font(Theme.body(15)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
            }
            Button(store.isComplete ? "Edit my answers" : "Answer a few questions") { navigation.sheet = .setup }.buttonStyle(.primary)
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(Pins.groups.enumerated()), id: \.element.key) { index, g in
                    section(number: index + 1, title: g.key.rawValue.capitalized) {
                        lines([profile[g.key].isEmpty ? "Not answered yet" : profile[g.key].joined(separator: " · ")])
                    }
                }
                section(number: 5, title: "Life routines") {
                    lines([(profile.activity.isEmpty ? "Not answered yet" : profile.activity) + (profile.window.isEmpty ? "" : " · \(profile.window)"), profile.rhythms.joined(separator: " · ")] + ((profile.sittingContexts?.isEmpty == false) ? ["Long sitting · \(profile.sittingContexts!.joined(separator: " · "))"] : []))
                }
                section(number: 6, title: "Familiar settings") {
                    lines([profile.visual.isEmpty ? "None chosen." : profile.visual.joined(separator: " · "), "Only for pictures. Never used to rank ideas."])
                }
                section(number: 7, title: "Country & currency") {
                    DisclosureGroup(isExpanded: $regionOpen) {
                        RegionSettings(country: Binding(get: { profile.country }, set: { c in store.update { $0.profile.country = c } }), currency: Binding(get: { profile.currency }, set: { c in store.update { $0.profile.currency = c } })).padding(.top, 8)
                    } label: {
                        Text("\(Regions.region(for: profile.country)?.name ?? "Country not set") · \(profile.currency)").font(Theme.body(14)).foregroundStyle(Theme.muted)
                    }
                    .tint(Theme.ink)
                }
                section(number: 8, title: "Apple Health") {
                    DisclosureGroup(isExpanded: $healthOpen) {
                        MovementPanelView(now: now)
                    } label: {
                        Text(store.health.connected ? "Connected · steps and exercise minutes, read only" : "Optional. Lets ENOUGH quieten ideas once you’ve had your enough.").font(Theme.body(14)).foregroundStyle(Theme.muted)
                    }
                    .tint(Theme.ink)
                }
                section(number: 9, title: "AI and privacy") { aiPrivacy }
                section(number: 10, title: "What ENOUGH is learning") { learning }
            }
            VStack(alignment: .leading, spacing: 4) {
                Button("Account") { navigation.sheet = .account(pending: nil) }.buttonStyle(.text)
                Button("Privacy notice") { showPrivacy = true }.buttonStyle(.text)
                Button(store.cloud ? "Delete my ENOUGH data" : "Reset this device") { store.cloud ? (confirmDelete = true) : (confirmReset = true) }.buttonStyle(.text)
            }
        }
        .pageGutter()
        .sheet(isPresented: $showPrivacy) { PrivacyView() }
        .confirmationDialog("Start fresh on this device?", isPresented: $confirmReset, titleVisibility: .visible) {
            Button("Reset this device", role: .destructive) { store.resetLocal(); navigation.go(.enough) }
            Button("Keep my data", role: .cancel) {}
        } message: { Text("This removes your answers, saved ideas and moments from this device. It cannot be undone.") }
        .confirmationDialog("Delete your ENOUGH data?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete my ENOUGH data", role: .destructive) { Task { if await store.deleteCloudData() { navigation.go(.enough) } } }
            Button("Keep my data", role: .cancel) {}
        } message: { Text("This permanently removes your answers, saved ideas, plans, photos, check-ins and moments from your account. It does not delete your sign-in itself.") }
    }

    private func section<Content: View>(number: Int, title: String, @ViewBuilder content: () -> Content) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Text(String(format: "%02d", number)).font(Theme.body(12, weight: .medium)).foregroundStyle(Theme.accent).frame(width: 28, alignment: .leading).padding(.top, 6)
            VStack(alignment: .leading, spacing: 6) {
                Text(title).font(Theme.display(22)).foregroundStyle(Theme.ink)
                content()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 14)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.border).frame(height: 1) }
    }

    private func lines(_ texts: [String]) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            ForEach(texts.filter { !$0.isEmpty }, id: \.self) { Text($0).font(Theme.body(14)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true) }
        }
    }

    private var aiPrivacy: some View {
        let consent = store.state.aiConsent
        let current = consent?.isCurrent == true
        return VStack(alignment: .leading, spacing: 8) {
            Text(current ? "Your choice: \(consent!.choice.label)." : "No AI permission yet. The library is always available.").font(Theme.body(14)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
            if current, let consent, let decided = ISO.date(consent.decidedAt) { Note("Chosen \(decided.formatted(date: .numeric, time: .omitted)).") }
            Button(current ? "Change my AI choice" : "Choose how AI helps") { navigation.sheet = .aiConsent }.buttonStyle(.secondary).disabled(store.aiBusy)
        }
    }

    private var learning: some View {
        let weights = Recommendations.learnedWeights(store.state).filter { $0.value.promised > 0 }.sorted { $0.key.rawValue < $1.key.rawValue }
        return VStack(alignment: .leading, spacing: 8) {
            Text("Your answers shape the ideas. What you say after a move shapes them further. Familiar settings never affect ranking.").font(Theme.body(14)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
            if weights.isEmpty {
                Note("Nothing learned yet. Your answers guide the first ideas.")
            } else {
                ForEach(weights, id: \.key) { type, w in
                    Note("\(type.rawValue.replacingOccurrences(of: "_", with: " ").capitalized): \(w.got) of \(w.promised) \(w.promised == 1 ? "try" : "tries") that promised it felt worthwhile.")
                }
            }
        }
    }
}
