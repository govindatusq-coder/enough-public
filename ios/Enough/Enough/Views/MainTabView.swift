import SwiftUI
import UniformTypeIdentifiers

/// The four-tab app shell (`Enough()` in `app/page.tsx`): My Enough, My Moves,
/// My Wins and My Pins, plus the notices, reminders and global sheets.
struct MainTabView: View {
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation
    @Environment(\.scenePhase) private var scenePhase
    @State private var clock = Date()

    var body: some View {
        TabView(selection: $navigation.tab) {
            tabPage(EnoughTabView(now: clock), title: "Home", icon: "house", tag: .enough, chrome: false)
            tabPage(MovesTabView(now: clock), title: "My Moves", icon: "magnifyingglass", tag: .moves)
            tabPage(WinsTabView(now: clock), title: "My Wins", icon: "heart", tag: .wins)
            tabPage(PinsTabView(now: clock), title: "My Pins", icon: "person", tag: .pins)
        }
        .task {
            // Refresh "now" every 30 seconds for reminders, periods and greetings.
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 30_000_000_000)
                clock = Date()
            }
        }
        .onChange(of: scenePhase) { _, phase in
            // Daily health readings never outlive the foreground session.
            if phase == .background { store.movementSnapshot = nil }
            if phase == .active { clock = Date() }
        }
        .sheet(item: $navigation.sheet) { sheet in
            switch sheet {
            case .account(let pending): AccountSheet(pending: pending)
            case .help: HelpSheet()
            case .aiConsent: AIConsentSheet()
            case .setup: SetupFlowView()
            case .signIn(let pending): SignInView(pending: pending)
            }
        }
    }

    /// `chrome: false` is the home tab: it draws its own header over a soft
    /// painting and carries the status strip and reminders itself.
    private func tabPage<Content: View>(_ content: Content, title: String, icon: String, tag: AppNavigation.Tab, chrome: Bool = true) -> some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        if chrome {
                            StatusStrip()
                            DueReminders(now: clock)
                        }
                        content
                    }
                    .padding(.top, 4)
                    .padding(.bottom, 48)
                }
                .onChange(of: navigation.scrollTarget) { _, _ in scrollIfAsked(proxy, tag: tag) }
                .onAppear { scrollIfAsked(proxy, tag: tag) }
            }
            .background { pageBackground(chrome: chrome) }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.large)
            .toolbar(chrome ? .visible : .hidden, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { navigation.sheet = .help } label: { Image(systemName: "questionmark.circle") }.accessibilityLabel("How ENOUGH works")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { navigation.sheet = .account(pending: nil) } label: { Image(systemName: store.cloud ? "person.circle.fill" : "person.circle") }
                        .accessibilityLabel(store.cloud ? "My account" : "Sign in")
                }
            }
        }
        .tabItem { Label(title, systemImage: icon) }
        .tag(tag)
    }

    /// Scroll to a section another tab asked for, once this page is on screen.
    private func scrollIfAsked(_ proxy: ScrollViewProxy, tag: AppNavigation.Tab) {
        guard let target = navigation.scrollTarget, navigation.tab == tag else { return }
        navigation.scrollTarget = nil
        Task {
            try? await Task.sleep(nanoseconds: 400_000_000)
            withAnimation { proxy.scrollTo(target, anchor: .top) }
        }
    }

    @ViewBuilder private func pageBackground(chrome: Bool) -> some View {
        if chrome {
            Theme.paper.ignoresSafeArea()
        } else {
            ZStack {
                Theme.paper
                SceneImage(name: "welcome-coast").blur(radius: 10).opacity(0.75)
                LinearGradient(colors: [Theme.paper.opacity(0.45), Theme.paper.opacity(0.7), Theme.paper.opacity(0.9)], startPoint: .top, endPoint: .bottom)
            }
            .ignoresSafeArea()
        }
    }
}

/// Cloud status, storage errors and the transient journey notice. Quiet when
/// everything is saved.
struct StatusStrip: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if !store.cloudError.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    AlertText(store.cloudError)
                    HStack(spacing: 16) {
                        ShareLink(item: ExportFile(data: store.exportData()), preview: SharePreview("ENOUGH backup")) { Text("Export my changes") }.buttonStyle(.text)
                        if store.cloudStatus == .conflict {
                            Button("Use the account version") { Task { await store.loadCloudVersion() } }.buttonStyle(.text)
                        } else {
                            Button("Try again") { Task { await store.retryCloud() } }.buttonStyle(.text)
                        }
                    }
                }
                .pageGutter()
            } else if store.cloud && store.cloudStatus != .saved {
                Text(store.cloudStatus == .saving || store.cloudStatus == .waiting ? "Saving to your account…" : "Changes haven’t been saved yet")
                    .font(Theme.body(12)).foregroundStyle(Theme.muted).pageGutter()
            }
            if !store.storageError.isEmpty { AlertText(store.storageError).pageGutter() }
            if !store.notice.isEmpty {
                HStack(alignment: .top) {
                    Text(store.notice).font(Theme.body(14)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
                    Spacer()
                    Button { store.notice = "" } label: { Image(systemName: "xmark").font(.system(size: 12, weight: .bold)) }
                        .buttonStyle(.plain).foregroundStyle(Theme.muted).tapTarget().accessibilityLabel("Dismiss")
                }
                .padding(.leading, 14).padding(.vertical, 6).padding(.trailing, 4)
                .background(Theme.mist).clipShape(RoundedRectangle(cornerRadius: Theme.Radius.field, style: .continuous)).pageGutter()
                .transition(.opacity)
            }
        }
    }
}

struct DueReminders: View {
    let now: Date
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation

    var body: some View {
        ForEach(store.dueReminders(now: now)) { entry in
            VStack(alignment: .leading, spacing: 8) {
                Eyebrow("A reminder you asked for")
                Text(store.state.idea(entry.ideaId).title).font(Theme.display(22)).foregroundStyle(Theme.ink)
                Note("Only if it still fits your day.")
                Button("See my plan") { navigation.openSupport(entry.id) }.buttonStyle(.secondary)
                HStack(spacing: 16) {
                    Button("In 15 minutes") { store.snoozeReminder(entryId: entry.id) }.buttonStyle(.text)
                    Button("Dismiss") { store.dismissReminder(entryId: entry.id) }.buttonStyle(.text)
                }
            }
            .glassPanel().pageGutter()
        }
    }
}

/// A JSON export shared through the system share sheet.
struct ExportFile: Transferable {
    let data: Data
    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(exportedContentType: .json) { $0.data }.suggestedFileName("enough-backup.json")
    }
}

struct CalendarFile: Transferable {
    let text: String
    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(exportedContentType: .calendarEvent) { Data($0.text.utf8) }.suggestedFileName("enough-move.ics")
    }
}
