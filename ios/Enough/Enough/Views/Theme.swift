import SwiftUI

/// The ENOUGH palette in a quiet register: brand navy and blue, pale sky,
/// washi paper, a little moss and clay. Surfaces are thin glass over paper;
/// headings and figures are a light serif, everything else a rounded sans.
enum Theme {
    static let ink = Color(red: 0x0A / 255, green: 0x2F / 255, blue: 0x52 / 255)
    static let deepInk = Color(red: 0x06 / 255, green: 0x27 / 255, blue: 0x44 / 255)
    static let muted = Color(red: 0x5B / 255, green: 0x6E / 255, blue: 0x80 / 255)
    static let accent = Color(red: 0x3F / 255, green: 0x7F / 255, blue: 0xBF / 255)
    static let sky = Color(red: 0xA7 / 255, green: 0xC7 / 255, blue: 0xE8 / 255)
    static let moss = Color(red: 0x7E / 255, green: 0x8F / 255, blue: 0x74 / 255)
    static let clay = Color(red: 0xD9 / 255, green: 0x9A / 255, blue: 0x7E / 255)
    static let paper = Color(red: 0xF7 / 255, green: 0xF6 / 255, blue: 0xF2 / 255)
    static let panel = Color(red: 0xEE / 255, green: 0xF3 / 255, blue: 0xF8 / 255)
    static let mist = Color(red: 0xE5 / 255, green: 0xED / 255, blue: 0xF3 / 255)
    static let border = Color(red: 0xCF / 255, green: 0xDC / 255, blue: 0xE8 / 255)
    static let card = Color.white.opacity(0.78)
    static let alertFill = Color(red: 0xFB / 255, green: 0xEF / 255, blue: 0xEA / 255)
    static let warm = Color(red: 0xD9 / 255, green: 0x7B / 255, blue: 0x5B / 255)
    static let alert = Color(red: 0xA6 / 255, green: 0x64 / 255, blue: 0x60 / 255)

    enum Radius {
        static let panel: CGFloat = 24
        static let card: CGFloat = 20
        static let field: CGFloat = 12
    }

    static func display(_ size: CGFloat, weight: Font.Weight = .light) -> Font { .system(size: size, weight: weight, design: .serif) }
    /// A handwritten flourish for the person's name; Snell Roundhand ships with iOS.
    static func script(_ size: CGFloat) -> Font { .custom("SnellRoundhand-Bold", size: size) }
    static func italic(_ size: CGFloat) -> Font { Font.system(size: size, weight: .light, design: .serif).italic() }
    static func body(_ size: CGFloat = 17, weight: Font.Weight = .regular) -> Font { .system(size: size, weight: weight, design: .rounded) }
    static let eyebrow: Font = .system(size: 11, weight: .medium, design: .rounded)
    static let shadow = Color(red: 0x0A / 255, green: 0x2F / 255, blue: 0x52 / 255).opacity(0.06)
}

struct Eyebrow: View {
    let text: String
    var color: Color = Theme.muted
    init(_ text: String, color: Color = Theme.muted) { self.text = text; self.color = color }
    var body: some View { Text(text).font(Theme.eyebrow).kerning(0.6).foregroundStyle(color) }
}

struct SectionTitle: View {
    let text: String
    var size: CGFloat = 22
    init(_ text: String, size: CGFloat = 22) { self.text = text; self.size = size }
    var body: some View { Text(text).font(Theme.display(size)).foregroundStyle(Theme.ink).lineSpacing(3).fixedSize(horizontal: false, vertical: true) }
}

struct Note: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View { Text(text).font(Theme.body(13)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true) }
}

/// A sheet of glass over paper: a faint translucent fill, a hairline and one soft shadow.
struct GlassPanel: ViewModifier {
    var padding: CGFloat = 20
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.ultraThinMaterial.opacity(0.7))
            .background(Theme.card)
            .overlay(RoundedRectangle(cornerRadius: Theme.Radius.panel, style: .continuous).stroke(Theme.border, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.panel, style: .continuous))
            .shadow(color: Theme.shadow, radius: 18, x: 0, y: 8)
    }
}

/// A white card with a sky hairline, for ideas and moments.
struct CardSurface: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous).stroke(Theme.border, lineWidth: 1))
            .shadow(color: Theme.shadow, radius: 18, x: 0, y: 8)
    }
}

extension View {
    func glassPanel(padding: CGFloat = 20) -> some View { modifier(GlassPanel(padding: padding)) }
    func cardSurface() -> some View { modifier(CardSurface()) }
    func pageGutter() -> some View { padding(.horizontal, 16) }
    /// A comfortable tap target for small controls.
    func tapTarget() -> some View { frame(minWidth: 44, minHeight: 44).contentShape(Rectangle()) }
}

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.body(15, weight: .medium))
            .foregroundStyle(.white)
            .padding(.horizontal, 26).padding(.vertical, 13)
            .frame(minHeight: 48)
            .background(Theme.accent)
            .clipShape(Capsule())
            .opacity(configuration.isPressed ? 0.85 : 1)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.body(15, weight: .medium))
            .foregroundStyle(Theme.ink)
            .padding(.horizontal, 20).padding(.vertical, 12)
            .frame(minHeight: 48)
            .background(Theme.card)
            .overlay(Capsule().stroke(Theme.ink.opacity(0.35), lineWidth: 0.8))
            .clipShape(Capsule())
            .opacity(configuration.isPressed ? 0.6 : 1)
    }
}

struct TextButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.body(15, weight: .medium))
            .foregroundStyle(Theme.accent)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
            .opacity(configuration.isPressed ? 0.6 : 1)
    }
}

extension ButtonStyle where Self == PrimaryButtonStyle { static var primary: PrimaryButtonStyle { PrimaryButtonStyle() } }
extension ButtonStyle where Self == SecondaryButtonStyle { static var secondary: SecondaryButtonStyle { SecondaryButtonStyle() } }
extension ButtonStyle where Self == TextButtonStyle { static var text: TextButtonStyle { TextButtonStyle() } }

/// A selectable chip.
struct Chip: View {
    let label: String
    var selected: Bool
    var icon: String? = nil
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let icon { Image(systemName: icon).font(.system(size: 12, weight: .medium)).accessibilityHidden(true) }
                Text(label)
            }
            .font(Theme.body(14))
            .foregroundStyle(selected ? Color.white : Theme.ink)
            .padding(.horizontal, 14).padding(.vertical, 9)
            .background(selected ? Theme.ink : Theme.panel)
            .overlay(Capsule().stroke(selected ? Theme.ink : Theme.border, lineWidth: 0.8))
            .clipShape(Capsule())
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? [.isSelected] : [])
    }
}

/// A small label on a picture or tag row.
struct Badge: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text).font(Theme.body(11, weight: .medium)).foregroundStyle(Theme.ink)
            .padding(.horizontal, 8).padding(.vertical, 4)
            .background(Theme.mist).clipShape(Capsule())
    }
}

struct ChipRow<Item: Hashable>: View {
    let items: [Item]
    let label: (Item) -> String
    var selected: (Item) -> Bool
    var icon: (Item) -> String? = { _ in nil }
    let pick: (Item) -> Void
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(items, id: \.self) { item in
                    Chip(label: label(item), selected: selected(item), icon: icon(item)) { pick(item) }
                }
            }
            .padding(.vertical, 2)
        }
    }
}

struct WrapChips<Item: Hashable>: View {
    let items: [Item]
    let label: (Item) -> String
    var selected: (Item) -> Bool
    let pick: (Item) -> Void
    var body: some View {
        FlowLayout(spacing: 8) {
            ForEach(items, id: \.self) { item in
                Chip(label: label(item), selected: selected(item)) { pick(item) }
            }
        }
    }
}

/// A simple wrapping layout for chips.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 320
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > width && x > 0 { x = 0; y += rowHeight + spacing; rowHeight = 0 }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: width, height: y + rowHeight)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > bounds.width && x > 0 { x = 0; y += rowHeight + spacing; rowHeight = 0 }
            view.place(at: CGPoint(x: bounds.minX + x, y: bounds.minY + y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

/// A figure with a quiet label.
struct Metric: View {
    let value: String
    let label: String
    var caption: String? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(value).font(Theme.display(22)).foregroundStyle(Theme.ink).lineLimit(1).minimumScaleFactor(0.7)
            Text(label).font(Theme.body(12)).foregroundStyle(Theme.muted)
            if let caption { Text(caption).font(Theme.body(11)).foregroundStyle(Theme.muted.opacity(0.8)) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 6)
    }
}

struct EmptyState: View {
    let title: String
    let text: String
    var action: (label: String, run: () -> Void)? = nil
    var secondary: (label: String, run: () -> Void)? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionTitle(title)
            Text(text).font(Theme.body(15)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
            if let action { Button(action.label, action: action.run).buttonStyle(.secondary) }
            if let secondary { Button(secondary.label, action: secondary.run).buttonStyle(.text) }
        }
        .glassPanel()
    }
}

struct AlertText: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        if !text.isEmpty {
            Text(text).font(Theme.body(14)).foregroundStyle(Theme.alert)
                .padding(12).frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.alertFill)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.field, style: .continuous))
        }
    }
}

struct FieldLabel: View {
    let text: String
    var optional = false
    init(_ text: String, optional: Bool = false) { self.text = text; self.optional = optional }
    var body: some View {
        HStack(spacing: 6) {
            Text(text).font(Theme.body(14, weight: .medium)).foregroundStyle(Theme.ink)
            if optional { Text("Optional").font(Theme.body(12)).foregroundStyle(Theme.muted) }
        }
    }
}

struct FieldBox: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(12)
            .background(Theme.card)
            .overlay(RoundedRectangle(cornerRadius: Theme.Radius.field, style: .continuous).stroke(Theme.border, lineWidth: 0.8))
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.field, style: .continuous))
    }
}
extension View { func fieldBox() -> some View { modifier(FieldBox()) } }

/// A sheet with a title and a Done button, the shape every sheet shares.
struct SheetFrame<Content: View>: View {
    let title: String
    var kicker: String? = nil
    var doneLabel = "Done"
    @ViewBuilder let content: Content
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if let kicker { Eyebrow(kicker) }
                    Text(title).font(Theme.display(28)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
                    content
                }
                .padding(20)
            }
            .background(Theme.paper)
            .scrollDismissesKeyboard(.interactively)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button(doneLabel) { dismiss() } } }
        }
    }
}
