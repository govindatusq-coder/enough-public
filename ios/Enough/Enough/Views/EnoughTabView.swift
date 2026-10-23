import SwiftUI

/// My Enough: the dashboard (`components/discovery.tsx` and `enough-widgets.tsx`).
struct EnoughTabView: View {
    let now: Date
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation
    @EnvironmentObject private var health: HealthService
    @State private var filter: DashboardFilter = .forYou
    @State private var query = ""
    @State private var maxMinutes = 0
    @State private var setting: Setting = .any
    @State private var gentle = false
    @State private var filtersOpen = false
    @State private var featuredId: Int?
    @State private var showToday = false
    @State private var movementOpen = false
    @State private var snapshot: MovementSnapshot?

    private var enoughReached: Bool { store.enoughReached(snapshot: snapshot, now: now) }
    private var ideas: [Idea] { Movement.suggestionsAfterEnough(store.feed(now: now).map(\.idea), reached: enoughReached, settings: store.state.movementSettings) }
    private var matches: [Idea] { Discovery.dashboardIdeas(ideas, filter: filter, state: store.state, query: query, maxMinutes: maxMinutes, setting: setting, gentle: gentle) }
    private var featured: Idea? { matches.first { $0.id == featuredId } ?? matches.first }
    private var hasFreeIdeas: Bool { ideas.contains(where: Discovery.isFreeMove) }
    private var personalised: Bool { store.isComplete }

    private func choose(_ next: DashboardFilter) {
        filter = next
        featuredId = next == .surpriseMe ? Discovery.surpriseIdeaId(Discovery.dashboardIdeas(ideas, filter: next, state: store.state, query: query, maxMinutes: maxMinutes, setting: setting, gentle: gentle), currentId: featured?.id) : nil
    }
    private func clearFilters() { filter = .forYou; query = ""; maxMinutes = 0; setting = .any; gentle = false; featuredId = nil }
    private func chooseSetting(_ next: Setting) { filter = .forYou; setting = next; featuredId = nil }
    private func startSetup() { navigation.sheet = .setup }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            hero
            if filtersOpen { filterPanel }
            if filter == .nearby { NearbyIdeas() } else { opportunities }
            widgets
            if filter != .nearby { NearbyIdeas() }
            DisclosureGroup("Your movement today", isExpanded: $movementOpen) {
                MovementPanelView(snapshot: $snapshot, now: now)
            }
            .font(Theme.body(15, weight: .semibold)).foregroundStyle(Theme.ink)
            .glassPanel()
        }
        .pageGutter()
        .sheet(isPresented: $showToday) { TodayNoteSheet() }
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("\(Discovery.greeting(now))\(store.profile.name.trimmingCharacters(in: .whitespaces).isEmpty ? "" : ", \(store.profile.name.trimmingCharacters(in: .whitespaces))").").font(Theme.body(15)).foregroundStyle(Theme.muted)
            Text(featured != nil ? (personalised ? "I found something you might like." : "A little idea for the life you have.") : "Your life comes first.").font(Theme.display(34)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
            Text(featured != nil ? (personalised ? "A small idea for a better today." : "An example to explore. Your PINS make it personal.") : "We can find another way when something fits your needs.").font(Theme.body(15)).foregroundStyle(Theme.muted)
            if let featured {
                let saving = Recommendations.moneyValue(featured, store.state)
                HStack(spacing: 8) {
                    Metric(icon: "figure.walk", value: "\(featured.minutes) min", label: "Movement", caption: "estimate")
                    Metric(icon: "wallet.pass", value: Regions.formatMoney(saving?.cents ?? 0, currency: saving?.currency ?? store.profile.currency, country: store.profile.country), label: "Money saved", caption: "estimate")
                    Metric(icon: featured.social ? "person.2" : "clock", value: featured.social ? "A conversation" : featured.extraTimeLabel, label: featured.social ? "Time together" : "Fits your day")
                }
                Note("Idea estimates. Confirm what happened in My Wins.")
                if !personalised { Button("Make it personal") { startSetup() }.buttonStyle(.secondary) }
                featuredCard(featured)
            } else {
                EmptyState(icon: "leaf", title: hasFreeIdeas ? "A different filter might fit." : "Your needs come first.", text: hasFreeIdeas ? "Try another filter to find a free idea." : "No free library idea currently clears your needs.", action: (hasFreeIdeas ? "Clear filters" : "Review My Pins", { hasFreeIdeas ? clearFilters() : startSetup() }))
            }
            ChipRow(items: DashboardFilter.allCases, label: { $0.rawValue }, selected: { $0 == filter }, icon: { $0 == .nearby ? "mappin" : $0 == .surpriseMe ? "sparkles" : nil }, pick: { choose($0) })
            Button { filtersOpen.toggle(); if filter == .nearby { filter = .forYou } } label: { Label("All filters", systemImage: "slider.horizontal.3") }.buttonStyle(.secondary)
        }
    }

    private func featuredCard(_ idea: Idea) -> some View {
        Button { navigation.openIdea(idea.id) } label: {
            HStack(spacing: 12) {
                SceneImage(name: Discovery.cover(idea)).frame(width: 84, height: 84).clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                VStack(alignment: .leading, spacing: 4) {
                    Label("Free activity", systemImage: "leaf").font(Theme.body(12, weight: .semibold)).foregroundStyle(Theme.accent)
                    Text(idea.title).font(Theme.body(16, weight: .semibold)).foregroundStyle(Theme.ink).multilineTextAlignment(.leading)
                    Text("\(idea.effort == .gentle ? "A gentle way to move" : "Move at your own pace") · \(idea.minutes) min").font(Theme.body(13)).foregroundStyle(Theme.muted)
                    Label("See this idea", systemImage: "arrow.right").font(Theme.body(13, weight: .semibold)).foregroundStyle(Theme.accent)
                }
                Spacer()
            }
            .glassPanel(padding: 14)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Explore featured idea: \(idea.title)")
    }

    private var filterPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack { SectionTitle("What would fit your day?", size: 22); Spacer(); Button("Clear filters") { clearFilters() }.buttonStyle(.text) }
            TextField("Search calls, family, music…", text: $query).fieldBox()
            LabeledPicker(label: "Activity length", selection: $maxMinutes, options: [(0, "Any length"), (5, "Up to 5 minutes"), (10, "Up to 10 minutes"), (15, "Up to 15 minutes"), (30, "Up to 30 minutes")])
            LabeledPicker(label: "Setting", selection: $setting, options: Setting.allCases.map { ($0, $0.label) })
            Toggle("Gentle movement only", isOn: $gentle).font(Theme.body(14)).tint(Theme.accent)
            Note("Your PINS boundaries apply to every filter.")
        }
        .glassPanel()
    }

    private var opportunities: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) { Eyebrow("A little possibility"); SectionTitle("Today’s opportunities") }
                Spacer()
                Button("See all ideas") { navigation.go(.moves, moves: .explore) }.buttonStyle(.text)
            }
            if enoughReached {
                Text("Your chosen enough is here. \(store.state.movementSettings?.keepSittingBreaksAfterEnough == false ? "New suggestions are quiet." : "Short sitting breaks remain available.") Browse My Moves whenever it suits.").font(Theme.body(14)).foregroundStyle(Theme.ink)
            }
            Text("Free ways to move a little more, with what you already have.").font(Theme.body(15)).foregroundStyle(Theme.muted)
            Text("\(matches.count) free \(matches.count == 1 ? "idea" : "ideas")\(filter == .forYou ? "" : " · \(filter.rawValue)")").font(Theme.body(13)).foregroundStyle(Theme.muted)
            let free = (featured.map { f in [f] + matches.filter { $0.id != f.id } } ?? matches).prefix(4)
            if free.isEmpty {
                EmptyState(icon: "leaf", title: enoughReached ? "Room to pause." : hasFreeIdeas ? "Let’s try another angle." : "Your needs come first.", text: enoughReached ? "Your new suggestions are quiet for now. You can browse the library at any time." : filter == .saveMoney ? "No free idea in this view has a saving recorded in your currency yet. Free activities can still give you movement, time and enjoyment." : hasFreeIdeas ? "No free ideas match these filters. Try another setting or search." : "No free library ideas currently clear your needs. Your boundaries still come first.", action: (hasFreeIdeas ? "Clear filters" : "Review My Pins", { hasFreeIdeas ? clearFilters() : startSetup() }))
            } else {
                ForEach(Array(free)) { idea in IdeaTile(idea: idea) }
            }
        }
    }

    private var widgets: some View {
        let activity = Wins.dashboardActivity(store.state, now: now)
        return VStack(alignment: .leading, spacing: 16) {
            readiness(activity)
            todayProgress(activity)
            RecentLifeWidget(now: now, activity: activity)
            GivenBackWidget(now: now)
            weekActivity(activity)
            savedWidget
            learning(activity)
            todayContext
            Button { choose(.surpriseMe) } label: {
                ZStack(alignment: .bottomLeading) {
                    SceneImage(name: "welcome-coast").frame(height: 190).clipped()
                    LinearGradient(colors: [.clear, Theme.deepInk.opacity(0.8)], startPoint: .top, endPoint: .bottom)
                    VStack(alignment: .leading, spacing: 4) {
                        Image(systemName: "sparkles").foregroundStyle(.white)
                        Text("Find me something I’d never think of.").font(Theme.body(17, weight: .semibold)).foregroundStyle(.white).multilineTextAlignment(.leading)
                        Text("A free idea that fits your PINS.").font(Theme.body(13)).foregroundStyle(.white.opacity(0.9))
                    }
                    .padding(16)
                }
                .frame(height: 190)
                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            }
            .buttonStyle(.plain)
        }
    }

    private func readiness(_ activity: DashboardActivity) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack { SectionTitle("Your Enough", size: 22); Spacer(); Button { startSetup() } label: { Image(systemName: "arrow.right") }.accessibilityLabel("Review My Pins") }
            HStack(spacing: 16) {
                ZStack {
                    Circle().stroke(Theme.mist, lineWidth: 8)
                    Circle().trim(from: 0, to: CGFloat(activity.pinsAnswered) / 4).stroke(Theme.accent, style: StrokeStyle(lineWidth: 8, lineCap: .round)).rotationEffect(.degrees(-90))
                    VStack(spacing: 0) {
                        Text("\(activity.pinsAnswered)").font(Theme.body(22, weight: .semibold)).foregroundStyle(Theme.ink) + Text("/4").font(Theme.body(12)).foregroundStyle(Theme.muted)
                        Text("PINS").font(Theme.body(10)).foregroundStyle(Theme.muted)
                    }
                }
                .frame(width: 84, height: 84)
                .accessibilityLabel("\(activity.pinsAnswered) of 4 PINS categories answered")
                VStack(alignment: .leading, spacing: 6) {
                    Text(store.isComplete ? "A starting point that can change with you." : "A few answers help us find ideas that fit your life.").font(Theme.body(14)).foregroundStyle(Theme.ink)
                    Text("\(activity.routinesAnswered) of 3 life routine answers saved.").font(Theme.body(12)).foregroundStyle(Theme.muted)
                }
            }
            if store.isComplete {
                Text("What sounds better right now?").font(Theme.body(14, weight: .semibold)).foregroundStyle(Theme.ink)
                HStack {
                    Button { chooseSetting(.outside) } label: { Label("A little fresh air", systemImage: "leaf") }.buttonStyle(.secondary)
                    Button { chooseSetting(.indoors) } label: { Label("Something indoors", systemImage: "heart") }.buttonStyle(.secondary)
                }
                Note("Just for this view. Your PINS needs still apply.")
            } else {
                Button("Continue my setup") { startSetup() }.buttonStyle(.secondary)
            }
        }
        .glassPanel()
    }

    private func todayProgress(_ activity: DashboardActivity) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack { SectionTitle("Today’s progress", size: 22); Spacer(); Button("See all") { navigation.go(.wins) }.buttonStyle(.text) }
            HStack(spacing: 8) {
                Metric(icon: "checkmark.circle", value: "\(activity.today)", label: "Confirmed today")
                Metric(icon: "figure.walk", value: Wins.durationLabel(activity.todayMinutes), label: "Movement reported")
                Button { navigation.go(.moves, moves: .planned) } label: { Metric(icon: "clock", value: "\(activity.planned)", label: "Open plans") }.buttonStyle(.plain)
            }
            Note(activity.today > 0 ? "A little of your day, confirmed by you." : activity.planned > 0 ? "Your plans are here whenever something fits." : "Your day is open. Explore an idea when it suits you.")
        }
        .glassPanel()
    }

    private func weekActivity(_ activity: DashboardActivity) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack { SectionTitle("Your week, at your pace", size: 22); Spacer(); Button { navigation.go(.wins) } label: { Image(systemName: "arrow.right") }.accessibilityLabel("See activity history") }
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: "leaf").font(.system(size: 24, weight: .light)).foregroundStyle(Theme.accent)
                Text("\(activity.activeDays)").font(Theme.display(34)).foregroundStyle(Theme.ink)
                Text("\(activity.activeDays == 1 ? "day" : "days") with a\nconfirmed moment").font(Theme.body(13)).foregroundStyle(Theme.muted)
            }
            ActivityDaysView(days: activity.days)
            Note("Each check marks a move you confirmed. You decide what enough looks like.")
            WeeklyReviewCard(now: now)
        }
        .glassPanel()
    }

    private var savedWidget: some View {
        let saved = Array(Set(store.state.saved)).compactMap { Catalogue.byId($0, generated: store.state.generated ?? []) }
        return VStack(alignment: .leading, spacing: 8) {
            HStack { SectionTitle("Kept for another day", size: 22); Spacer(); Image(systemName: "bookmark").foregroundStyle(Theme.accent) }
            Text(saved.isEmpty ? "A place for your possibilities." : "\(saved.count) \(saved.count == 1 ? "idea" : "ideas") you liked the look of.").font(Theme.body(15, weight: .semibold)).foregroundStyle(Theme.ink)
            if !saved.isEmpty {
                HStack(spacing: -12) {
                    ForEach(saved.prefix(3)) { i in SceneImage(name: Discovery.cover(i)).frame(width: 56, height: 56).clipShape(Circle()).overlay(Circle().stroke(Color.white, lineWidth: 2)) }
                }
                .accessibilityHidden(true)
            }
            Text(saved.isEmpty ? "Save an idea in My Moves to find it here later." : "Your Saved ideas are here when the day has room. Your current needs are checked when you open them.").font(Theme.body(13)).foregroundStyle(Theme.muted)
            Button("See Saved") { navigation.go(.moves, moves: .saved) }.buttonStyle(.text)
        }
        .glassPanel()
    }

    @State private var acknowledged = ""
    private func learning(_ activity: DashboardActivity) -> some View {
        let interests = store.profile.interests.filter { $0 != "Nothing to add" }.prefix(3).map { $0.replacingOccurrences(of: Pins.customPrefix, with: "") }
        let key = store.profile.preferences.joined() + store.profile.interests.joined() + store.profile.needs.joined() + store.profile.strengths.joined()
        return VStack(alignment: .leading, spacing: 8) {
            Label("Enough is learning", systemImage: "brain").font(Theme.display(22)).foregroundStyle(Theme.ink)
            Text(interests.isEmpty ? "Your PINS help us start with what matters to you." : "You’ve told us you enjoy \(interests.joined(separator: ", ")).").font(Theme.body(14)).foregroundStyle(Theme.ink)
            if activity.confirmed > 0 {
                Text("You said \(activity.worthwhile) of \(activity.confirmed) confirmed \(activity.confirmed == 1 ? "move was" : "moves were") worthwhile.\(activity.worthwhileOutside > 0 ? " \(activity.worthwhileOutside) included time outside." : "")\(activity.worthwhileTogether > 0 ? " \(activity.worthwhileTogether) included connection." : "")").font(Theme.body(13)).foregroundStyle(Theme.muted)
            }
            Text("Does your profile still fit?").font(Theme.body(14, weight: .semibold)).foregroundStyle(Theme.ink)
            HStack {
                Button("Yes, still right") { acknowledged = key }.buttonStyle(.secondary)
                Button("Not quite") { startSetup() }.buttonStyle(.secondary)
            }
            if acknowledged == key { Label("Your current PINS will keep shaping your ideas.", systemImage: "checkmark").font(Theme.body(13)).foregroundStyle(Theme.accent) }
            Button("Update My Pins") { startSetup() }.buttonStyle(.text)
        }
        .glassPanel()
    }

    private var todayContext: some View {
        let note = store.state.today.date == localDate(now) ? store.state.today.context : ""
        let choices: [(String, String)] = [("Feeling stressed", "brain"), ("Tired after a shift", "clock"), ("Low energy", "heart"), ("Got some time", "clock"), ("With the kids", "person.2"), ("Save money", "wallet.pass"), ("Want to get out", "leaf"), ("Something else", "ellipsis")]
        return VStack(alignment: .leading, spacing: 8) {
            SectionTitle("Anything different today?", size: 22)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                ForEach(choices, id: \.0) { label, icon in
                    Button { chooseContext(label) } label: {
                        Label(label, systemImage: icon).font(Theme.body(13, weight: .semibold)).foregroundStyle(Theme.ink).frame(maxWidth: .infinity, alignment: .leading).padding(10).background(Theme.panel).clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
            Note(note.isEmpty ? "Pick what fits right now. Your PINS needs always apply." : "Today’s note: \(note)")
        }
        .glassPanel()
    }

    private func chooseContext(_ context: String) {
        switch context {
        case "Something else": showToday = true
        case "Got some time": maxMinutes = 0; filter = .forYou; filtersOpen = true
        case "Want to get out": chooseSetting(.outside)
        case "Feeling stressed", "Tired after a shift": store.setToday(context); choose(.forYou)
        case "Low energy": store.setToday("Lower energy"); choose(.lowEnergy)
        case "With the kids": choose(.withFamily)
        default: choose(.saveMoney)
        }
    }
}

/// `IdeaTile`: a discovery card for the dashboard grid.
struct IdeaTile: View {
    let idea: Idea
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation

    var body: some View {
        let saving = Recommendations.moneyValue(idea, store.state)
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
                    HStack(spacing: 14) {
                        Label("\(idea.minutes) min", systemImage: "figure.walk")
                        Label(Regions.formatMoney(saving?.cents ?? 0, currency: saving?.currency ?? store.profile.currency, country: store.profile.country), systemImage: "wallet.pass")
                    }
                    .font(Theme.body(13, weight: .semibold)).foregroundStyle(Theme.ink)
                    HStack { Label(idea.extraTimeLabel, systemImage: "clock").font(Theme.body(12)).foregroundStyle(Theme.muted); Spacer(); Text("See idea").font(Theme.body(13, weight: .semibold)).foregroundStyle(Theme.accent) }
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
                                    else { ChoiceArtwork(label: Wins.artwork(idea)); Text("Illustration").font(Theme.body(10)).padding(4).background(.ultraThinMaterial).clipShape(Capsule()).padding(6) }
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
