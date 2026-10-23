import SwiftUI

/// Money kept and time, with a small ⓘ that opens the workings.
struct ValueStrip: View {
    let idea: Idea
    var compact = false
    @EnvironmentObject private var store: AppStore
    @State private var showWorkings = false

    var body: some View {
        let value = Economics.value(of: idea, in: store.state)
        HStack(alignment: .top, spacing: 18) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(alignment: .center, spacing: 0) {
                    Text(Economics.money(value.totalCents, store.state)).font(Theme.display(compact ? 20 : 24)).foregroundStyle(Theme.ink).lineLimit(1).minimumScaleFactor(0.7)
                    Button { showWorkings = true } label: {
                        Image(systemName: "info.circle").font(.system(size: 13)).foregroundStyle(Theme.accent)
                            .frame(width: 34, height: 34).contentShape(Rectangle())
                    }
                    .buttonStyle(.plain).accessibilityLabel("How this is worked out")
                }
                Text("Money kept").font(Theme.body(11)).foregroundStyle(Theme.muted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            VStack(alignment: .leading, spacing: 2) {
                Text("\(value.minutes) min").font(Theme.display(compact ? 20 : 24)).foregroundStyle(Theme.ink).lineLimit(1).minimumScaleFactor(0.7).frame(height: 34)
                Text(value.extraMinutes > 0 ? "moving · \(value.extraMinutes) min extra" : value.extraMinutes < 0 ? "moving · \(-value.extraMinutes) min given back" : "moving · no extra time").font(Theme.body(11)).foregroundStyle(Theme.muted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .sheet(isPresented: $showWorkings) { WorkingsSheet(idea: idea) }
    }
}

/// "How this is worked out": the health-economics behind the figure.
struct WorkingsSheet: View {
    let idea: Idea
    @EnvironmentObject private var store: AppStore

    var body: some View {
        let value = Economics.value(of: idea, in: store.state)
        let visit = Economics.casualVisit[store.profile.currency] ?? Economics.casualVisit["AUD"]!
        SheetFrame(title: Economics.money(value.totalCents, store.state), kicker: "How this is worked out") {
            Text("Money kept if you do \(idea.title.lowercased()) instead of \(idea.usual.lowercased()).").font(Theme.body(15)).foregroundStyle(Theme.muted)
            VStack(alignment: .leading, spacing: 10) {
                ForEach(value.lines) { line in
                    HStack(alignment: .top) {
                        Text(line.label).font(Theme.body(14)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
                        Spacer()
                        Text(Economics.money(line.cents, store.state)).font(Theme.body(14, weight: .medium)).foregroundStyle(Theme.ink)
                    }
                }
            }
            .padding(14).background(Theme.panel).clipShape(RoundedRectangle(cornerRadius: Theme.Radius.field, style: .continuous))
            section("Movement you don’t have to buy", "A casual gym or class visit costs about \(Economics.money(visit.cents, store.state)) for \(visit.minutes) minutes, roughly \(Economics.money(visit.cents / visit.minutes, store.state)) a minute. This idea gives you \(value.minutes) minutes of movement inside something you were doing anyway, so that is movement you keep without paying for it. ENOUGH uses one typical price for your currency rather than tracking what any gym charges.")
            section("Direct savings", value.directCents > 0 ? "\(value.directSource ?? "Cost avoided"): \(Economics.money(value.directCents, store.state))." : "This idea doesn’t replace a paid service, so the figure is movement value only. If you know what you’d normally spend, choose “Use my own costs” on the idea and ENOUGH will use your numbers instead.")
            section("Time", "\(value.minutes) minutes of movement. \(value.extraMinutes > 0 ? "It takes about \(value.extraMinutes) extra minutes beyond what was already happening." : value.extraMinutes < 0 ? "It gives back about \(-value.extraMinutes) minutes compared with the usual way." : "It takes no extra time: the movement sits inside something already in your day.")")
            section("Why movement has a value", "Regular everyday movement lowers the risk of heart disease, type 2 diabetes, some cancers, depression and falls, and these benefits come from light and moderate activity, not only from structured exercise. Health economists value this through quality-adjusted life years and avoided care costs; ENOUGH does not put a price on your health. The figure here is simply the market price of the same minutes, which you keep.")
            Note("My Wins counts only money you confirm after a move. This figure is what the idea is worth before you try it.")
            Link("Australian 24-hour movement guidelines", destination: URL(string: "https://www.health.gov.au/topics/physical-activity/24-hour-movement-guidelines-for-all-australians/recommendations-for-adults-18-to-64-years")!).font(Theme.body(14, weight: .medium))
            Link("World Health Organization: physical activity", destination: URL(string: "https://www.who.int/news-room/fact-sheets/detail/physical-activity")!).font(Theme.body(14, weight: .medium))
        }
    }

    private func section(_ title: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(Theme.body(15, weight: .medium)).foregroundStyle(Theme.ink)
            Text(text).font(Theme.body(14)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
        }
    }
}
