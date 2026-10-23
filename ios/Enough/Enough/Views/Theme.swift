import SwiftUI

/// The website's palette and type: ink navy, soft blue accent, warm paper
/// background, serif headings and glass panels.
enum Theme {
    static let ink = Color(red: 0x0A / 255, green: 0x2F / 255, blue: 0x52 / 255)
    static let deepInk = Color(red: 0x06 / 255, green: 0x27 / 255, blue: 0x44 / 255)
    static let muted = Color(red: 0x51 / 255, green: 0x65 / 255, blue: 0x77 / 255)
    static let accent = Color(red: 0x3F / 255, green: 0x7F / 255, blue: 0xBF / 255)
    static let sky = Color(red: 0xA7 / 255, green: 0xC7 / 255, blue: 0xE8 / 255)
    static let paper = Color(red: 0xFA / 255, green: 0xFA / 255, blue: 0xF8 / 255)
    static let panel = Color(red: 0xF1 / 255, green: 0xF6 / 255, blue: 0xF9 / 255)
    static let mist = Color(red: 0xEE / 255, green: 0xF3 / 255, blue: 0xF8 / 255)
    static let border = Color(red: 0xDC / 255, green: 0xE3 / 255, blue: 0xE7 / 255)
    static let warm = Color(red: 0xD9 / 255, green: 0x7B / 255, blue: 0x5B / 255)
    static let alert = Color(red: 0xA6 / 255, green: 0x64 / 255, blue: 0x60 / 255)

    static func display(_ size: CGFloat, weight: Font.Weight = .regular) -> Font { .system(size: size, weight: weight, design: .serif) }
    static func body(_ size: CGFloat = 17, weight: Font.Weight = .regular) -> Font { .system(size: size, weight: weight, design: .default) }
    static let eyebrow: Font = .system(size: 11, weight: .semibold)
}

struct Eyebrow: View {
    let text: String
    var color: Color = Theme.muted
    init(_ text: String, color: Color = Theme.muted) { self.text = text; self.color = color }
    var body: some View {
        Text(text.uppercased()).font(Theme.eyebrow).kerning(1.7).foregroundStyle(color)
    }
}

struct SectionTitle: View {
    let text: String
    var size: CGFloat = 26
    init(_ text: String, size: CGFloat = 26) { self.text = text; self.size = size }
    var body: some View { Text(text).font(Theme.display(size)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true) }
}

struct Note: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View { Text(text).font(Theme.body(13)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true) }
}

struct GlassPanel: ViewModifier {
    var padding: CGFloat = 20
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(LinearGradient(colors: [Color.white.opacity(0.78), Theme.panel.opacity(0.9)], startPoint: .topLeading, endPoint: .bottomTrailing))
            .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(Color.white.opacity(0.8), lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .shadow(color: Theme.ink.opacity(0.05), radius: 14, x: 0, y: 6)
    }
}

extension View {
    func glassPanel(padding: CGFloat = 20) -> some View { modifier(GlassPanel(padding: padding)) }
    func pageGutter() -> some View { padding(.horizontal, 16) }
}

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.body(15, weight: .semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 24).padding(.vertical, 14)
            .frame(minHeight: 48)
            .background(LinearGradient(colors: [Color(red: 0x5C / 255, green: 0x9C / 255, blue: 0xC4 / 255), Theme.accent], startPoint: .topLeading, endPoint: .bottomTrailing))
            .clipShape(Capsule())
            .opacity(configuration.isPressed ? 0.8 : 1)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.body(14, weight: .semibold))
            .foregroundStyle(Theme.ink)
            .padding(.horizontal, 20).padding(.vertical, 12)
            .frame(minHeight: 44)
            .background(Color.white.opacity(0.75))
            .overlay(Capsule().stroke(Theme.border, lineWidth: 1))
            .clipShape(Capsule())
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}

struct TextButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.body(14, weight: .semibold))
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
            .font(Theme.body(14, weight: selected ? .semibold : .regular))
            .foregroundStyle(selected ? Color.white : Theme.ink)
            .padding(.horizontal, 14).padding(.vertical, 9)
            .background(selected ? Theme.ink : Color.white.opacity(0.8))
            .overlay(Capsule().stroke(selected ? Theme.ink : Theme.border, lineWidth: 1))
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
        VStack(alignment: .leading, spacing: 4) {
            Image(systemName: icon).font(.system(size: 20, weight: .light)).foregroundStyle(Theme.accent)
            Text(value).font(Theme.body(20, weight: .semibold)).foregroundStyle(Theme.ink).lineLimit(1).minimumScaleFactor(0.7)
            Text(label).font(Theme.body(12, weight: .semibold)).foregroundStyle(Theme.ink)
            if let caption { Text(caption).font(Theme.body(11)).foregroundStyle(Theme.muted) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Theme.panel)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
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
            .background(Color.white)
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Theme.border, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}
extension View { func fieldBox() -> some View { modifier(FieldBox()) } }
