import SwiftUI

/// Email, Google or Apple sign-in (`app/signin/page.tsx`).
struct SignInView: View {
    var pending: AppNavigation.PendingAction? = nil
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var auth: AuthService
    @EnvironmentObject private var navigation: AppNavigation
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var password = ""
    @State private var create = false
    @State private var recovering = false
    @State private var busy = false
    @State private var message = ""
    @State private var showPrivacy = false

    var body: some View {
        SheetFrame(title: recovering ? "Reset your password" : create ? "Keep your ENOUGH" : "Welcome back", kicker: "Sign in", doneLabel: "Not now") {
            Text("Your answers, plans and moments, together.").font(Theme.body(15)).foregroundStyle(Theme.muted)
            if !auth.available {
                AlertText("Accounts aren’t available in this build.")
            }
            VStack(alignment: .leading, spacing: 8) {
                Button { Task { await social("google") } } label: { Text("Continue with Google") }.buttonStyle(.secondary).disabled(busy || !auth.available || !auth.providers.google)
                Button { Task { await social("apple") } } label: { Label("Continue with Apple", systemImage: "apple.logo") }.buttonStyle(.secondary).disabled(busy || !auth.available || !auth.providers.apple)
                if auth.available && (!auth.providers.google || !auth.providers.apple) { Note("Some sign-in options aren’t switched on yet.") }
            }
            Text("Or with your email").font(Theme.body(13)).foregroundStyle(Theme.muted)
            VStack(alignment: .leading, spacing: 10) {
                FieldLabel("Email")
                TextField("you@example.com", text: $email).keyboardType(.emailAddress).textContentType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled().fieldBox()
                if !recovering {
                    FieldLabel("Password")
                    SecureField("At least 8 characters", text: $password).textContentType(create ? .newPassword : .password).fieldBox()
                }
            }
            Button(recovering ? "Send a reset link" : create ? "Create my account" : "Sign in") { Task { await submit() } }
                .buttonStyle(.primary).disabled(busy || !auth.available || email.isEmpty || (!recovering && password.count < 8))
            if busy { ProgressView() }
            VStack(alignment: .leading, spacing: 2) {
                if recovering {
                    Button("Back to sign-in") { recovering = false; message = "" }
                } else {
                    Button(create ? "I already have an account" : "Create an account") { create.toggle(); message = "" }
                    Button("Forgot password?") { recovering = true; message = "" }
                }
            }
            .buttonStyle(.text)
            if !message.isEmpty { Text(message).font(Theme.body(14)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true).padding(12).frame(maxWidth: .infinity, alignment: .leading).background(Theme.mist).clipShape(RoundedRectangle(cornerRadius: Theme.Radius.field, style: .continuous)) }
            CollectionNotice(cloud: false, showPrivacy: $showPrivacy)
        }
        .task { await auth.loadProviders() }
        .sheet(isPresented: $showPrivacy) { PrivacyView() }
    }

    private func submit() async {
        busy = true; message = ""
        defer { busy = false }
        do {
            if recovering {
                try await auth.recover(email: email)
                message = "If an account uses this email, a reset link is on its way. Open it on the ENOUGH website to choose a new password."
            } else if create {
                let signedIn = try await auth.signUp(email: email, password: password)
                if signedIn { await finish() } else { message = "Check your email to confirm your account, then come back and sign in." }
            } else {
                try await auth.signIn(email: email, password: password)
                await finish()
            }
        } catch {
            message = error.localizedDescription
        }
    }

    private func social(_ provider: String) async {
        busy = true; message = ""
        defer { busy = false }
        do { try await auth.signIn(provider: provider); await finish() }
        catch { message = error.localizedDescription }
    }

    private func finish() async {
        await store.loadAccount()
        if store.cloud {
            dismiss()
            store.notice = "Welcome back. Your ENOUGH is loaded."
        } else {
            // Swapping the sheet item presents the account sheet in its place,
            // carrying the save or accept the user was in the middle of.
            navigation.sheet = .account(pending: pending)
        }
    }
}

/// `components/collection-notice.tsx`.
struct CollectionNotice: View {
    var cloud = false
    @Binding var showPrivacy: Bool
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(cloud ? "Before we keep your ENOUGH" : "About your information").font(Theme.body(15, weight: .medium)).foregroundStyle(Theme.ink)
            Text(cloud ? "Keeping it stores your answers, routines, moves, moments and AI choice in your account. Needs can include health details. Photos and companion names are stored only when you add them." : "Signing in sends your email and sign-in details to ENOUGH’s account service. Google or Apple also handle sign-in if you choose them. Nothing on this phone is uploaded until you choose to keep it.").font(Theme.body(13)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
            Text("ENOUGH runs on services set up in Sydney. AI ideas and pictures are a separate choice; the library needs neither.").font(Theme.body(13)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
            Button("Privacy notice") { showPrivacy = true }.buttonStyle(.text)
        }
        .padding(14).background(Theme.mist).clipShape(RoundedRectangle(cornerRadius: Theme.Radius.field, style: .continuous))
    }
}
