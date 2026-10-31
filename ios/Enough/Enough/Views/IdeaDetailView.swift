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
    private var active: Ranked? { feed.first { $0.idea.id == ideaId } ?? feed.first }
    private var idea: Idea { active?.idea ?? store.state.idea(ideaId) }
    private var position: Int { feed.firstIndex { $0.idea.id == idea.id } ?? 0 }
    private var cash: MoneyEstimate? { Recommendations.moneyValue(idea, store.state) }
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
            if store.isComplete {
                VStack(alignment: .leading, spacing: 8) {
                    Eyebrow("Matched to your PINS")
                    Text("\(feed.count) ideas that cleared your current needs.").font(Theme.body(14)).foregroundStyle(Theme.ink)
                    if store.aiAvailable { Note("Fresh ideas and pictures are prepared by OpenAI only with your permission. You can exclude health needs in My Pins → AI and privacy. Your name, photos, companions and visual preferences are not sent.") }
                    HStack { Button("Tune my ideas") { showTune = true }.buttonStyle(.secondary); if store.aiAvailable { MoreSuggestionsButton(enoughReached: false) } }
                    AlertText(store.aiError)
                }
                .glassPanel(padding: 14)
            }
            Button("Back to all ideas") { navigation.detailIdeaId = nil }.buttonStyle(.secondary)
            if feed.isEmpty {
                EmptyState(icon: "leaf", title: "Let’s keep your needs first.", text: store.profile.hasFreeTextNeed ? "Your written need is saved. ENOUGH cannot yet assess free-text needs, so suggestions are paused. Keep your answer, or choose equivalent listed boundaries in My Pins." : "No library idea currently clears your constraints. Keep your needs as they are, or update them if something has changed.", action: ("Review idea settings", { showTune = true }), secondary: ("Review My Pins", { navigation.sheet = .setup }))
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
            ZStack(alignment: .top) {
                IdeaPicture(idea: idea).frame(height: 300).clipped()
                HStack {
                    Text("ENOUGH").font(Theme.body(12, weight: .semibold)).kerning(2).foregroundStyle(.white)
                    Spacer()
                    Text("\(position + 1)").font(Theme.body(13, weight: .semibold)).foregroundStyle(.white).accessibilityLabel("Idea \(position + 1) of \(feed.count)")
                }
                .padding(14)
                .background(LinearGradient(colors: [Theme.deepInk.opacity(0.5), .clear], startPoint: .top, endPoint: .bottom))
            }
            .gesture(DragGesture(minimumDistance: 40).onEnded { value in
                let d = abs(value.translation.height) > abs(value.translation.width) ? value.translation.height : value.translation.width
                if abs(d) > 65 { next(d < 0 ? 1 : -1) }
            })
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 18) {
                    Button { act(.save(idea.id)) } label: { Label(store.isSaved(idea.id) ? "Saved" : "Save", systemImage: store.isSaved(idea.id) ? "bookmark.fill" : "bookmark") }
                    Button { showWhy = true } label: { Label("Why this?", systemImage: "ellipsis.circle") }
                }
                .font(Theme.body(14, weight: .semibold)).foregroundStyle(Theme.ink)
                Eyebrow(store.isComplete ? "Matched to your PINS" : "Worth a look")
                Text(idea.title).font(Theme.display(28)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
                Text(idea.body).font(Theme.body(15)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 8) {
                    Metric(icon: "figure.walk", value: "\(idea.minutes) min", label: "Exercise Minutes")
                    Metric(icon: "wallet.pass", value: Regions.formatMoney(cash?.cents ?? 0, currency: cash?.currency ?? store.profile.currency, country: store.profile.country), label: "Money Saved", caption: "estimate")
                    Metric(icon: "wind", value: idea.extraMin > 0 ? "+\(idea.extraMin) min" : idea.extraMin < 0 ? "\(-idea.extraMin) min reclaimed" : "No extra time", label: idea.extraMin > 0 ? "additional time" : "paired with your day")
                }
                (Text("Because ").bold() + Text(active?.told.first.map { $0.prefix(1).lowercased() + String($0.dropFirst()) } ?? "this offers another way through an everyday moment.")).font(Theme.body(14)).foregroundStyle(Theme.ink)
                IdeaTagsView(idea: idea)
                Note(idea.source == .ai ? "AI-generated · checked against your needs" : "From the supplied idea library")
                Button(planned ? "View my experience" : "Sounds good") { act(.accept(idea.id)) }.buttonStyle(.primary).frame(maxWidth: .infinity)
                HStack {
                    Button("Previous") { next(-1) }.buttonStyle(.secondary)
                    Spacer()
                    VStack(spacing: 2) { Text("\(position + 1) / \(feed.count)").font(Theme.body(13, weight: .semibold)).foregroundStyle(Theme.ink); Text("Swipe for another").font(Theme.body(11)).foregroundStyle(Theme.muted) }
                    Spacer()
                    Button("Next idea") { next(1) }.buttonStyle(.secondary)
                }
            }
            .padding(16)
        }
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(Theme.border))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Idea browser")
    }

    private var notes: some View {
        let tries = store.state.entries.filter { $0.ideaId == idea.id && $0.status == .completed }
        let cost = (store.state.costs ?? []).first { $0.ideaId == idea.id && $0.currency == store.profile.currency }
        return VStack(alignment: .leading, spacing: 12) {
            Button(cost != nil ? "Edit my cost calculation" : "Calculate Money Saved with my costs") { showCosts = true }.buttonStyle(.text)
            DisclosureGroup("On your terms") {
                VStack(alignment: .leading, spacing: 8) {
                    Text("An idea. Never an obligation. Take what fits your day and leave the rest. There’s no limit to exploring; you set the pace.").font(Theme.body(14)).foregroundStyle(Theme.ink)
                    Button("See My Pins") { navigation.go(.pins) }.buttonStyle(.text)
                    Note("Library and AI ideas are labelled separately. Only confirmed outcomes enter My Wins.")
                }
                .padding(.top, 6)
            }
            .font(Theme.body(15, weight: .semibold)).foregroundStyle(Theme.ink)
            DisclosureGroup("Ratings & experiences") {
                VStack(alignment: .leading, spacing: 8) {
                    Text(tries.isEmpty ? "You haven’t rated this idea yet. After trying it, tell us whether it was worthwhile." : "\(tries.filter { $0.worthwhile == true }.count) of your \(tries.count) confirmed tries felt worthwhile.").font(Theme.body(14)).foregroundStyle(Theme.ink)
                    Note("Your feedback is private to you. Community ratings and testimonials are not connected in this preview.")
                }
                .padding(.top, 6)
            }
            .font(Theme.body(15, weight: .semibold)).foregroundStyle(Theme.ink)
            if (store.state.passes?.count ?? 0) >= 6 { Button("Want a closer fit? Tune your ideas.") { showTune = true }.buttonStyle(.text) }
        }
        .glassPanel()
    }

    private var whySheet: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Eyebrow("ENOUGH")
                    Text("A little more about this idea").font(Theme.display(28)).foregroundStyle(Theme.ink)
                    Text(store.isComplete ? ((active.map { $0.told + $0.learned + $0.protects } ?? []).joined(separator: " ")) : "Complete your PINS and routines for personalised matches.").font(Theme.body(14)).foregroundStyle(Theme.muted)
                    Text("Instead of: \(idea.usual)").font(Theme.body(15)).foregroundStyle(Theme.ink)
                    Text(idea.extraMin > 0 ? "This adds \(idea.extraMin) minutes beyond the usual activity." : "This combines movement with an existing activity; timing is a template assumption.").font(Theme.body(15)).foregroundStyle(Theme.ink)
                    Text(cash?.source ?? "No cash saving is assumed for this idea.").font(Theme.body(15)).foregroundStyle(Theme.ink)
                    Text(idea.safety).font(Theme.body(15)).foregroundStyle(Theme.ink)
                    if store.isComplete, let active {
                        Text("What shaped this match").font(Theme.body(15, weight: .semibold)).foregroundStyle(Theme.ink)
                        ForEach(active.told + active.learned + active.protects, id: \.self) { Text("• \($0)").font(Theme.body(14)).foregroundStyle(Theme.ink) }
                        Button("Not for me · hide this idea") { store.hide(idea.id); showWhy = false; navigation.detailIdeaId = nil }.buttonStyle(.text)
                    }
                    Note("Check the real route, setting and movement before trying it. Your visual preferences are never used to infer ability or fit.")
                    Button("Got it") { showWhy = false }.buttonStyle(.primary)
                }
                .padding(16)
            }
            .background(Theme.paper)
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
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Your costs for this move").font(Theme.display(28)).foregroundStyle(Theme.ink)
                    Text("\(idea.title). Use the costs you would actually pay, including any extra costs. This calculation stays separate from confirmed money in My Wins.").font(Theme.body(14)).foregroundStyle(Theme.muted)
                    FieldLabel("What would you normally spend? (\(currency))"); TextField("0.00", text: $usual).keyboardType(.decimalPad).fieldBox()
                    FieldLabel("What would this move cost in total? (\(currency))"); TextField("0.00", text: $move).keyboardType(.decimalPad).fieldBox()
                    if let usualCents, let moveCents {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Money Saved").font(Theme.body(12, weight: .semibold)).foregroundStyle(Theme.muted)
                            Text(Regions.formatMoney(max(0, usualCents - moveCents), currency: currency, country: store.profile.country)).font(Theme.display(28)).foregroundStyle(Theme.ink)
                            Text(moveCents > usualCents ? "This move would cost \(Regions.formatMoney(moveCents - usualCents, currency: currency, country: store.profile.country)) more. No saving is counted." : "Your usual cost minus this move’s cost. Only confirm money afterwards if you actually kept it.").font(Theme.body(13)).foregroundStyle(Theme.muted)
                        }
                        .padding(12).background(Theme.mist).clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    AlertText(error)
                    Button("Use these costs") {
                        guard let usualCents, let moveCents else { error = "Enter both costs from 0 to 1,000, with up to two decimal places."; return }
                        store.setCost(Cost(ideaId: idea.id, currency: currency, usualCents: usualCents, moveCents: moveCents, updatedAt: ISO.string()))
                        dismiss()
                    }
                    .buttonStyle(.primary)
                    if existing != nil { Button("Remove my cost calculation") { store.removeCost(ideaId: idea.id, currency: currency); dismiss() }.buttonStyle(.text) }
                }
                .padding(16)
            }
            .background(Theme.paper)
            .onAppear { if let existing { usual = String(format: "%.2f", Double(existing.usualCents) / 100); move = String(format: "%.2f", Double(existing.moveCents) / 100) } }
        }
    }
}
