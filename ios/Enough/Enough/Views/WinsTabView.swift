import SwiftUI

/// My Wins: confirmed outcomes and what they gave back (`components/wins-dashboard.tsx`,
/// `wins-gallery.tsx` and the wins branch of `app/page.tsx`).
struct WinsTabView: View {
    let now: Date
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation
    @State private var reportCurrency: String?
    @State private var showWorkings = false
    @State private var correcting: Entry?
    @State private var historyOpen = false
    @State private var receiptOpen = false

    private var period: ReturnPeriod { navigation.winsPeriod }
    private var currency: String { reportCurrency ?? store.profile.currency }
    private var report: Receipt { Journey.receipt(store.state.entries, period: period, currency: currency, now: now) }

    private func addWin() { navigation.go(.moves, moves: store.state.plannedEntries.isEmpty ? .explore : .planned) }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            summary
            returnsPanel
            WinsGallery(now: now, day: $navigation.winsDay, onAddWin: addWin)
            WinsDetails(now: now, period: period, currency: currency, day: $navigation.winsDay)
            learning
            nextMove
            history
            if !report.rows.isEmpty { receipt }
            Note("\(store.cloud ? "Saved to your account." : "Stored only on this device.") Daily health readings are not stored. Optional movement checks are saved only with your activity.\nCurrencies are never combined. Current receipt currency: \(currency).")
        }
        .pageGutter()
        .sheet(isPresented: $showWorkings) { workings }
        .confirmationDialog("Correct this outcome?", isPresented: Binding(get: { correcting != nil }, set: { if !$0 { correcting = nil } }), titleVisibility: .visible) {
            Button("Return move to Planned", role: .destructive) { if let e = correcting { store.undoOutcome(entryId: e.id) }; correcting = nil }
            Button("Keep this outcome", role: .cancel) { correcting = nil }
        } message: { Text("The current result will be removed from your receipt and the move will return to Planned so you can confirm it again.") }
        .onChange(of: navigation.highlightedOutcomeId) { _, id in if id != nil { historyOpen = true } }
    }

    private var summary: some View {
        let activity = Wins.dashboardActivity(store.state, now: now)
        return VStack(alignment: .leading, spacing: 12) {
            Eyebrow("My Wins · Confirmed by you")
            Text("More life.\nIn little moments.").font(Theme.display(34)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
            Text(report.rows.isEmpty ? "A conversation, an errand, a useful pause. Confirm what happened after a move, and your returns will appear here." : "\(report.rows.count) confirmed \(report.rows.count == 1 ? "moment" : "moments") \(period == .allTime ? "so far" : period.rawValue.lowercased()). Here’s what they gave back to you.").font(Theme.body(15)).foregroundStyle(Theme.muted)
            Button { addWin() } label: { Label("Add a win", systemImage: "plus") }.buttonStyle(.primary)
            VStack(alignment: .leading, spacing: 8) {
                Eyebrow("Your week, at your pace")
                HStack(spacing: 10) {
                    Image(systemName: "leaf").font(.system(size: 22, weight: .light)).foregroundStyle(Theme.accent)
                    Text("\(activity.activeDays)").font(Theme.display(34)).foregroundStyle(Theme.ink)
                    Text("\(activity.activeDays == 1 ? "day" : "days") with a\nconfirmed moment").font(Theme.body(13)).foregroundStyle(Theme.muted)
                }
                ActivityDaysView(days: activity.days)
                Note("Each check is a moment you recorded.")
            }
            .glassPanel(padding: 14)
        }
    }

    private var returnsPanel: some View {
        let moving = report.rows.reduce(0) { $0 + ($1.minutes ?? 0) }, combined = report.rows.reduce(0) { $0 + ($1.timeCombined ?? 0) }
        let previous = Wins.previousReturns(store.state.entries, period: period, currency: currency, now: now)
        let currencies = Array(Set([currency] + Wins.returnCurrencies(store.state, now: now))).sorted()
        return VStack(alignment: .leading, spacing: 12) {
            Eyebrow("What came back")
            SectionTitle("Your real returns.")
            HStack {
                Picker("Wins period", selection: $navigation.winsPeriod) { ForEach(ReturnPeriod.allCases) { Text($0.rawValue).tag($0) } }.pickerStyle(.menu).tint(Theme.ink)
                Picker("Money totals in", selection: Binding(get: { currency }, set: { reportCurrency = $0 })) { ForEach(currencies, id: \.self) { Text($0).tag($0) } }.pickerStyle(.menu).tint(Theme.ink)
            }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                Metric(icon: "figure.walk", value: Wins.durationLabel(moving), label: "Movement reported", caption: "From your confirmed activities")
                Metric(icon: "wallet.pass", value: Regions.formatMoney(report.money, currency: currency, country: store.profile.country), label: "Money kept", caption: previous.map { "\($0.label): \(Regions.formatMoney($0.money, currency: currency, country: store.profile.country)) confirmed" } ?? "Only the saving you confirmed")
                Metric(icon: "clock", value: Wins.durationLabel(combined), label: "Time combined", caption: moving > 0 ? "\(combined) of \(moving) moving minutes combined" : "Movement alongside another task")
                Metric(icon: "heart", value: "\(report.worthwhile)", label: "Worthwhile moments", caption: report.rows.isEmpty ? "Things you said were worth it" : "\(report.worthwhile) of \(report.rows.count) confirmed moments")
            }
            Note("Money stays in \(currency); currencies are kept separate. Movement and moments include all currencies. Time combined is part of moving time.")
            Button("How this is worked out") { showWorkings = true }.buttonStyle(.text)
        }
        .glassPanel()
    }

    private var learning: some View {
        let activity = Wins.dashboardActivity(store.state, now: now)
        return VStack(alignment: .leading, spacing: 10) {
            Label("What Enough has learned", systemImage: "brain").font(Theme.display(22)).foregroundStyle(Theme.ink)
            HStack(alignment: .top, spacing: 12) {
                if activity.confirmed > 0 {
                    (Text("\(activity.worthwhile)").font(Theme.display(34)) + Text("/\(activity.confirmed)").font(Theme.body(14))).foregroundStyle(Theme.ink)
                    Text("confirmed moves\nfelt worthwhile").font(Theme.body(13)).foregroundStyle(Theme.muted)
                } else {
                    Image(systemName: "brain").font(.system(size: 30, weight: .light)).foregroundStyle(Theme.accent)
                    Text("No feedback yet").font(Theme.body(13)).foregroundStyle(Theme.muted)
                }
            }
            Text(activity.confirmed > 0 ? "Your own feedback helps refine later ideas. You can change your PINS whenever life changes." : "Your PINS guide the starting ideas. Tell us what an experience gave you, and ENOUGH can learn from your feedback.").font(Theme.body(14)).foregroundStyle(Theme.ink)
            Button("Review My Pins") { navigation.sheet = .setup }.buttonStyle(.text)
        }
        .glassPanel()
    }

    private var nextMove: some View {
        ZStack(alignment: .bottomLeading) {
            SceneImage(name: "welcome-coast").frame(height: 220).clipped()
            LinearGradient(colors: [.clear, Theme.deepInk.opacity(0.85)], startPoint: .top, endPoint: .bottom)
            VStack(alignment: .leading, spacing: 6) {
                Eyebrow("A little possibility", color: .white.opacity(0.9))
                Text("More life, when it fits.").font(Theme.display(26)).foregroundStyle(.white)
                Text("A small idea inside something you’re already doing.").font(Theme.body(13)).foregroundStyle(.white.opacity(0.9))
                Button { navigation.go(.moves, moves: .explore) } label: { Label("Find your next move", systemImage: "arrow.right") }.buttonStyle(.primary)
            }
            .padding(16)
        }
        .frame(height: 220)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    private var history: some View {
        let rows = report.rows.sorted { ($0.completedDate ?? .distantPast) > ($1.completedDate ?? .distantPast) }
        return DisclosureGroup(isExpanded: $historyOpen) {
            VStack(alignment: .leading, spacing: 12) {
                if rows.isEmpty {
                    Text("No confirmed outcomes in this period. After trying a move, tell us what happened to record it here.").font(Theme.body(14)).foregroundStyle(Theme.muted)
                    Button("Visit My Moves") { addWin() }.buttonStyle(.secondary)
                } else {
                    ForEach(rows) { e in outcomeRow(e) }
                }
            }
            .padding(.top, 8)
        } label: {
            VStack(alignment: .leading, spacing: 2) {
                Text("Activity history").font(Theme.body(16, weight: .semibold)).foregroundStyle(Theme.ink)
                Text("\(report.rows.count) confirmed \(report.rows.count == 1 ? "move" : "moves") · \(period.rawValue.lowercased())").font(Theme.body(12)).foregroundStyle(Theme.muted)
            }
        }
        .glassPanel()
    }

    private func outcomeRow(_ e: Entry) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Note("\(e.completedDate.map { $0.formatted(date: .abbreviated, time: .omitted) } ?? "") · confirmed by you")
            Text(store.state.idea(e.ideaId).title).font(Theme.body(16, weight: .semibold)).foregroundStyle(Theme.ink)
            Text("\(e.minutes ?? 0) minutes · \(Regions.formatMoney(e.moneyCents ?? 0, currency: e.currency, country: store.profile.country)) kept · \(e.worthwhile == true ? "worthwhile" : "not worthwhile this time")").font(Theme.body(14)).foregroundStyle(Theme.ink)
            MeetingCheckinView(entryId: e.id)
            MovementEvidenceText(entry: e)
            if e.movementEvidence != nil { Button("Remove saved movement reading") { store.updateEntry(e.id) { $0.movementEvidence = nil } }.buttonStyle(.text) }
            if let moment = e.planMoment { Note("At the planned moment: \(moment.label).") }
            if let broke = e.brokeSitting { Note("Broke up a long stretch of sitting: \(broke == .yes ? "Yes" : broke == .no ? "No" : "Not sure").") }
            if let added = e.additionalMovement { Note("Your reflection: \(added == .more ? "this idea added movement" : added == .same ? "about the same movement" : added == .less ? "less movement than usual" : "not sure about added movement").") }
            Button("Correct this outcome") { correcting = e }.buttonStyle(.text)
        }
        .padding(12)
        .background(navigation.highlightedOutcomeId == e.id ? Theme.mist : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .id("win-outcome-\(e.id)")
    }

    private var receipt: some View {
        DisclosureGroup("Your detailed receipt", isExpanded: $receiptOpen) {
            VStack(alignment: .leading, spacing: 12) {
                HStack { WavePath().stroke(Theme.accent, style: StrokeStyle(lineWidth: 2, lineCap: .round)).frame(width: 60, height: 24); Spacer(); Text(store.cloud ? "Your receipt" : "Your local-demo receipt").font(Theme.body(11, weight: .semibold)).padding(.horizontal, 8).padding(.vertical, 4).background(Theme.mist).clipShape(Capsule()) }
                (Text("A little more\n").font(Theme.display(26)) + Text("from your everyday.").font(Theme.display(26)).italic().foregroundStyle(Theme.accent)).foregroundStyle(Theme.ink)
                Note("\(period.rawValue) · confirmed by you")
                receiptRow("Money kept", "Only savings you confirmed", Regions.formatMoney(report.money, currency: currency, country: store.profile.country), currency)
                receiptRow("Time outside", "Time you reported outside", "\(report.outside)", "minutes")
                receiptRow("Time connecting", "Time you reported together", "\(report.connecting)", "minutes")
                receiptRow("Worthwhile moments", "Moves you said were worth it", "\(report.worthwhile)", "")
                HStack { Text("More life. In the life you have.").font(Theme.body(13)).foregroundStyle(Theme.muted); Spacer(); Button("How this is worked out") { showWorkings = true }.buttonStyle(.text) }
            }
            .padding(.top, 8)
        }
        .font(Theme.body(16, weight: .semibold)).foregroundStyle(Theme.ink)
        .glassPanel()
    }

    private func receiptRow(_ label: String, _ caption: String, _ value: String, _ unit: String) -> some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 2) { Text(label).font(Theme.body(14, weight: .semibold)).foregroundStyle(Theme.ink); Text(caption).font(Theme.body(12)).foregroundStyle(Theme.muted) }
            Spacer()
            VStack(alignment: .trailing, spacing: 0) { Text(value).font(Theme.body(18, weight: .semibold)).foregroundStyle(Theme.ink); if !unit.isEmpty { Text(unit).font(Theme.body(11)).foregroundStyle(Theme.muted) } }
        }
        .padding(.vertical, 6)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.border).frame(height: 1) }
    }

    private var workings: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                Eyebrow("ENOUGH")
                Text("Your receipt, with the workings").font(Theme.display(28)).foregroundStyle(Theme.ink)
                Text("Totals come only from your confirmed outcomes. Outside time and connecting time can overlap and are shown separately. Money is added only when you explicitly confirm a saving, in the same currency. This week starts on Monday in your device’s timezone.").font(Theme.body(15)).foregroundStyle(Theme.muted)
                Button("Got it") { showWorkings = false }.buttonStyle(.primary)
                Spacer()
            }
            .padding(16).background(Theme.paper)
        }
        .presentationDetents([.medium])
    }
}

/// "Your month in moments", milestones, "Made room for more" and top moments.
struct WinsDetails: View {
    let now: Date
    let period: ReturnPeriod
    let currency: String
    @Binding var day: String?
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation
    @State private var selectedMonth: String?

    var body: some View {
        let months = Wins.collectionMonths(store.state.entries, now: now)
        let month = selectedMonth.flatMap { months.contains($0) ? $0 : nil } ?? months[0]
        let collection = Wins.monthCollection(store.state.entries, month: month, now: now)
        let report = Journey.receipt(store.state.entries, period: period, currency: currency, now: now)
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 10) {
                HStack { SectionTitle("Your month in moments", size: 22); Spacer(); Picker("Collection month", selection: Binding(get: { month }, set: { selectedMonth = $0 })) { ForEach(months, id: \.self) { Text(monthLabel($0)).tag($0) } }.pickerStyle(.menu).tint(Theme.ink) }
                Text("\(collection.total > 0 ? "\(collection.total) confirmed \(collection.total == 1 ? "moment" : "moments") across \(collection.activeDays) \(collection.activeDays == 1 ? "day" : "days")." : "A place for the moments you choose to record.") Tap a marked day to see its moments.").font(Theme.body(13)).foregroundStyle(Theme.muted)
                calendar(collection)
                if day != nil { Button("Show moments from every day") { day = nil }.buttonStyle(.text) }
            }
            .glassPanel()
            milestones
            everyday(report)
            topMoments(report)
        }
    }

    private func monthLabel(_ key: String) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM"
        guard let date = f.date(from: key) else { return key }
        let out = DateFormatter(); out.dateFormat = "MMM yyyy"
        return out.string(from: date)
    }

    private func calendar(_ collection: MonthCollection) -> some View {
        let columns = Array(repeating: GridItem(.flexible(), spacing: 4), count: 7)
        return LazyVGrid(columns: columns, spacing: 4) {
            ForEach(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], id: \.self) { Text($0).font(Theme.body(10)).foregroundStyle(Theme.muted) }
            ForEach(0..<collection.offset, id: \.self) { _ in Color.clear.frame(height: 34) }
            ForEach(collection.days) { d in
                Button { day = day == d.date ? nil : d.date } label: {
                    VStack(spacing: 1) {
                        Text("\(d.number)").font(Theme.body(12, weight: d.today ? .bold : .regular))
                        if d.count > 0 { Image(systemName: "checkmark").font(.system(size: 8, weight: .bold)) }
                    }
                    .frame(maxWidth: .infinity, minHeight: 34)
                    .background(day == d.date ? Theme.ink : d.count > 0 ? Theme.mist : Color.clear)
                    .foregroundStyle(day == d.date ? .white : d.count > 0 ? Theme.accent : Theme.ink)
                    .opacity(d.future ? 0.35 : 1)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(d.today ? Theme.ink : Color.clear))
                }
                .buttonStyle(.plain)
                .disabled(d.count == 0)
                .accessibilityLabel("\(d.number) \(collection.label): \(d.count) confirmed \(d.count == 1 ? "moment" : "moments")\(d.today ? ", today" : "")")
            }
        }
    }

    private var milestones: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack { SectionTitle("Your milestones", size: 22); Spacer(); Image(systemName: "medal").foregroundStyle(Theme.accent) }
            Text("Small things you’ve actually recorded. Kept across all your confirmed moves.").font(Theme.body(13)).foregroundStyle(Theme.muted)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                ForEach(Wins.milestones(store.state.entries, now: now)) { m in
                    VStack(alignment: .leading, spacing: 4) {
                        ZStack(alignment: .bottomTrailing) {
                            Circle().fill(m.earnedAt != nil ? Theme.accent : Theme.mist).frame(width: 44, height: 44)
                                .overlay(Image(systemName: m.key == "first" ? "figure.walk" : m.key == "combined" ? "clock" : m.key == "connection" ? "person.2" : "wallet.pass").foregroundStyle(m.earnedAt != nil ? .white : Theme.muted))
                            if m.earnedAt != nil { Image(systemName: "checkmark.circle.fill").foregroundStyle(Theme.ink).background(Circle().fill(.white)) }
                        }
                        Text(m.title).font(Theme.body(14, weight: .semibold)).foregroundStyle(Theme.ink)
                        Text(m.description).font(Theme.body(12)).foregroundStyle(Theme.muted)
                        Text(m.earnedAt.flatMap(ISO.date).map { $0.formatted(date: .abbreviated, time: .omitted) } ?? "Not recorded yet").font(Theme.body(11)).foregroundStyle(Theme.muted)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading).padding(10).background(Theme.panel).clipShape(RoundedRectangle(cornerRadius: 14))
                    .opacity(m.earnedAt != nil ? 1 : 0.7)
                }
            }
        }
        .glassPanel()
    }

    private func everyday(_ report: Receipt) -> some View {
        let history = Wins.recentMonths(store.state.entries, now: now)
        let peak = max(1, history.map(\.count).max() ?? 1)
        return VStack(alignment: .leading, spacing: 10) {
            HStack { SectionTitle("Made room for more.", size: 22); Spacer(); Image(systemName: "sparkles").foregroundStyle(Theme.accent) }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                Metric(icon: "leaf", value: Wins.durationLabel(report.outside), label: "Time outside")
                Metric(icon: "person.2", value: Wins.durationLabel(report.connecting), label: "Time connecting")
                Metric(icon: "figure.walk", value: "\(report.rows.filter { $0.brokeSitting == .yes }.count)", label: "Sitting breaks reported")
                Metric(icon: "checkmark", value: "\(report.rows.filter { ($0.gave ?? []).contains(.taskCompleted) }.count)", label: "Tasks completed")
            }
            Note("\(period.rawValue) · Outside and connecting time can overlap.")
            HStack(alignment: .bottom, spacing: 10) {
                ForEach(history) { m in
                    VStack(spacing: 4) {
                        Text("\(m.count)").font(Theme.body(12, weight: .semibold)).foregroundStyle(Theme.ink)
                        RoundedRectangle(cornerRadius: 4).fill(m.current ? Theme.accent : Theme.sky).frame(height: max(4, CGFloat(m.count) / CGFloat(peak) * 70))
                        Text(m.label).font(Theme.body(11)).foregroundStyle(Theme.muted)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .frame(height: 110, alignment: .bottom)
            .accessibilityLabel("Confirmed moments in the last five calendar months")
            Note("Confirmed moments by month. The current month includes today so far.")
        }
        .glassPanel()
    }

    private func topMoments(_ report: Receipt) -> some View {
        let top = Wins.topWorthwhile(report.rows, now: now)
        return VStack(alignment: .leading, spacing: 10) {
            HStack { SectionTitle("Your top moments", size: 22); Spacer(); Image(systemName: "heart").foregroundStyle(Theme.accent) }
            Text("\(period.rawValue) · Sorted by how often you said an idea was worthwhile.").font(Theme.body(13)).foregroundStyle(Theme.muted)
            if top.isEmpty {
                Label("Your worthwhile moments will find a home here after you confirm them.", systemImage: "heart").font(Theme.body(13)).foregroundStyle(Theme.muted)
            } else {
                ForEach(Array(top.enumerated()), id: \.element.id) { index, m in
                    Button { navigation.openOutcome(m.entryId) } label: {
                        HStack(alignment: .top, spacing: 10) {
                            Text("\(index + 1)").font(Theme.body(14, weight: .bold)).foregroundStyle(.white).frame(width: 26, height: 26).background(Theme.ink).clipShape(Circle())
                            VStack(alignment: .leading, spacing: 2) {
                                Text(store.state.idea(m.ideaId).title).font(Theme.body(14, weight: .semibold)).foregroundStyle(Theme.ink).multilineTextAlignment(.leading)
                                Text("\(m.worthwhile) worthwhile \(m.worthwhile == 1 ? "try" : "tries") · \(Wins.durationLabel(m.minutes)) reported").font(Theme.body(12)).foregroundStyle(Theme.muted)
                                Text(m.money.map { Regions.formatMoney($0.value, currency: $0.key, country: store.profile.country) }.joined(separator: " · ") + " kept").font(Theme.body(12)).foregroundStyle(Theme.muted)
                            }
                            Spacer(); Image(systemName: "arrow.right").foregroundStyle(Theme.accent)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .glassPanel()
    }
}
