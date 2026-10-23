import SwiftUI

/// My Wins: what your confirmed moments gave back (`components/wins-dashboard.tsx`
/// and the wins branch of `app/page.tsx`). Only what you confirm is counted.
struct WinsTabView: View {
    let now: Date
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation
    @EnvironmentObject private var health: HealthService
    @State private var reportCurrency: String?
    @State private var showWorkings = false
    @State private var correcting: Entry?
    @State private var historyOpen = false
    @State private var photos: [ActivityPhoto] = []

    private var period: ReturnPeriod { navigation.winsPeriod }
    private var currency: String { reportCurrency ?? store.profile.currency }
    private var report: Receipt { Journey.receipt(store.state.entries, period: period, currency: currency, now: now) }

    private func addWin() { navigation.go(.moves, moves: store.state.plannedEntries.isEmpty ? .explore : .planned) }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            summary
            record
            WinsGallery(now: now, photos: $photos, onAddWin: addWin)
            goals
            history
            WeeklyReviewCard(now: now).glassPanel()
            Note("\(store.cloud ? "Kept in your account." : "Kept only on this device.") Money is never converted between currencies; this receipt is in \(currency).")
        }
        .pageGutter()
        .onAppear { if navigation.highlightedOutcomeId != nil { historyOpen = true } }
        .sheet(isPresented: $showWorkings) { workings }
        .confirmationDialog("Correct this outcome?", isPresented: Binding(get: { correcting != nil }, set: { if !$0 { correcting = nil } }), titleVisibility: .visible) {
            Button("Return it to Planned", role: .destructive) { if let e = correcting { store.undoOutcome(entryId: e.id) }; correcting = nil }
            Button("Keep this outcome", role: .cancel) { correcting = nil }
        } message: { Text("This result leaves your receipt and the move goes back to Planned, so you can confirm it again.") }
        .onChange(of: navigation.highlightedOutcomeId) { _, id in if id != nil { historyOpen = true } }
        .onChange(of: historyOpen) { _, open in if !open { navigation.highlightedOutcomeId = nil } }
    }

    private var summary: some View {
        let activity = Wins.dashboardActivity(store.state, now: now)
        return VStack(alignment: .leading, spacing: 12) {
            Eyebrow("My Wins")
            Text("More life. In little moments.").font(Theme.display(26)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
            Text(activity.confirmed == 0 ? "A conversation, an errand, a useful pause. After a move, say what happened and it is kept here." : "\(activity.confirmed) \(activity.confirmed == 1 ? "moment" : "moments") you chose to keep. Here’s what they gave back.").font(Theme.body(15)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
            VStack(alignment: .leading, spacing: 8) {
                Text("Your week, at your pace").font(Theme.body(15, weight: .medium)).foregroundStyle(Theme.ink)
                ActivityDaysView(days: activity.days)
                Note(activity.activeDays == 0 ? "An open week. Nothing to make up." : "\(activity.activeDays) \(activity.activeDays == 1 ? "day" : "days") with a moment you kept.")
            }
            .glassPanel(padding: 14)
        }
    }

    /// Record exercise & savings: steps today, money kept, activities you enjoy, photos.
    private var record: some View {
        let moving = report.rows.reduce(0) { $0 + ($1.minutes ?? 0) }
        let previous = Wins.previousReturns(store.state.entries, period: period, currency: currency, now: now)
        let currencies = Array(Set([currency] + Wins.returnCurrencies(store.state, now: now))).sorted()
        let interests = Set(store.profile.interests)
        let enjoyed = report.rows.filter { e in !interests.isDisjoint(with: store.state.idea(e.ideaId).enjoy) }.count
        let steps = Movement.todayMovement(store.movementSnapshot, now: now)?.steps
        return VStack(alignment: .leading, spacing: 12) {
            Eyebrow("Record exercise & savings")
            SectionTitle("What came back.")
            HStack(spacing: 10) {
                Picker("Period", selection: $navigation.winsPeriod) { ForEach(ReturnPeriod.allCases) { Text($0.rawValue).tag($0) } }.pickerStyle(.menu).tint(Theme.ink)
                if currencies.count > 1 {
                    Picker("Currency", selection: Binding(get: { currency }, set: { reportCurrency = $0 })) { ForEach(currencies, id: \.self) { Text($0).tag($0) } }.pickerStyle(.menu).tint(Theme.ink)
                }
                Spacer()
            }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                Metric(value: steps.map { String(Int($0)) } ?? "—", label: "Steps today", caption: health.connected ? "From Apple Health" : "Connect Apple Health in My Pins")
                Metric(value: Regions.formatMoney(report.money, currency: currency, country: store.profile.country), label: "Money kept", caption: previous.map { "\($0.label): \(Regions.formatMoney($0.money, currency: currency, country: store.profile.country))" } ?? "Only what you confirmed")
                Metric(value: "\(enjoyed)", label: "Activities you enjoy", caption: interests.isEmpty ? "Say what you enjoy in My Pins" : "\(enjoyed == 1 ? "moment" : "moments") with something you love, of \(report.rows.count)")
                Metric(value: "\(store.cloud ? photos.count : 0)", label: "Photos", caption: store.cloud ? "Kept with your moments" : "Sign in to keep photos")
            }
            Note("\(Wins.durationLabel(moving)) moving, \(Wins.durationLabel(report.outside)) of it outside, \(report.worthwhile) \(report.worthwhile == 1 ? "moment" : "moments") you called worthwhile.")
            VStack(alignment: .leading, spacing: 8) {
                Button("Add a moment") { addWin() }.buttonStyle(.primary)
                Button("How this is worked out") { showWorkings = true }.buttonStyle(.text)
            }
        }
        .glassPanel()
        .id("wins-record")
    }

    /// My goals: every plan you set, planned, done or set aside.
    private var goals: some View {
        let rows = store.state.entries.filter { $0.support != nil }.sorted { $0.acceptedAt > $1.acceptedAt }
        return VStack(alignment: .leading, spacing: 12) {
            Eyebrow("My goals")
            SectionTitle("What you set out to do.")
            if rows.isEmpty {
                Text("No goals yet. Say “sounds good” to an idea in My Moves, then add a plan: a direction or a clear target, in your own words.").font(Theme.body(14)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
                Button("Find an idea") { navigation.go(.moves, moves: .explore) }.buttonStyle(.secondary)
            } else {
                ForEach(rows) { e in goalRow(e) }
            }
        }
        .glassPanel()
        .id("wins-goals")
    }

    private func goalRow(_ e: Entry) -> some View {
        let plan = e.support ?? SupportPlan()
        let status = e.status == .completed ? "Done" : e.status == .notToday ? "Set aside" : plan.paused == true ? "Paused" : "Planned"
        return VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top) {
                Text(store.state.idea(e.ideaId).title).font(Theme.display(20)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
                Spacer()
                Badge(status)
            }
            Text(plan.goal).font(Theme.body(14)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
            Note(plan.goalType == .smart
                ? "A clear target\(plan.target.isEmpty ? "" : " · \(plan.target)")\(plan.deadlineDate.map { " · by \($0.formatted(date: .abbreviated, time: .omitted))" } ?? "")"
                : "A direction\(plan.when.isEmpty ? "" : " · \(plan.when)")")
            if e.status == .accepted {
                Button("See my plan") { navigation.openSupport(e.id) }.buttonStyle(.text)
            } else if e.status == .completed {
                Button("See outcome") { navigation.openOutcome(e.id) }.buttonStyle(.text)
            }
        }
        .padding(.vertical, 8)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.border).frame(height: 1) }
    }

    private var history: some View {
        let rows = report.rows.sorted { ($0.completedDate ?? .distantPast) > ($1.completedDate ?? .distantPast) }
        return DisclosureGroup(isExpanded: $historyOpen) {
            VStack(alignment: .leading, spacing: 12) {
                if rows.isEmpty {
                    Text("No moments in this period yet.").font(Theme.body(14)).foregroundStyle(Theme.muted)
                } else {
                    ForEach(rows) { e in outcomeRow(e) }
                }
            }
            .padding(.top, 8)
        } label: {
            VStack(alignment: .leading, spacing: 2) {
                Text("Every moment").font(Theme.body(16, weight: .medium)).foregroundStyle(Theme.ink)
                Text("\(report.rows.count) \(report.rows.count == 1 ? "moment" : "moments") · \(period.rawValue.lowercased())").font(Theme.body(12)).foregroundStyle(Theme.muted)
            }
        }
        .tint(Theme.ink)
        .glassPanel()
    }

    private func outcomeRow(_ e: Entry) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Note(e.completedDate.map { $0.formatted(date: .abbreviated, time: .omitted) } ?? "")
            Text(store.state.idea(e.ideaId).title).font(Theme.display(20)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
            Text("\(e.minutes ?? 0) min · \(Regions.formatMoney(e.moneyCents ?? 0, currency: e.currency, country: store.profile.country)) kept · \(e.worthwhile == true ? "worthwhile" : "not worthwhile this time")").font(Theme.body(14)).foregroundStyle(Theme.ink)
            MeetingCheckinView(entryId: e.id)
            MovementEvidenceText(entry: e)
            if e.movementEvidence != nil { Button("Remove the saved health reading") { store.updateEntry(e.id) { $0.movementEvidence = nil } }.buttonStyle(.text) }
            if let moment = e.planMoment { Note("At the planned moment: \(moment.label).") }
            if let broke = e.brokeSitting { Note("Broke up a long stretch of sitting: \(broke == .yes ? "yes" : broke == .no ? "no" : "not sure").") }
            if let added = e.additionalMovement { Note(added == .more ? "You felt it added movement." : added == .same ? "About the same movement as usual." : added == .less ? "Less movement than usual." : "Not sure whether it added movement.") }
            Button("Correct this outcome") { correcting = e }.buttonStyle(.text)
        }
        .padding(12)
        .background(navigation.highlightedOutcomeId == e.id ? Theme.mist : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.field, style: .continuous))
        .id("win-outcome-\(e.id)")
    }

    private var workings: some View {
        SheetFrame(title: "Your receipt, with the workings", kicker: "My Wins") {
            Text("Totals come only from what you confirmed after a move. Outside time and connecting time can overlap, so they are shown separately. Money is added only when you confirm a saving, in the same currency; nothing is converted. This week starts on Monday in your device’s time zone.").font(Theme.body(15)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
            Note("Before a move, the money figure on an idea is what it is worth if you do it. After a move, only what you confirm counts here.")
        }
        .presentationDetents([.medium, .large])
    }
}

/// "A moment to reflect": the optional weekly review.
struct WeeklyReviewCard: View {
    let now: Date
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation
    @State private var open = false
    @State private var worked = ""
    @State private var barrier = ""
    @State private var smallFix = ""
    @State private var choices: [String: PlanChoice] = [:]
    @State private var error = ""

    var body: some View {
        let week = WeeklyReviews.localWeek(now)
        let saved = store.state.weeklyReviews?.first { $0.week == week }
        let plans = WeeklyReviews.activePlans(store.state)
        VStack(alignment: .leading, spacing: 10) {
            Text("A moment to reflect").font(Theme.body(15, weight: .medium)).foregroundStyle(Theme.ink)
            if let saved {
                Text("Your review for this week is kept.").font(Theme.body(13)).foregroundStyle(Theme.muted)
                if !saved.worked.isEmpty { reviewRow("What worked", saved.worked) }
                if !saved.barrier.isEmpty { reviewRow("What got in the way", saved.barrier) }
                if !saved.smallFix.isEmpty { reviewRow("One small change", saved.smallFix) }
                ForEach(saved.plans, id: \.entryId) { p in
                    HStack {
                        Text("\(store.state.entries.first { $0.id == p.entryId }.map { store.state.idea($0.ideaId).title } ?? "Your plan") · \(p.choice == .keep ? "Keep" : p.choice == .pause ? "Paused" : "Change")").font(Theme.body(13)).foregroundStyle(Theme.ink)
                        if p.choice == .change && store.state.entries.contains(where: { $0.id == p.entryId && $0.status == .accepted }) { Button("Edit this plan") { navigation.openSupport(p.entryId) }.buttonStyle(.text) }
                    }
                }
            } else {
                Text("What fitted your life this week? Keep what helped, change the size, or pause a plan. Entirely optional.").font(Theme.body(13)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
                if !open {
                    Button("Review this week") { open = true }.buttonStyle(.secondary)
                } else {
                    VStack(alignment: .leading, spacing: 8) {
                        FieldLabel("What worked?", optional: true); TextField("", text: $worked, axis: .vertical).fieldBox()
                        FieldLabel("What got in the way?", optional: true); TextField("", text: $barrier, axis: .vertical).fieldBox()
                        FieldLabel("One small change", optional: true); TextField("", text: $smallFix, axis: .vertical).fieldBox()
                        ForEach(plans) { p in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(store.state.idea(p.ideaId).title).font(Theme.body(13, weight: .medium)).foregroundStyle(Theme.ink)
                                ChipRow(items: PlanChoice.allCases, label: { $0.label }, selected: { choices[p.id] == $0 }, pick: { choices[p.id] = $0 })
                            }
                        }
                        if choices.values.contains(.pause) { Note("Pausing quietens the reminder for that plan.") }
                        AlertText(error)
                        Button("Keep this week’s review") {
                            do { try store.saveWeeklyReview(worked: String(worked.prefix(240)), barrier: String(barrier.prefix(240)), smallFix: String(smallFix.prefix(240)), plans: plans.compactMap { p in choices[p.id].map { ReviewedPlan(entryId: p.id, choice: $0) } }); open = false; error = "" }
                            catch { self.error = error.localizedDescription }
                        }.buttonStyle(.primary)
                        Button("Leave it for now") { open = false }.buttonStyle(.text)
                    }
                }
            }
        }
    }

    private func reviewRow(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) { Text(label).font(Theme.body(12, weight: .medium)).foregroundStyle(Theme.muted); Text(value).font(Theme.body(13)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true) }
    }
}
