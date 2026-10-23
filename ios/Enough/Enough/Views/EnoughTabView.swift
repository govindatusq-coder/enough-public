import SwiftUI

/// My Enough: a calm home. A greeting, one gentle idea for today, a question
/// about how the day feels, and a quiet view of the week. Nothing to catch up
/// on, nothing to score.
struct EnoughTabView: View {
    let now: Date
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation
    @State private var setting: Setting = .any
    @State private var featuredId: Int?
    @State private var showToday = false

    private var enoughReached: Bool { store.enoughReached(now: now) }
    private var ideas: [Idea] { Movement.suggestionsAfterEnough(store.feed(now: now).map(\.idea), reached: enoughReached, settings: store.state.movementSettings) }
    private var matches: [Idea] { Discovery.homeIdeas(ideas, state: store.state, setting: setting) }
    private var featured: Idea? { matches.first { $0.id == featuredId } ?? matches.first }
    private var name: String { store.profile.name.trimmingCharacters(in: .whitespaces) }
    private var todayNote: String { store.state.today.date == localDate(now) ? store.state.today.context : "" }

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
                Text("\(Discovery.greeting(now))\(name.isEmpty ? "" : ", \(name)").").font(Theme.display(30)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
                Text(encouragement).font(Theme.body(16)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
            }
            if let featured { todayCard(featured) } else { quietCard }
            if store.isComplete { mood } else { Button("Start with my life") { navigation.sheet = .setup }.buttonStyle(.primary) }
            week
            Note("ENOUGH never sets you a target. Enough is whatever you decide it is.")
        }
        .pageGutter()
        .sheet(isPresented: $showToday) { TodayNoteSheet(now: now) }
    }

    private func todayCard(_ idea: Idea) -> some View {
        Button { navigation.openIdea(idea.id) } label: {
            VStack(alignment: .leading, spacing: 0) {
                IdeaPicture(idea: idea).frame(height: 200).frame(maxWidth: .infinity)
                VStack(alignment: .leading, spacing: 10) {
                    Eyebrow(store.isComplete ? "One idea for today" : "An example to explore")
                    Text(idea.title).font(Theme.display(24)).foregroundStyle(Theme.ink).multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                    Text(idea.body).font(Theme.body(14)).foregroundStyle(Theme.muted).multilineTextAlignment(.leading).lineLimit(3)
                    ValueStrip(idea: idea, compact: true)
                    Text("Only if it fits. There’s always another day.").font(Theme.body(12)).foregroundStyle(Theme.muted)
                }
                .padding(16)
            }
            .cardSurface()
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Today’s idea: \(idea.title)")
    }

    private var quietCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(enoughReached ? "Room to pause." : "Your needs come first.").font(Theme.display(24)).foregroundStyle(Theme.ink)
            Text(enoughReached ? "Ideas are quiet for today. Browse My Moves whenever you like." : "Nothing in the library fits your current needs, and that’s fine. Your boundaries stay as they are.").font(Theme.body(14)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
            if !enoughReached { Button("Review my answers") { navigation.sheet = .setup }.buttonStyle(.secondary) }
        }
        .glassPanel()
    }

    private enum Mood: String, CaseIterable, Hashable {
        case outside = "Fresh air", indoors = "Indoors", surprise = "Surprise me"
    }

    private func moodSelected(_ mood: Mood) -> Bool {
        switch mood {
        case .outside: return setting == .outside
        case .indoors: return setting == .indoors
        case .surprise: return false
        }
    }

    private func pickMood(_ mood: Mood) {
        switch mood {
        case .outside: setting = setting == .outside ? .any : .outside; featuredId = nil
        case .indoors: setting = setting == .indoors ? .any : .indoors; featuredId = nil
        case .surprise: featuredId = Discovery.surpriseIdeaId(matches, currentId: featured?.id)
        }
    }

    private var mood: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("How’s today feeling?").font(Theme.body(15, weight: .medium)).foregroundStyle(Theme.ink)
            ChipRow(items: Mood.allCases, label: { $0.rawValue }, selected: { moodSelected($0) }, pick: { pickMood($0) })
            Button(todayNote.isEmpty ? "Less time, low energy, a hard day? Tell ENOUGH" : "Today: \(todayNote) · change") { showToday = true }.buttonStyle(.text)
        }
        .glassPanel()
    }

    private var week: some View {
        let activity = Wins.dashboardActivity(store.state, now: now)
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Your week, at your pace").font(Theme.body(15, weight: .medium)).foregroundStyle(Theme.ink)
                Spacer()
                Button("My Wins") { navigation.go(.wins) }.buttonStyle(.text)
            }
            ActivityDaysView(days: activity.days)
            Text(activity.activeDays == 0 ? "An open week. There’s nothing to make up." : "\(activity.activeDays) \(activity.activeDays == 1 ? "day" : "days") with a moment you chose to keep.").font(Theme.body(13)).foregroundStyle(Theme.muted)
        }
        .glassPanel()
    }
}

/// "Anything different today?": a note that shapes today's ideas and expires tomorrow.
struct TodayNoteSheet: View {
    let now: Date
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var note = ""

    var body: some View {
        SheetFrame(title: "Anything different today?", kicker: "Today", doneLabel: "Cancel") {
            Text("Less time, lower energy or a hard day changes which ideas fit. The note is forgotten tomorrow.").font(Theme.body(14)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
            WrapChips(items: DailyContexts.todayContexts, label: { $0 }, selected: { note == $0 }) { choice in note = note == choice ? "" : choice }
            FieldLabel("Or in your own words", optional: true)
            TextField("Anything you’d like to keep in mind?", text: $note).fieldBox().onChange(of: note) { _, v in if v.count > 240 { note = String(v.prefix(240)) } }
            Note("A note is for today only. Needs that should always limit ideas belong in My Pins.")
            Button("Keep today’s note") { store.setToday(note.trimmingCharacters(in: .whitespaces)); dismiss() }.buttonStyle(.primary)
        }
        .onAppear { note = store.state.today.date == localDate(now) ? store.state.today.context : "" }
    }
}
