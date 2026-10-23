import SwiftUI

/// My Enough: the dashboard (`components/discovery.tsx` and `enough-widgets.tsx`).
/// My Enough: a calm home. One gentle idea for today, a question about how
/// you are, and a quiet view of your week. Everything else lives in its own tab.
struct EnoughTabView: View {
    let now: Date
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation
    @EnvironmentObject private var health: HealthService
    @State private var setting: Setting = .any
    @State private var featuredId: Int?
    @State private var showToday = false
    @State private var movementOpen = false
    @State private var snapshot: MovementSnapshot?

    private var enoughReached: Bool { store.enoughReached(snapshot: snapshot, now: now) }
    private var ideas: [Idea] { Movement.suggestionsAfterEnough(store.feed(now: now).map(\.idea), reached: enoughReached, settings: store.state.movementSettings) }
    private var matches: [Idea] { Discovery.dashboardIdeas(ideas, filter: .forYou, state: store.state, query: "", maxMinutes: 0, setting: setting, gentle: false) }
    private var featured: Idea? { matches.first { $0.id == featuredId } ?? matches.first }
    private var name: String { store.profile.name.trimmingCharacters(in: .whitespaces) }

    private var encouragement: String {
        let activity = Wins.dashboardActivity(store.state, now: now)
        if enoughReached { return "You’ve had your enough today. Nothing more is needed." }
        if activity.today > 0 { return "Something already happened today. That counts." }
        if activity.planned > 0 { return "A plan is waiting, for whenever it fits. No rush." }
        if !store.isComplete { return "A few answers about your life, and the ideas become yours." }
        return "Nothing to catch up on. Here’s one small possibility, if the day has room."
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 6) {
                Text("\(Discovery.greeting(now))\(name.isEmpty ? "" : ", \(name)").").font(Theme.display(28)).foregroundStyle(Theme.ink)
                Text(encouragement).font(Theme.body(16)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
            }
            if let featured { todayCard(featured) } else { quietCard }
            if store.isComplete { mood } else { Button("Start with my life") { navigation.sheet = .setup }.buttonStyle(.primary) }
            week
            DisclosureGroup("Your movement today", isExpanded: $movementOpen) {
                MovementPanelView(snapshot: $snapshot, now: now)
            }
            .font(Theme.body(15, weight: .semibold)).foregroundStyle(Theme.ink)
            .glassPanel()
            Note("ENOUGH never sets you a target. Enough is whatever you decide it is.")
        }
        .pageGutter()
        .sheet(isPresented: $showToday) { TodayNoteSheet() }
    }

    private func todayCard(_ idea: Idea) -> some View {
        return Button { navigation.openIdea(idea.id) } label: {
            VStack(alignment: .leading, spacing: 0) {
                SceneImage(name: Discovery.cover(idea)).frame(height: 190).frame(maxWidth: .infinity)
                VStack(alignment: .leading, spacing: 8) {
                    Eyebrow(store.isComplete ? "One idea for today" : "An example to explore")
                    Text(idea.title).font(Theme.display(24)).foregroundStyle(Theme.ink).multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                    Text(idea.body).font(Theme.body(14)).foregroundStyle(Theme.muted).multilineTextAlignment(.leading).lineLimit(3)
                    ValueStrip(idea: idea, compact: true)
                    Text("Only if it fits. There’s always another day.").font(Theme.body(12)).foregroundStyle(Theme.muted)
                }
                .padding(16)
            }
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(Theme.border))
            .shadow(color: Theme.ink.opacity(0.08), radius: 20, x: 0, y: 10)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Today’s idea: \(idea.title)")
    }

    private var quietCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: "leaf").font(.system(size: 24, weight: .light)).foregroundStyle(Theme.accent)
            Text(enoughReached ? "Room to pause." : "Your needs come first.").font(Theme.display(24)).foregroundStyle(Theme.ink)
            Text(enoughReached ? "Suggestions are quiet for today. Browse My Moves whenever you like." : "Nothing in the library fits your current needs, and that’s fine. Your boundaries stay as they are.").font(Theme.body(14)).foregroundStyle(Theme.muted)
            if !enoughReached { Button("Review My Pins") { navigation.sheet = .setup }.buttonStyle(.secondary) }
        }
        .glassPanel()
    }

    private var mood: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("How’s today feeling?").font(Theme.body(15, weight: .semibold)).foregroundStyle(Theme.ink)
            HStack(spacing: 8) {
                Chip(label: "Fresh air", selected: setting == .outside, icon: "leaf") { setting = setting == .outside ? .any : .outside; featuredId = nil }
                Chip(label: "Indoors", selected: setting == .indoors, icon: "house") { setting = setting == .indoors ? .any : .indoors; featuredId = nil }
                Chip(label: "Surprise me", selected: false, icon: "sparkles") { featuredId = Discovery.surpriseIdeaId(matches, currentId: featured?.id) }
            }
            Button(store.state.today.date == localDate(now) && !store.state.today.context.isEmpty ? "Today: \(store.state.today.context) · change" : "Less time, low energy, a hard day? Tell ENOUGH") { showToday = true }.buttonStyle(.text)
        }
        .glassPanel()
    }

    private var week: some View {
        let activity = Wins.dashboardActivity(store.state, now: now)
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Your week, at your pace").font(Theme.body(15, weight: .semibold)).foregroundStyle(Theme.ink)
                Spacer()
                Button("My Wins") { navigation.go(.wins) }.buttonStyle(.text)
            }
            ActivityDaysView(days: activity.days)
            Text(activity.activeDays == 0 ? "An open week. There’s nothing to make up." : "\(activity.activeDays) \(activity.activeDays == 1 ? "day" : "days") with a moment you chose to keep.").font(Theme.body(13)).foregroundStyle(Theme.muted)
        }
        .glassPanel()
    }
}

/// `IdeaTile`: a discovery card for the dashboard grid.
struct IdeaTile: View {
    let idea: Idea
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation

    var body: some View {
        Button { navigation.openIdea(idea.id) } label: {
            VStack(alignment: .leading, spacing: 0) {
                ZStack(alignment: .topLeading) {
                    SceneImage(name: Discovery.cover(idea)).frame(height: 150).clipped()
                    Text(Discovery.isFreeMove(idea) ? "Free activity" : idea.source == .ai ? "AI idea" : "Everyday idea").font(Theme.body(11, weight: .semibold)).padding(.horizontal, 8).padding(.vertical, 4).background(.ultraThinMaterial).clipShape(Capsule()).padding(10)
                    if store.isSaved(idea.id) { Image(systemName: "bookmark.fill").foregroundStyle(Theme.ink).padding(8).background(.ultraThinMaterial).clipShape(Circle()).padding(10).frame(maxWidth: .infinity, alignment: .trailing) }
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text(idea.title).font(Theme.body(16, weight: .semibold)).foregroundStyle(Theme.ink).multilineTextAlignment(.leading)
                    Text(idea.body).font(Theme.body(13)).foregroundStyle(Theme.muted).multilineTextAlignment(.leading).lineLimit(3)
                    IdeaTagsView(idea: idea)
                    ValueStrip(idea: idea, compact: true)
                    HStack { Spacer(); Text("See idea").font(Theme.body(13, weight: .semibold)).foregroundStyle(Theme.accent) }
                }
                .padding(12)
            }
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Theme.border))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Explore \(idea.title)")
    }
}

/// "Ideas near you": map searches for free places, with the user's own locality.
struct NearbyIdeas: View {
    @EnvironmentObject private var store: AppStore
    @AppStorage("enough.nearby.locality.v1") private var locality = ""
    private let places: [(String, String, String, String, String)] = [
        ("A little green space", "A gentle wander, or a call outside.", "public parks", "leaf", "welcome-call"),
        ("A path near home", "A few minutes of fresh air on a familiar route.", "public walking paths", "figure.walk", "welcome-coast"),
        ("While the kids play", "Move nearby while keeping them in sight.", "free public playgrounds", "person.2", "welcome-school")
    ]

    private var constrained: Bool {
        store.profile.needs.contains { ["Physical comfort / accessibility", "Pain / discomfort", "Safety matters", "Weather / heat", "Hard to walk where I live", "Transport limitations"].contains($0) || $0.hasPrefix(Pins.customPrefix) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack { VStack(alignment: .leading, spacing: 4) { Eyebrow("Free places to move"); SectionTitle("Ideas near you", size: 22) }; Spacer(); Image(systemName: "mappin").foregroundStyle(Theme.accent) }
            Text("Start close to home. No class, ticket or purchase needed.").font(Theme.body(14)).foregroundStyle(Theme.muted)
            HStack { Image(systemName: "mappin"); TextField("Your suburb or town", text: $locality) }.fieldBox()
            if constrained {
                Label("Your current needs favour familiar, comfortable spaces. Try the indoor or seated ideas in your feed; update My Pins if your circumstances change.", systemImage: "heart").font(Theme.body(13)).foregroundStyle(Theme.ink)
            } else {
                ForEach(places, id: \.0) { name, description, query, icon, image in
                    HStack(spacing: 12) {
                        SceneImage(name: image).frame(width: 64, height: 64).clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        VStack(alignment: .leading, spacing: 2) {
                            Label(name, systemImage: icon).font(Theme.body(14, weight: .semibold)).foregroundStyle(Theme.ink)
                            Text(description).font(Theme.body(12)).foregroundStyle(Theme.muted)
                            if let url = Discovery.placeSearchURL(query: query, locality: locality) { Link("Search places on map", destination: url).font(Theme.body(13, weight: .semibold)) } else { Note("Enter a town to search") }
                        }
                    }
                }
            }
            Note("Map searches help you find places. Check a venue’s access, opening hours and any fees before heading out.")
        }
        .glassPanel()
    }
}

/// "Your life lately": recent confirmed moments with private photos when signed in.
struct RecentLifeWidget: View {
    let now: Date
    let activity: DashboardActivity
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation
    @State private var photos: [ActivityPhoto] = []
    @State private var photoError = false

    var body: some View {
        let recent = Array(Wins.confirmed(store.state.entries, now: now).prefix(3))
        VStack(alignment: .leading, spacing: 10) {
            HStack { SectionTitle("Your life lately", size: 22); Spacer(); Button("See all") { navigation.go(.wins) }.buttonStyle(.text) }
            Text(activity.month > 0 ? "You’ve confirmed \(activity.month) \(activity.month == 1 ? "moment" : "moments") this month." : "Your real moments, and what they gave you.").font(Theme.body(14)).foregroundStyle(Theme.ink)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(recent) { entry in
                        let idea = Catalogue.byId(entry.ideaId, generated: store.state.generated ?? [])
                        Button { navigation.go(.wins) } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                ZStack(alignment: .bottomLeading) {
                                    if store.cloud, let photo = photos.first(where: { $0.entry_id == entry.id }) {
                                        RemoteImage(path: "/api/photos?id=\(photo.id)")
                                    } else if let image = idea?.image { SceneImage(name: image) }
                                    else { SceneImage(name: idea.map(Discovery.cover) ?? "welcome-coast") }
                                }
                                .frame(width: 150, height: 110).clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                HStack(spacing: 4) {
                                    Text(idea?.title ?? "Your confirmed move").font(Theme.body(13, weight: .semibold)).foregroundStyle(Theme.ink).lineLimit(2).multilineTextAlignment(.leading)
                                    if entry.worthwhile == true { Image(systemName: "heart.fill").font(.system(size: 11)).foregroundStyle(Theme.warm) }
                                }
                                Text(Wins.momentDateLabel(entry.completedAt ?? "", now: now)).font(Theme.body(11)).foregroundStyle(Theme.muted)
                            }
                            .frame(width: 150, alignment: .leading)
                        }
                        .buttonStyle(.plain)
                    }
                    Button { navigation.go(.moves, moves: activity.planned > 0 ? .planned : .explore) } label: {
                        VStack(spacing: 6) {
                            Image(systemName: "plus").font(.system(size: 24, weight: .light))
                            Text("Add a moment").font(Theme.body(13, weight: .semibold))
                            Text(activity.planned > 0 ? "Check in on a planned move" : "Find a move to try").font(Theme.body(11)).foregroundStyle(Theme.muted)
                        }
                        .foregroundStyle(Theme.ink)
                        .frame(width: 150, height: 150)
                        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Theme.border, style: StrokeStyle(lineWidth: 1, dash: [5])))
                    }
                    .buttonStyle(.plain)
                }
            }
            if recent.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Label("Little moments. Yours to keep.", systemImage: "camera").font(Theme.body(15, weight: .semibold)).foregroundStyle(Theme.ink)
                    Text("Confirm a move to start your story. Your photos stay private in My Wins.").font(Theme.body(13)).foregroundStyle(Theme.muted)
                }
            }
            if photoError { HStack { Note("Your private photos couldn’t load."); Button("Try again") { Task { await load() } }.buttonStyle(.text) } }
        }
        .glassPanel()
        .task(id: store.cloud) { await load() }
    }

    private func load() async {
        guard store.cloud else { photos = []; return }
        do { photos = try await store.api.photos(); photoError = false } catch { photoError = true }
    }
}

/// "Enough has given back": confirmed returns for a period.
struct GivenBackWidget: View {
    let now: Date
    @EnvironmentObject private var store: AppStore
    @State private var period: ReturnPeriod = .thisMonth
    @State private var selectedCurrency: String?

    var body: some View {
        let currencies = Wins.returnCurrencies(store.state, now: now)
        let currency = selectedCurrency.flatMap { currencies.contains($0) ? $0 : nil } ?? store.profile.currency
        let report = Journey.receipt(store.state.entries, period: period, currency: currency, now: now)
        let previous = Wins.previousReturns(store.state.entries, period: period, currency: currency, now: now)
        let moneyRows = report.rows.filter { $0.currency == currency }
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                SectionTitle("Enough has given back", size: 22)
                Spacer()
                Picker("Return period", selection: $period) { ForEach(ReturnPeriod.allCases) { Text($0.rawValue).tag($0) } }.pickerStyle(.menu).tint(Theme.ink)
            }
            if currencies.count > 1 {
                Picker("Money currency", selection: Binding(get: { currency }, set: { selectedCurrency = $0 })) { ForEach(currencies, id: \.self) { Text($0).tag($0) } }.pickerStyle(.segmented)
            }
            Text(Regions.formatMoney(report.money, currency: currency, country: store.profile.country)).font(Theme.display(34)).foregroundStyle(Theme.ink)
            Label("Money kept · confirmed", systemImage: "wallet.pass").font(Theme.body(13)).foregroundStyle(Theme.muted)
            if let previous { Text("\(previous.label): \(Regions.formatMoney(previous.money, currency: currency, country: store.profile.country)) confirmed").font(Theme.body(13)).foregroundStyle(Theme.muted) }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                Metric(icon: "figure.walk", value: Wins.durationLabel(report.rows.reduce(0) { $0 + ($1.minutes ?? 0) }), label: "Moving")
                Metric(icon: "clock", value: Wins.durationLabel(report.rows.reduce(0) { $0 + ($1.timeCombined ?? 0) }), label: "Time combined")
                Metric(icon: "heart", value: "\(report.worthwhile)", label: "Worthwhile")
                Metric(icon: "checkmark", value: "\(report.rows.count)", label: "Confirmed moments")
            }
            Note(report.rows.isEmpty ? "Confirm an outcome to see what came back." : moneyRows.isEmpty ? "No confirmed money entries in \(currency) for this period. Movement and moments include all currencies." : currencies.count > 1 ? "Money currencies stay separate. Movement and moments include all currencies." : "Only outcomes you confirmed. Time combined overlaps with moving time.")
        }
        .glassPanel()
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
        VStack(alignment: .leading, spacing: 8) {
            Text("A moment to reflect").font(Theme.body(15, weight: .semibold)).foregroundStyle(Theme.ink)
            if let saved {
                Text("Your review for this week is saved.").font(Theme.body(13)).foregroundStyle(Theme.muted)
                if !saved.worked.isEmpty { reviewRow("What worked", saved.worked) }
                if !saved.barrier.isEmpty { reviewRow("A barrier", saved.barrier) }
                if !saved.smallFix.isEmpty { reviewRow("A small fix", saved.smallFix) }
                ForEach(saved.plans, id: \.entryId) { p in
                    HStack {
                        Text("\(store.state.entries.first { $0.id == p.entryId }.map { store.state.idea($0.ideaId).title } ?? "Your plan") · \(p.choice == .keep ? "Keep" : p.choice == .pause ? "Paused" : "Change")").font(Theme.body(13)).foregroundStyle(Theme.ink)
                        if p.choice == .change && store.state.entries.contains(where: { $0.id == p.entryId && $0.status == .accepted }) { Button("Edit this plan") { navigation.openSupport(p.entryId) }.buttonStyle(.text) }
                    }
                }
            } else {
                Text("What fitted your life this week? Keep what helped, change the size or pause a plan. This review is optional.").font(Theme.body(13)).foregroundStyle(Theme.muted)
                if !open {
                    Button("Review this week") { open = true }.buttonStyle(.secondary)
                } else {
                    VStack(alignment: .leading, spacing: 8) {
                        FieldLabel("What worked?", optional: true); TextField("", text: $worked, axis: .vertical).fieldBox()
                        FieldLabel("What got in the way?", optional: true); TextField("", text: $barrier, axis: .vertical).fieldBox()
                        FieldLabel("One small fix", optional: true); TextField("", text: $smallFix, axis: .vertical).fieldBox()
                        ForEach(plans) { p in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(store.state.idea(p.ideaId).title).font(Theme.body(13, weight: .semibold))
                                HStack { ForEach(PlanChoice.allCases, id: \.self) { c in Chip(label: c.label, selected: choices[p.id] == c) { choices[p.id] = c } } }
                            }
                        }
                        if choices.values.contains(.pause) { Note("Pausing stops ENOUGH’s reminder for that plan.") }
                        AlertText(error)
                        HStack {
                            Button("Save this week’s review") {
                                do { try store.saveWeeklyReview(worked: String(worked.prefix(240)), barrier: String(barrier.prefix(240)), smallFix: String(smallFix.prefix(240)), plans: plans.compactMap { p in choices[p.id].map { ReviewedPlan(entryId: p.id, choice: $0) } }); open = false; error = "" }
                                catch { self.error = error.localizedDescription }
                            }.buttonStyle(.primary)
                            Button("Leave for now") { open = false }.buttonStyle(.text)
                        }
                    }
                }
            }
        }
        .padding(.top, 6)
    }

    private func reviewRow(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) { Text(label).font(Theme.body(12, weight: .semibold)).foregroundStyle(Theme.muted); Text(value).font(Theme.body(13)).foregroundStyle(Theme.ink) }
    }
}

/// "Anything different today?" with a free note.
struct TodayNoteSheet: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var note = ""

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 14) {
                Eyebrow("ENOUGH")
                Text("Anything different today?").font(Theme.display(28)).foregroundStyle(Theme.ink)
                Text("Keep a note for today. Time, energy, stress and shift notes adjust today’s matches; the note expires tomorrow.").font(Theme.body(14)).foregroundStyle(Theme.muted)
                WrapChips(items: DailyContexts.todayContexts, label: { $0 }, selected: { store.state.today.date == localDate() && store.state.today.context == $0 }) { note = $0 }
                FieldLabel("A note for today", optional: true)
                TextField("Anything you’d like to keep in mind?", text: $note).fieldBox().onChange(of: note) { _, v in if v.count > 240 { note = String(v.prefix(240)) } }
                Note("Notes are reminders. Use My Pins for needs that should limit suggestions.")
                Button("Done") { store.setToday(note); dismiss() }.buttonStyle(.primary)
                Spacer()
            }
            .padding(16)
            .background(Theme.paper)
            .onAppear { note = store.state.today.date == localDate() ? store.state.today.context : "" }
        }
        .presentationDetents([.large])
    }
}
