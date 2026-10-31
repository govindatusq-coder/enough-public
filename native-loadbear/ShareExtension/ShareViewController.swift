import UIKit
import UniformTypeIdentifiers
import UserNotifications

// Share to Load Bear.
//
// This extension appears in the iPhone share sheet (Messages, Messenger, WhatsApp, Mail, Safari,
// Photos, Files). It does NOT talk to the network or the AI service. It only saves what was shared
// into a shared App Group folder called "inbox". The Load Bear app picks the inbox up the next time
// it comes to the front, and the web app turns it into a task or bill as normal.
//
// Photos are shrunk and saved as JPEG (this also converts HEIC). PDFs are saved as they are.
final class ShareViewController: UIViewController {
    private let groupID = "group.au.loadbear.app"
    private let maxFiles = 5
    private let maxFileBytes = 10 * 1024 * 1024

    private let card = UIView()
    private let iconView = UIImageView()
    private let titleLabel = UILabel()
    private let detailLabel = UILabel()
    private let spinner = UIActivityIndicatorView(style: .medium)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.063, green: 0.165, blue: 0.263, alpha: 0.35)

        card.backgroundColor = UIColor(red: 1.0, green: 0.969, blue: 0.91, alpha: 1.0)
        card.layer.cornerRadius = 26
        card.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(card)

        iconView.tintColor = UIColor(red: 1.0, green: 0.318, blue: 0.278, alpha: 1.0)
        iconView.contentMode = .scaleAspectFit
        iconView.translatesAutoresizingMaskIntoConstraints = false
        iconView.isHidden = true

        titleLabel.font = .systemFont(ofSize: 20, weight: .bold)
        titleLabel.textColor = UIColor(red: 0.063, green: 0.165, blue: 0.263, alpha: 1.0)
        titleLabel.textAlignment = .center
        titleLabel.text = "Giving it to Bear…"

        detailLabel.font = .systemFont(ofSize: 15)
        detailLabel.textColor = UIColor(red: 0.063, green: 0.165, blue: 0.263, alpha: 0.7)
        detailLabel.textAlignment = .center
        detailLabel.numberOfLines = 0

        spinner.startAnimating()

        let stack = UIStackView(arrangedSubviews: [spinner, iconView, titleLabel, detailLabel])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 10
        stack.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(stack)

        NSLayoutConstraint.activate([
            card.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            card.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            card.widthAnchor.constraint(equalToConstant: 280),
            stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 26),
            stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -26),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -20),
            iconView.heightAnchor.constraint(equalToConstant: 44),
            iconView.widthAnchor.constraint(equalToConstant: 44),
        ])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        Task { @MainActor in await self.handle() }
    }

    // MARK: - Reading what was shared

    @MainActor
    private func handle() async {
        let items = (extensionContext?.inputItems as? [NSExtensionItem]) ?? []
        var texts: [String] = []
        var files: [(name: String, mime: String, data: Data)] = []
        var skipped = 0

        for item in items {
            if let title = item.attributedContentText?.string.trimmingCharacters(in: .whitespacesAndNewlines), !title.isEmpty {
                addText(title, to: &texts)
            }
            for provider in item.attachments ?? [] {
                if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
                    if files.count >= maxFiles { skipped += 1; continue }
                    if let data = await loadImage(provider) {
                        files.append(("photo-\(files.count + 1).jpg", "image/jpeg", data))
                    } else { skipped += 1 }
                } else if provider.hasItemConformingToTypeIdentifier(UTType.pdf.identifier) {
                    if files.count >= maxFiles { skipped += 1; continue }
                    if let data = await loadFileData(provider, type: UTType.pdf.identifier), data.count <= maxFileBytes {
                        files.append(("document-\(files.count + 1).pdf", "application/pdf", data))
                    } else { skipped += 1 }
                } else if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    if let url = await loadURL(provider), !url.isFileURL { addText(url.absoluteString, to: &texts) } else { skipped += 1 }
                } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    if let text = await loadText(provider) { addText(text, to: &texts) }
                } else {
                    skipped += 1
                }
            }
        }

        let text = texts.joined(separator: "\n")
        if text.isEmpty && files.isEmpty {
            finish(success: false, title: "Bear can't read that", detail: "Try sharing text, a link, a photo or a PDF.")
            return
        }
        do {
            try save(text: text, files: files)
            let note = skipped > 0 ? "Tap the Bear notification to see it. Some items could not be sent." : "Tap the Bear notification to see it."
            finish(success: true, title: "Given to Bear", detail: note)
        } catch {
            finish(success: false, title: "Bear couldn't save that", detail: "Open Load Bear once, then try sharing again.")
        }
    }

    // Many apps repeat the link inside the text, or the title inside the text. Keep each idea once.
    private func addText(_ value: String, to texts: inout [String]) {
        let v = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if v.isEmpty { return }
        if texts.contains(where: { $0.contains(v) }) { return }
        texts.removeAll(where: { v.contains($0) })
        texts.append(v)
    }

    private func loadImage(_ provider: NSItemProvider) async -> Data? {
        await withCheckedContinuation { (cont: CheckedContinuation<Data?, Never>) in
            provider.loadItem(forTypeIdentifier: UTType.image.identifier, options: nil) { item, _ in
                var image: UIImage?
                if let url = item as? URL, let data = try? Data(contentsOf: url) { image = UIImage(data: data) }
                else if let img = item as? UIImage { image = img }
                else if let data = item as? Data { image = UIImage(data: data) }
                cont.resume(returning: image.flatMap { ShareViewController.jpeg($0) })
            }
        }
    }

    private func loadFileData(_ provider: NSItemProvider, type: String) async -> Data? {
        await withCheckedContinuation { (cont: CheckedContinuation<Data?, Never>) in
            provider.loadItem(forTypeIdentifier: type, options: nil) { item, _ in
                if let url = item as? URL { cont.resume(returning: try? Data(contentsOf: url)) }
                else if let data = item as? Data { cont.resume(returning: data) }
                else { cont.resume(returning: nil) }
            }
        }
    }

    private func loadURL(_ provider: NSItemProvider) async -> URL? {
        await withCheckedContinuation { (cont: CheckedContinuation<URL?, Never>) in
            provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { item, _ in
                if let url = item as? URL { cont.resume(returning: url) }
                else if let s = item as? String { cont.resume(returning: URL(string: s)) }
                else { cont.resume(returning: nil) }
            }
        }
    }

    private func loadText(_ provider: NSItemProvider) async -> String? {
        await withCheckedContinuation { (cont: CheckedContinuation<String?, Never>) in
            provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { item, _ in
                if let s = item as? String { cont.resume(returning: s) }
                else if let a = item as? NSAttributedString { cont.resume(returning: a.string) }
                else if let d = item as? Data { cont.resume(returning: String(data: d, encoding: .utf8)) }
                else { cont.resume(returning: nil) }
            }
        }
    }

    // Shrink to at most 2000 px on the long side and save as JPEG, so uploads are small and HEIC is converted.
    private nonisolated static func jpeg(_ image: UIImage) -> Data? {
        let maxImageSide: CGFloat = 2000
        let longest = max(image.size.width, image.size.height)
        var target = image
        if longest > maxImageSide {
            let scale = maxImageSide / longest
            let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
            let format = UIGraphicsImageRendererFormat.default()
            format.scale = 1
            target = UIGraphicsImageRenderer(size: size, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
        }
        var quality: CGFloat = 0.85
        var data = target.jpegData(compressionQuality: quality)
        while let d = data, d.count > 8 * 1024 * 1024, quality > 0.4 {
            quality -= 0.15
            data = target.jpegData(compressionQuality: quality)
        }
        return data
    }

    // MARK: - Saving to the shared inbox

    private func save(text: String, files: [(name: String, mime: String, data: Data)]) throws {
        guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupID) else {
            throw NSError(domain: "LoadBear", code: 1)
        }
        let id = UUID().uuidString
        let dir = container.appendingPathComponent("inbox/\(id)", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        var listed: [[String: String]] = []
        for file in files {
            try file.data.write(to: dir.appendingPathComponent(file.name))
            listed.append(["name": file.name, "mime": file.mime])
        }
        let manifest: [String: Any] = [
            "id": id,
            "createdAt": ISO8601DateFormatter().string(from: Date()),
            "text": text,
            "files": listed,
        ]
        let json = try JSONSerialization.data(withJSONObject: manifest)
        // payload.json is written last: the app only picks up an item once this file exists.
        try json.write(to: dir.appendingPathComponent("payload.json"), options: .atomic)
    }

    // MARK: - Finishing

    @MainActor
    private func finish(success: Bool, title: String, detail: String) {
        spinner.stopAnimating()
        spinner.isHidden = true
        iconView.isHidden = false
        iconView.image = UIImage(systemName: success ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
        titleLabel.text = title
        detailLabel.text = detail
        if success {
            notifyOpenApp()
            openHostApp(URL(string: "loadbear://share")!)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + (success ? 1.1 : 1.8)) {
            self.extensionContext?.completeRequest(returningItems: nil)
        }
    }

    // iOS does not let a share extension open its app. What it does allow is a notification: tapping it
    // opens Load Bear, which then picks up the shared item. This uses the notification permission that
    // Load Bear itself asks for the first time it opens.
    private func notifyOpenApp() {
        let content = UNMutableNotificationContent()
        content.title = "Given to Bear"
        content.body = "Tap to open Load Bear and see it."
        content.interruptionLevel = .active
        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: 0.5, repeats: false)
        )
        UNUserNotificationCenter.current().add(request, withCompletionHandler: nil)
    }

    // Best effort: ask iOS to bring Load Bear to the front. Apple does not officially let a share extension
    // open its app, so this reaches the system through the responder chain at run time. If a given iOS
    // version refuses, nothing is lost: the share already worked and the app picks it up next time it opens.
    private func openHostApp(_ url: URL) {
        let modern = NSSelectorFromString("openURL:options:completionHandler:")
        let legacy = NSSelectorFromString("openURL:")
        var responder: UIResponder? = self
        while let current = responder {
            if current.responds(to: modern) {
                typealias OpenFunction = @convention(c) (AnyObject, Selector, URL, [UIApplication.OpenExternalURLOptionsKey: Any], ((Bool) -> Void)?) -> Void
                let function = unsafeBitCast(current.method(for: modern), to: OpenFunction.self)
                function(current, modern, url, [:], nil)
                return
            }
            if current.responds(to: legacy) {
                _ = current.perform(legacy, with: url)
                return
            }
            responder = current.next
        }
    }
}
