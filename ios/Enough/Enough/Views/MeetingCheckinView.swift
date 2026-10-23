import SwiftUI
import AVFoundation
import CoreImage.CIFilterBuiltins

/// "Who joined you?": voluntary name exchanges by QR or by typing
/// (`components/meeting-checkin.tsx`).
struct MeetingCheckinView: View {
    let entryId: String
    @EnvironmentObject private var store: AppStore
    @State private var open = false
    @State private var myName = ""
    @State private var qr: UIImage?
    @State private var manual = ""
    @State private var candidate = ""
    @State private var error = ""
    @State private var scanning = false

    private var entry: Entry? { store.state.entries.first { $0.id == entryId } }
    private var people: [Companion] { entry?.companions ?? [] }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack { Text("Who joined you?").font(Theme.body(14, weight: .medium)).foregroundStyle(Theme.ink); Spacer(); Button(open ? "Close check-in" : "Add a name / scan QR") { open.toggle(); scanning = false }.buttonStyle(.text) }
            if !people.isEmpty {
                FlowLayout(spacing: 6) {
                    ForEach(people) { p in
                        HStack(spacing: 4) {
                            VStack(alignment: .leading, spacing: 0) { Text(p.name).font(Theme.body(13, weight: .semibold)); Text(p.source == .qr ? "QR check-in" : "Added by you").font(Theme.body(10)).foregroundStyle(Theme.muted) }
                            Button { store.updateEntry(entryId) { $0.companions = people.filter { $0.id != p.id } } } label: { Image(systemName: "xmark").font(.system(size: 10, weight: .bold)) }.accessibilityLabel("Remove \(p.name)")
                        }
                        .foregroundStyle(Theme.ink).padding(.horizontal, 10).padding(.vertical, 6).background(Theme.mist).clipShape(Capsule())
                    }
                }
            }
            if open {
                Text("Ask before keeping someone’s name. A first name or nickname is enough. These notes stay private.").font(Theme.body(13)).foregroundStyle(Theme.muted)
                Button(scanning ? "Stop camera" : "Scan their QR") { scanning.toggle(); error = "" }.buttonStyle(.secondary)
                if scanning {
                    QRScannerView { raw in
                        do { candidate = try MeetingCode.read(raw); error = ""; scanning = false } catch { self.error = error.localizedDescription }
                    } onError: { message in error = message; scanning = false }
                    .frame(height: 240).clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous)).accessibilityLabel("QR scanning camera")
                }
                if !candidate.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Did you meet \(candidate) during this activity?").font(Theme.body(14)).foregroundStyle(Theme.ink)
                        HStack { Button("Yes, add to this move") { add(candidate, .qr) }.buttonStyle(.primary); Button("Cancel") { candidate = "" }.buttonStyle(.text) }
                    }
                }
                FieldLabel("Or add their name")
                HStack { TextField("First name or nickname", text: $manual).fieldBox(); Button("Add name") { add(manual, .manual) }.buttonStyle(.secondary) }
                DisclosureGroup("Show my name QR") {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Let someone scan your chosen name. This code contains only that name; it does not open your profile.").font(Theme.body(13)).foregroundStyle(Theme.muted)
                        FieldLabel("Name to share"); TextField("", text: $myName).fieldBox().onChange(of: myName) { _, _ in qr = nil }
                        Button("Show QR") { do { qr = MeetingCheckinView.qrImage(try MeetingCode.make(name: myName)); error = "" } catch { self.error = error.localizedDescription } }.buttonStyle(.secondary)
                        if let qr { Image(uiImage: qr).interpolation(.none).resizable().scaledToFit().frame(width: 220, height: 220).accessibilityLabel("Name QR for \(myName)") }
                    }
                    .padding(.top, 6)
                }
                .font(Theme.body(14, weight: .medium)).foregroundStyle(Theme.ink).tint(Theme.ink)
                Note("QR check-ins are voluntary name exchanges, not verified identity or proof of location. They do not send invitations or count a completed move.")
                AlertText(error)
            }
        }
        .onAppear { myName = store.profile.name }
    }

    private func add(_ name: String, _ source: CompanionSource) {
        do {
            let next = try MeetingCode.add(people, name: name, source: source)
            store.updateEntry(entryId) { $0.companions = next }
            candidate = ""; manual = ""; error = ""
        } catch { self.error = error.localizedDescription }
    }

    static func qrImage(_ text: String) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(text.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 8, y: 8)), let cg = CIContext().createCGImage(output, from: output.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}

/// A rear-camera QR reader built on AVFoundation.
struct QRScannerView: UIViewControllerRepresentable {
    let onCode: (String) -> Void
    let onError: (String) -> Void

    func makeUIViewController(context: Context) -> ScannerController {
        let controller = ScannerController()
        controller.onCode = onCode
        controller.onError = onError
        return controller
    }
    func updateUIViewController(_ controller: ScannerController, context: Context) {}

    final class ScannerController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
        var onCode: ((String) -> Void)?
        var onError: ((String) -> Void)?
        private let session = AVCaptureSession()
        private var preview: AVCaptureVideoPreviewLayer?

        override func viewDidLoad() {
            super.viewDidLoad()
            view.backgroundColor = .black
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                DispatchQueue.main.async {
                    if granted { self?.configure() } else { self?.onError?("The camera could not open. Check permission in Settings, or add their name instead.") }
                }
            }
        }

        private func configure() {
            guard let device = AVCaptureDevice.default(for: .video), let input = try? AVCaptureDeviceInput(device: device), session.canAddInput(input) else { onError?("Camera scanning is unavailable. Add their name instead."); return }
            session.addInput(input)
            let output = AVCaptureMetadataOutput()
            guard session.canAddOutput(output) else { onError?("Camera scanning is unavailable. Add their name instead."); return }
            session.addOutput(output)
            output.setMetadataObjectsDelegate(self, queue: .main)
            output.metadataObjectTypes = [.qr]
            let layer = AVCaptureVideoPreviewLayer(session: session)
            layer.videoGravity = .resizeAspectFill
            layer.frame = view.bounds
            view.layer.addSublayer(layer)
            preview = layer
            DispatchQueue.global(qos: .userInitiated).async { [session] in session.startRunning() }
        }

        override func viewDidLayoutSubviews() { super.viewDidLayoutSubviews(); preview?.frame = view.bounds }
        override func viewWillDisappear(_ animated: Bool) { super.viewWillDisappear(animated); if session.isRunning { session.stopRunning() } }

        func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
            guard let object = metadataObjects.first as? AVMetadataMachineReadableCodeObject, let value = object.stringValue else { return }
            session.stopRunning()
            onCode?(value)
        }
    }
}
