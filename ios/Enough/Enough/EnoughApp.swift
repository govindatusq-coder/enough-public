import SwiftUI

@main
struct EnoughApp: App {
    @StateObject private var store = AppStore()
    @StateObject private var navigation = AppNavigation()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .environmentObject(store.auth)
                .environmentObject(store.health)
                .environmentObject(navigation)
                .tint(Theme.accent)
                .task { await store.start() }
        }
    }
}

/// Which tab, filter and overlay is showing (`location.hash` on the website).
@MainActor
final class AppNavigation: ObservableObject {
    enum Tab: String, CaseIterable { case enough, moves, wins, pins }
    enum MovesView: String, CaseIterable { case explore = "Explore", saved = "Saved", planned = "Planned" }
    enum GlobalSheet: Identifiable {
        case account(pending: PendingAction?), help, aiConsent, setup, signIn
        var id: String {
            switch self {
            case .account: return "account"
            case .help: return "help"
            case .aiConsent: return "aiConsent"
            case .setup: return "setup"
            case .signIn: return "signIn"
            }
        }
    }
    enum PendingAction { case save(Int), accept(Int) }

    @Published var opened = false
    @Published var tab: Tab = .enough
    @Published var movesView: MovesView = .explore
    @Published var detailIdeaId: Int?
    @Published var supportEntryId: String?
    @Published var sheet: GlobalSheet?
    @Published var winsDay: String?
    @Published var winsPeriod: ReturnPeriod = .thisWeek
    @Published var highlightedOutcomeId: String?

    func go(_ tab: Tab, moves: MovesView? = nil) {
        self.tab = tab
        if let moves { movesView = moves }
        detailIdeaId = nil
        supportEntryId = nil
    }

    func openIdea(_ id: Int) { tab = .moves; movesView = .explore; detailIdeaId = id; supportEntryId = nil }
    func openSupport(_ entryId: String) { tab = .moves; movesView = .planned; supportEntryId = entryId; detailIdeaId = nil }
    func openOutcome(_ entryId: String) { tab = .wins; winsPeriod = .allTime; highlightedOutcomeId = entryId }
}

struct RootView: View {
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation

    var body: some View {
        ZStack {
            Theme.paper.ignoresSafeArea()
            if navigation.opened {
                MainTabView().transition(.opacity)
            } else {
                WelcomeView().transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: navigation.opened)
        .preferredColorScheme(.light)
    }
}
