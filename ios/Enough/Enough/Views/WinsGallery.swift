import SwiftUI
import PhotosUI

/// "Your moments": confirmed moves with optional private photos
/// (`components/wins-gallery.tsx`). Photos need an account.
struct WinsGallery: View {
    let now: Date
    @Binding var photos: [ActivityPhoto]
    let onAddWin: () -> Void
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation
    @State private var status = "loading"
    @State private var error = ""
    @State private var view: MomentFilter = .all
    @State private var query = ""
    @State private var limit = 12
    @State private var showUpload = false
    @State private var selectedPhoto: ActivityPhoto?

    private var entries: [Entry] { Wins.confirmed(store.state.entries, now: now) }
    private var matching: [Entry] { Wins.filterMoments(store.state.entries, filter: view, query: query, generated: store.state.generated ?? [], day: nil, now: now) }
    private var visible: [ActivityPhoto] { let ids = Set(matching.map(\.id)); return store.cloud ? photos.filter { ids.contains($0.entry_id) } : [] }

    private func clearFilters() { view = .all; query = ""; limit = 12 }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) { Eyebrow("Your moments"); SectionTitle("The little things, kept.") }
            if entries.isEmpty {
                Text("After trying an idea, say what happened in My Moves. It is kept here, with a photo if you like.").font(Theme.body(14)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
            } else {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass").foregroundStyle(Theme.muted).accessibilityHidden(true)
                    TextField("Search your moments…", text: $query).onChange(of: query) { _, _ in limit = 12 }
                }
                .fieldBox()
                ChipRow(items: MomentFilter.allCases, label: { $0.rawValue }, selected: { $0 == view }, pick: { view = $0; limit = 12 })
                Text("\(matching.count) \(matching.count == 1 ? "moment" : "moments")\(visible.isEmpty ? "" : " · \(visible.count) \(visible.count == 1 ? "photo" : "photos")")").font(Theme.body(13)).foregroundStyle(Theme.muted)
                moments
                if store.cloud { Button("Add photos") { showUpload = true }.buttonStyle(.secondary) }
                else { Note("Sign in to keep photos with your moments.") }
            }
            if status == "error" { Button("Try loading photos again") { Task { await load() } }.buttonStyle(.text) }
            AlertText(error)
        }
        .glassPanel()
        .task(id: store.cloud) { await load() }
        .sheet(isPresented: $showUpload) { PhotoUploadSheet(entries: entries) { photo in photos.insert(photo, at: 0); clearFilters() } }
        .sheet(item: $selectedPhoto) { photo in PhotoLightbox(photo: photo, photos: visible) { removed in photos.removeAll { $0.id == removed } } }
    }

    private func load() async {
        guard store.cloud else { photos = []; status = "local"; return }
        status = "loading"
        do { photos = try await store.api.photos(); status = "ready"; error = "" } catch { status = "error"; self.error = error.localizedDescription }
    }

    @ViewBuilder private var moments: some View {
        if matching.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("No moments with those filters.").font(Theme.body(15, weight: .medium)).foregroundStyle(Theme.ink)
                Button("Clear search and filters") { clearFilters() }.buttonStyle(.text)
            }
        } else {
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 14) {
                ForEach(matching.prefix(limit)) { e in momentCard(e) }
            }
            if matching.count > limit { Button("Show more moments") { limit += 12 }.buttonStyle(.secondary) }
        }
    }

    private func momentCard(_ e: Entry) -> some View {
        let idea = Catalogue.byId(e.ideaId, generated: store.state.generated ?? [])
        let memories = store.cloud ? photos.filter { $0.entry_id == e.id } : []
        let memory = memories.first
        return VStack(alignment: .leading, spacing: 4) {
            Button { if let memory { selectedPhoto = memory } else { navigation.openOutcome(e.id) } } label: {
                ZStack(alignment: .topTrailing) {
                    if let memory { RemoteImage(path: "/api/photos?id=\(memory.id)") }
                    else if let idea { IdeaPicture(idea: idea) }
                    else { SceneImage(name: "welcome-coast") }
                    HStack(spacing: 4) {
                        if memories.count > 1 { Badge("\(memories.count) photos") }
                        if e.worthwhile == true { Image(systemName: "heart.fill").font(.system(size: 12)).foregroundStyle(Theme.clay).padding(5).background(.ultraThinMaterial).clipShape(Circle()).accessibilityLabel("Worthwhile") }
                    }
                    .padding(6)
                }
                .frame(height: 120).clipShape(RoundedRectangle(cornerRadius: Theme.Radius.field, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityLabel((memory != nil ? "Photo: " : "Moment: ") + (memory?.caption.isEmpty == false ? memory!.caption : (idea?.title ?? "Your move")))
            Text(idea?.title ?? "Your move").font(Theme.body(13, weight: .medium)).foregroundStyle(Theme.ink).lineLimit(2)
            Text("\(Wins.momentDateLabel(e.completedAt ?? "", now: now)) · \(e.minutes ?? 0) min · \(Regions.formatMoney(e.moneyCents ?? 0, currency: e.currency, country: store.profile.country))").font(Theme.body(11)).foregroundStyle(Theme.muted).lineLimit(2)
            if memory?.caption.isEmpty == false { Text("“\(memory!.caption)”").font(Theme.body(11)).foregroundStyle(Theme.muted).lineLimit(2) }
            Button("See outcome") { navigation.openOutcome(e.id) }.buttonStyle(.text)
        }
    }
}

/// Add activity photos to a confirmed move. Photos are resized, re-encoded as
/// JPEG and lose their location metadata before upload, as on the website.
struct PhotoUploadSheet: View {
    let entries: [Entry]
    let onSaved: (ActivityPhoto) -> Void
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var entryId = ""
    @State private var caption = ""
    @State private var items: [PhotosPickerItem] = []
    @State private var busy = false
    @State private var error = ""
    @State private var preview: UIImage?

    var body: some View {
        SheetFrame(title: "Add photos", kicker: "Your moments", doneLabel: "Cancel") {
            Text("Keep a photo with a moment. Ask before adding photos of other people.").font(Theme.body(14)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
            LabeledPicker(label: "Moment", selection: $entryId, options: entries.map { ($0.id, "\(store.state.idea($0.ideaId).title) · \($0.completedDate.map { $0.formatted(date: .numeric, time: .omitted) } ?? "")") })
            PhotosPicker(selection: $items, maxSelectionCount: 12, matching: .images) { Text(items.isEmpty ? "Choose photos" : "Choose different photos") }.buttonStyle(.secondary).disabled(busy)
            if let preview { Image(uiImage: preview).resizable().scaledToFit().frame(maxHeight: 220).clipShape(RoundedRectangle(cornerRadius: Theme.Radius.field, style: .continuous)).accessibilityLabel("First selected photo") }
            FieldLabel("Caption", optional: true)
            TextField("A moment you’d like to remember", text: $caption).fieldBox().onChange(of: caption) { _, v in if v.count > 200 { caption = String(v.prefix(200)) } }
            Note("\(items.count) selected · up to 12 per moment. Photos are resized and location details are removed.")
            if !store.synced { Note("Wait for your changes to finish saving before adding photos.") }
            AlertText(error)
            Button(busy ? "Saving photos…" : "Keep these photos") { Task { await send() } }.buttonStyle(.primary).disabled(busy || !store.synced || items.isEmpty || entryId.isEmpty)
        }
        .onAppear { entryId = entries.first?.id ?? "" }
        .onChange(of: items) { _, picked in Task { if let first = picked.first, let data = try? await first.loadTransferable(type: Data.self) { preview = UIImage(data: data) } else { preview = nil } } }
        .interactiveDismissDisabled(busy)
    }

    private func send() async {
        busy = true; error = ""
        defer { busy = false }
        var done = 0
        do {
            for item in items {
                guard let data = try await item.loadTransferable(type: Data.self), let image = UIImage(data: data) else { throw EnoughError.message("Choose a JPEG, PNG, HEIC or WebP photo.") }
                let jpeg = try PhotoUploadSheet.prepare(image)
                let photo = try await store.api.uploadPhoto(entryId: entryId, caption: caption, jpeg: jpeg)
                done += 1
                onSaved(photo)
            }
            dismiss()
        } catch {
            self.error = "\(done > 0 ? "\(done) photo\(done == 1 ? "" : "s") saved. " : "")\(error.localizedDescription)"
        }
    }

    /// Longest side 1600px, JPEG quality 0.82, under 2 MB (the website's `preparePhoto`).
    static func prepare(_ image: UIImage) throws -> Data {
        let longest = max(image.size.width, image.size.height)
        let scale = min(1, 1600 / longest)
        let size = CGSize(width: (image.size.width * scale).rounded(), height: (image.size.height * scale).rounded())
        let format = UIGraphicsImageRendererFormat.default(); format.scale = 1
        let resized = UIGraphicsImageRenderer(size: size, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
        guard let data = resized.jpegData(compressionQuality: 0.82) else { throw EnoughError.message("Could not prepare the photo.") }
        guard data.count <= 2 * 1024 * 1024 else { throw EnoughError.message("The prepared photo is too large. Choose a smaller version.") }
        return data
    }
}

/// A swipeable private photo viewer with delete.
struct PhotoLightbox: View {
    let photo: ActivityPhoto
    let photos: [ActivityPhoto]
    let onDeleted: (String) -> Void
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var index = 0
    @State private var confirmDelete = false
    @State private var busy = false
    @State private var error = ""

    private var current: ActivityPhoto { photos.indices.contains(index) ? photos[index] : photo }
    private var entry: Entry? { store.state.entries.first { $0.id == current.entry_id } }

    var body: some View {
        SheetFrame(title: entry.map { store.state.idea($0.ideaId).title } ?? "Your photo", kicker: "\(index + 1) of \(photos.count) · private") {
            TabView(selection: $index) {
                ForEach(Array(photos.enumerated()), id: \.element.id) { i, p in
                    RemoteImage(path: "/api/photos?id=\(p.id)").frame(maxWidth: .infinity).clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous)).tag(i).accessibilityLabel(p.caption.isEmpty ? "Photo from your moment" : p.caption)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .frame(height: 360)
            if !current.caption.isEmpty { Text(current.caption).font(Theme.body(14)).foregroundStyle(Theme.ink) }
            if let people = entry?.companions, !people.isEmpty { Text("With \(people.map(\.name).joined(separator: ", "))").font(Theme.body(13)).foregroundStyle(Theme.muted) }
            if confirmDelete {
                Text("Remove this photo for good?").font(Theme.body(14)).foregroundStyle(Theme.ink)
                HStack(spacing: 16) { Button(busy ? "Removing…" : "Remove photo") { Task { await remove() } }.buttonStyle(.secondary).disabled(busy); Button("Keep it") { confirmDelete = false }.buttonStyle(.text) }
            } else {
                Button("Remove this photo") { confirmDelete = true }.buttonStyle(.text)
            }
            AlertText(error)
        }
        .onAppear { index = photos.firstIndex { $0.id == photo.id } ?? 0 }
    }

    private func remove() async {
        busy = true; error = ""
        defer { busy = false }
        do { try await store.api.deletePhoto(id: current.id); onDeleted(current.id); dismiss() } catch { self.error = error.localizedDescription }
    }
}
