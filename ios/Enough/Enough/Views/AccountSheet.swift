import SwiftUI

/// The account modal: sign in, keep or replace the local profile, export,
/// sign out and delete.
struct AccountSheet: View {
    let pending: AppNavigation.PendingAction?
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var auth: AuthService
    @EnvironmentObject private var navigation: AppNavigation
    @Environment(\.dismiss) private var dismiss
    @State private var confirmDelete = false
    @State private var showPrivacy = false
    @State private var working = false

    private var title: String {
        switch pending {
        case .save: return "Sign in to save this idea"
        case .accept: return "Sign in to accept this idea"
        case nil: return "Keep what works for you."
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Eyebrow("ENOUGH")
                    Text(title).font(Theme.display(30)).foregroundStyle(Theme.ink)
                    Text(store.cloud ? "Your ENOUGH profile and progress are kept with your signed-in ENOUGH account." : "Sign in to ENOUGH to keep your profile, saved moves and progress across devices.").font(Theme.body(15)).foregroundStyle(Theme.muted)
                    if auth.isSignedIn {
                        Text("Signed in as \(store.accountEmail ?? auth.email)").font(Theme.body(14, weight: .semibold)).foregroundStyle(Theme.ink)
                        if store.cloud { signedInCloud } else { attachChoices }
                    } else {
                        Button("Sign in to ENOUGH") { navigation.sheet = .signIn }.buttonStyle(.primary)
                        Note("Your setup stays on this device during sign-in. You can choose to import it afterwards.")
                    }
                    AlertText(store.cloudError)
                    Button(store.cloud ? "Close" : "Keep browsing") { dismiss() }.buttonStyle(.text)
                }
                .padding(16)
            }
            .background(Theme.paper)
            .sheet(isPresented: $showPrivacy) { PrivacyView() }
            .confirmationDialog("Delete your ENOUGH data?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete my ENOUGH cloud data", role: .destructive) {
                    Task { if await store.deleteCloudData() { dismiss(); navigation.go(.enough) } }
                }
                Button("Keep my data", role: .cancel) {}
            } message: {
                Text("This permanently removes your ENOUGH profile, saved moves, support plans, photos, check-ins and outcomes from cloud storage. It does not delete your sign-in account.")
            }
        }
    }

    private var signedInCloud: some View {
        VStack(alignment: .leading, spacing: 10) {
            ShareLink(item: ExportFile(data: store.exportData()), preview: SharePreview("ENOUGH profile backup")) { Text("Download my ENOUGH data") }.buttonStyle(.secondary)
            Note("This exports your profile, plans, check-ins and outcomes. Save photo files separately from the gallery.")
            Button("Sign out of ENOUGH") {
                if store.cloudStatus != .saved { store.notice = "Wait for your changes to save, or download them before signing out." }
                else { Task { await store.signOut(); dismiss() } }
            }
            .buttonStyle(.text)
            Button("Delete my ENOUGH data") { confirmDelete = true }.buttonStyle(.text)
        }
    }

    private var attachChoices: some View {
        VStack(alignment: .leading, spacing: 10) {
            Note("Choose whether to bring the profile and local-demo outcomes from this device into your account. They stay self-reported; no activity has been sensor-verified.")
            CollectionNotice(cloud: true, showPrivacy: $showPrivacy)
            Button("Keep my current profile & progress") { Task { await attach(importLocal: true) } }.buttonStyle(.primary).disabled(working)
            Button("Start with a new profile") { Task { await attach(importLocal: false) } }.buttonStyle(.secondary).disabled(working)
            if working { ProgressView() }
        }
    }

    private func attach(importLocal: Bool) async {
        working = true
        defer { working = false }
        guard await store.attach(importLocal: importLocal) else { return }
        dismiss()
        if importLocal {
            store.notice = "Your profile and progress are now backed up."
            switch pending {
            case .save(let id): store.save(id)
            case .accept(let id):
                if let entry = store.accept(id) { navigation.openSupport(entry.id) }
            case nil: break
            }
        } else {
            store.notice = "Your ENOUGH account is ready. Complete your setup to explore."
        }
    }
}

/// "A little help getting started" (the help modal).
struct HelpSheet: View {
    @EnvironmentObject private var navigation: AppNavigation
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Eyebrow("ENOUGH")
                    Text("A little help getting started").font(Theme.display(30)).foregroundStyle(Theme.ink)
                    Text("Explore freely. Complete your PINS and routines before personalised ideas. Save or accept an idea when something fits your day.").font(Theme.body(15)).foregroundStyle(Theme.muted)
                    step("Choose an experience", "Browse My Moves by swiping or tapping Previous and Next. Optional name and visual questions can be skipped.")
                    step("Make it easier", "After accepting, choose an open or SMART goal, prepare for barriers, add a reminder, or plan to meet someone. All support options are optional.")
                    step("Keep what it gave you", "Use How did it go? to confirm the outcome. Add a photo or meeting check-in in My Wins. Money counts only after you confirm it.")
                    Note("Free while we test usefulness. Email sign-in is available. Health access is optional. Browsing has no daily limit.")
                    Button("Explore My Moves") { dismiss(); navigation.go(.moves, moves: .explore) }.buttonStyle(.primary)
                }
                .padding(16)
            }
            .background(Theme.paper)
        }
    }

    private func step(_ title: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(Theme.body(15, weight: .semibold)).foregroundStyle(Theme.ink)
            Text(text).font(Theme.body(14)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// "Choose how AI helps" (`components/ai-consent.tsx`).
struct AIConsentSheet: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var showPrivacy = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Eyebrow("ENOUGH")
                    Text("Choose how AI helps").font(Theme.display(30)).foregroundStyle(Theme.ink)
                    Text("Your library stays available whichever option you choose. No option is pre-selected.").font(Theme.body(15)).foregroundStyle(Theme.muted)
                    Text("OpenAI prepares fresh ideas and illustrative pictures when you request suggestions. It processes information in the United States.").font(Theme.body(14)).foregroundStyle(Theme.ink)
                    Text("With your permission, we send your PINS, routines and activity feedback. Needs can include health information, such as pain, fatigue or recovery. For pictures, we send the suggested activity and its scene details.").font(Theme.body(14)).foregroundStyle(Theme.ink)
                    Text("Your name, uploaded photos, companion records and visual preferences are not sent. Avoid identifying details in written answers.").font(Theme.body(14)).foregroundStyle(Theme.ink)
                    ForEach(AIConsentChoice.allCases, id: \.self) { choice in
                        Button {
                            store.chooseAIConsent(choice)
                            dismiss()
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(choice.label).font(Theme.body(15, weight: .semibold)).foregroundStyle(Theme.ink)
                                Text(choice.detail).font(Theme.body(13)).foregroundStyle(Theme.muted).multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(14)
                            .background(Color.white)
                            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Theme.border))
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .disabled(store.aiBusy)
                    }
                    Note("The reduced option may return fewer ideas. It does not generate missing pictures for older ideas, which may contain earlier health context. You can change your choice in My Pins → AI and privacy. Changing it stops future requests; it cannot recall information already sent.")
                    Button("Read the draft privacy notice") { showPrivacy = true }.buttonStyle(.text)
                }
                .padding(16)
            }
            .background(Theme.paper)
            .sheet(isPresented: $showPrivacy) { PrivacyView() }
        }
    }
}
