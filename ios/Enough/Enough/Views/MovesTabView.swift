import SwiftUI

/// My Moves: Explore, Saved and Planned (`components/moves-discovery.tsx` and
/// the moves branch of `app/page.tsx`).
struct MovesTabView: View {
    let now: Date
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation
    @State private var showTune = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if let entryId = navigation.supportEntryId, let entry = store.state.entries.first(where: { $0.id == entryId }) {
                SupportPlanView(entry: entry).id(entry.id)
            } else {
                Picker("Move view", selection: $navigation.movesView) {
                    ForEach(AppNavigation.MovesView.allCases, id: \.self) { v in
                        Text(v == .saved && !store.state.saved.isEmpty ? "Saved (\(store.state.saved.count))" : v == .planned && !store.state.plannedEntries.isEmpty ? "Planned (\(store.state.plannedEntries.count))" : v.rawValue).tag(v)
                    }
                }
                .pickerStyle(.segmented).pageGutter()
                .onChange(of: navigation.movesView) { _, v in if v != .explore { navigation.detailIdeaId = nil } }
                switch navigation.movesView {
                case .explore:
                    if let id = navigation.detailIdeaId {
                        IdeaDetailView(ideaId: id, now: now, showTune: $showTune)
                    } else {
                        MovesDiscoveryView(now: now, showTune: $showTune)
                    }
                case .saved: SavedList()
                case .planned: PlannedList(now: now)
                }
            }
        }
        .sheet(isPresented: $showTune) { TuneSheet() }
    }
}

/// Explore: search, a few ways in, collections, then the ideas.
struct MovesDiscoveryView: View {
    let now: Date
    @Binding var showTune: Bool
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation
    @State private var filter: MoveFilter = .forYou
    @State private var options = MoveOptions.default
    @State private var filtersOpen = false
    @State private var limit = 8
    @State private var surpriseId: Int?
    @State private var collection: String?

    private var ideas: [Idea] { store.feed(now: now).map(\.idea) }
    private var personal: Bool { store.isComplete }
    private var collections: [MoveCollection] { Discovery.collections(ideas, state: store.state, now: now) }
    private var pool: [Idea] { Discovery.movesIdeas(ideas, filter: filter, state: store.state, options: options) }
    private var selected: MoveCollection? { collection.flatMap { key in collections.first { $0.key == key } } }
    private var narrowed: [Idea] {
        guard let selected else { return collection == nil ? pool : [] }
        return pool.filter { i in selected.ideas.contains { $0.id == i.id } }
    }
    private var featured: Idea? { narrowed.first { $0.id == surpriseId } ?? narrowed.first }
    private var shown: [Idea] {
        if filter == .surpriseMe, let featured { return [featured] + narrowed.filter { $0.id != featured.id } }
        let fresh = Dictionary(store.freshIds.enumerated().map { ($1, $0) }, uniquingKeysWith: { first, _ in first })
        return narrowed.filter { fresh[$0.id] != nil }.sorted { fresh[$0.id]! < fresh[$1.id]! } + narrowed.filter { fresh[$0.id] == nil }
    }

    private func clear() { filter = .forYou; options = .default; collection = nil; surpriseId = nil; limit = 8 }
    private func choose(_ value: MoveFilter) {
        filter = value; collection = nil; limit = 8
        surpriseId = value == .surpriseMe ? Discovery.surpriseIdeaId(Discovery.movesIdeas(ideas, filter: value, state: store.state, options: options), currentId: featured?.id) : nil
    }
    private func chooseCollection(_ key: String) { filter = .forYou; options = .default; collection = key; surpriseId = nil; limit = 8 }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 10) {
                Eyebrow("My Moves")
                Text("What could you do with the time you have?").font(Theme.display(26)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
                Text("Movement inside an ordinary day. Choose what fits; leave the rest.").font(Theme.body(15)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
                if !personal {
                    Note("These are examples. A few answers about your life make them yours.")
                    Button("Answer a few questions") { navigation.sheet = .setup }.buttonStyle(.secondary)
                }
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass").foregroundStyle(Theme.muted).accessibilityHidden(true)
                    TextField("Search calls, family, music…", text: $options.query).onChange(of: options.query) { _, _ in limit = 8 }
                    if !options.query.isEmpty {
                        Button { options.query = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(Theme.muted) }.buttonStyle(.plain).accessibilityLabel("Clear search")
                    }
                }
                .fieldBox()
                ChipRow(items: MoveFilter.allCases, label: { $0.rawValue }, selected: { $0 == filter && collection == nil }, pick: { choose($0) })
                Button(filtersOpen ? "Fewer filters" : "More filters") { filtersOpen.toggle() }.buttonStyle(.text)
            }
            .pageGutter()

            if filtersOpen { filterPanel.pageGutter() }
            if collection == nil { collectionsRow }
            results.pageGutter()
        }
    }

    private var filterPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack { SectionTitle("What fits right now?"); Spacer(); Button("Clear") { clear() }.buttonStyle(.text) }
            LabeledPicker(label: "Length", selection: $options.maxMinutes, options: [(0, "Any length"), (5, "Up to 5 minutes"), (10, "Up to 10 minutes"), (15, "Up to 15 minutes"), (30, "Up to 30 minutes"), (60, "Up to 60 minutes")])
            LabeledPicker(label: "Setting", selection: $options.setting, options: Setting.allCases.map { ($0, $0.label) })
            LabeledPicker(label: "Part of your day", selection: $options.category, options: [(nil, "Any part of the day"), (.call, "Calls"), (.listen, "Listening"), (.family, "Family time"), (.chores, "Household tasks"), (.work, "Work or study"), (.waiting, "Waiting"), (.think, "Thinking"), (.errand, "Errands"), (.shopping, "Shopping"), (.travel, "Travel"), (.coffee, "Coffee"), (.other, "Other")])
            LabeledPicker(label: "Kind of movement", selection: $options.intensity, options: [(nil, "Any kind")] + IdeaIntensity.allCases.map { (Optional($0), $0.label) })
            Toggle("Breaks up sitting", isOn: $options.breaksSitting).font(Theme.body(14)).tint(Theme.accent)
            Toggle("Gentle only", isOn: $options.gentle).font(Theme.body(14)).tint(Theme.accent)
            Toggle("No extra time", isOn: $options.noExtra).font(Theme.body(14)).tint(Theme.accent)
            Note("Your needs from My Pins apply to every filter.")
            Button("Tune my ideas") { showTune = true }.buttonStyle(.text)
        }
        .glassPanel()
    }

    private var collectionsRow: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(personal && collections.contains { $0.personal } ? "Because you like…" : "Ways into your day").font(Theme.body(15, weight: .medium)).foregroundStyle(Theme.ink).pageGutter()
            if collections.isEmpty {
                Note("Collections appear when an idea fits your current needs.").pageGutter()
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(collections) { t in
                            Button { chooseCollection(t.key) } label: {
                                VStack(alignment: .leading, spacing: 6) {
                                    SceneImage(name: t.image).frame(width: 160, height: 110).clipShape(RoundedRectangle(cornerRadius: Theme.Radius.field, style: .continuous))
                                    Text(t.title).font(Theme.body(14, weight: .medium)).foregroundStyle(Theme.ink).lineLimit(1)
                                    Text("\(t.ideas.count) \(t.ideas.count == 1 ? "idea" : "ideas") · \(t.reason)").font(Theme.body(11)).foregroundStyle(Theme.muted).lineLimit(2).multilineTextAlignment(.leading)
                                }
                                .frame(width: 160, alignment: .leading)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("\(t.title), \(t.ideas.count) ideas")
                        }
                    }
                    .pageGutter()
                }
            }
        }
    }

    private var results: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let selected {
                Eyebrow(selected.reason)
                HStack(alignment: .top) {
                    SectionTitle(selected.title, size: 26)
                    Spacer()
                    Button("All ideas") { collection = nil }.buttonStyle(.text)
                }
            } else {
                Eyebrow(personal ? "Shaped by your answers" : "Ideas to explore")
                SectionTitle(filter == .surpriseMe ? "Something you might not think of." : "A little possibility.", size: 26)
            }
            Text("\(shown.count) \(shown.count == 1 ? "idea" : "ideas")\(selected == nil && filter != .forYou ? " · \(filter.rawValue)" : "")").font(Theme.body(13)).foregroundStyle(Theme.muted)
            if shown.isEmpty {
                EmptyState(title: ideas.isEmpty ? "Your needs come first." : "Let’s try another angle.", text: store.profile.hasFreeTextNeed ? "Your written need is kept. Ideas are paused because ENOUGH can’t yet read free-text needs. Keep your answer, or choose from the listed needs in My Pins." : ideas.isEmpty ? "No library idea fits your current needs. Keep your boundaries, or revisit My Pins when something changes." : "Try another word, setting or collection. Your needs still apply.", action: (ideas.isEmpty ? "Review my answers" : "Clear search and filters", { ideas.isEmpty ? (navigation.sheet = .setup) : clear() }))
            } else {
                ForEach(shown.prefix(limit)) { idea in MoveCard(idea: idea, now: now, surprise: filter == .surpriseMe && idea.id == featured?.id) }
                if shown.count > limit { Button("Show more ideas") { limit += 8 }.buttonStyle(.secondary) }
            }
            if store.historyHasMore || !store.historyError.isEmpty {
                Button(store.historyLoading ? "Loading earlier ideas…" : store.historyError.isEmpty ? "Show earlier ideas" : "Try earlier ideas again") { limit += 32; Task { await store.loadHistory() } }.buttonStyle(.secondary).disabled(store.historyLoading)
                AlertText(store.historyError)
            }
            if store.aiAvailable {
                MoreSuggestionsButton(enoughReached: false) { clear() }
                AlertText(store.aiError)
            }
            Note("Money kept and time come from the idea and typical prices; tap ⓘ on any idea for the workings. Only what you confirm afterwards enters My Wins.")
        }
        .task(id: store.cloud) { if store.cloud { await store.loadHistory(reset: true) } }
    }
}

/// "More ideas": the user-requested AI batch, gated by account and consent.
struct MoreSuggestionsButton: View {
    let enoughReached: Bool
    var before: () -> Void = {}
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation

    var body: some View {
        Button(store.aiBusy ? "Painting new ideas…" : "More ideas, made for me") {
            before()
            switch store.requestFreshIdeas(enoughReached: enoughReached) {
            case .needsAccount: navigation.sheet = .account(pending: nil)
            case .needsConsent: navigation.sheet = .aiConsent
            case .started, .quiet: break
            }
        }
        .buttonStyle(.secondary)
        .disabled(store.aiBusy || (store.cloud && !store.synced))
    }
}

/// A move card in the Explore list (`MoveCard` in `moves-discovery.tsx`).
struct MoveCard: View {
    let idea: Idea
    let now: Date
    var surprise = false
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation

    var body: some View {
        let feedback = Discovery.feedback(ideaId: idea.id, state: store.state, now: now)
        let saved = store.isSaved(idea.id)
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .topLeading) {
                Button { navigation.openIdea(idea.id) } label: {
                    IdeaPicture(idea: idea).frame(height: 190).frame(maxWidth: .infinity)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Open \(idea.title)")
                HStack(alignment: .top) {
                    if surprise { Badge("Something different") } else if Discovery.isFreeMove(idea) { Badge("No cost") }
                    Spacer()
                    Button { saved ? store.unsave(idea.id) : saveTapped() } label: {
                        Image(systemName: saved ? "bookmark.fill" : "bookmark").font(.system(size: 15)).foregroundStyle(Theme.ink)
                            .frame(width: 36, height: 36).background(.ultraThinMaterial).clipShape(Circle())
                    }
                    .buttonStyle(.plain).tapTarget()
                    .accessibilityLabel(saved ? "Remove from saved: \(idea.title)" : "Save for later: \(idea.title)")
                }
                .padding(10)
            }
            VStack(alignment: .leading, spacing: 10) {
                Button { navigation.openIdea(idea.id) } label: {
                    Text(idea.title).font(Theme.display(22)).foregroundStyle(Theme.ink).multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                }
                .buttonStyle(.plain)
                Text(idea.body).font(Theme.body(14)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
                IdeaTagsView(idea: idea)
                ValueStrip(idea: idea, compact: true)
                if feedback.tries > 0 {
                    Text("\(feedback.worthwhile) of your \(feedback.tries) \(feedback.tries == 1 ? "try" : "tries") felt worthwhile.").font(Theme.body(12)).foregroundStyle(Theme.muted)
                }
                Button("See this idea") { navigation.openIdea(idea.id) }.buttonStyle(.text)
            }
            .padding(16)
        }
        .cardSurface()
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous).stroke(surprise ? Theme.accent : Color.clear, lineWidth: 1.5))
    }

    private func saveTapped() {
        switch store.gate(for: idea.id, now: now) {
        case .needsSetup: navigation.sheet = .setup
        case .needsAccount: navigation.sheet = .account(pending: .save(idea.id))
        case .done: store.save(idea.id)
        }
    }
}

struct SavedList: View {
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation
    @State private var preview: Idea?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if store.state.saved.isEmpty {
                EmptyState(title: "A place for later.", text: "Save an idea when something catches your eye.", action: ("Explore ideas", { navigation.go(.moves, moves: .explore) }))
            } else {
                ForEach(store.state.saved, id: \.self) { id in
                    let idea = store.state.idea(id)
                    VStack(alignment: .leading, spacing: 0) {
                        IdeaPicture(idea: idea).frame(height: 150).frame(maxWidth: .infinity)
                        VStack(alignment: .leading, spacing: 8) {
                            Text(idea.title).font(Theme.display(22)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
                            Text(idea.body).font(Theme.body(14)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
                            ValueStrip(idea: idea, compact: true)
                            Button("See this idea") { if store.feed().contains(where: { $0.idea.id == id }) { navigation.openIdea(id) } else { preview = idea } }.buttonStyle(.secondary)
                            Button("Remove from saved") { store.unsave(id) }.buttonStyle(.text)
                        }
                        .padding(16)
                    }
                    .cardSurface()
                }
            }
        }
        .pageGutter()
        .sheet(item: $preview) { idea in
            SheetFrame(title: idea.title, kicker: "Saved") {
                Text(idea.body).font(Theme.body(15)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
                Text(idea.safety).font(Theme.body(14)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
                Note(IdeaMovement.hasMovement(idea) ? "This saved idea doesn’t fit your current needs or the time of day, so it isn’t in today’s ideas. It stays saved." : "This earlier idea doesn’t describe a clear movement, so it stays in your history and isn’t offered any more.")
            }
        }
    }
}

struct PlannedList: View {
    let now: Date
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation
    @State private var confirming: Entry?

    var body: some View {
        let planned = store.state.plannedEntries
        VStack(alignment: .leading, spacing: 12) {
            if planned.isEmpty {
                EmptyState(title: "Nothing to catch up on.", text: "When you say “sounds good” to an idea, it waits here. You can always change your mind.", action: ("Explore ideas", { navigation.go(.moves, moves: .explore) }))
            } else {
                ForEach(planned) { entry in
                    VStack(alignment: .leading, spacing: 12) {
                        Eyebrow("Planned · not yet counted")
                        Text(store.state.idea(entry.ideaId).title).font(Theme.display(22)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
                        if entry.support?.paused == true { Note("This plan is paused. Its reminder is quiet.") }
                        VStack(alignment: .leading, spacing: 8) {
                            Button("How did it go?") { confirming = entry }.buttonStyle(.primary)
                            Button(entry.support != nil ? "My plan" : "Add support") { navigation.openSupport(entry.id) }.buttonStyle(.secondary)
                            Button("Not today") { store.notToday(entryId: entry.id) }.buttonStyle(.text)
                        }
                        ActivityMovementView(entry: entry)
                        if entry.support?.qrMeet == true { MeetingCheckinView(entryId: entry.id) }
                    }
                    .glassPanel()
                }
            }
        }
        .pageGutter()
        .sheet(item: $confirming) { entry in ConfirmOutcomeView(entry: entry) }
    }
}

/// "A closer fit for your day." (the tune sheet)
struct TuneSheet: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        let tune = store.state.tuningOrDefault
        SheetFrame(title: "A closer fit for your day.", kicker: "Tune my ideas") {
            Text("How much extra time you can spare, and what you would otherwise do. Browsing stays unlimited.").font(Theme.body(14)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
            LabeledPicker(label: "Most extra time I can spare", selection: Binding(get: { tune.extraMinutes }, set: { v in store.setTuning { $0.extraMinutes = v } }), options: [(0, "Only inside what I already do"), (5, "5 minutes"), (10, "10 minutes"), (15, "15 minutes"), (30, "30 minutes")])
            LabeledPicker(label: "For errands, I would otherwise", selection: Binding(get: { tune.travel }, set: { v in store.setTuning { $0.travel = v } }), options: TravelHabit.allCases.map { ($0, $0.label) })
            if !tune.hidden.isEmpty { Button("Bring back hidden ideas (\(tune.hidden.count))") { store.setTuning { $0.hidden = [] } }.buttonStyle(.text) }
            Note("New ideas never appear on their own.")
        }
    }
}
