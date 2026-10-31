import SwiftUI

/// A quiet palette in the spirit of shibui: ink that is not quite black,
/// washi-coloured paper, one muted indigo accent, a little moss and clay.
/// Surfaces stay plain (kanso), with room around everything (ma).
enum Theme {
    static let ink = Color(red: 0x2A / 255, green: 0x36 / 255, blue: 0x44 / 255)
    static let deepInk = Color(red: 0x1C / 255, green: 0x26 / 255, blue: 0x32 / 255)
    static let muted = Color(red: 0x6B / 255, green: 0x74 / 255, blue: 0x7D / 255)
    static let accent = Color(red: 0x4E / 255, green: 0x6E / 255, blue: 0x8E / 255)
    static let sky = Color(red: 0xB9 / 255, green: 0xC9 / 255, blue: 0xD6 / 255)
    static let moss = Color(red: 0x7E / 255, green: 0x8F / 255, blue: 0x74 / 255)
    static let clay = Color(red: 0xC4 / 255, green: 0x9E / 255, blue: 0x8A / 255)
    static let paper = Color(red: 0xF7 / 255, green: 0xF5 / 255, blue: 0xF0 / 255)
    static let panel = Color(red: 0xF1 / 255, green: 0xEF / 255, blue: 0xE9 / 255)
    static let mist = Color(red: 0xEC / 255, green: 0xEE / 255, blue: 0xEC / 255)
    static let border = Color(red: 0xE2 / 255, green: 0xDF / 255, blue: 0xD8 / 255)
    static let warm = Color(red: 0xC4 / 255, green: 0x9E / 255, blue: 0x8A / 255)
    static let alert = Color(red: 0x9C / 255, green: 0x6B / 255, blue: 0x63 / 255)

    static func display(_ size: CGFloat, weight: Font.Weight = .regular) -> Font { .system(size: size, weight: weight, design: .serif) }
    static func body(_ size: CGFloat = 17, weight: Font.Weight = .regular) -> Font { .system(size: size, weight: weight, design: .default) }
    static let eyebrow: Font = .system(size: 11, weight: .medium)
}

struct Eyebrow: View {
    let text: String
    var color: Color = Theme.muted
    init(_ text: String, color: Color = Theme.muted) { self.text = text; self.color = color }
    var body: some View {
        Text(text).font(Theme.eyebrow).kerning(0.6).foregroundStyle(color)
    }
}

struct SectionTitle: View {
    let text: String
    var size: CGFloat = 26
    init(_ text: String, size: CGFloat = 26) { self.text = text; self.size = size }
    var body: some View { Text(text).font(Theme.display(size)).foregroundStyle(Theme.ink).lineSpacing(3).fixedSize(horizontal: false, vertical: true) }
}

struct Note: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View { Text(text).font(Theme.body(13)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true) }
}

/// A sheet of glass over washi: a faint translucent fill, a hairline, no shadow.
struct GlassPanel: ViewModifier {
    var padding: CGFloat = 22
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.ultraThinMaterial.opacity(0.6))
            .background(Color.white.opacity(0.45))
            .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(Theme.border.opacity(0.9), lineWidth: 0.8))
            .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
    }
}

extension View {
    func glassPanel(padding: CGFloat = 20) -> some View { modifier(GlassPanel(padding: padding)) }
    func pageGutter() -> some View { padding(.horizontal, 16) }
}

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.body(15, weight: .medium))
            .foregroundStyle(Theme.paper)
            .padding(.horizontal, 26).padding(.vertical, 14)
            .frame(minHeight: 50)
            .background(Theme.ink)
            .clipShape(Capsule())
            .opacity(configuration.isPressed ? 0.85 : 1)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.body(14, weight: .medium))
            .foregroundStyle(Theme.ink)
            .padding(.horizontal, 20).padding(.vertical, 12)
            .frame(minHeight: 46)
            .overlay(Capsule().stroke(Theme.ink.opacity(0.35), lineWidth: 0.8))
            .clipShape(Capsule())
            .opacity(configuration.isPressed ? 0.6 : 1)
    }
}

struct TextButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.body(14, weight: .medium))
            .foregroundStyle(Theme.accent)
            .padding(.vertical, 8)
            .opacity(configuration.isPressed ? 0.6 : 1)
    }
}

extension ButtonStyle where Self == PrimaryButtonStyle { static var primary: PrimaryButtonStyle { PrimaryButtonStyle() } }
extension ButtonStyle where Self == SecondaryButtonStyle { static var secondary: SecondaryButtonStyle { SecondaryButtonStyle() } }
extension ButtonStyle where Self == TextButtonStyle { static var text: TextButtonStyle { TextButtonStyle() } }

/// A selectable chip, the `aria-pressed` buttons used throughout the site.
struct Chip: View {
    let label: String
    var selected: Bool
    var icon: String? = nil
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let icon { Image(systemName: icon).font(.system(size: 12, weight: .semibold)) }
                Text(label)
            }
            .font(Theme.body(14, weight: .regular))
            .foregroundStyle(selected ? Theme.paper : Theme.ink)
            .padding(.horizontal, 14).padding(.vertical, 9)
            .background(selected ? Theme.ink : Color.clear)
            .overlay(Capsule().stroke(selected ? Theme.ink : Theme.ink.opacity(0.3), lineWidth: 0.8))
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? [.isSelected] : [])
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

struct Metric: View {
    let icon: String
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
    let icon: String
    let title: String
    let text: String
    var action: (label: String, run: () -> Void)? = nil
    var secondary: (label: String, run: () -> Void)? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: icon).font(.system(size: 26, weight: .light)).foregroundStyle(Theme.accent)
            SectionTitle(title, size: 24)
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
                .background(Color(red: 1, green: 0xF0 / 255, blue: 0xE8 / 255))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .accessibilityAddTraits(.isStaticText)
        }
    }
}

struct FieldLabel: View {
    let text: String
    var optional = false
    init(_ text: String, optional: Bool = false) { self.text = text; self.optional = optional }
    var body: some View {
        HStack(spacing: 6) {
            Text(text).font(Theme.body(14, weight: .semibold)).foregroundStyle(Theme.ink)
            if optional { Text("Optional").font(Theme.body(12)).foregroundStyle(Theme.muted) }
        }
    }
}

struct FieldBox: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(12)
            .background(Color.white.opacity(0.55))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Theme.border, lineWidth: 0.8))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}
extension View { func fieldBox() -> some View { modifier(FieldBox()) } }
