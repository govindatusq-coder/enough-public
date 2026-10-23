import SwiftUI

/// Three short cards on first launch, then straight into the app.
struct OnboardingView: View {
    /// Called with `true` to start setup, `false` to explore first.
    let finish: (Bool) -> Void
    @State private var page = 0

    private struct Card { let image: String, kicker: String, title: String, text: String }
    private let cards = [
        Card(image: "welcome-hero", kicker: "Less sacrifice. More life.", title: "Movement that fits the life you have.", text: "ENOUGH is not a fitness app. It looks for a little movement inside the things you already do."),
        Card(image: "welcome-catchup-walk", kicker: "How it thinks", title: "One small change to something you’re already doing.", text: "A call becomes a walk. An errand becomes a few minutes outside. Your needs set the boundaries."),
        Card(image: "welcome-coast", kicker: "No streaks. No guilt.", title: "Keep only what it gave back.", text: "Tell ENOUGH what actually happened. Money, time and moments count only when you confirm them.")
    ]

    var body: some View {
        VStack(spacing: 0) {
            TabView(selection: $page) {
                ForEach(cards.indices, id: \.self) { index in
                    card(cards[index]).tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .always))
            .indexViewStyle(.page(backgroundDisplayMode: .always))

            VStack(spacing: 10) {
                if page < cards.count - 1 {
                    Button("Continue") { withAnimation { page += 1 } }.buttonStyle(.primary).frame(maxWidth: .infinity)
                    Button("Skip") { finish(false) }.buttonStyle(.text)
                } else {
                    Button("Set up my ENOUGH") { finish(true) }.buttonStyle(.primary).frame(maxWidth: .infinity)
                    Button("Explore first") { finish(false) }.buttonStyle(.text)
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 24)
        }
        .background(Theme.paper)
    }

    private func card(_ card: Card) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            SceneImage(name: card.image)
                .frame(height: 360)
                .frame(maxWidth: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
                .padding(.horizontal, 16)
                .padding(.top, 8)
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
