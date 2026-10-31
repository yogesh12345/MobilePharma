import Capacitor
import UIKit

@objc(InvoicePdfOpener)
public class InvoicePdfOpener: CAPPlugin, CAPBridgedPlugin, UIDocumentInteractionControllerDelegate {
    public let identifier = "InvoicePdfOpener"
    public let jsName = "InvoicePdfOpener"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)
    ]

    private var documentController: UIDocumentInteractionController?

    @objc func open(_ call: CAPPluginCall) {
        guard let base64 = call.getString("data"),
              let data = Data(base64Encoded: base64),
              data.starts(with: Data("%PDF-".utf8)) else {
            call.reject("The server did not return a valid PDF.")
            return
        }

        let requestedName = call.getString("fileName") ?? "invoice.pdf"
        let safeName = requestedName.replacingOccurrences(of: "[^A-Za-z0-9._-]", with: "_", options: .regularExpression)
        let fileName = safeName.hasSuffix(".pdf") ? safeName : safeName + ".pdf"
        let fileURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)

        do {
            try data.write(to: fileURL, options: .atomic)
        } catch {
            call.reject("Unable to save invoice PDF.", nil, error)
            return
        }

        DispatchQueue.main.async {
            let controller = UIDocumentInteractionController(url: fileURL)
            controller.uti = "com.adobe.pdf"
            controller.delegate = self
            self.documentController = controller
            if controller.presentPreview(animated: true) {
                call.resolve()
            } else {
                call.reject("No PDF viewer is available on this device.")
            }
        }
    }

    public func documentInteractionControllerViewControllerForPreview(_ controller: UIDocumentInteractionController) -> UIViewController {
        return bridge?.viewController ?? UIViewController()
    }
}
