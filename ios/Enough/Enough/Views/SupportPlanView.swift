import SwiftUI

/// "Make it work for you": the six-page support plan (`components/move-support.tsx`).
struct SupportPlanView: View {
    let entry: Entry
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation
    @State private var page = 0
    @State private var plan = SupportPlan()
    @State private var error = ""
    @State private var message = ""
    @State private var remindDate = Date().addingTimeInterval(3600)
    @State private var deadlineDate = Date().addingTimeInterval(86400)
    @State private var calendarText: String?

    private let pages = ["Goal", "When & where", "Barriers", "Get ready", "Support", "Your plan"]
    private let headings = ["A direction, or a clear target?", "Find a place in your day.", "What might get in the way?", "Make the first step easier.", "A little support, on your terms.", "Your plan. Room to change."]
    private var title: String { store.state.idea(entry.ideaId).title }
    private var routines: [String] { store.profile.rhythms + (store.profile.sittingContexts ?? []) }

    private var prep: [String] {
        entry.ideaId == 0 ? ["Check the pick-up time", "Check the route and weather", "Put comfortable shoes by the door", "Take a bag and check carrying comfort", "Check the actual delivery fee avoided"]
        : entry.ideaId == 1 ? ["Agree a good time to call", "Charge the phone", "Choose a familiar, accessible route", "Check weather and background noise", "Have an indoor or seated alternative"]
        : ["Check when this fits", "Choose a comfortable, accessible version", "Check anything you need before starting", "Keep room to shorten or change the plan"]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack { Eyebrow("Make it work for you"); Spacer(); Button("Close without saving") { close() }.buttonStyle(.text) }
            Text(title).font(Theme.body(15, weight: .semibold)).foregroundStyle(Theme.ink)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(pages.indices, id: \.self) { i in
                        Button { page = i; error = "" } label: { Text("\(i + 1) \(pages[i])").font(Theme.body(12, weight: page == i ? .semibold : .regular)).padding(.horizontal, 10).padding(.vertical, 6).background(page == i ? Theme.ink : Theme.mist).foregroundStyle(page == i ? .white : Theme.ink).clipShape(Capsule()) }
                    }
                }
            }
            Text(headings[page]).font(Theme.display(28)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
            pageContent
            if !message.isEmpty { Text(message).font(Theme.body(13)).foregroundStyle(Theme.accent) }
            AlertText(error)
            HStack {
                if page > 0 { Button("Back") { page -= 1 }.buttonStyle(.secondary) }
                Spacer()
                if page < 5 { Button("Continue") { page += 1 }.buttonStyle(.primary) }
                else { Button("Save my support plan") { if save() { close() } }.buttonStyle(.primary) }
            }
            Button("I’m ready without extra support") { close() }.buttonStyle(.text)
        }
        .pageGutter()
        .onAppear {
            plan = entry.support ?? SupportPlan.new(ideaId: entry.ideaId, title: title)
            if let d = plan.remindDate { remindDate = d }
            if let d = plan.deadlineDate { deadlineDate = d }
        }
    }

    private func close() { navigation.supportEntryId = nil }

    private func save() -> Bool {
        if plan.reminder != .none { plan.remindAt = SupportPlan.localString(remindDate) }
        if plan.goalType == .smart { plan.deadline = SupportPlan.localString(deadlineDate) }
        let problem = plan.validationError()
        if !problem.isEmpty { error = problem; return false }
        var saved = plan
        saved.paused = false; saved.reminderDismissed = false; saved.updatedAt = ISO.string()
        store.setSupport(saved, for: entry.id)
        return true
    }

    @ViewBuilder private var pageContent: some View {
        switch page {
        case 0: goalPage
        case 1: whenPage
        case 2: barriersPage
        case 3: readyPage
        case 4: supportPage
        default: summaryPage
        }
    }

    private var goalPage: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Both goal styles are valid. Choose what helps you try this idea without turning it into another obligation.").font(Theme.body(14)).foregroundStyle(Theme.muted)
            HStack(spacing: 10) {
                goalOption(.open, icon: "safari", title: "Open goal", text: "Explore what feels possible. No fixed performance target.")
                goalOption(.smart, icon: "target", title: "SMART goal", text: "A specific action, a measure, a realistic size, a reason and a deadline.")
            }
            FieldLabel(plan.goalType == .open ? "What would you like to explore?" : "What specifically will you do?")
            TextField("", text: $plan.goal, axis: .vertical).lineLimit(2...5).fieldBox()
            if plan.goalType == .smart {
                FieldLabel("How will you know you did it?"); TextField("e.g. One call outside for five comfortable minutes", text: $plan.target).fieldBox()
                FieldLabel("Why does this matter to you?"); TextField("e.g. A bit of fresh air while catching up", text: $plan.reason).fieldBox()
                LabeledPicker(label: "What size feels achievable?", selection: $plan.confidence, options: [("", "Choose one"), ("This feels manageable", "This feels manageable"), ("I’ll start with a smaller version", "I’ll start with a smaller version"), ("I’ll try it with support", "I’ll try it with support")])
                DatePicker("By when?", selection: $deadlineDate).font(Theme.body(14, weight: .semibold)).tint(Theme.accent)
                    .onChange(of: deadlineDate) { _, d in plan.deadline = SupportPlan.localString(d) }
            }
        }
    }

    private func goalOption(_ type: GoalType, icon: String, title: String, text: String) -> some View {
        Button { plan.goalType = type; error = "" } label: {
            VStack(alignment: .leading, spacing: 4) {
                Image(systemName: icon).foregroundStyle(Theme.accent)
                Text(title).font(Theme.body(14, weight: .semibold)).foregroundStyle(Theme.ink)
                Text(text).font(Theme.body(12)).foregroundStyle(Theme.muted).multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading).padding(12)
            .background(Color.white).overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(plan.goalType == type ? Theme.accent : Theme.border, lineWidth: plan.goalType == type ? 2 : 1)).clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private var whenPage: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Choose a moment you already have. Location suggestions are based on the setting you choose; ENOUGH is not tracking where you are.").font(Theme.body(14)).foregroundStyle(Theme.muted)
            FieldLabel("When might it fit?"); TextField("e.g. Tuesday after work, before dinner", text: $plan.when).fieldBox()
            WrapChips(items: ["Morning", "Lunch break", "After work", "Evening", "When it fits"], label: { $0 }, selected: { plan.when == $0 }) { plan.when = $0 }
            tip("calendar", plan.when == "Morning" ? "Prepare what you need the night before. Leave enough time for what follows." : plan.when == "Lunch break" ? "Choose a short version that fits comfortably before your next commitment." : plan.when == "Evening" ? "Check light, weather and your energy. A shorter or indoor version is an option." : "Look for a transition already in your day. Leave a little buffer so the move does not make the next thing harder.")
            LabeledPicker(label: "Link to a routine answer · optional", selection: Binding(get: { plan.routineAnchor ?? "" }, set: { plan.routineAnchor = $0.isEmpty ? nil : $0 }), options: [("", "Choose a routine, or skip")] + Array(Set((plan.routineAnchor.map { [$0] } ?? []) + routines)).sorted().map { ($0, $0) })
            FieldLabel("Attach it to an existing moment"); TextField("e.g. After I finish my last meeting", text: $plan.cue).fieldBox()
            FieldLabel("What kind of place?")
            WrapChips(items: ["Familiar streets", "Near work", "Park or green space", "Indoors"], label: { $0 }, selected: { plan.placeType == $0 }) { plan.placeType = $0 }
            FieldLabel("Place or area", optional: true); TextField("e.g. A local park or the takeaway shop", text: $plan.place).fieldBox()
            tip("mappin", plan.placeType == "Indoors" ? "An indoor or seated version can keep the conversation or useful task, with less travel." : plan.placeType == "Near work" ? "Use a familiar route near work and a natural transition, such as finishing your day." : plan.placeType == "Park or green space" ? "Choose a known, accessible path and check opening hours and conditions before leaving." : "Start with a route you already know. Check crossings, access and how you will get back.")
            if let url = mapURL { Link("Look up this place in Maps", destination: url).font(Theme.body(14, weight: .semibold)) }
            Note("Maps opens externally and receives your search. No route, distance or opening hours have been verified here.")
        }
    }

    private var barriersPage: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Pick anything that might make this harder. You can change the plan instead of pushing through it.").font(Theme.body(14)).foregroundStyle(Theme.muted)
            WrapChips(items: SupportPlan.barrierTips.map { $0.0 }, label: { $0 }, selected: { plan.barriers.contains($0) }) { v in if plan.barriers.contains(v) { plan.barriers.removeAll { $0 == v } } else { plan.barriers.append(v) } }
            ForEach(plan.barriers, id: \.self) { b in
                VStack(alignment: .leading, spacing: 2) { Text(b).font(Theme.body(14, weight: .semibold)).foregroundStyle(Theme.ink); Text(SupportPlan.tip(for: b)).font(Theme.body(13)).foregroundStyle(Theme.muted) }
            }
            FieldLabel("If that happens, what will you do instead?")
            TextField("If I run out of time, I’ll do a two-minute version or choose another day.", text: $plan.fallback, axis: .vertical).lineLimit(2...4).fieldBox()
            Button("Use a flexible fallback") { plan.fallback = "I’ll choose a smaller, comfortable version, or leave it for another day." }.buttonStyle(.text)
        }
    }

    private var readyPage: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("A few small preparations can make starting simpler. Tick what you’ve sorted; everything here is optional.").font(Theme.body(14)).foregroundStyle(Theme.muted)
            ForEach(prep, id: \.self) { item in
                Toggle(item, isOn: Binding(get: { plan.prep.contains(item) }, set: { on in if on { plan.prep.append(item) } else { plan.prep.removeAll { $0 == item } } })).font(Theme.body(14)).tint(Theme.accent)
            }
            tip("checkmark.shield", entry.ideaId == 0 ? "Check the food is ready before leaving. Choose a carrying load and route that are comfortable for you. Savings only count after you confirm the actual amount." : entry.ideaId == 1 ? "Keep the call easy to hear and the route easy to navigate. Pause the conversation when you need attention for crossings or surroundings." : "Check that the setting, equipment and movement suit you. A smaller or seated alternative is valid.")
            FieldLabel("Something enjoyable to pair with it", optional: true); TextField("e.g. A favourite podcast or a quiet moment afterwards", text: $plan.reward).fieldBox()
        }
    }

    private var supportPage: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Choose only the support you want. No penalties, deposits or automatic messages.").font(Theme.body(14)).foregroundStyle(Theme.muted)
            FieldLabel("Reminder")
            ForEach([(ReminderKind.none, "No reminder", "I’ll come back when it suits."), (.inApp, "A reminder from ENOUGH", "A gentle note at the chosen time, as a notification if you allow them and in the app."), (.calendar, "Add to my calendar", "Save an event with an alert to your own calendar.")], id: \.0) { kind, label, detail in
                Button { plan.reminder = kind } label: {
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: "bell").foregroundStyle(Theme.accent)
                        VStack(alignment: .leading, spacing: 2) { Text(label).font(Theme.body(14, weight: .semibold)).foregroundStyle(Theme.ink); Text(detail).font(Theme.body(12)).foregroundStyle(Theme.muted).multilineTextAlignment(.leading) }
                        Spacer()
                    }
                    .padding(12).background(Color.white).overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(plan.reminder == kind ? Theme.accent : Theme.border, lineWidth: plan.reminder == kind ? 2 : 1)).clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(.plain)
            }
            if plan.reminder != .none {
                DatePicker("Reminder date and time", selection: $remindDate, in: Date()...).font(Theme.body(14, weight: .semibold)).tint(Theme.accent)
                    .onChange(of: remindDate) { _, d in plan.remindAt = SupportPlan.localString(d) }
                Note("Uses your device’s timezone: \(TimeZone.current.identifier).")
            }
            FieldLabel("A commitment that helps")
            WrapChips(items: ["Keep it private", "Write an if–then plan", "Tell someone", "Arrange company"], label: { $0 }, selected: { plan.commitment == $0 }) { plan.commitment = $0 }
            if ["Tell someone", "Arrange company"].contains(plan.commitment) {
                FieldLabel("Who would you like to involve?", optional: true); TextField("A first name is enough", text: $plan.buddy).fieldBox()
                VStack(alignment: .leading, spacing: 6) {
                    Text(commitmentText).font(Theme.body(13)).foregroundStyle(Theme.ink)
                    Button("Copy my commitment") { UIPasteboard.general.string = commitmentText; message = "Copied. You choose whether and where to send it." }.buttonStyle(.text)
                }
                .padding(12).background(Theme.mist).clipShape(RoundedRectangle(cornerRadius: 12))
            }
            if plan.commitment == "Write an if–then plan" {
                tip("flag", "After \(plan.cue.isEmpty ? "an existing moment you choose" : plan.cue), I’ll \(plan.goal.lowercased()) If plans change, \(plan.fallback.isEmpty ? "I can choose a smaller version or another day." : plan.fallback)")
            }
            Toggle("Plan a QR check-in when we meet", isOn: Binding(get: { plan.qrMeet ?? false }, set: { plan.qrMeet = $0 })).font(Theme.body(14)).tint(Theme.accent)
            Note("Agree to meet someone, then scan each other’s name QR when you arrive. Their name will stay with this move in My Wins. It’s a small commitment, with room to change plans.")
            Note("Location-triggered nudges are not enabled. Notifications need your permission in Settings.")
        }
    }

    private var mapURL: URL? {
        let place = plan.place.trimmingCharacters(in: .whitespaces)
        guard !place.isEmpty, var components = URLComponents(string: "https://www.google.com/maps/search/") else { return nil }
        components.queryItems = [URLQueryItem(name: "api", value: "1"), URLQueryItem(name: "query", value: place)]
        return components.url
    }

    private var commitmentText: String {
        "I’m planning to \(plan.goal) \(plan.when.isEmpty ? "" : "When: \(plan.when). ")\(plan.cue.isEmpty ? "" : "After \(plan.cue). ")\(plan.qrMeet == true ? "We can check in with a name QR when we meet. " : "")If plans change, \(plan.fallback.isEmpty ? "I’ll choose a smaller version or another day" : plan.fallback)."
    }

    private var summaryPage: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("You can start with less, move the time or change your mind. Accepting this plan still records intent, not completion.").font(Theme.body(14)).foregroundStyle(Theme.muted)
            row(plan.goalType == .open ? "Open goal" : "SMART goal", plan.goal)
            if plan.goalType == .smart {
                row("Measure & achievable size", "\(plan.target.isEmpty ? "Not set" : plan.target) · \(plan.confidence.isEmpty ? "Not set" : plan.confidence)")
                row("Reason & deadline", "\(plan.reason.isEmpty ? "Not set" : plan.reason) · \(plan.deadlineDate.map { $0.formatted(date: .abbreviated, time: .shortened) } ?? "Not set")")
            }
            row("When & where", "\(plan.when.isEmpty ? "When it fits" : plan.when) · \(plan.place.isEmpty ? plan.placeType : plan.place)\(plan.cue.isEmpty ? "" : " · After \(plan.cue)")")
            if let anchor = plan.routineAnchor { row("Routine link", anchor) }
            row("If plans change", plan.fallback.isEmpty ? "Choose a smaller version or another day." : plan.fallback)
            row("Support", "\(plan.commitment)\(plan.buddy.isEmpty ? "" : " · \(plan.buddy)")\(plan.qrMeet == true ? " · QR check-in when we meet" : "") · \(plan.reminder == .none ? "No reminder" : "\(plan.reminder == .calendar ? "Calendar event" : "ENOUGH reminder"): \(remindDate.formatted(date: .abbreviated, time: .shortened))")")
            row("Ready so far", plan.prep.isEmpty ? "No preparation checked yet. That’s okay." : plan.prep.joined(separator: " · "))
            if plan.reminder == .calendar {
                Button("Save plan & share calendar event") {
                    guard save() else { return }
                    do { calendarText = try plan.calendarEvent(title: title, id: entry.id) } catch { self.error = error.localizedDescription }
                }
                .buttonStyle(.secondary)
                if let calendarText {
                    ShareLink(item: CalendarFile(text: calendarText), preview: SharePreview("ENOUGH move")) { Label("Add the event to your calendar", systemImage: "calendar.badge.plus") }.buttonStyle(.secondary)
                    Note("Open the shared file in Calendar and check that its alert is enabled.")
                }
            }
            Note(store.cloud ? "Saved to your ENOUGH account." : "Saved only on this device.")
        }
    }

    private func row(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) { Text(label).font(Theme.body(12, weight: .semibold)).foregroundStyle(Theme.muted); Text(value).font(Theme.body(14)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true) }
    }

    private func tip(_ icon: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 10) { Image(systemName: icon).foregroundStyle(Theme.accent); Text(text).font(Theme.body(13)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true) }
            .padding(12).background(Theme.mist).clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
