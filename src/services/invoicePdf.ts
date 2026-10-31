import { Capacitor, registerPlugin } from "@capacitor/core";
import API from "./api";

type PdfOpener = {
  open(options: { data: string; fileName: string }): Promise<void>;
};

const pdfOpener = registerPlugin<PdfOpener>("InvoicePdfOpener");

export async function openInvoicePdf(invoiceId: number, invoiceYear: number): Promise<void> {
  // Open the browser tab during the button event so popup blockers do not block it.
  const tab = Capacitor.getPlatform() === "web" ? window.open("", "_blank") : null;
  try {
    const response = await API.get(`/mobile/customer-portal/invoices/${invoiceId}/pdf`, {
      params: { invoiceYear },
      responseType: "blob",
      timeout: 120000,
    });
    const pdf = new Blob([response.data], { type: "application/pdf" });
    const fileName = `sales-invoice-${invoiceYear}-${invoiceId}.pdf`;

    if (Capacitor.isNativePlatform()) {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",", 2)[1] || "");
        reader.onerror = () => reject(new Error("Unable to read invoice PDF."));
        reader.readAsDataURL(pdf);
      });
      await pdfOpener.open({ data, fileName });
      return;
    }

    const url = URL.createObjectURL(pdf);
    if (tab) {
      tab.location.href = url;
    } else {
      window.open(url, "_blank");
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    tab?.close();
    throw error;
  }
}
