import SwiftUI
import UIKit

/// Bundled WebP scenes from the website's `public/images` folder.
enum BundledImages {
    private static var cache: [String: UIImage] = [:]
    /// A watercolour illustration dropped into `Resources/Illustrations`.
    static func illustration(_ name: String) -> UIImage? {
        let key = "illustration:" + name
        if let cached = cache[key] { return cached }
        for ext in ["webp", "png", "jpg"] {
            // Files are named `<scene>-illustration.<ext>` because Xcode flattens resource folders into the bundle, where a plain name would collide with the photograph.
            if let url = Bundle.main.url(forResource: name + "-illustration", withExtension: ext) ?? Bundle.main.url(forResource: name + "-illustration", withExtension: ext, subdirectory: "Illustrations"), let image = UIImage(contentsOfFile: url.path) {
                cache[key] = image
                return image
            }
        }
        return nil
    }

    static func image(_ name: String) -> UIImage? {
        if let cached = cache[name] { return cached }
        guard let url = Bundle.main.url(forResource: name, withExtension: "webp") ?? Bundle.main.url(forResource: name, withExtension: "webp", subdirectory: "Images"), let image = UIImage(contentsOfFile: url.path) else { return nil }
        cache[name] = image
        return image
    }
}

/// An illustration slot. It shows `Resources/Illustrations/<name>-illustration.webp` (a
/// watercolour painting) when that file exists; until then the matching
/// photograph is softened into a wash so the app reads as one quiet whole.
/// It fills whatever frame it is given without ever widening its container.
struct SceneImage: View {
    let name: String
    var body: some View {
        Color.clear
            .overlay {
                if let painting = BundledImages.illustration(name) {
                    Image(uiImage: painting).resizable().scaledToFill()
                } else if let image = BundledImages.image(name) {
                    Image(uiImage: image).resizable().scaledToFill()
                        .saturation(0.55).contrast(0.9).brightness(0.04)
                        .overlay(Theme.paper.opacity(0.18))
                        .overlay(LinearGradient(colors: [.clear, Theme.paper.opacity(0.35)], startPoint: .center, endPoint: .bottom))
                } else {
                    LinearGradient(colors: [Theme.sky, Theme.panel, Theme.paper], startPoint: .topLeading, endPoint: .bottomTrailing)
                }
            }
            .clipped()
    }
}

/// `ChoiceArtwork`: one cell of a 4 × 4 photo sheet, keyed by the option label.
struct ChoiceArtwork: View {
    let label: String
    var lifestyle = false

    private static let sheets: [String: String] = ["preferences": "preferences-lifestyle-v1", "interests": "onboarding-interests-v1", "needs": "onboarding-needs-v1", "strengths": "onboarding-strengths-v1", "routines": "onboarding-routines-v1"]
    private static let preferenceScenes: [String: Int] = ["Outside": 0, "Indoors": 1, "Alone": 2, "With someone": 3, "Quiet": 4, "Music": 5, "Morning": 6, "Afternoon": 7, "Evening": 8, "Planned": 9, "Spontaneous": 10, "Short bursts": 11, "Take my time": 12, "Familiar places": 13, "New places": 14, "Nothing to add": 15]
    private static let scenes: [String: (String, Int)] = [
        "Podcasts": ("interests", 0), "Music": ("preferences", 5), "Coffee": ("interests", 1), "Family time": ("interests", 2), "Friends / talking": ("interests", 3), "Nature": ("interests", 4),
        "Animals": ("interests", 5), "Shopping / browsing": ("interests", 6), "Photography": ("interests", 7), "Exploring new places": ("preferences", 14), "Learning": ("strengths", 10), "Gardening": ("interests", 9),
        "Making things": ("interests", 10), "Audiobooks": ("interests", 11), "TV / streaming": ("interests", 12), "Sport": ("interests", 13), "Food": ("interests", 14), "Markets": ("interests", 6),
        "Community activities": ("strengths", 13), "Creative hobbies": ("interests", 10), "Reading": ("interests", 8), "Gaming": ("interests", 15), "Listening to something": ("interests", 0), "Solving problems": ("strengths", 4),
        "Not enough time": ("needs", 0), "Save money": ("needs", 1), "Low energy / tired": ("needs", 2), "Family or caring": ("needs", 3), "Work / shifts": ("needs", 4), "Need recovery": ("needs", 5),
        "Safety matters": ("needs", 6), "Weather / heat": ("needs", 7), "Hard to walk where I live": ("needs", 8), "Physical comfort / accessibility": ("needs", 9), "Need flexibility": ("needs", 10),
        "Already active at work": ("needs", 11), "Sleep matters": ("needs", 12), "Pain / discomfort": ("needs", 13), "Unpredictable day": ("routines", 3), "Transport limitations": ("needs", 14), "Money is tight": ("needs", 1),
        "Privacy matters": ("needs", 15), "I don’t enjoy exercise": ("preferences", 4),
        "I keep routines": ("strengths", 0), "I like getting things done": ("strengths", 1), "I walk when there’s a reason": ("strengths", 2), "I enjoy company": ("interests", 3),
        "I can do things independently": ("strengths", 3), "I like exploring": ("preferences", 14), "I solve problems": ("strengths", 4), "I care for others": ("needs", 3),
        "I know my neighbourhood": ("strengths", 5), "I use public transport": ("strengths", 6), "I’m already on my feet": ("strengths", 7), "I’m willing to try small changes": ("strengths", 8),
        "I know what works for me": ("strengths", 9), "I enjoy learning": ("strengths", 10), "I’m good at planning": ("strengths", 11), "I adapt when plans change": ("strengths", 12),
        "I have supportive people": ("strengths", 13), "I like challenges": ("strengths", 14), "I notice patterns": ("strengths", 15),
        "Mostly seated": ("routines", 0), "On my feet": ("routines", 1), "A mix of both": ("routines", 2), "Every day is different": ("routines", 3), "Work or study": ("routines", 0), "School run": ("routines", 4),
        "Calls": ("routines", 5), "Takeaway": ("routines", 6), "Groceries": ("routines", 7), "Podcasts or music": ("preferences", 5), "Caring for someone": ("needs", 3),
        "Household tasks": ("routines", 8), "No regular routine": ("routines", 3), "Morning": ("preferences", 6), "Daytime": ("routines", 14), "Evening": ("preferences", 8),
        "It varies": ("routines", 3), "City streets": ("routines", 9), "Suburban neighbourhoods": ("routines", 10), "Small towns": ("routines", 11), "Country settings": ("routines", 12),
        "Coastal places": ("routines", 13), "Mix it up": ("routines", 15), "Nothing to add": ("preferences", 15), "Outside": ("preferences", 0), "Short bursts": ("preferences", 11)
    ]

    var body: some View {
        let scene: (String, Int) = (lifestyle ? ChoiceArtwork.preferenceScenes[label].map { ("preferences", $0) } : nil) ?? ChoiceArtwork.scenes[label] ?? ("preferences", 15)
        GeometryReader { geo in
            if let sheet = BundledImages.image(ChoiceArtwork.sheets[scene.0] ?? "") {
                let column = CGFloat(scene.1 % 4), row = CGFloat(scene.1 / 4)
                Image(uiImage: sheet)
                    .resizable()
                    .frame(width: geo.size.width * 4, height: geo.size.height * 4)
                    .offset(x: -column * geo.size.width, y: -row * geo.size.height)
                    .frame(width: geo.size.width, height: geo.size.height, alignment: .topLeading)
            } else {
                Theme.mist
            }
        }
        .clipped()
        .accessibilityHidden(true)
    }
}

/// `ChoiceTiles`: photo tiles with a label and a check when selected.
struct ChoiceTiles: View {
    let options: [String]
    let values: [String]
    var lifestyle = false
    let pick: (String) -> Void
    private let columns = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]

    var body: some View {
        LazyVGrid(columns: columns, spacing: 10) {
            ForEach(options, id: \.self) { option in
                let selected = values.contains(option)
                Button { pick(option) } label: {
                    VStack(alignment: .leading, spacing: 0) {
                        ChoiceArtwork(label: option, lifestyle: lifestyle).aspectRatio(3 / 2, contentMode: .fit)
                        HStack(alignment: .top) {
                            Text(option).font(Theme.body(13, weight: .semibold)).foregroundStyle(Theme.ink).multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                            Spacer(minLength: 4)
                            ZStack {
                                Circle().fill(selected ? Theme.ink : Color.clear).frame(width: 22, height: 22).overlay(Circle().stroke(selected ? Theme.ink : Theme.border, lineWidth: 0.8))
                                if selected { Image(systemName: "checkmark").font(.system(size: 11, weight: .bold)).foregroundStyle(.white) }
                            }
                        }
                        .padding(10)
                        .frame(minHeight: 56, alignment: .top)
                    }
                    .background(Color.white.opacity(0.5))
                    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(selected ? Theme.ink : Theme.border, lineWidth: selected ? 1.5 : 0.8))
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(option)
                .accessibilityAddTraits(selected ? [.isSelected] : [])
            }
        }
    }
}

/// `PinsOptions`: tiles plus "Nothing to add" and a free-text "Something else".
struct PinsOptions: View {
    let options: [String]
    @Binding var values: [String]
    var lifestyle = false
    @State private var otherOpen = false
    @State private var custom = ""

    private var customValue: String { values.first { $0.hasPrefix(Pins.customPrefix) }.map { String($0.dropFirst(Pins.customPrefix.count)) } ?? "" }

    func pick(_ v: String) {
        if v == "Nothing to add" { values = values.contains(v) ? [] : [v] }
        else if values.contains(v) { values.removeAll { $0 == v } }
        else { values = values.filter { $0 != "Nothing to add" } + [v] }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ChoiceTiles(options: options + ["Nothing to add"], values: values, lifestyle: lifestyle, pick: pick)
            Button {
                otherOpen.toggle()
            } label: {
                HStack {
                    Image(systemName: "plus.circle")
                    VStack(alignment: .leading) {
                        Text("Something else").font(Theme.body(14, weight: .semibold))
                        Text(customValue.isEmpty ? "Tell us in your own words" : "Your answer is included").font(Theme.body(12)).foregroundStyle(Theme.muted)
                    }
                    Spacer()
                }
                .foregroundStyle(Theme.ink)
                .padding(12)
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Theme.border, style: StrokeStyle(lineWidth: 1, dash: [4])))
            }
            .buttonStyle(.plain)
            if otherOpen {
                VStack(alignment: .leading, spacing: 6) {
                    FieldLabel("What else should we know?")
                    TextField("What fits your life?", text: $custom, axis: .vertical).lineLimit(2...4).fieldBox()
                        .onChange(of: custom) { _, answer in
                            let trimmed = answer.trimmingCharacters(in: .whitespaces)
                            values = values.filter { !$0.hasPrefix(Pins.customPrefix) && $0 != "Nothing to add" } + (trimmed.isEmpty ? [] : [Pins.customPrefix + String(answer.prefix(150))])
                        }
                    Note("Your answer is saved with this category.")
                }
            }
        }
        .onAppear { custom = customValue; otherOpen = !customValue.isEmpty }
    }
}

/// An image fetched through the website's API with the bearer token
/// (`AsyncImage` cannot send headers).
@MainActor
final class RemoteImageLoader: ObservableObject {
    @Published var image: UIImage?
    @Published var failed = false
    private static var cache = NSCache<NSString, UIImage>()
    private var task: Task<Void, Never>?

    func load(_ path: String, api: EnoughAPI) {
        if let cached = RemoteImageLoader.cache.object(forKey: path as NSString) { image = cached; return }
        task?.cancel()
        task = Task {
            do {
                let data = try await api.imageData(path)
                guard let loaded = UIImage(data: data) else { failed = true; return }
                RemoteImageLoader.cache.setObject(loaded, forKey: path as NSString)
                image = loaded
            } catch { failed = true }
        }
    }
}

struct RemoteImage: View {
    let path: String
    @EnvironmentObject private var store: AppStore
    @StateObject private var loader = RemoteImageLoader()
    var body: some View {
        Color.clear
            .overlay {
                if let image = loader.image { Image(uiImage: image).resizable().scaledToFill() }
                else if loader.failed { Theme.mist.overlay(Image(systemName: "photo").foregroundStyle(Theme.muted)) }
                else { Theme.mist.overlay(ProgressView()) }
            }
            .clipped()
        .onAppear { loader.load(path, api: store.api) }
        .onChange(of: path) { _, next in loader.load(next, api: store.api) }
    }
}

/// `IdeaPhoto`: generated pictures for AI ideas are prepared with the batch and
/// only read here; library ideas use bundled scenes.
@MainActor
final class IdeaPictureLoader: ObservableObject {
    @Published var credit: IdeaImageCredit?
    @Published var status = "idle"
    private var task: Task<Void, Never>?

    func prepare(idea: Idea, api: EnoughAPI, enabled: Bool) {
        guard idea.image == nil, enabled, status == "idle" else { return }
        status = "loading"
        task = Task {
            var attempts = 0
            while attempts < 60 {
                guard let result = try? await api.ideaImage(id: idea.id) else { status = "error"; return }
                switch result {
                case .ready(let credit):
                    if idea.source == .ai && !(credit.image.hasPrefix("/api/idea-image?") && credit.kind == "generated") { status = "error"; return }
                    self.credit = credit; status = "ready"; return
                case .pending(let seconds):
                    attempts += 1
                    try? await Task.sleep(nanoseconds: UInt64(seconds) * 1_000_000_000)
                case .unavailable:
                    status = "error"; return
                }
            }
            status = "error"
        }
    }
}

struct IdeaPicture: View {
    let idea: Idea
    @EnvironmentObject private var store: AppStore
    @StateObject private var loader = IdeaPictureLoader()

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            if let image = idea.image {
                SceneImage(name: image)
            } else if let credit = loader.credit {
                RemoteImage(path: credit.image)
                if let creator = credit.creator {
                    Text("\(creator) · \(credit.license ?? "")").font(Theme.body(10)).padding(6).background(.ultraThinMaterial).clipShape(Capsule()).padding(8)
                }
            } else {
                SceneImage(name: Discovery.cover(idea))
            }
        }
        .onAppear { loader.prepare(idea: idea, api: store.api, enabled: store.cloud && store.isComplete) }
    }
}

struct IdeaTagsView: View {
    let idea: Idea
    var body: some View {
        HStack(spacing: 6) {
            ForEach(idea.tagLabels, id: \.self) { tag in
                Text(tag).font(Theme.body(11, weight: .semibold)).foregroundStyle(Theme.ink).padding(.horizontal, 8).padding(.vertical, 4).background(Theme.mist).clipShape(Capsule())
            }
        }
    }
}

/// The confirmed-days strip used on the dashboard, in My Moves and My Wins.
struct ActivityDaysView: View {
    let days: [ActivityDay]
    var body: some View {
        HStack(spacing: 6) {
            ForEach(days) { d in
                VStack(spacing: 4) {
                    ZStack {
                        Circle().fill(d.count > 0 ? Theme.moss : Theme.mist).frame(width: 28, height: 28)
                            .overlay(Circle().stroke(d.today ? Theme.ink : Color.clear, lineWidth: 1.5))
                        if d.count > 0 { Image(systemName: "checkmark").font(.system(size: 12, weight: .bold)).foregroundStyle(.white) }
                        else { Circle().fill(Theme.border).frame(width: 6, height: 6) }
                    }
                    .opacity(d.future ? 0.45 : 1)
                    Text(d.label).font(Theme.body(10)).foregroundStyle(Theme.muted)
                }
                .frame(maxWidth: .infinity)
                .accessibilityLabel("\(d.label): \(d.count) confirmed moments\(d.today ? ", today" : "")")
            }
        }
    }
}

struct LabeledPicker<Value: Hashable>: View {
    let label: String
    @Binding var selection: Value
    let options: [(Value, String)]
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            FieldLabel(label)
            Picker(label, selection: $selection) {
                ForEach(options, id: \.0) { value, text in Text(text).tag(value) }
            }
            .pickerStyle(.menu)
            .tint(Theme.ink)
            .frame(maxWidth: .infinity, alignment: .leading)
            .fieldBox()
        }
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
