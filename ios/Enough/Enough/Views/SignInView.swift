import SwiftUI

/// Email and password sign-in (`app/signin/page.tsx`).
struct SignInView: View {
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
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    LogoView(height: 24)
                    Text(recovering ? "Reset your password" : create ? "Keep your ENOUGH" : "Welcome back").font(Theme.display(32)).foregroundStyle(Theme.ink)
                    Text("Your profile, plans and moments, together.").font(Theme.body(15)).foregroundStyle(Theme.muted)
                    if !auth.available {
                        AlertText("Accounts are not configured in this build. Add the Supabase URL and publishable key to EnoughConfig.plist.")
                    }
                    CollectionNotice(cloud: false, showPrivacy: $showPrivacy)
                    VStack(alignment: .leading, spacing: 10) {
                        FieldLabel("Email")
                        TextField("you@example.com", text: $email).keyboardType(.emailAddress).textContentType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled().fieldBox()
                        if !recovering {
                            FieldLabel("Password")
                            SecureField("At least 8 characters", text: $password).textContentType(create ? .newPassword : .password).fieldBox()
                        }
                    }
                    Button(recovering ? "Send reset link" : create ? "Create account" : "Sign in") { Task { await submit() } }
                        .buttonStyle(.primary).disabled(busy || !auth.available || email.isEmpty || (!recovering && password.count < 8))
                    if busy { ProgressView() }
                    HStack {
                        if recovering {
                            Button("Back to sign-in") { recovering = false; message = "" }
                        } else {
                            Button(create ? "I already have an account" : "Create an account") { create.toggle(); message = "" }
                            Button("Forgot password?") { recovering = true; message = "" }
                        }
                    }
                    .buttonStyle(.text)
                    VStack(alignment: .leading, spacing: 8) {
                        Button { Task { await social("google") } } label: { Label("Continue with Google", systemImage: "globe") }.buttonStyle(.secondary).disabled(busy || !auth.providers.google)
                        Button { Task { await social("apple") } } label: { Label("Continue with Apple", systemImage: "apple.logo") }.buttonStyle(.secondary).disabled(busy || !auth.providers.apple)
                        if !auth.providers.google || !auth.providers.apple { Note("Some sign-in options are not available yet.") }
                    }
                    if !message.isEmpty { Text(message).font(Theme.body(14)).foregroundStyle(Theme.ink).padding(12).background(Theme.mist).clipShape(RoundedRectangle(cornerRadius: 12)) }
                    Button("Keep browsing") { dismiss() }.buttonStyle(.text)
                }
                .padding(16)
            }
            .background(Theme.paper)
            .scrollDismissesKeyboard(.interactively)
            .task { await auth.loadProviders() }
            .sheet(isPresented: $showPrivacy) { PrivacyView() }
        }
    }

    private func submit() async {
        busy = true; message = ""
        defer { busy = false }
        do {
            if recovering {
                try await auth.recover(email: email)
                message = "If an account uses this email, you’ll receive a reset link. Open it on the ENOUGH website to choose a new password."
            } else if create {
                let signedIn = try await auth.signUp(email: email, password: password)
                if signedIn { await finish() } else { message = "Check your email to confirm your account, then return to ENOUGH and sign in." }
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
        dismiss()
        if !store.cloud { navigation.sheet = .account(pending: nil) } else { store.notice = "Welcome back. Your profile and progress are loaded." }
    }
}

/// `components/collection-notice.tsx`.
struct CollectionNotice: View {
    var cloud = false
    @Binding var showPrivacy: Bool
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(cloud ? "Before we keep your profile" : "About your information").font(Theme.body(15, weight: .semibold)).foregroundStyle(Theme.ink)
            Text(cloud ? "Saving keeps your PINS, routines, moves, outcomes and AI choice in your account. Needs may include health information. Photos and QR companion names are saved only when you add them." : "Creating or accessing an account sends your email and sign-in details to Supabase. Google or Apple also processes sign-in details if you choose that option. Your device preview is not imported until you choose to keep it.").font(Theme.body(13)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
            Text("ENOUGH uses Supabase and Vercel, configured in Sydney, to run your account. Fresh OpenAI ideas and pictures require a separate choice. You can browse the library without them.").font(Theme.body(13)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
            Button("Draft privacy notice: storage, overseas processing, export, deletion and complaints") { showPrivacy = true }.buttonStyle(.text)
        }
        .padding(14).background(Theme.mist).clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}
