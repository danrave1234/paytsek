import UIKit
import UniformTypeIdentifiers

/// Minimal iOS share extension: copies the shared image into the App Group
/// staging container (share-inbox) and opens the main app, which drains the
/// inbox on resume. No network, no OCR, no credentials in the extension.
final class ShareViewController: UIViewController {
  private let appGroup = (Bundle.main.object(forInfoDictionaryKey: "PayTsekAppGroup") as? String) ?? "group.ph.paytsek.app"

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .clear
    handleShare()
  }

  private func handleShare() {
    guard let items = extensionContext?.inputItems as? [NSExtensionItem] else { return finish() }
    let group = DispatchGroup()
    var saved = 0
    for item in items {
      for provider in item.attachments ?? [] where provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
        group.enter()
        provider.loadFileRepresentation(forTypeIdentifier: UTType.image.identifier) { url, _ in
          defer { group.leave() }
          guard let url = url else { return }
          if self.stage(url) { saved += 1 }
        }
      }
    }
    group.notify(queue: .main) {
      if saved > 0 { self.openApp() }
      self.finish()
    }
  }

  private func stage(_ url: URL) -> Bool {
    guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else { return false }
    let inbox = container.appendingPathComponent("share-inbox", isDirectory: true)
    try? FileManager.default.createDirectory(at: inbox, withIntermediateDirectories: true)
    let ext = url.pathExtension.isEmpty ? "jpg" : url.pathExtension
    let dest = inbox.appendingPathComponent("\(UUID().uuidString).\(ext)")
    return (try? FileManager.default.copyItem(at: url, to: dest)) != nil
  }

  private func openApp() {
    guard let url = URL(string: "paytsek://scan?source=share") else { return }
    var responder: UIResponder? = self
    while let r = responder {
      if let app = r as? UIApplication { app.open(url); return }
      responder = r.next
    }
  }

  private func finish() {
    extensionContext?.completeRequest(returningItems: nil)
  }
}
