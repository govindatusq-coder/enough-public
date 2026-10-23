import SwiftUI

/// The landing page (`components/welcome.tsx`), with the same copy.
struct WelcomeView: View {
    @EnvironmentObject private var navigation: AppNavigation
    @EnvironmentObject private var store: AppStore
    @State private var showPrivacy = false

    private struct Example { let tag: String, title: String, text: String, image: String }
    private let examples = [
        Example(tag: "Calling a friend", title: "Take the catch-up outside.", text: "You were going to call anyway. Keep the conversation and add a comfortable walk on a familiar route.", image: "welcome-catchup-walk"),
        Example(tag: "The water refill", title: "A refill. A flight of stairs.", text: "Refilling your bottle? Choose a water station one floor up and take the stairs as part of the trip.", image: "welcome-refill-stairs"),
        Example(tag: "Library errand", title: "That errand could be your run.", text: "A book to return? Tuck it in a light backpack and make the drop-off a short, easy run.", image: "welcome-library-run"),
        Example(tag: "The ad break", title: "Keep your show. Add a little strength.", text: "During the adverts, try a few wall push-ups in a clear space beside the sofa.", image: "welcome-ad-break-strength")
    ]

    private func open(_ tab: AppNavigation.Tab, setup: Bool = false) {
        navigation.go(tab)
        navigation.opened = true
        if setup { navigation.sheet = .setup }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                hero
                problem
                difference
                ideas
                results
                breathe
                how
                footer
            }
            .padding(.bottom, 40)
        }
        .background(Theme.paper)
        .overlay(alignment: .top) { header }
        .sheet(isPresented: $showPrivacy) { PrivacyView() }
    }

    private var header: some View {
        HStack {
            LogoView(height: 26)
            Spacer()
            Button { open(.enough) } label: { Label("Open ENOUGH", systemImage: "arrow.right") }.buttonStyle(.secondary)
        }
        .padding(.horizontal, 16).padding(.top, 8)
    }

    private var hero: some View {
        ZStack(alignment: .bottomLeading) {
            SceneImage(name: "welcome-hero").frame(height: 440).clipped()
            LinearGradient(colors: [.clear, Theme.deepInk.opacity(0.75)], startPoint: .center, endPoint: .bottom)
            VStack(alignment: .leading, spacing: 12) {
                Text("Less sacrifice.\nMore life.").font(Theme.display(44)).foregroundStyle(.white).lineSpacing(-2)
                Text("Find exercise that fits your life.").font(Theme.body(17)).foregroundStyle(.white.opacity(0.92))
                Button { open(.moves, setup: true) } label: { Label("Try ENOUGH", systemImage: "arrow.right") }.buttonStyle(.primary)
                HStack(alignment: .top, spacing: 12) {
                    benefit("bolt", "More energy for what you love")
                    benefit("heart", "Fits your life and priorities")
                    benefit("leaf", "Real ideas for real days")
                }
                .padding(.top, 6)
            }
            .padding(20)
        }
        .frame(height: 440)
        .accessibilityElement(children: .contain)
    }

    private func benefit(_ icon: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Image(systemName: icon).foregroundStyle(.white)
            Text(text).font(Theme.body(12)).foregroundStyle(.white.opacity(0.9)).fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var problem: some View {
        VStack(alignment: .leading, spacing: 8) {
            Eyebrow("The problem")
            Text("Want to exercise more.").font(Theme.display(30)).foregroundStyle(Theme.ink)
            Text("Don’t want another thing to do?").font(Theme.display(30)).foregroundStyle(Theme.accent)
        }
        .glassPanel().pageGutter()
    }

    private var difference: some View {
        VStack(alignment: .leading, spacing: 12) {
            Eyebrow("How it’s different")
            SectionTitle("This is not a fitness app.", size: 28)
            Text("A fitness app hands you a plan and asks for your time. ENOUGH looks at the time you’re already spending.").font(Theme.body(16)).foregroundStyle(Theme.muted)
            HStack(alignment: .top, spacing: 12) {
                comparison("A fitness app", ["Gives you a plan", "Adds another thing to do", "Focuses on workouts", "Takes dedicated time", "Easy to drop"], icon: "xmark", color: Theme.alert)
                comparison("ENOUGH", ["Finds opportunities in your day", "Fits what you already do", "Builds movement into real life", "No dedicated exercise time", "Ideas you’ll actually do again"], icon: "checkmark", color: Theme.accent)
            }
        }
        .glassPanel().pageGutter()
    }

    private func comparison(_ title: String, _ items: [String], icon: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Eyebrow(title)
            ForEach(items, id: \.self) { item in
                HStack(alignment: .top, spacing: 6) {
                    Image(systemName: icon).font(.system(size: 11, weight: .bold)).foregroundStyle(color).padding(.top, 3)
                    Text(item).font(Theme.body(13)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var ideas: some View {
        VStack(alignment: .leading, spacing: 12) {
            Eyebrow("The idea").pageGutter()
            SectionTitle("There’s another way through.", size: 28).pageGutter()
            Text("ENOUGH finds movement inside things you’re already doing.").font(Theme.body(16)).foregroundStyle(Theme.muted).pageGutter()
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(examples, id: \.tag) { example in
                        Button { open(.moves) } label: {
                            VStack(alignment: .leading, spacing: 0) {
                                SceneImage(name: example.image).frame(width: 280, height: 170).clipped()
                                VStack(alignment: .leading, spacing: 6) {
                                    Eyebrow(example.tag)
                                    Text(example.title).font(Theme.display(21)).foregroundStyle(Theme.ink).multilineTextAlignment(.leading)
                                    Text(example.text).font(Theme.body(13)).foregroundStyle(Theme.muted).multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                                    Image(systemName: "arrow.right").foregroundStyle(Theme.accent)
                                }
                                .padding(14)
                            }
                            .frame(width: 280, alignment: .leading)
                            .background(Color.white)
                            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Theme.border))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(example.title) Explore this kind of idea")
                    }
                }
                .padding(.horizontal, 16)
            }
            Button { open(.moves) } label: { Label("See more ideas", systemImage: "arrow.right") }.buttonStyle(.primary).pageGutter()
        }
    }

    private var results: some View {
        VStack(alignment: .leading, spacing: 12) {
            Eyebrow("What you get back")
            SectionTitle("A month of ENOUGH, in numbers.", size: 28)
            Text("An illustrative month — your own results will be personal to you.").font(Theme.body(15)).foregroundStyle(Theme.muted)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                Metric(icon: "figure.walk", value: "3h 48m", label: "Exercise Minutes")
                Metric(icon: "wallet.pass", value: "$42.60", label: "Money kept", caption: "from paid travel and delivery")
                Metric(icon: "clock", value: "0 mins", label: "stolen from your life")
                Metric(icon: "heart", value: "7", label: "things that brought you joy")
            }
            Note("Example figures, not measured user results. My Wins records only savings you confirm.")
            Text("Every move counts. ENOUGH adds to, not replaces, recommended weekly activity and strength training.").font(Theme.body(13)).foregroundStyle(Theme.muted)
            Link("Australian 24-hour movement guidelines", destination: URL(string: "https://www.health.gov.au/topics/physical-activity/24-hour-movement-guidelines-for-all-australians/recommendations-for-adults-18-to-64-years")!).font(Theme.body(13, weight: .semibold))
        }
        .glassPanel().pageGutter()
    }

    private var breathe: some View {
        ZStack(alignment: .bottomLeading) {
            SceneImage(name: "welcome-coast").frame(height: 320).clipped()
            VStack(alignment: .leading, spacing: 8) {
                Eyebrow("A kinder, smarter approach", color: Theme.ink)
                Text("Health without\nthe homework.").font(Theme.display(30)).foregroundStyle(Theme.ink)
                Text("No streaks. No guilt. No exercise debt.").font(Theme.body(15)).foregroundStyle(Theme.muted)
                Button { open(.moves, setup: true) } label: { Label("Try ENOUGH", systemImage: "arrow.right") }.buttonStyle(.secondary)
            }
            .padding(18)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .padding(16)
        }
        .frame(height: 320)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .pageGutter()
    }

    private var how: some View {
        VStack(alignment: .leading, spacing: 12) {
            Eyebrow("How it thinks")
            SectionTitle("One small change to something you’re already doing.", size: 26)
            Text("Real movement, almost no sacrifice.").font(Theme.body(15)).foregroundStyle(Theme.muted)
            ForEach(Array([("magnifyingglass", "Understand", "Your life, preferences and what’s getting in the way."), ("list.bullet", "Find", "Personalised ideas inside your existing plans and routines."), ("star", "See if it’s worth it", "Tell us how an idea worked for you."), ("checkmark", "Learn", "Your answers shape better ideas, over time.")].enumerated()), id: \.offset) { index, step in
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: step.0).font(.system(size: 22, weight: .light)).foregroundStyle(Theme.accent).frame(width: 30)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(index + 1). \(step.1)").font(Theme.body(15, weight: .semibold)).foregroundStyle(Theme.ink)
                        Text(step.2).font(Theme.body(14)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        .glassPanel().pageGutter()
    }

    private var footer: some View {
        VStack(alignment: .leading, spacing: 10) {
            LogoView(height: 24)
            Text("Less sacrifice. More life.").font(Theme.body(14)).foregroundStyle(Theme.muted)
            HStack(spacing: 16) {
                Button("Find ideas") { open(.moves) }
                Button("My Pins") { open(.pins) }
                Button("My Wins") { open(.wins) }
            }
            .buttonStyle(.text)
            HStack(spacing: 16) {
                Button("Open the app") { open(.enough) }
                Button("Sign in") { navigation.opened = true; navigation.sheet = .signIn }
                Button("Privacy notice") { showPrivacy = true }
            }
            .buttonStyle(.text)
            Text("Movement that fits.\nRoom for the rest of your life.").font(Theme.body(13)).foregroundStyle(Theme.muted)
        }
        .pageGutter()
        .padding(.top, 10)
    }
}

/// The wordmark: a soft wave over the letters, as in `public/logo.svg`.
struct LogoView: View {
    var height: CGFloat = 26
    var body: some View {
        VStack(spacing: 2) {
            WavePath().stroke(LinearGradient(colors: [Theme.ink, Theme.accent, Theme.sky], startPoint: .leading, endPoint: .trailing), style: StrokeStyle(lineWidth: 2, lineCap: .round))
                .frame(width: height * 2.4, height: height * 0.5)
            Text("ENOUGH").font(.system(size: height * 0.55, weight: .regular)).kerning(height * 0.14).foregroundStyle(Theme.ink)
        }
        .accessibilityLabel("ENOUGH")
    }
}

struct WavePath: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let w = rect.width, h = rect.height
        path.move(to: CGPoint(x: 0, y: h * 0.8))
        path.addCurve(to: CGPoint(x: w * 0.43, y: h * 0.2), control1: CGPoint(x: w * 0.15, y: h * 0.45), control2: CGPoint(x: w * 0.3, y: h * 0))
        path.addCurve(to: CGPoint(x: w * 0.69, y: h * 0.85), control1: CGPoint(x: w * 0.54, y: h * 0.4), control2: CGPoint(x: w * 0.55, y: h * 0.85))
        path.addCurve(to: CGPoint(x: w, y: h * 0.25), control1: CGPoint(x: w * 0.8, y: h * 0.85), control2: CGPoint(x: w * 0.9, y: h * 0.55))
        return path
    }
}
