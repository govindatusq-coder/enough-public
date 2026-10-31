import SwiftUI

/// My Pins: the profile that shapes every match (the pins branch of `app/page.tsx`).
struct PinsTabView: View {
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation
    @State private var regionOpen = false
    @State private var confirmReset = false
    @State private var confirmDelete = false
    @State private var showPrivacy = false

    private var profile: Profile { store.profile }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Eyebrow("A few things that make you, you")
                Text("Your life is the starting point.").font(Theme.body(15)).foregroundStyle(Theme.muted)
            }
            Label(store.isComplete ? "Your profile is ready. You can change your answers whenever life changes." : "Complete your PINS and routines before saving or accepting an idea.", systemImage: "slider.horizontal.3").font(Theme.body(14)).foregroundStyle(Theme.ink).glassPanel(padding: 14)
            aiPrivacy
            DisclosureGroup("Country & currency", isExpanded: $regionOpen) {
                RegionSettings(country: Binding(get: { profile.country }, set: { c in store.update { $0.profile.country = c } }), currency: Binding(get: { profile.currency }, set: { c in store.update { $0.profile.currency = c } })).padding(.top, 8)
            }
            .font(Theme.body(15, weight: .semibold)).foregroundStyle(Theme.ink).glassPanel()
            Button(store.isComplete ? "Edit my profile" : "Complete my setup") { navigation.sheet = .setup }.buttonStyle(.primary)
            ForEach(Array(Pins.groups.enumerated()), id: \.element.key) { index, g in
                section(number: index + 1, title: g.key.rawValue.capitalized, lines: [profile[g.key].isEmpty ? "Not answered yet" : profile[g.key].joined(separator: " · ")])
            }
            section(number: 5, title: "Life routines", lines: [(profile.activity.isEmpty ? "Not answered yet" : profile.activity) + (profile.window.isEmpty ? "" : " · \(profile.window)"), profile.rhythms.joined(separator: " · ")] + ((profile.sittingContexts?.isEmpty == false) ? ["Sitting contexts · \(profile.sittingContexts!.joined(separator: " · "))"] : []))
            section(number: 6, title: "Visual preferences · optional", lines: [profile.visual.isEmpty ? "No visual preferences set." : profile.visual.joined(separator: " · "), "Only for future imagery. Never used to rank ideas."])
            learning
        }
        .pageGutter()
        .sheet(isPresented: $showPrivacy) { PrivacyView() }
        .confirmationDialog("Start fresh on this device?", isPresented: $confirmReset, titleVisibility: .visible) {
            Button("Reset my local preview", role: .destructive) { store.resetLocal(); navigation.go(.enough) }
            Button("Keep my data", role: .cancel) {}
        } message: { Text("This removes your profile, saved ideas and local outcomes from this device. It cannot be undone.") }
        .confirmationDialog("Delete your ENOUGH data?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete my ENOUGH cloud data", role: .destructive) { Task { if await store.deleteCloudData() { navigation.go(.enough) } } }
            Button("Keep my data", role: .cancel) {}
        } message: { Text("This permanently removes your ENOUGH profile, saved moves, support plans, photos, check-ins and outcomes from cloud storage. It does not delete your sign-in account.") }
    }

    private func section(number: Int, title: String, lines: [String]) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Text(String(format: "%02d", number)).font(Theme.body(12, weight: .semibold)).foregroundStyle(Theme.accent).frame(width: 28, alignment: .leading)
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(Theme.display(22)).foregroundStyle(Theme.ink)
                ForEach(lines.filter { !$0.isEmpty }, id: \.self) { Text($0).font(Theme.body(14)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true) }
            }
        }
        .padding(.vertical, 12)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.border).frame(height: 1) }
    }

    private var aiPrivacy: some View {
        let consent = store.state.aiConsent
        let current = consent?.isCurrent == true
        return VStack(alignment: .leading, spacing: 8) {
            SectionTitle("AI and privacy", size: 22)
            Text(current ? "Your choice: \(consent!.choice.label)." : "No current AI permission. The library is still available.").font(Theme.body(14)).foregroundStyle(Theme.ink)
            if current, let consent, let decided = ISO.date(consent.decidedAt) { Note("Chosen \(decided.formatted(date: .numeric, time: .omitted)). Consent version \(consent.version).") }
            HStack {
                Button(current ? "Change AI choice" : "Choose AI permission") { navigation.sheet = .aiConsent }.buttonStyle(.secondary).disabled(store.aiBusy)
                Button("Privacy notice") { showPrivacy = true }.buttonStyle(.text)
            }
        }
        .glassPanel()
    }

    private var learning: some View {
        let weights = Recommendations.learnedWeights(store.state).filter { $0.value.promised > 0 }.sorted { $0.key.rawValue < $1.key.rawValue }
        return HStack(alignment: .top, spacing: 14) {
            Text("07").font(Theme.body(12, weight: .semibold)).foregroundStyle(Theme.accent).frame(width: 28, alignment: .leading)
            VStack(alignment: .leading, spacing: 8) {
                Text("What ENOUGH is learning").font(Theme.display(22)).foregroundStyle(Theme.ink)
                Text("Your PINS and routines shape the feed. Confirmed tries influence later matches. Visual preferences never affect ranking.").font(Theme.body(14)).foregroundStyle(Theme.muted)
                VStack(alignment: .leading, spacing: 4) {
                    Text("What your feedback says so far").font(Theme.body(14, weight: .semibold)).foregroundStyle(Theme.ink)
                    if weights.isEmpty { Text("There isn’t enough outcome feedback yet. Your PINS guide the starting matches.").font(Theme.body(13)).foregroundStyle(Theme.muted) }
                    ForEach(weights, id: \.key) { type, w in Text("\(type.rawValue.replacingOccurrences(of: "_", with: " ")): \(w.got) worthwhile confirmations from \(w.promised) tries that promised it.").font(Theme.body(13)).foregroundStyle(Theme.muted) }
                }
                .padding(12).background(Theme.mist).clipShape(RoundedRectangle(cornerRadius: 12))
                Button(store.cloud ? "Delete my ENOUGH data" : "Reset this device’s preview") { store.cloud ? (confirmDelete = true) : (confirmReset = true) }.buttonStyle(.text)
                Button("Account & backup") { navigation.sheet = .account(pending: nil) }.buttonStyle(.text)
                Button("Privacy notice") { showPrivacy = true }.buttonStyle(.text)
            }
        }
        .padding(.vertical, 12)
    }
}
