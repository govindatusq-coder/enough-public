import SwiftUI

/// The full idea card with Save, Why this?, Sounds good and Previous/Next
/// (the `move-card` article in `app/page.tsx`).
struct IdeaDetailView: View {
    let ideaId: Int
    let now: Date
    @Binding var showTune: Bool
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation
    @State private var showWhy = false
    @State private var showCosts = false

    private var feed: [Ranked] { store.feed(now: now) }
    /// Only the idea that was opened; never a silent stand-in from the feed.
    private var active: Ranked? { feed.first { $0.idea.id == ideaId } }
    private var idea: Idea { active?.idea ?? store.state.idea(ideaId) }
    private var position: Int { feed.firstIndex { $0.idea.id == ideaId } ?? 0 }
    private var planned: Bool { store.isPlanned(idea.id) }

    private func next(_ direction: Int) {
        guard !feed.isEmpty else { return }
        let target = feed[(position + direction + feed.count) % feed.count].idea.id
        if direction > 0 { store.pass(idea.id) }
        navigation.detailIdeaId = target
    }

    private func act(_ action: AppNavigation.PendingAction) {
        switch store.gate(for: idea.id, now: now) {
        case .needsSetup: navigation.sheet = .setup
        case .needsAccount: navigation.sheet = .account(pending: action)
        case .done:
            switch action {
            case .save: store.save(idea.id)
            case .accept:
                if planned, let entry = store.state.entries.first(where: { $0.ideaId == idea.id && $0.status == .accepted }) { navigation.openSupport(entry.id) }
                else if let entry = store.accept(idea.id) { navigation.openSupport(entry.id) }
            }
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Button { navigation.detailIdeaId = nil } label: { Label("All ideas", systemImage: "chevron.left") }.buttonStyle(.text)
            if feed.isEmpty {
                EmptyState(title: "Your needs come first.", text: store.profile.hasFreeTextNeed ? "Your written need is kept. ENOUGH can’t yet read free-text needs, so ideas are paused. Keep your answer, or choose from the listed needs in My Pins." : "No library idea fits your current needs. Keep them as they are, or update them if something has changed.", action: ("Tune my ideas", { showTune = true }), secondary: ("Review my answers", { navigation.sheet = .setup }))
            } else if active == nil {
                EmptyState(title: "This one doesn’t fit right now.", text: "\(idea.title) isn’t among today’s ideas any more, perhaps because of the time of day or a note you made. It stays where you kept it.", action: ("See today’s ideas", { navigation.detailIdeaId = feed.first?.id }))
            } else {
                card
                notes
            }
        }
        .pageGutter()
        .sheet(isPresented: $showWhy) { whySheet }
        .sheet(isPresented: $showCosts) { CostSheet(idea: idea) }
    }

    private var card: some View {
        VStack(alignment: .leading, spacing: 0) {
            IdeaPicture(idea: idea).frame(height: 300).frame(maxWidth: .infinity)
                .gesture(DragGesture(minimumDistance: 30).onEnded { value in
                    // Sideways only, so scrolling the page never changes the idea.
                    let dx = value.translation.width, dy = value.translation.height
                    guard abs(dx) > 60, abs(dx) > abs(dy) * 1.5 else { return }
                    next(dx < 0 ? 1 : -1)
                })
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 20) {
                    Button { act(.save(idea.id)) } label: { Label(store.isSaved(idea.id) ? "Saved" : "Save", systemImage: store.isSaved(idea.id) ? "bookmark.fill" : "bookmark") }
                    Button { showWhy = true } label: { Label("Why this?", systemImage: "info.circle") }
                    Spacer()
                }
                .buttonStyle(.text)
                Eyebrow(store.isComplete ? "Matched to your answers" : "Worth a look")
                Text(idea.title).font(Theme.display(30)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
                Text(idea.body).font(Theme.body(15)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
                ValueStrip(idea: idea)
                (Text("Because ").fontWeight(.medium) + Text(active?.told.first.map { $0.prefix(1).lowercased() + String($0.dropFirst()) } ?? "this offers another way through an everyday moment.")).font(Theme.body(14)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
                IdeaTagsView(idea: idea)
                if idea.source == .ai { Note("Made for you by AI, checked against your needs.") }
                Button(planned ? "See my plan" : "Sounds good") { act(.accept(idea.id)) }.buttonStyle(.primary)
                HStack {
                    Button("Previous") { next(-1) }.buttonStyle(.text)
                    Spacer()
                    Text("\(position + 1) of \(feed.count)").font(Theme.body(12)).foregroundStyle(Theme.muted)
                    Spacer()
                    Button("Next idea") { next(1) }.buttonStyle(.text)
                }
            }
            .padding(16)
        }
        .cardSurface()
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Idea \(position + 1) of \(feed.count): \(idea.title)")
    }

    private var notes: some View {
        let tries = store.state.entries.filter { $0.ideaId == idea.id && $0.status == .completed }
        let cost = (store.state.costs ?? []).first { $0.ideaId == idea.id && $0.currency == store.profile.currency }
        return VStack(alignment: .leading, spacing: 12) {
            Text("An idea, never an obligation. Take what fits your day and leave the rest.").font(Theme.body(14)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
            if !tries.isEmpty {
                Text("\(tries.filter { $0.worthwhile == true }.count) of your \(tries.count) \(tries.count == 1 ? "try" : "tries") felt worthwhile.").font(Theme.body(14)).foregroundStyle(Theme.ink)
            }
            Button(cost != nil ? "Edit my own costs" : "Use my own costs") { showCosts = true }.buttonStyle(.text)
            if (store.state.passes?.count ?? 0) >= 6 { Button("Want a closer fit? Tune my ideas") { showTune = true }.buttonStyle(.text) }
        }
        .glassPanel()
    }

    private var whySheet: some View {
        let value = Economics.value(of: idea, in: store.state)
        return SheetFrame(title: "A little more about this idea", kicker: "Why this?") {
            if store.isComplete, let active, !(active.told + active.learned + active.protects).isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("What shaped this match").font(Theme.body(15, weight: .medium)).foregroundStyle(Theme.ink)
                    ForEach(active.told + active.learned + active.protects, id: \.self) { Text("• \($0)").font(Theme.body(14)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true) }
                }
            } else if !store.isComplete {
                Text("Answer a few questions about your life in My Pins and ENOUGH can say why an idea fits you.").font(Theme.body(14)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
            }
            whyRow("Instead of", idea.usual)
            whyRow("Time", idea.extraMin > 0 ? "About \(idea.extraMin) extra minutes beyond what was already happening." : idea.extraMin < 0 ? "Gives back about \(-idea.extraMin) minutes compared with the usual way." : "No extra time: the movement sits inside something already in your day.")
            whyRow("Money", value.directCents > 0 ? "\(value.directSource ?? "Cost avoided"): \(Economics.money(value.directCents, store.state)). Tap ⓘ on the idea for the full workings." : "No fee or fare is avoided; the figure is the price of the same minutes of movement. Tap ⓘ on the idea for the workings.")
            whyRow("Take care", idea.safety)
            if store.isComplete && active != nil {
                Button("Not for me · hide this idea") { store.hide(idea.id); showWhy = false; navigation.detailIdeaId = nil }.buttonStyle(.text)
            }
            Note("Check the real route, setting and movement before trying it. Your visual preferences are never used to judge ability or fit.")
        }
    }

    private func whyRow(_ label: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label).font(Theme.body(12, weight: .medium)).foregroundStyle(Theme.muted)
            Text(text).font(Theme.body(14)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// "Your costs for this move" (`components/move-costs.tsx`).
struct CostSheet: View {
    let idea: Idea
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var usual = ""
    @State private var move = ""
    @State private var error = ""

    var body: some View {
        let currency = store.profile.currency
        let existing = (store.state.costs ?? []).first { $0.ideaId == idea.id && $0.currency == currency }
        let usualCents = Regions.parseMoney(usual), moveCents = Regions.parseMoney(move)
        SheetFrame(title: "Your own costs", kicker: idea.title, doneLabel: "Cancel") {
            Text("Use what you would actually pay, including any extra costs. This replaces the typical figure for this idea; My Wins still counts only what you confirm afterwards.").font(Theme.body(14)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
            FieldLabel("What would you normally spend? (\(currency))"); TextField("0.00", text: $usual).keyboardType(.decimalPad).fieldBox()
            FieldLabel("What would this move cost in total? (\(currency))"); TextField("0.00", text: $move).keyboardType(.decimalPad).fieldBox()
            if let usualCents, let moveCents {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Money kept").font(Theme.body(12, weight: .medium)).foregroundStyle(Theme.muted)
                    Text(Regions.formatMoney(max(0, usualCents - moveCents), currency: currency, country: store.profile.country)).font(Theme.display(28)).foregroundStyle(Theme.ink)
                    Text(moveCents > usualCents ? "This move would cost \(Regions.formatMoney(moveCents - usualCents, currency: currency, country: store.profile.country)) more, so nothing is kept." : "Your usual cost minus this move’s cost.").font(Theme.body(13)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
                }
                .padding(12).background(Theme.mist).clipShape(RoundedRectangle(cornerRadius: Theme.Radius.field, style: .continuous))
            }
            AlertText(error)
            Button("Use these costs") {
                guard let usualCents, let moveCents else { error = "Enter both costs from 0 to 1,000, with up to two decimal places."; return }
                store.setCost(Cost(ideaId: idea.id, currency: currency, usualCents: usualCents, moveCents: moveCents, updatedAt: ISO.string()))
                dismiss()
            }
            .buttonStyle(.primary)
            if existing != nil { Button("Go back to the typical figure") { store.removeCost(ideaId: idea.id, currency: currency); dismiss() }.buttonStyle(.text) }
        }
        .onAppear { if let existing { usual = String(format: "%.2f", Double(existing.usualCents) / 100); move = String(format: "%.2f", Double(existing.moveCents) / 100) } }
    }
}
