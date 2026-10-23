import SwiftUI
import PhotosUI

/// "Your moments": confirmed moves with optional private photos
/// (`components/wins-gallery.tsx`). Photos need a cloud account.
struct WinsGallery: View {
    let now: Date
    @Binding var day: String?
    let onAddWin: () -> Void
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation
    @State private var photos: [ActivityPhoto] = []
    @State private var status = "loading"
    @State private var error = ""
    @State private var view: MomentFilter = .all
    @State private var display = "Moments"
    @State private var query = ""
    @State private var limit = 12
    @State private var showUpload = false
    @State private var selectedPhoto: ActivityPhoto?

    private var entries: [Entry] { Wins.confirmed(store.state.entries, now: now) }
    private var matching: [Entry] { Wins.filterMoments(store.state.entries, filter: view, query: query, generated: store.state.generated ?? [], day: day, now: now) }
    private var visible: [ActivityPhoto] { let ids = Set(matching.map(\.id)); return store.cloud ? photos.filter { ids.contains($0.entry_id) } : [] }

    private func clearFilters() { view = .all; query = ""; limit = 12; day = nil }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) { Eyebrow("Your moments"); SectionTitle("The little things, kept.") }
            HStack {
                Button { showUpload = true } label: { Label("Add photos", systemImage: "camera") }.buttonStyle(.secondary).disabled(!store.cloud || entries.isEmpty)
                Button { onAddWin() } label: { Label("Add a win", systemImage: "plus") }.buttonStyle(.primary)
            }
            Note("All confirmed moves · Private to you.")
            HStack {
                Picker("Moments display", selection: $display) { Text("Moments").tag("Moments"); Text("Photos").tag("Photos") }.pickerStyle(.segmented)
            }
            HStack { Image(systemName: "magnifyingglass").foregroundStyle(Theme.muted); TextField("Search your moves…", text: $query).onChange(of: query) { _, _ in limit = 12 } }.fieldBox()
            ChipRow(items: MomentFilter.allCases, label: { $0.rawValue }, selected: { $0 == view }, pick: { view = $0; limit = 12 })
            if let day {
                HStack { Text("Moments on \(dayLabel(day))").font(Theme.body(13)).foregroundStyle(Theme.ink); Spacer(); Button("Show every day") { self.day = nil }.buttonStyle(.text) }
            }
            Text(display == "Moments" ? "\(matching.count) confirmed \(matching.count == 1 ? "moment" : "moments")" : "\(visible.count) private \(visible.count == 1 ? "photo" : "photos")").font(Theme.body(13)).foregroundStyle(Theme.muted)
            if display == "Moments" { moments } else { photoTiles }
            if status == "error" { Button("Try loading photos again") { Task { await load() } }.buttonStyle(.text) }
            AlertText(error)
        }
        .glassPanel()
        .task(id: store.cloud) { await load() }
        .sheet(isPresented: $showUpload) { PhotoUploadSheet(entries: entries) { photo in photos.insert(photo, at: 0); display = "Photos"; clearFilters() } }
        .sheet(item: $selectedPhoto) { photo in PhotoLightbox(photo: photo, photos: visible) { removed in photos.removeAll { $0.id == removed } } }
    }

    private func dayLabel(_ day: String) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        return f.date(from: day).map { $0.formatted(date: .long, time: .omitted) } ?? day
    }

    private func load() async {
        guard store.cloud else { photos = []; status = "local"; return }
        status = "loading"
        do { photos = try await store.api.photos(); status = "ready"; error = "" } catch { status = "error"; self.error = error.localizedDescription }
    }

    @ViewBuilder private var moments: some View {
        if matching.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: "camera").font(.system(size: 26, weight: .light)).foregroundStyle(Theme.accent)
                Text(entries.isEmpty ? "Your story starts with a moment." : "No moments with those filters.").font(Theme.body(16, weight: .semibold)).foregroundStyle(Theme.ink)
                Text(entries.isEmpty ? "After trying an idea, confirm what happened in My Moves. Your real returns will appear here." : "Try another word, day or filter.").font(Theme.body(13)).foregroundStyle(Theme.muted)
                Button(entries.isEmpty ? "Find a move to try" : "Clear search and filters") { entries.isEmpty ? onAddWin() : clearFilters() }.buttonStyle(.secondary)
            }
        } else {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                ForEach(matching.prefix(limit)) { e in momentCard(e) }
                Button { onAddWin() } label: {
                    VStack(spacing: 6) { Image(systemName: "plus").font(.system(size: 24, weight: .light)); Text("Keep another moment.").font(Theme.body(13, weight: .semibold)); Text("Try an idea, then tell us what happened.").font(Theme.body(11)).foregroundStyle(Theme.muted) }
                        .foregroundStyle(Theme.ink).frame(maxWidth: .infinity, minHeight: 180).padding(8)
                        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Theme.border, style: StrokeStyle(lineWidth: 1, dash: [5])))
                }
                .buttonStyle(.plain)
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
                    ZStack(alignment: .bottomLeading) {
                        if let memory { RemoteImage(path: "/api/photos?id=\(memory.id)") }
                        else if let image = idea?.image { SceneImage(name: image) }
                        else { SceneImage(name: idea.map(Discovery.cover) ?? "welcome-coast") }
                    }
                    HStack(spacing: 4) {
                        if memories.count > 1 { Label("\(memories.count)", systemImage: "photo.on.rectangle").font(Theme.body(11)).padding(4).background(.ultraThinMaterial).clipShape(Capsule()) }
                        if e.worthwhile == true { Image(systemName: "heart.fill").font(.system(size: 12)).foregroundStyle(Theme.warm).padding(5).background(.ultraThinMaterial).clipShape(Circle()).accessibilityLabel("You said this was worthwhile") }
                    }
                    .padding(6)
                }
                .frame(height: 120).clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityLabel((memory != nil ? "View photo: " : "See outcome: ") + (memory?.caption.isEmpty == false ? memory!.caption : (idea?.title ?? "Your confirmed move")))
            Text(idea?.title ?? "Your confirmed move").font(Theme.body(13, weight: .semibold)).foregroundStyle(Theme.ink).lineLimit(2)
            Text(Wins.momentDateLabel(e.completedAt ?? "", now: now)).font(Theme.body(11)).foregroundStyle(Theme.muted)
            HStack(spacing: 8) { Label("\(e.minutes ?? 0) min", systemImage: "figure.walk"); Label(Regions.formatMoney(e.moneyCents ?? 0, currency: e.currency, country: store.profile.country), systemImage: "wallet.pass") }.font(Theme.body(11)).foregroundStyle(Theme.ink)
            Text(memory?.caption.isEmpty == false ? "“\(memory!.caption)”" : e.worthwhile == true ? "Worthwhile for you." : "Not worthwhile this time.").font(Theme.body(11)).foregroundStyle(Theme.muted).lineLimit(2)
            Button("View outcome") { navigation.openOutcome(e.id) }.buttonStyle(.text)
        }
    }

    @ViewBuilder private var photoTiles: some View {
        if status == "loading" && store.cloud { ProgressView("Loading your photos…") }
        else if visible.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: "camera").font(.system(size: 26, weight: .light)).foregroundStyle(Theme.accent)
                Text("A private place for your photos.").font(Theme.body(16, weight: .semibold)).foregroundStyle(Theme.ink)
                Text(!store.cloud ? "Sign in and keep your ENOUGH profile to save activity photos." : entries.isEmpty ? "Your photos will appear here after you confirm a move." : matching.isEmpty ? "No photos match these filters." : "Keep a photo from one of your confirmed moves.").font(Theme.body(13)).foregroundStyle(Theme.muted)
                if store.cloud && !entries.isEmpty { Button(matching.isEmpty ? "Clear search and filters" : "Add photos") { matching.isEmpty ? clearFilters() : (showUpload = true) }.buttonStyle(.secondary) }
            }
        } else {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 6) {
                ForEach(visible) { p in
                    Button { selectedPhoto = p } label: {
                        RemoteImage(path: "/api/photos?id=\(p.id)").frame(height: 110).clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("View photo: \(p.caption.isEmpty ? (entries.first { $0.id == p.entry_id }.map { store.state.idea($0.ideaId).title } ?? "") : p.caption)")
                }
            }
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
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Add activity photos").font(Theme.display(28)).foregroundStyle(Theme.ink)
                    Text("Save a moment to a confirmed move. Ask permission before uploading photos of other people.").font(Theme.body(14)).foregroundStyle(Theme.muted)
                    LabeledPicker(label: "Activity", selection: $entryId, options: entries.map { ($0.id, "\(store.state.idea($0.ideaId).title) · \($0.completedDate.map { $0.formatted(date: .numeric, time: .omitted) } ?? "")") })
                    PhotosPicker(selection: $items, maxSelectionCount: 12, matching: .images) { Label("Choose photos", systemImage: "photo.on.rectangle") }.buttonStyle(.secondary).disabled(busy)
                    if let preview { Image(uiImage: preview).resizable().scaledToFit().frame(maxHeight: 220).clipShape(RoundedRectangle(cornerRadius: 12)).accessibilityLabel("First selected photo preview") }
                    FieldLabel("Caption", optional: true)
                    TextField("A moment you’d like to remember", text: $caption).fieldBox().onChange(of: caption) { _, v in if v.count > 200 { caption = String(v.prefix(200)) } }
                    Note("\(items.count) selected · Up to 12 photos per move. Photos are resized and location metadata is removed.")
                    if !store.synced { Text("Wait for your confirmed outcome to finish saving before uploading.").font(Theme.body(13)).foregroundStyle(Theme.ink) }
                    AlertText(error)
                    Button(busy ? "Saving photos…" : "Save photos") { Task { await send() } }.buttonStyle(.primary).disabled(busy || !store.synced || items.isEmpty || entryId.isEmpty)
                }
                .padding(16)
            }
            .background(Theme.paper)
            .onAppear { entryId = entries.first?.id ?? "" }
            .onChange(of: items) { _, picked in Task { if let first = picked.first, let data = try? await first.loadTransferable(type: Data.self) { preview = UIImage(data: data) } else { preview = nil } } }
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Cancel") { dismiss() }.disabled(busy) } }
        }
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
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                Text(entry.map { store.state.idea($0.ideaId).title } ?? "Your photo").font(Theme.display(24)).foregroundStyle(Theme.ink)
                Text("\(index + 1) of \(photos.count) · Private activity photos").font(Theme.body(13)).foregroundStyle(Theme.muted)
                TabView(selection: $index) {
                    ForEach(Array(photos.enumerated()), id: \.element.id) { i, p in
                        RemoteImage(path: "/api/photos?id=\(p.id)").frame(maxWidth: .infinity).clipShape(RoundedRectangle(cornerRadius: 14)).tag(i).accessibilityLabel(p.caption.isEmpty ? "Photo from your activity" : p.caption)
                    }
                }
                .tabViewStyle(.page)
                .frame(height: 360)
                if !current.caption.isEmpty { Text(current.caption).font(Theme.body(14)).foregroundStyle(Theme.ink) }
                if let people = entry?.companions, !people.isEmpty { Text("With \(people.map(\.name).joined(separator: ", "))").font(Theme.body(13)).foregroundStyle(Theme.muted) }
                if confirmDelete {
                    Text("Remove this photo permanently?").font(Theme.body(14)).foregroundStyle(Theme.ink)
                    HStack { Button(busy ? "Removing…" : "Remove photo") { Task { await remove() } }.buttonStyle(.secondary).disabled(busy); Button("Keep photo") { confirmDelete = false }.buttonStyle(.text) }
                } else {
                    Button("Remove this photo") { confirmDelete = true }.buttonStyle(.text)
                }
                AlertText(error)
                Spacer()
            }
            .padding(16).background(Theme.paper)
            .onAppear { index = photos.firstIndex { $0.id == photo.id } ?? 0 }
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } } }
        }
    }

    private func remove() async {
        busy = true; error = ""
        defer { busy = false }
        do { try await store.api.deletePhoto(id: current.id); onDeleted(current.id); dismiss() } catch { self.error = error.localizedDescription }
    }
}
