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
        case account(pending: PendingAction?), help, aiConsent, setup, signIn(pending: PendingAction?)
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
    @Published var winsPeriod: ReturnPeriod = .thisWeek
    @Published var highlightedOutcomeId: String?
    /// A view id the current tab's scroll view should move to.
    @Published var scrollTarget: String?

    func go(_ tab: Tab, moves: MovesView? = nil) {
        self.tab = tab
        if let moves { movesView = moves }
        detailIdeaId = nil
        supportEntryId = nil
        highlightedOutcomeId = nil
    }

    func openIdea(_ id: Int) { tab = .moves; movesView = .explore; detailIdeaId = id; supportEntryId = nil }
    func openSupport(_ entryId: String) { tab = .moves; movesView = .planned; supportEntryId = entryId; detailIdeaId = nil }
    func openOutcome(_ entryId: String) {
        tab = .wins
        winsPeriod = .allTime
        highlightedOutcomeId = entryId
        scrollTarget = "win-outcome-\(entryId)"
    }
}

struct RootView: View {
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation
    @AppStorage("enough.onboarded.v1") private var onboarded = false

    var body: some View {
        ZStack {
            Theme.paper.ignoresSafeArea()
            if navigation.opened || onboarded {
                MainTabView().transition(.opacity)
            } else {
                OnboardingView { startSetup in
                    onboarded = true
                    navigation.go(startSetup ? .moves : .enough)
                    navigation.opened = true
                    // The tab view that owns the sheet has to be on screen first.
                    if startSetup {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { navigation.sheet = .setup }
                    }
                }
                .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: navigation.opened || onboarded)
        .preferredColorScheme(.light)
    }
}
