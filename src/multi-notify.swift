import AppKit
import Foundation

class AppDelegate: NSObject, NSApplicationDelegate {
    var panels: [NSPanel] = []
    var dismissTimer: Timer?
    var config = Config()

    struct Config {
        var title    = "Notification"
        var subtitle = ""
        var message  = ""
        var iconPath: String? = nil
        var duration: Double  = 10.0
        var urlString: String? = nil
        var activateBundle: String? = nil
        var openPath: String? = nil   // file path to open with activateBundle app
    }

    func applicationDidFinishLaunching(_ n: Notification) {
        NSScreen.screens.forEach { showPanel(on: $0) }
        dismissTimer = Timer.scheduledTimer(withTimeInterval: config.duration, repeats: false) { [weak self] _ in
            self?.quit()
        }
    }

    private func showPanel(on screen: NSScreen) {
        let W: CGFloat = 344
        let H: CGFloat = 84
        let margin: CGFloat = 18

        let origin = CGPoint(
            x: screen.visibleFrame.maxX - W - margin,
            y: screen.visibleFrame.maxY - H - margin
        )
        let panel = NSPanel(
            contentRect: CGRect(origin: origin, size: CGSize(width: W, height: H)),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        panel.level = .floating
        panel.isOpaque = false
        panel.hasShadow = true
        panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary]
        panel.backgroundColor = .clear

        // Container with rounded corners
        let content = NSView(frame: CGRect(x: 0, y: 0, width: W, height: H))
        content.wantsLayer = true
        content.layer?.cornerRadius = 13
        content.layer?.masksToBounds = true
        content.layer?.backgroundColor = NSColor(
            calibratedRed: 0.13, green: 0.13, blue: 0.14, alpha: 0.96
        ).cgColor

        var textX: CGFloat = 14

        // Icon image
        if let path = config.iconPath, let img = NSImage(contentsOfFile: path) {
            let side: CGFloat = 44
            let iv = NSImageView(frame: CGRect(x: 14, y: (H - side) / 2, width: side, height: side))
            iv.image = img
            iv.imageScaling = .scaleProportionallyUpOrDown
            iv.wantsLayer = true
            iv.layer?.cornerRadius = 8
            iv.layer?.masksToBounds = true
            content.addSubview(iv)
            textX = 68
        }

        // Title
        content.addSubview(makeLabel(
            config.title, x: textX, y: H - 27, w: W - textX - 12, h: 17,
            size: 13, bold: true, color: .white
        ))

        // Subtitle (optional)
        var msgY: CGFloat = 13
        if !config.subtitle.isEmpty {
            content.addSubview(makeLabel(
                config.subtitle, x: textX, y: H - 44, w: W - textX - 12, h: 14,
                size: 11, bold: false, color: NSColor(white: 0.6, alpha: 1)
            ))
            msgY = H - 62
        }

        // Message body
        content.addSubview(makeLabel(
            config.message, x: textX, y: msgY, w: W - textX - 12, h: 15,
            size: 12, bold: false, color: NSColor(white: 0.78, alpha: 1)
        ))

        // Click anywhere to act
        let click = NSClickGestureRecognizer(target: self, action: #selector(handleClick))
        content.addGestureRecognizer(click)

        panel.contentView = content
        panel.orderFrontRegardless()
        panels.append(panel)
    }

    private func makeLabel(
        _ s: String, x: CGFloat, y: CGFloat, w: CGFloat, h: CGFloat,
        size: CGFloat, bold: Bool, color: NSColor
    ) -> NSTextField {
        let f = NSTextField(labelWithString: s)
        f.frame = CGRect(x: x, y: y, width: w, height: h)
        f.textColor = color
        f.font = bold ? .boldSystemFont(ofSize: size) : .systemFont(ofSize: size)
        f.lineBreakMode = .byTruncatingTail
        return f
    }

    @objc func handleClick() {
        if let urlStr = config.urlString, let url = URL(string: urlStr) {
            NSWorkspace.shared.open(url)
        } else if let bundle = config.activateBundle {
            // For PyCharm: call the focus-project plugin endpoint (silent HTTP call).
            // This raises the correct project window and opens its Terminal tool window.
            // Falls back to plain app activation if the plugin isn't installed.
            if bundle == "com.jetbrains.pycharm", let openPath = config.openPath {
                let encoded = openPath.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? openPath
                if let url = URL(string: "http://localhost:63342/focus-project?path=\(encoded)") {
                    var req = URLRequest(url: url, timeoutInterval: 3)
                    req.httpMethod = "GET"
                    let sem = DispatchSemaphore(value: 0)
                    URLSession.shared.dataTask(with: req) { _, resp, _ in
                        sem.signal()
                        // 200 → plugin handled it; anything else → fall through to activate below
                    }.resume()
                    let timedOut = sem.wait(timeout: .now() + 3) == .timedOut
                    if !timedOut {
                        // Plugin responded — it's handling the window focus
                        quit()
                        return
                    }
                }
            }
            // Fallback: plain app activate
            if let running = NSRunningApplication.runningApplications(withBundleIdentifier: bundle).first {
                running.activate(options: .activateIgnoringOtherApps)
            } else if let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundle) {
                NSWorkspace.shared.open(url)
            }
        }
        quit()
    }

    private func quit() {
        dismissTimer?.invalidate()
        panels.forEach { $0.close() }
        NSApp.terminate(nil)
    }
}

func parseArgs() -> AppDelegate.Config {
    var c = AppDelegate.Config()
    var args = Array(CommandLine.arguments.dropFirst())
    var i = 0
    while i < args.count {
        let key = args[i]
        let hasVal = i + 1 < args.count
        switch key {
        case "--title":    if hasVal { c.title    = args[i+1]; i += 2 }
        case "--subtitle": if hasVal { c.subtitle = args[i+1]; i += 2 }
        case "--message":  if hasVal { c.message  = args[i+1]; i += 2 }
        case "--icon":     if hasVal { c.iconPath = args[i+1]; i += 2 }
        case "--duration": if hasVal { c.duration = Double(args[i+1]) ?? 10.0; i += 2 }
        case "--url":       if hasVal { c.urlString      = args[i+1]; i += 2 }
        case "--activate":  if hasVal { c.activateBundle = args[i+1]; i += 2 }
        case "--open-path": if hasVal { c.openPath       = args[i+1]; i += 2 }
        default: i += 1
        }
    }
    return c
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let delegate = AppDelegate()
delegate.config = parseArgs()
app.delegate = delegate
app.run()
