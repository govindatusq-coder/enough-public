import SwiftUI

/// The draft privacy notice (`app/privacy/page.tsx`), readable offline, with a
/// link to the live page on the website.
struct PrivacyView: View {
    @Environment(\.dismiss) private var dismiss

    private let sections: [(String, [String])] = [
        ("What we collect, and why", [
            "Account details: email and sign-in information, including details returned by Google or Apple if you choose that provider. Supabase manages authentication. They let you access your own saved account.",
            "Your profile: optional first name, PINS (preferences, interests, needs and strengths), life routines, country, currency and optional visual preferences. These help match movement ideas to your day. Needs can include health information, such as pain, low energy or accessibility needs.",
            "Moves and feedback: saved and generated ideas, plans, reminders, cost assumptions, daily notes, optional weekly reviews, confirmed outcomes and reflections. These support your matches and your own record of what worked.",
            "Photos and check-ins: photos you choose to upload and companion names you add manually or through QR check-ins. They support your private moments gallery and meeting record. ENOUGH does not upload your address book.",
            "Optional native health access: Apple Health daily steps and exercise minutes are read only after permission in the app. Daily totals remain in app memory and clear when you leave or hide the app. If you explicitly save a movement check for an activity, that selected reading becomes part of the activity record.",
            "Technical information: authentication tokens and device storage maintain your session and preview. Hosting and service providers may process IP addresses, request details and operational logs to deliver and protect the service.",
            "You can browse the library without an account or AI permission. Written answers are optional where marked. Avoid adding names, contact details or information about other people to written answers."
        ]),
        ("Device preview and cloud storage", [
            "Before you choose a cloud profile, your preview profile and progress stay on this device. Signing in does not automatically import them. We show a collection notice before you choose to keep a profile in your account.",
            "Cloud account records and private photos are stored using Supabase in Sydney. Vercel hosts the web app and API, with application functions configured for Sydney. An Australian region does not mean every provider operation, support process or log stays in Australia. Access rules restrict account records and private photos to their signed-in owner."
        ]),
        ("OpenAI ideas and pictures are your choice", [
            "Use AI ideas: send PINS choices, routines, daily context and selected activity feedback to OpenAI. This can include health-related needs.",
            "Use AI ideas without my health needs: send approved non-health choices only. Health needs, usual-day activity, written notes, previous outcome records and earlier AI text are excluded. ENOUGH still applies all your needs on its own server before offering an idea. Fewer ideas may fit.",
            "Not now: continue with library ideas, with no new OpenAI idea or picture requests.",
            "OpenAI processes requests in the United States. Your choice is saved with its time and version. Change it in My Pins → AI and privacy. A changed choice stops later requests; it cannot recall data already sent."
        ]),
        ("Who processes information", [
            "Supabase provides account authentication, database and private photo storage. Vercel provides hosting and application processing. OpenAI processes optional AI requests. Google or Apple processes its own sign-in flow if selected on the website. Licensed library images may be loaded from external image providers, which receive ordinary web request information such as your IP address.",
            "No selling of profile data or advertising integration is implemented in this prototype."
        ]),
        ("Access, correction and export", [
            "Edit your profile in My Pins. Correct outcomes in My Wins. Open My account → Download my ENOUGH data for a JSON export of your current profile, consent choice, plans, check-ins and outcomes. Save original photo files separately from the gallery."
        ]),
        ("Deletion and retention", [
            "My Pins or My account → Delete my ENOUGH data removes your cloud profile, plans, outcomes, suggestion archive and stored photos, including cached AI pictures. This does not delete the separate Supabase sign-in identity or recall requests already processed by OpenAI.",
            "Reset this device’s preview clears the local preview. A fixed retention schedule, backup removal process and account-identity deletion route must be confirmed during legal review."
        ]),
        ("Questions and complaints", [
            "For the current prototype, contact the person who provided access to request access, correction or deletion, or to raise a privacy concern. Do not post health information, photos or account exports in a public issue tracker.",
            "If a concern is not resolved, you can read the Office of the Australian Information Commissioner’s privacy complaint process, including when it can consider a complaint and the requirement to complain to the organisation first."
        ])
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Eyebrow("Your information")
                    Text("Privacy, in plain language.").font(Theme.display(32)).foregroundStyle(Theme.ink)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Draft for legal review · 11 October 2026").font(Theme.body(14, weight: .semibold)).foregroundStyle(Theme.ink)
                        Text("This describes the current prototype. The operating entity, public privacy contact, retention arrangements and overseas processing must be confirmed before public release. It is not a claim of legal compliance.").font(Theme.body(13)).foregroundStyle(Theme.muted)
                    }
                    .padding(12).background(Theme.mist).clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    ForEach(sections, id: \.0) { section in
                        VStack(alignment: .leading, spacing: 8) {
                            SectionTitle(section.0, size: 22)
                            ForEach(section.1, id: \.self) { paragraph in
                                Text(paragraph).font(Theme.body(14)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                    Link("Office of the Australian Information Commissioner: privacy complaints", destination: URL(string: "https://www.oaic.gov.au/privacy/privacy-complaints")!).font(Theme.body(14, weight: .semibold))
                    Link("Read the current notice on the ENOUGH website", destination: Config.shared.privacyURL).font(Theme.body(14, weight: .semibold))
                }
                .padding(16)
            }
            .background(Theme.paper)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } } }
        }
    }
}
