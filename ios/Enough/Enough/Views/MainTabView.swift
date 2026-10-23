import SwiftUI
import UniformTypeIdentifiers

/// The four-tab app shell (`Enough()` in `app/page.tsx`): My Enough, My Moves,
/// My Wins and My Pins, plus the notices, reminders and global sheets.
struct MainTabView: View {
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation
    @State private var clock = Date()

    var body: some View {
        TabView(selection: $navigation.tab) {
            tabPage(EnoughTabView(now: clock), title: "My Enough", icon: "house", tag: .enough)
            tabPage(MovesTabView(now: clock), title: "My Moves", icon: "figure.walk", tag: .moves)
            tabPage(WinsTabView(now: clock), title: "My Wins", icon: "doc.text", tag: .wins)
            tabPage(PinsTabView(), title: "My Pins", icon: "pin", tag: .pins)
        }
        .task {
            // Refresh "now" every 30 seconds for reminders, periods and greetings.
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 30_000_000_000)
                clock = Date()
            }
        }
        .sheet(item: $navigation.sheet) { sheet in
            switch sheet {
            case .account(let pending): AccountSheet(pending: pending)
            case .help: HelpSheet()
            case .aiConsent: AIConsentSheet()
            case .setup: SetupFlowView()
            case .signIn: SignInView()
            }
        }
    }

    private func tabPage<Content: View>(_ content: Content, title: String, icon: String, tag: AppNavigation.Tab) -> some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    StatusStrip()
                    DueReminders(now: clock)
                    content
                }
                .padding(.bottom, 32)
            }
            .background(Theme.paper)
            .scrollDismissesKeyboard(.interactively)
            .toolbar {
                ToolbarItem(placement: .principal) { LogoView(height: 20) }
                ToolbarItem(placement: .topBarLeading) {
                    Button("How it works") { navigation.sheet = .help }.font(Theme.body(13, weight: .semibold))
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { navigation.sheet = .account(pending: nil) } label: {
                        HStack(spacing: 6) {
                            Circle().fill(store.cloud ? Theme.accent : Theme.warm).frame(width: 8, height: 8)
                            Text(store.cloud ? "My account" : "Account").font(Theme.body(13, weight: .semibold))
                        }
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
        .tabItem { Label(title, systemImage: icon) }
        .tag(tag)
    }
}

/// Cloud status, storage errors and the transient journey notice.
struct StatusStrip: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if !store.cloudError.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    AlertText(store.cloudError)
                    HStack {
                        ShareLink(item: ExportFile(data: store.exportData()), preview: SharePreview("ENOUGH profile backup")) { Text("Download current changes") }.buttonStyle(.text)
                        if store.cloudStatus == .conflict {
                            Button("Load cloud version") { Task { await store.loadCloudVersion() } }.buttonStyle(.text)
                        } else {
                            Button("Try again") { Task { await store.retryCloud() } }.buttonStyle(.text)
                        }
                    }
                }
                .pageGutter()
            }
            if store.cloud {
                Text(store.cloudStatus == .saved ? "Saved to your account" : (store.cloudStatus == .saving || store.cloudStatus == .waiting) ? "Saving your changes…" : "Changes haven’t been saved yet")
                    .font(Theme.body(12)).foregroundStyle(Theme.muted).pageGutter()
            }
            if !store.storageError.isEmpty { AlertText(store.storageError).pageGutter() }
            if !store.notice.isEmpty {
                HStack(alignment: .top) {
                    Text(store.notice).font(Theme.body(14)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
                    Spacer()
                    Button { store.notice = "" } label: { Image(systemName: "xmark").font(.system(size: 12, weight: .bold)) }.foregroundStyle(Theme.muted).accessibilityLabel("Dismiss notice")
                }
                .padding(12).background(Theme.mist).clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous)).pageGutter()
                .transition(.opacity)
            }
        }
        .padding(.top, 8)
    }
}

struct DueReminders: View {
    let now: Date
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation

    var body: some View {
        ForEach(store.dueReminders(now: now)) { entry in
            VStack(alignment: .leading, spacing: 8) {
                Eyebrow("Your requested reminder")
                Text(store.state.idea(entry.ideaId).title).font(Theme.body(16, weight: .semibold)).foregroundStyle(Theme.ink)
                Note("Only if it still fits your day.")
                HStack {
                    Button("View plan") { navigation.openSupport(entry.id) }.buttonStyle(.secondary)
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
        DataRepresentation(exportedContentType: .json) { $0.data }.suggestedFileName("enough-profile-backup.json")
    }
}

struct CalendarFile: Transferable {
    let text: String
    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(exportedContentType: .calendarEvent) { Data($0.text.utf8) }.suggestedFileName("enough-move.ics")
    }
}
