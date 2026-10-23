import SwiftUI

/// Home: a soft painting behind a greeting, one calm line, and four ways in.
/// Ideas for exercise (My Moves), Record exercise & savings (My Wins), My life
/// (My Pins) and My goals (the goals list in My Wins). Nothing to catch up on.
struct EnoughTabView: View {
    let now: Date
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation
    @State private var showToday = false

    private var name: String { store.profile.name.trimmingCharacters(in: .whitespaces) }
    private var todayNote: String { store.state.today.date == localDate(now) ? store.state.today.context : "" }
    private var activity: DashboardActivity { Wins.dashboardActivity(store.state, now: now) }
    private var featured: Idea? {
        let ideas = Movement.suggestionsAfterEnough(store.feed(now: now).map(\.idea), reached: store.enoughReached(now: now), settings: store.state.movementSettings)
        return Discovery.homeIdeas(ideas, state: store.state, setting: .any).first
    }

    private var calmLine: String {
        if store.enoughReached(now: now) { return "You’ve had your enough today. Nothing more is needed." }
        if activity.today > 0 { return "Something already happened today. That counts." }
        if !todayNote.isEmpty { return "Noted: \(todayNote.lowercased()). Today’s ideas are shaped around it." }
        return "Take a breath. There’s nothing you need to do this second."
    }

    /// One quiet line under the tiles, with a link: a waiting plan, today's idea, or the first step.
    private var notice: (text: String, link: String, action: () -> Void)? {
        if activity.planned > 0 {
            return ("A plan is waiting, for whenever it fits.", "Have a look when you’re ready.", { navigation.go(.moves, moves: .planned) })
        }
        if !store.isComplete {
            return ("A few answers about your life make the ideas yours.", "Start when you’re ready.", { navigation.sheet = .setup })
        }
        if let featured {
            return ("One idea for today: \(featured.title).", "Have a look when you’re ready.", { navigation.openIdea(featured.id) })
        }
        return nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header.pageGutter().padding(.top, 8)
            StatusStrip().padding(.top, 12)
            DueReminders(now: now).padding(.top, 12)
            VStack(alignment: .leading, spacing: 2) {
                Text("\(Discovery.greeting(now)),").font(Theme.display(38)).foregroundStyle(Theme.ink)
                Text("\(name.isEmpty ? "friend" : name).").font(Theme.script(54)).foregroundStyle(Theme.ink).lineLimit(1).minimumScaleFactor(0.6).padding(.leading, 6)
            }
            .pageGutter().padding(.top, 28)
            .accessibilityElement(children: .combine)
            Text(calmLine).font(Theme.italic(19)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true).pageGutter().padding(.top, 18)
            panel.pageGutter().padding(.top, 26)
            HStack { Spacer(); Button("Having a hard day?") { showToday = true }.buttonStyle(.secondary); Spacer() }.padding(.top, 30)
            Note("ENOUGH never sets you a target. Enough is whatever you decide it is.").pageGutter().padding(.top, 26)
        }
        .sheet(isPresented: $showToday) { TodayNoteSheet(now: now) }
    }

    private var header: some View {
        HStack(alignment: .center) {
            LogoView(height: 24)
            Spacer()
            Button { navigation.sheet = .account(pending: nil) } label: {
                Image(systemName: "gearshape").font(.system(size: 17, weight: .light)).foregroundStyle(Theme.ink)
                    .frame(width: 44, height: 44)
                    .background(Theme.card).overlay(Circle().stroke(Theme.border)).clipShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(store.cloud ? "Account and settings" : "Sign in and settings")
            Text(now.formatted(.dateTime.weekday(.wide))).font(Theme.display(19)).foregroundStyle(Theme.ink).padding(.leading, 10)
        }
    }

    private var panel: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text("What would help right now?").font(Theme.display(27)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
                Text(store.isComplete ? "Pick one, or just have a look." : "Pick one. Nothing here is required.").font(Theme.body(15)).foregroundStyle(Theme.muted)
            }
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                tile("Ideas for exercise", icon: "figure.walk") { navigation.go(.moves, moves: .explore) }
                tile("Record exercise & savings", icon: "checkmark.circle") { navigation.go(.wins); navigation.scrollTarget = "wins-record" }
                tile("My life", icon: "leaf") { navigation.go(.pins) }
                tile("My goals", icon: "flag") { navigation.go(.wins); navigation.scrollTarget = "wins-goals" }
            }
            if let notice {
                Button(action: notice.action) {
                    HStack(alignment: .top, spacing: 10) {
                        Circle().fill(Theme.clay).frame(width: 8, height: 8).padding(.top, 8)
                        (Text(notice.text + " ") + Text(notice.link).underline()).font(Theme.display(17, weight: .regular)).foregroundStyle(Theme.ink).multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                    }
                }
                .buttonStyle(.plain)
                .padding(.top, 4)
            }
        }
        .glassPanel(padding: 22)
    }

    private func tile(_ title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 10) {
                Image(systemName: icon).font(.system(size: 22, weight: .ultraLight)).foregroundStyle(Theme.accent).accessibilityHidden(true)
                Text(title).font(Theme.display(18, weight: .regular)).foregroundStyle(Theme.ink).multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, minHeight: 112)
            .padding(.horizontal, 10).padding(.vertical, 12)
            .background(Theme.card.opacity(0.55))
            .overlay(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous).stroke(Theme.border))
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }
}

/// "Anything different today?": a note that shapes today's ideas and expires tomorrow.
struct TodayNoteSheet: View {
    let now: Date
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var note = ""

    var body: some View {
        SheetFrame(title: "A quieter day?", kicker: "Today", doneLabel: "Cancel") {
            Text("Some days are full. Say so, and today’s ideas fit around it. The note is forgotten tomorrow.").font(Theme.body(14)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
            WrapChips(items: DailyContexts.todayContexts, label: { $0 }, selected: { note == $0 }) { choice in note = note == choice ? "" : choice }
            FieldLabel("Or in your own words", optional: true)
            TextField("Anything you’d like to keep in mind?", text: $note).fieldBox().onChange(of: note) { _, v in if v.count > 240 { note = String(v.prefix(240)) } }
            Note("A note is for today only. Needs that should always limit ideas belong in My Pins.")
            Button("Keep today’s note") { store.setToday(note.trimmingCharacters(in: .whitespaces)); dismiss() }.buttonStyle(.primary)
        }
        .onAppear { note = store.state.today.date == localDate(now) ? store.state.today.context : "" }
    }
}
