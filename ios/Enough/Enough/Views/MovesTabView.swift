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
                if navigation.movesView != .explore || navigation.detailIdeaId != nil { heading }
                if !store.isComplete && (navigation.movesView != .explore || navigation.detailIdeaId != nil) {
                    HStack(alignment: .top) {
                        Text("These are examples. Complete your PINS and routines to get personalised ideas. An account is needed only when you save or accept one.").font(Theme.body(14)).foregroundStyle(Theme.ink)
                        Button("Set up My Pins") { navigation.sheet = .setup }.buttonStyle(.text)
                    }
                    .glassPanel(padding: 14).pageGutter()
                }
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

    private var heading: some View {
        VStack(alignment: .leading, spacing: 4) {
            Eyebrow("Life first. Movement fits.")
            Text("A little possibility in what you’re already doing.").font(Theme.body(15)).foregroundStyle(Theme.muted)
        }
        .pageGutter()
    }
}

struct MovesDiscoveryView: View {
    let now: Date
    @Binding var showTune: Bool
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation
    @EnvironmentObject private var health: HealthService
    @State private var filter: MoveFilter = .forYou
    @State private var options = MoveOptions.default
    @State private var filtersOpen = false
    @State private var limit = 8
    @State private var surpriseId: Int?
    @State private var collection: String?
    @State private var savedOnly = false

    private var ideas: [Idea] { store.feed(now: now).map(\.idea) }
    private var personal: Bool { store.isComplete }
    private var collections: [MoveCollection] { Discovery.collections(ideas, state: store.state, now: now) }
    private var pool: [Idea] { Discovery.movesIdeas(ideas, filter: filter, state: store.state, options: options) }
    private var selected: MoveCollection? { collection.flatMap { key in collections.first { $0.key == key } } }
    private var narrowed: [Idea] {
        if let selected { return pool.filter { i in selected.ideas.contains { $0.id == i.id } && (!savedOnly || store.isSaved(i.id)) } }
        return collection != nil ? [] : pool
    }
    private var featured: Idea? { narrowed.first { $0.id == surpriseId } ?? narrowed.first }
    private var shown: [Idea] {
        if filter == .surpriseMe, let featured { return [featured] + narrowed.filter { $0.id != featured.id } }
        let fresh = Dictionary(store.freshIds.enumerated().map { ($1, $0) }, uniquingKeysWith: { first, _ in first })
        return narrowed.filter { fresh[$0.id] != nil }.sorted { fresh[$0.id]! < fresh[$1.id]! } + narrowed.filter { fresh[$0.id] == nil }
    }

    private func clear() { filter = .forYou; options = .default; collection = nil; savedOnly = false; surpriseId = nil; limit = 8 }
    private func choose(_ value: MoveFilter) {
        filter = value; collection = nil; savedOnly = false; limit = 8
        surpriseId = value == .surpriseMe ? Discovery.surpriseIdeaId(Discovery.movesIdeas(ideas, filter: value, state: store.state, options: options), currentId: featured?.id) : nil
    }
    private func chooseCollection(_ key: String, saved: Bool = false) { filter = .forYou; options = .default; collection = key; savedOnly = saved; surpriseId = nil; limit = 8 }

    var body: some View {
        let activity = Wins.dashboardActivity(store.state, now: now)
        let free = pool.filter(Discovery.isFreeMove)
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 10) {
                Eyebrow("My Moves · Life first")
                Text("What could you do with the time you have?").font(Theme.display(24)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
                Text("Ideas for more movement inside an ordinary day. Choose what fits.").font(Theme.body(15)).foregroundStyle(Theme.muted)
                if !personal {
                    Note("These are examples. Your PINS and routines make them personal.")
                    Button("Set up My Pins") { navigation.sheet = .setup }.buttonStyle(.secondary)
                }
                HStack { Image(systemName: "magnifyingglass").foregroundStyle(Theme.muted); TextField("Search calls, family, music…", text: $options.query).onChange(of: options.query) { _, _ in limit = 8 } }.fieldBox()
                Button { choose(.free) } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "leaf").font(.system(size: 24, weight: .light)).foregroundStyle(Theme.accent)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Today’s opportunities").font(Theme.body(15, weight: .semibold)).foregroundStyle(Theme.ink)
                            Text("\(free.count) free \(free.count == 1 ? "idea" : "ideas") \(personal ? "within your current needs" : "to explore")").font(Theme.body(13)).foregroundStyle(Theme.muted)
                            Text("A little possibility, at your pace.").font(Theme.body(11)).foregroundStyle(Theme.muted)
                        }
                        Spacer(); Image(systemName: "arrow.right").foregroundStyle(Theme.accent)
                    }
                    .glassPanel(padding: 14)
                }
                .buttonStyle(.plain)
                ChipRow(items: MoveFilter.allCases, label: { $0.rawValue }, selected: { $0 == filter && collection == nil }, icon: { $0 == .nearMe ? "mappin" : $0 == .surpriseMe ? "sparkles" : nil }, pick: { choose($0) })
                Button { filtersOpen.toggle() } label: { Label("All filters", systemImage: "slider.horizontal.3") }.buttonStyle(.secondary)
            }
            .pageGutter()

            if filtersOpen { filterPanel.pageGutter() }

            results.pageGutter()

            VStack(spacing: 10) {
                contextCard(icon: "leaf", strong: "\(activity.activeDays)", text: "\(activity.activeDays == 1 ? "day" : "days") with a moment this week", small: nil) { navigation.go(.wins) } extra: { ActivityDaysView(days: activity.days) }
                contextCard(icon: "clock", strong: activity.planned > 0 ? "\(activity.planned) \(activity.planned == 1 ? "move" : "moves") waiting for you" : "Room for a future move.", text: activity.planned > 0 ? "Your plans, for when they fit." : "An idea can wait until it fits your day.", small: "Plans are intentions. Returns start after confirmation.") { navigation.go(.moves, moves: .planned) } extra: { EmptyView() }
                contextCard(icon: "heart", strong: "Your life comes first.", text: personal ? ([store.profile.preferences.first, store.profile.rhythms.first].compactMap { $0 }.joined(separator: " · ").isEmpty ? "Your current PINS guide these ideas." : [store.profile.preferences.first, store.profile.rhythms.first].compactMap { $0 }.joined(separator: " · ")) : "Your PINS help us find a closer fit.", small: personal ? "Change your PINS when life changes." : "Name and visual preferences are optional.") { navigation.sheet = .setup } extra: { EmptyView() }
            }
            .pageGutter()

            collectionsPanel.pageGutter()
            favouritesPanel.pageGutter()
            NearbyIdeas().pageGutter()
            surprisePanel.pageGutter()
        }
    }

    private func contextCard<Extra: View>(icon: String, strong: String, text: String, small: String?, action: @escaping () -> Void, @ViewBuilder extra: () -> Extra) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: icon).font(.system(size: 22, weight: .light)).foregroundStyle(Theme.accent)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(strong).font(Theme.body(16, weight: .semibold)).foregroundStyle(Theme.ink).multilineTextAlignment(.leading)
                        Text(text).font(Theme.body(13)).foregroundStyle(Theme.muted).multilineTextAlignment(.leading)
                        if let small { Text(small).font(Theme.body(11)).foregroundStyle(Theme.muted).multilineTextAlignment(.leading) }
                    }
                    Spacer(); Image(systemName: "arrow.right").foregroundStyle(Theme.accent)
                }
                extra()
            }
            .glassPanel(padding: 14)
        }
        .buttonStyle(.plain)
    }

    private var filterPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack { SectionTitle("What fits right now?", size: 22); Spacer(); Button("Clear filters") { clear() }.buttonStyle(.text) }
            LabeledPicker(label: "Activity length", selection: $options.maxMinutes, options: [(0, "Any length"), (5, "Up to 5 minutes"), (10, "Up to 10 minutes"), (15, "Up to 15 minutes"), (30, "Up to 30 minutes"), (60, "Up to 60 minutes")])
            LabeledPicker(label: "Setting", selection: $options.setting, options: Setting.allCases.map { ($0, $0.label) })
            LabeledPicker(label: "Part of your day", selection: $options.category, options: [(nil, "Any activity"), (.call, "Calls"), (.listen, "Listening"), (.family, "Family time"), (.chores, "Household tasks"), (.work, "Work or study"), (.waiting, "Waiting"), (.think, "Thinking"), (.errand, "Errands"), (.shopping, "Shopping"), (.travel, "Travel"), (.coffee, "Coffee"), (.other, "Other activities")])
            LabeledPicker(label: "Movement type", selection: $options.intensity, options: [(nil, "Any type")] + IdeaIntensity.allCases.map { (Optional($0), $0.label) })
            Toggle("Breaks up sitting", isOn: $options.breaksSitting).font(Theme.body(14)).tint(Theme.accent)
            Toggle("Gentle movement only", isOn: $options.gentle).font(Theme.body(14)).tint(Theme.accent)
            Toggle("No extra time", isOn: $options.noExtra).font(Theme.body(14)).tint(Theme.accent)
            HStack { Note("Your PINS boundaries apply to every filter."); Spacer(); Button("Tune my ideas") { showTune = true }.buttonStyle(.text) }
        }
        .glassPanel()
    }

    private var results: some View {
        VStack(alignment: .leading, spacing: 12) {
            Eyebrow(personal ? "Shaped by your PINS" : "Ideas to explore")
            SectionTitle(selected.map { $0.title + (savedOnly ? " · saved" : "") } ?? (filter == .surpriseMe ? "Something you might not think of." : "A little possibility."), size: 26)
            Text("\(shown.count) \(shown.count == 1 ? "idea" : "ideas")\(selected != nil ? " in this collection" : filter == .forYou ? "" : " · \(filter.rawValue)")").font(Theme.body(13)).foregroundStyle(Theme.muted)
            if collection != nil {
                HStack { Text(savedOnly ? "Saved ideas within your current needs." : selected?.reason ?? "Your collection has no ideas within these filters.").font(Theme.body(13)).foregroundStyle(Theme.ink); Spacer(); Button("Show every collection") { collection = nil; savedOnly = false }.buttonStyle(.text) }
            }
            if shown.isEmpty {
                EmptyState(icon: "leaf", title: ideas.isEmpty ? "Your needs come first." : "Let’s try another angle.", text: store.profile.hasFreeTextNeed ? "Your written need is saved. Suggestions are paused because ENOUGH cannot yet assess free-text needs. Keep your answer or review the listed boundaries in My Pins." : filter == .saveMoney ? "No saving is recorded for these ideas in your currency. A free move can still give you movement, useful time, and enjoyment." : ideas.isEmpty ? "No library idea currently clears your needs. Keep your boundaries, or revisit My Pins when something changes." : "Try another word, setting or collection. Your current needs will keep applying.", action: (ideas.isEmpty ? "Review My Pins" : "Clear search and filters", { ideas.isEmpty ? (navigation.sheet = .setup) : clear() }))
            } else {
                ForEach(shown.prefix(limit)) { idea in MoveCard(idea: idea, now: now, surprise: filter == .surpriseMe && idea.id == featured?.id) }
                if shown.count > limit { Button("Show more ideas") { limit += 8 }.buttonStyle(.secondary) }
            }
            if store.historyHasMore || !store.historyError.isEmpty {
                Button(store.historyLoading ? "Loading earlier ideas…" : store.historyError.isEmpty ? "Show earlier ideas" : "Retry earlier ideas") { limit += 32; Task { await store.loadHistory() } }.buttonStyle(.secondary).disabled(store.historyLoading)
                AlertText(store.historyError)
            }
            Note("Movement tags, time and savings are estimates. Gentle is a compatibility label; intensity is a template estimate, not measured effort. Only confirmed outcomes enter My Wins.")
            HStack {
                Button("Tune my ideas") { showTune = true }.buttonStyle(.text)
                if store.aiAvailable { MoreSuggestionsButton(enoughReached: false) { clear() } }
            }
            if store.aiAvailable { Note("Keep exploring. Ask for more whenever you like.") }
            AlertText(store.aiError)
        }
        .task(id: store.cloud) { if store.cloud { await store.loadHistory(reset: true) } }
    }

    private var collectionsPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) { Eyebrow("More ways into your day"); SectionTitle(personal && collections.contains { $0.personal } ? "Because you like…" : "Collections to explore", size: 22) }
                Spacer()
                Button("See all ideas") { clear() }.buttonStyle(.text)
            }
            if collections.isEmpty { Note("Collections appear when an idea fits your current needs.") }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(collections) { t in
                        Button { chooseCollection(t.key) } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                ZStack { if let image = t.image { SceneImage(name: image) } else { ChoiceArtwork(label: t.art) } }.frame(width: 150, height: 100).clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                Text(t.title).font(Theme.body(14, weight: .semibold)).foregroundStyle(Theme.ink)
                                Label("\(t.ideas.count) \(t.ideas.count == 1 ? "idea" : "ideas")", systemImage: "arrow.right").font(Theme.body(12)).foregroundStyle(Theme.accent)
                                Text(t.reason).font(Theme.body(11)).foregroundStyle(Theme.muted).lineLimit(2)
                            }
                            .frame(width: 150, alignment: .leading)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .glassPanel()
    }

    private var favouritesPanel: some View {
        let favourites = Discovery.favouriteCollections(ideas, state: store.state)
        return VStack(alignment: .leading, spacing: 10) {
            HStack { SectionTitle("Your favourites", size: 22); Spacer(); Image(systemName: "bookmark").foregroundStyle(Theme.accent) }
            Text("Ideas you saved for another day.").font(Theme.body(14)).foregroundStyle(Theme.muted)
            if favourites.isEmpty {
                Label(store.state.saved.isEmpty ? "Use the bookmark on an idea to keep it here." : "Your saved ideas are still kept. Review Saved to see how your current needs apply.", systemImage: "bookmark").font(Theme.body(13)).foregroundStyle(Theme.muted)
            } else {
                ForEach(favourites.prefix(4)) { t in
                    Button { chooseCollection(t.key, saved: true) } label: {
                        HStack(spacing: 10) {
                            ZStack { if let image = t.image { SceneImage(name: image) } else { ChoiceArtwork(label: t.art) } }.frame(width: 52, height: 52).clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            VStack(alignment: .leading, spacing: 2) { Text(t.title).font(Theme.body(14, weight: .semibold)).foregroundStyle(Theme.ink); Text("\(t.ideas.count) saved \(t.ideas.count == 1 ? "idea" : "ideas") within your needs").font(Theme.body(12)).foregroundStyle(Theme.muted) }
                            Spacer(); Image(systemName: "arrow.right").foregroundStyle(Theme.accent)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            Button("See Saved\(store.state.saved.isEmpty ? "" : " (\(store.state.saved.count))")") { navigation.go(.moves, moves: .saved) }.buttonStyle(.text)
            Note("An idea can belong to more than one collection.")
        }
        .glassPanel()
    }

    private var surprisePanel: some View {
        ZStack(alignment: .bottomLeading) {
            SceneImage(name: "welcome-coast").frame(height: 240).clipped()
            LinearGradient(colors: [.clear, Theme.deepInk.opacity(0.6)], startPoint: .top, endPoint: .bottom)
            VStack(alignment: .leading, spacing: 6) {
                Image(systemName: "sparkles").foregroundStyle(.white)
                Eyebrow("A different possibility", color: .white.opacity(0.9))
                Text("Surprise me.").font(Theme.display(28)).foregroundStyle(.white)
                Text("A free idea you might not normally think of. Your needs still come first.").font(Theme.body(13)).foregroundStyle(.white.opacity(0.9))
                Button { choose(.surpriseMe) } label: { Label("Find something different", systemImage: "arrow.right") }.buttonStyle(.primary)
            }
            .padding(16)
        }
        .frame(height: 240)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}

/// "More suggestions": the user-requested OpenAI batch, gated by account and consent.
struct MoreSuggestionsButton: View {
    let enoughReached: Bool
    var before: () -> Void = {}
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation

    var body: some View {
        Button(store.aiBusy ? "Preparing ideas and pictures…" : "More suggestions") {
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
        let saving = Recommendations.moneyValue(idea, store.state)
        let feedback = Discovery.feedback(ideaId: idea.id, state: store.state, now: now)
        let saved = store.isSaved(idea.id)
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .topLeading) {
                Button { navigation.openIdea(idea.id) } label: {
                    ZStack(alignment: .bottomTrailing) {
                        MoveArt(idea: idea).frame(height: 180).clipped()
                        if idea.source != .ai { Text("Illustrative scene").font(Theme.body(10)).padding(5).background(.ultraThinMaterial).clipShape(Capsule()).padding(8) }
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Explore \(idea.title)")
                HStack {
                    Label(surprise ? "Something different" : Discovery.isFreeMove(idea) ? "Free activity" : idea.source == .ai ? "AI idea" : "Everyday idea", systemImage: surprise ? "sparkles" : "leaf").font(Theme.body(11, weight: .semibold)).padding(.horizontal, 8).padding(.vertical, 5).background(.ultraThinMaterial).clipShape(Capsule())
                    Spacer()
                    Button { saved ? store.unsave(idea.id) : saveTapped() } label: { Image(systemName: saved ? "bookmark.fill" : "bookmark").padding(8).background(.ultraThinMaterial).clipShape(Circle()) }.foregroundStyle(Theme.ink).accessibilityLabel(saved ? "Remove saved idea: \(idea.title)" : "Save idea: \(idea.title)")
                }
                .padding(10)
            }
            VStack(alignment: .leading, spacing: 8) {
                Button { navigation.openIdea(idea.id) } label: { Text(idea.title).font(Theme.body(17, weight: .semibold)).foregroundStyle(Theme.ink).multilineTextAlignment(.leading) }.buttonStyle(.plain)
                Text(idea.body).font(Theme.body(13)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
                IdeaTagsView(idea: idea)
                HStack(spacing: 8) {
                    Metric(icon: "figure.walk", value: "\(idea.minutes) min", label: "Movement", caption: "estimate")
                    Metric(icon: "wallet.pass", value: Regions.formatMoney(saving?.cents ?? 0, currency: saving?.currency ?? store.profile.currency, country: store.profile.country), label: "Money saved", caption: "estimate")
                }
                Label(idea.extraTimeLabel, systemImage: "clock").font(Theme.body(12)).foregroundStyle(Theme.muted)
                Label(feedback.tries > 0 ? "\(feedback.worthwhile) of your \(feedback.tries) \(feedback.tries == 1 ? "try" : "tries") felt worthwhile" : idea.effort == .gentle ? "A gentle idea to explore." : "Choose a pace that suits you.", systemImage: feedback.tries > 0 ? "heart" : "leaf").font(Theme.body(12)).foregroundStyle(Theme.muted)
                Button { navigation.openIdea(idea.id) } label: { Label("See this idea", systemImage: "arrow.right") }.buttonStyle(.text)
            }
            .padding(14)
        }
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(surprise ? Theme.accent : Theme.border, lineWidth: surprise ? 2 : 1))
    }

    private func saveTapped() {
        switch store.gate(for: idea.id, now: now) {
        case .needsSetup: navigation.sheet = .setup
        case .needsAccount: navigation.sheet = .account(pending: .save(idea.id))
        case .done: store.save(idea.id)
        }
    }
}

/// `MoveArt`: a bundled scene, generated picture or illustration for an idea.
struct MoveArt: View {
    let idea: Idea
    var body: some View {
        let visual = Discovery.visual(idea)
        ZStack {
            if idea.source == .ai { IdeaPicture(idea: idea) }
            else if let image = visual.image { SceneImage(name: image) }
            else if visual.art == "Cycling" { iconArt("bicycle") }
            else if visual.art == "Video call" { iconArt("video") }
            else if visual.art == "Active play" { iconArt("figure.play") }
            else if visual.art == "Garden + Podcast" { ChoiceArtwork(label: "Household tasks"); Image(systemName: "headphones").font(.system(size: 26)).foregroundStyle(.white).padding(8).background(Theme.ink.opacity(0.6)).clipShape(Circle()) }
            else { ChoiceArtwork(label: visual.art) }
        }
    }
    private func iconArt(_ name: String) -> some View {
        ZStack { Theme.mist; Image(systemName: name).font(.system(size: 42, weight: .light)).foregroundStyle(Theme.accent) }
    }
}

struct SavedList: View {
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation
    @State private var preview: Idea?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if store.state.saved.isEmpty {
                EmptyState(icon: "bookmark", title: "A place for later.", text: "Save an idea when something catches your eye.", action: ("Explore ideas", { navigation.go(.moves, moves: .explore) }))
            } else {
                ForEach(store.state.saved, id: \.self) { id in
                    let idea = store.state.idea(id)
                    VStack(alignment: .leading, spacing: 8) {
                        Text(idea.title).font(Theme.body(17, weight: .semibold)).foregroundStyle(Theme.ink)
                        Text(idea.body).font(Theme.body(14)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
                        HStack {
                            Button("View idea") { if store.feed().contains(where: { $0.idea.id == id }) { navigation.openIdea(id) } else { preview = idea } }.buttonStyle(.secondary)
                            Button("Remove saved idea") { store.unsave(id) }.buttonStyle(.text)
                        }
                    }
                    .glassPanel()
                }
            }
        }
        .pageGutter()
        .sheet(item: $preview) { idea in
            NavigationStack {
                VStack(alignment: .leading, spacing: 12) {
                    Eyebrow("ENOUGH")
                    Text(idea.title).font(Theme.display(28)).foregroundStyle(Theme.ink)
                    Text("Your saved idea is kept in your history. Current movement and fit checks apply to suggestions.").font(Theme.body(14)).foregroundStyle(Theme.muted)
                    Text(idea.body).font(Theme.body(15)).foregroundStyle(Theme.ink)
                    Text(idea.safety).font(Theme.body(14)).foregroundStyle(Theme.ink)
                    Note(IdeaMovement.hasMovement(idea) ? "This saved idea does not currently appear in your matched feed. You can revisit your settings if your circumstances have changed." : "This earlier idea does not describe a clear movement action, so it is kept in your history and no longer offered as a movement suggestion.")
                    Button("Done") { preview = nil }.buttonStyle(.primary)
                    Spacer()
                }
                .padding(16).background(Theme.paper)
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
                EmptyState(icon: "leaf", title: "No plans to catch up on.", text: "When you accept an idea, it will wait here. You can always change your mind.", action: ("Explore ideas", { navigation.go(.moves, moves: .explore) }))
            } else {
                ForEach(planned) { entry in
                    VStack(alignment: .leading, spacing: 10) {
                        Note("Intent only · not counted as completed")
                        Text(store.state.idea(entry.ideaId).title).font(Theme.body(17, weight: .semibold)).foregroundStyle(Theme.ink)
                        if entry.support?.paused == true { Note("This plan is paused. Its reminder is quiet.") }
                        HStack {
                            Button("How did it go?") { confirming = entry }.buttonStyle(.primary)
                            Button(entry.support != nil ? "View / edit plan" : "Make it easier") { navigation.openSupport(entry.id) }.buttonStyle(.secondary)
                        }
                        Button("Not today") { store.notToday(entryId: entry.id) }.buttonStyle(.text)
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

/// "A closer fit for your day." (the tune modal)
struct TuneSheet: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let tune = store.state.tuningOrDefault
        NavigationStack {
            VStack(alignment: .leading, spacing: 14) {
                Eyebrow("ENOUGH")
                Text("A closer fit for your day.").font(Theme.display(28)).foregroundStyle(Theme.ink)
                Text("Set the extra time you can spare and what you would otherwise do. Browsing remains unlimited.").font(Theme.body(14)).foregroundStyle(Theme.muted)
                LabeledPicker(label: "Maximum extra time", selection: Binding(get: { tune.extraMinutes }, set: { v in store.setTuning { $0.extraMinutes = v } }), options: [(0, "Only combined activities"), (5, "5 minutes"), (10, "10 minutes"), (15, "15 minutes"), (30, "30 minutes")])
                LabeledPicker(label: "For errands, what would you otherwise do?", selection: Binding(get: { tune.travel }, set: { v in store.setTuning { $0.travel = v } }), options: TravelHabit.allCases.map { ($0, $0.label) })
                if !tune.hidden.isEmpty { Button("Bring back hidden ideas (\(tune.hidden.count))") { store.setTuning { $0.hidden = [] } }.buttonStyle(.text) }
                Note("Browsing is unlimited. New suggestions never pop up automatically.")
                Button("Done") { dismiss() }.buttonStyle(.primary)
                Spacer()
            }
            .padding(16).background(Theme.paper)
        }
    }
}
