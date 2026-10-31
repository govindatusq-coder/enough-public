import UIKit
import Capacitor
import WebKit
import UserNotifications

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)

        // Lets the Share Extension tell you "Given to Bear" and lets Bear's reminders reach you. Asked once.
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
        // loadbear://share is what the Share Extension uses to bring the app to the front.
        ShareInbox.deliver(from: window)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    // Whenever Load Bear comes to the front, hand anything shared to it over to the web app.
    func sceneDidBecomeActive(_ scene: UIScene) {
        ShareInbox.deliver(from: window)
    }
}

/// Picks up what the Share Extension saved in the shared App Group "inbox" and gives it to the web app,
/// which turns it into a task or bill. An item is only deleted once the web app has accepted it, and the
/// hand-over is retried for up to 20 seconds in case the page is still loading.
enum ShareInbox {
    static let groupID = "group.au.loadbear.app"
    private static var busy = false

    static func deliver(from window: UIWindow?, attempt: Int = 0) {
        if attempt == 0 {
            if busy { return }
            busy = true
        }
        guard let root = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupID)?
                .appendingPathComponent("inbox", isDirectory: true),
              let ids = try? FileManager.default.contentsOfDirectory(atPath: root.path)
        else { busy = false; return }

        // Oldest first; an item only counts once its payload.json exists.
        let ready = ids.sorted().filter { FileManager.default.fileExists(atPath: root.appendingPathComponent($0).appendingPathComponent("payload.json").path) }
        guard let id = ready.first else { busy = false; return }
        let dir = root.appendingPathComponent(id, isDirectory: true)

        guard let raw = try? Data(contentsOf: dir.appendingPathComponent("payload.json")),
              var json = try? JSONSerialization.jsonObject(with: raw) as? [String: Any]
        else { try? FileManager.default.removeItem(at: dir); busy = false; return }

        var files: [[String: Any]] = []
        for entry in (json["files"] as? [[String: Any]]) ?? [] {
            if let name = entry["name"] as? String, let data = try? Data(contentsOf: dir.appendingPathComponent(name)) {
                files.append(["name": name, "mime": entry["mime"] ?? "application/octet-stream", "b64": data.base64EncodedString()])
            }
        }
        json["files"] = files
        guard let body = try? JSONSerialization.data(withJSONObject: json), let literal = String(data: body, encoding: .utf8) else {
            try? FileManager.default.removeItem(at: dir); busy = false; return
        }

        let script = "(function(){try{return window.__bearShare?window.__bearShare(\(literal)):false;}catch(e){return false;}})()"
        let retry = {
            if attempt < 20 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 1) { deliver(from: window, attempt: attempt + 1) }
            } else { busy = false }
        }
        guard let web = (window?.rootViewController as? CAPBridgeViewController)?.bridge?.webView else { retry(); return }
        web.evaluateJavaScript(script) { result, _ in
            DispatchQueue.main.async {
                if (result as? Bool) == true {
                    try? FileManager.default.removeItem(at: dir)
                    busy = false
                    deliver(from: window) // any further items waiting
                } else {
                    retry()
                }
            }
        }
    }
}
