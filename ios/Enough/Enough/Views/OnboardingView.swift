import SwiftUI

/// First launch: the ENOUGH mark, then four cards that tell the story
/// (no time → the cost-and-shame cycle → movement already in your day →
/// good for you, in your own way), then into the app.
struct OnboardingView: View {
    /// Called with `true` to start setup, `false` to explore first.
    let finish: (Bool) -> Void
    @State private var page = 0

    private struct Card { let image: String?, kicker: String, title: String, text: String }
    private let cards = [
        Card(image: nil, kicker: "", title: "", text: ""),
        Card(image: "welcome-podcast", kicker: "We know the feeling", title: "There’s never enough time.", text: "Work, family, the commute, the washing. Exercise ends up as one more thing you should be doing, and never quite do."),
        Card(image: "welcome-dinner", kicker: "The cycle", title: "Paying to feel bad about it.", text: "The gym membership, the equipment, the class you signed up for. When life gets in the way, the cost turns into guilt, and the guilt makes it harder to start again. You don’t need any of it."),
        Card(image: "welcome-catchup-walk", kicker: "A different way through", title: "Movement is already in your day.", text: "ENOUGH finds it: the call you were going to make, the dinner you were going to collect, the stairs you walk past. Small, real, and already yours."),
        Card(image: "welcome-coast", kicker: "Good for you, in your own way", title: "Better health. Money kept. Something you enjoy.", text: "Pair movement with the things you love, keep the delivery fee or the bus fare, and feel a little better for it. No streaks, no targets, no one keeping score.")
    ]

    var body: some View {
        VStack(spacing: 0) {
            TabView(selection: $page) {
                ForEach(cards.indices, id: \.self) { index in
                    Group { if index == 0 { brandCard } else { card(cards[index]) } }.tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            HStack(spacing: 6) {
                ForEach(cards.indices, id: \.self) { index in
                    Capsule().fill(index == page ? Theme.ink : Theme.border).frame(width: index == page ? 18 : 6, height: 6)
                }
            }
            .padding(.bottom, 16)
            .accessibilityLabel("Page \(page + 1) of \(cards.count)")

            VStack(spacing: 4) {
                if page < cards.count - 1 {
                    Button("Continue") { withAnimation { page += 1 } }.buttonStyle(.primary).frame(maxWidth: .infinity)
                    Button("Have a look first") { finish(false) }.buttonStyle(.text)
                } else {
                    Button("Start with my life") { finish(true) }.buttonStyle(.primary).frame(maxWidth: .infinity)
                    Button("Have a look first") { finish(false) }.buttonStyle(.text)
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 20)
        }
        .background(Theme.paper)
    }

    private var brandCard: some View {
        ZStack {
            SceneImage(name: "welcome-hero").frame(maxWidth: .infinity, maxHeight: .infinity)
            LinearGradient(colors: [Theme.paper.opacity(0.1), Theme.paper.opacity(0.92), Theme.paper], startPoint: .top, endPoint: .bottom)
            VStack(spacing: 14) {
                Spacer()
                LogoView(height: 56)
                Text("Exercise for your vibe.").font(Theme.display(34)).foregroundStyle(Theme.ink).multilineTextAlignment(.center)
                Text("Less sacrifice. More life.").font(Theme.body(17)).foregroundStyle(Theme.muted)
                Spacer().frame(height: 24)
            }
            .padding(.horizontal, 32)
        }
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    private func card(_ card: Card) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            if let image = card.image {
                SceneImage(name: image)
                    .frame(height: 300)
                    .frame(maxWidth: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
            }
            VStack(alignment: .leading, spacing: 10) {
                Eyebrow(card.kicker, color: Theme.accent)
                Text(card.title).font(Theme.display(30)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
                Text(card.text).font(Theme.body(16)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, 24)
            .padding(.top, 22)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
