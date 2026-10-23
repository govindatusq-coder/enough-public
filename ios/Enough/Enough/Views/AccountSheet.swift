import SwiftUI

/// The account sheet: sign in, keep or replace what is on this device,
/// export, sign out and delete.
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
        case .accept: return "Sign in to keep this plan"
        case nil: return store.cloud ? "Your account" : "Keep what works for you."
        }
    }

    var body: some View {
        SheetFrame(title: title, kicker: "Account", doneLabel: store.cloud ? "Done" : "Not now") {
            Text(store.cloud ? "Your answers, plans and moments are kept in your account and follow you between devices." : "Sign in to keep your answers, saved ideas and moments, on this phone and on the website.").font(Theme.body(15)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
            if auth.isSignedIn {
                Text("Signed in as \(store.accountEmail ?? auth.email)").font(Theme.body(14, weight: .medium)).foregroundStyle(Theme.ink)
                if store.cloud { signedInCloud } else { attachChoices }
            } else {
                Button("Sign in") { navigation.sheet = .signIn(pending: pending) }.buttonStyle(.primary)
                Note("What is on this phone stays here while you sign in. You choose afterwards whether to keep it.")
            }
            AlertText(store.cloudError)
        }
        .sheet(isPresented: $showPrivacy) { PrivacyView() }
        .confirmationDialog("Delete your ENOUGH data?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete my ENOUGH data", role: .destructive) {
                Task { if await store.deleteCloudData() { dismiss(); navigation.go(.enough) } }
            }
            Button("Keep my data", role: .cancel) {}
        } message: {
            Text("This permanently removes your answers, saved ideas, plans, photos, check-ins and moments from your account. It does not delete your sign-in itself.")
        }
    }

    private var signedInCloud: some View {
        VStack(alignment: .leading, spacing: 10) {
            ShareLink(item: ExportFile(data: store.exportData()), preview: SharePreview("ENOUGH backup")) { Text("Export my data") }.buttonStyle(.secondary)
            Note("A file with your answers, plans, check-ins and moments. Photos are kept separately in My Wins.")
            Button("Sign out") {
                if store.cloudStatus != .saved { store.notice = "Wait for your changes to save, or export them, before signing out." }
                else { Task { await store.signOut(); dismiss() } }
            }
            .buttonStyle(.text)
            Button("Delete my ENOUGH data") { confirmDelete = true }.buttonStyle(.text)
        }
    }

    private var attachChoices: some View {
        VStack(alignment: .leading, spacing: 10) {
            Note("Bring what is on this phone into your account, or start again. Everything stays as you reported it.")
            CollectionNotice(cloud: true, showPrivacy: $showPrivacy)
            Button("Keep what’s on this phone") { Task { await attach(importLocal: true) } }.buttonStyle(.primary).disabled(working)
            Button("Start fresh") { Task { await attach(importLocal: false) } }.buttonStyle(.secondary).disabled(working)
            if working { ProgressView() }
        }
    }

    private func attach(importLocal: Bool) async {
        working = true
        defer { working = false }
        guard await store.attach(importLocal: importLocal) else { return }
        dismiss()
        if importLocal {
            store.notice = "Your ENOUGH is now kept in your account."
            switch pending {
            case .save(let id): store.save(id)
            case .accept(let id):
                if let entry = store.accept(id) { navigation.openSupport(entry.id) }
            case nil: break
            }
        } else {
            store.notice = "Your account is ready. Answer a few questions to begin."
        }
    }
}

/// "How ENOUGH works" (the help sheet).
struct HelpSheet: View {
    @EnvironmentObject private var navigation: AppNavigation
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        SheetFrame(title: "How ENOUGH works", kicker: "A little help") {
            Text("Movement already lives in your day: the call, the dinner you collect, the stairs you walk past. ENOUGH points it out and keeps score of nothing.").font(Theme.body(15)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
            step("Tell ENOUGH about your life", "A few answers in My Pins: what you enjoy, what you need to work around, what already happens in your week. Ideas are shaped around them.")
            step("Choose an idea, or don’t", "Browse My Moves. Every idea shows the money kept and the time it takes; tap ⓘ for the workings. “Sounds good” puts it in Planned, where a little support is optional: a direction or a clear target, a moment in your day, a reminder, someone to go with.")
            step("Say what happened", "Afterwards, “How did it go?” keeps the moment in My Wins, with a photo if you like. Money counts only once you confirm it.")
            Note("Free while we learn what is useful. Browsing has no limit, and nothing happens unless you choose it.")
            Button("Explore My Moves") { dismiss(); navigation.go(.moves, moves: .explore) }.buttonStyle(.primary)
        }
    }

    private func step(_ title: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(Theme.body(15, weight: .medium)).foregroundStyle(Theme.ink)
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
        SheetFrame(title: "Choose how AI helps", kicker: "AI and privacy", doneLabel: "Not now") {
            Text("The library is always there, whatever you choose. Nothing is chosen for you.").font(Theme.body(15)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
            Text("When you ask for more ideas, OpenAI writes them and paints their pictures. It processes the request in the United States.").font(Theme.body(14)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
            Text("With your permission ENOUGH sends your answers, routines and what you said after moves. Needs can include health details such as pain, tiredness or recovery. For pictures it sends the idea and its scene.").font(Theme.body(14)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
            Text("Your name, photos, companions and familiar settings are never sent. Keep identifying details out of written answers.").font(Theme.body(14)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
            ForEach(AIConsentChoice.allCases, id: \.self) { choice in
                Button {
                    store.chooseAIConsent(choice)
                    dismiss()
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(choice.label).font(Theme.body(15, weight: .medium)).foregroundStyle(Theme.ink)
                        Text(choice.detail).font(Theme.body(13)).foregroundStyle(Theme.muted).multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(14)
                    .cardSurface()
                }
                .buttonStyle(.plain)
                .disabled(store.aiBusy)
            }
            Note("The reduced option may bring fewer ideas and does not paint pictures for older ideas. Change your choice any time under AI and privacy in My Pins; it stops future requests but cannot recall what was already sent.")
            Button("Read the privacy notice") { showPrivacy = true }.buttonStyle(.text)
        }
        .sheet(isPresented: $showPrivacy) { PrivacyView() }
    }
}
