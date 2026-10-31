import Capacitor

class InvoicePdfBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(InvoicePdfOpener())
    }
}
