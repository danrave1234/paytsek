import ExpoModulesCore
import MLKitTextRecognition
import MLKitVision
import UIKit
import ImageIO

/// On-device OCR (ML Kit Text Recognition v2) and metadata stripping for iOS.
/// Also drains images staged by the share extension in the App Group container.
public class ReceiptOcrModule: Module {
  private lazy var recognizer = TextRecognizer.textRecognizer(options: TextRecognizerOptions())

  private var appGroup: String {
    (Bundle.main.object(forInfoDictionaryKey: "PayRecordAppGroup") as? String) ?? "group.ph.payrecord.app"
  }

  public func definition() -> ModuleDefinition {
    Name("ReceiptOcr")

    AsyncFunction("recognize") { (fileUri: String, promise: Promise) in
      guard let url = URL(string: fileUri), let image = UIImage(contentsOfFile: url.path) else {
        promise.reject("OCR_FAILED", "Could not load image")
        return
      }
      let vision = VisionImage(image: image)
      vision.orientation = image.imageOrientation
      let w = max(image.size.width, 1), h = max(image.size.height, 1)
      self.recognizer.process(vision) { result, error in
        if let error = error { promise.reject("OCR_FAILED", error.localizedDescription); return }
        guard let result = result else { promise.reject("OCR_FAILED", "No result"); return }
        var blocks: [[String: Any?]] = []
        for block in result.blocks {
          for line in block.lines {
            let f = line.frame
            blocks.append([
              "text": line.text,
              "confidence": nil,
              "box": [f.origin.x / w, f.origin.y / h, f.size.width / w, f.size.height / h],
            ])
          }
        }
        promise.resolve([
          "engine": "MLKIT_TEXT_V2",
          "engineVersion": "GoogleMLKit/TextRecognition 7.x",
          "fullText": blocks.compactMap { $0["text"] as? String }.joined(separator: "\n"),
          "blocks": blocks,
          "imageWidth": Int(image.size.width),
          "imageHeight": Int(image.size.height),
        ])
      }
    }

    /// Re-encode as JPEG with orientation applied and no EXIF/GPS.
    AsyncFunction("stripMetadata") { (fileUri: String, quality: Double) -> [String: Any] in
      guard let url = URL(string: fileUri), let image = UIImage(contentsOfFile: url.path) else {
        throw Exception(name: "STRIP_FAILED", description: "Could not load image")
      }
      let normalized = image.normalizedOrientation()
      guard let data = normalized.jpegData(compressionQuality: CGFloat(min(max(quality, 0.5), 1.0))) else {
        throw Exception(name: "STRIP_FAILED", description: "Encode failed")
      }
      let out = FileManager.default.temporaryDirectory.appendingPathComponent("clean-\(Int(Date().timeIntervalSince1970 * 1000)).jpg")
      try data.write(to: out, options: .atomic)
      return ["uri": out.absoluteString, "byteLength": data.count, "contentType": "image/jpeg"]
    }

    /// Images the share extension wrote to <AppGroup>/Library/Caches/share-inbox.
    AsyncFunction("drainSharedInbox") { () -> [[String: Any]] in
      guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: self.appGroup) else { return [] }
      let inbox = container.appendingPathComponent("share-inbox", isDirectory: true)
      guard let files = try? FileManager.default.contentsOfDirectory(at: inbox, includingPropertiesForKeys: [.creationDateKey]) else { return [] }
      var out: [[String: Any]] = []
      for f in files where ["jpg", "jpeg", "png", "heic"].contains(f.pathExtension.lowercased()) {
        let dest = FileManager.default.temporaryDirectory.appendingPathComponent(f.lastPathComponent)
        try? FileManager.default.removeItem(at: dest)
        if (try? FileManager.default.moveItem(at: f, to: dest)) != nil {
          let created = (try? f.resourceValues(forKeys: [.creationDateKey]).creationDate) ?? Date()
          let ext = f.pathExtension.lowercased()
          let type = ext == "png" ? "image/png" : ext == "heic" ? "image/heic" : "image/jpeg"
          out.append(["uri": dest.absoluteString, "contentType": type, "receivedAt": ISO8601DateFormatter().string(from: created)])
        }
      }
      return out
    }
  }
}

extension UIImage {
  func normalizedOrientation() -> UIImage {
    if imageOrientation == .up { return self }
    let renderer = UIGraphicsImageRenderer(size: size)
    return renderer.image { _ in draw(in: CGRect(origin: .zero, size: size)) }
  }
}
