package in.co.meenaagencies.pharmasys;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

@CapacitorPlugin(name = "InvoicePdfOpener")
public class InvoicePdfOpener extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        String data = call.getString("data");
        String fileName = call.getString("fileName", "invoice.pdf");
        boolean isText = "text/plain".equals(call.getString("mimeType"));
        if (data == null || data.isEmpty()) {
            call.reject("Invoice PDF is empty.");
            return;
        }
        fileName = fileName.replaceAll("[^A-Za-z0-9._-]", "_");
        String extension = isText ? ".txt" : ".pdf";
        if (!fileName.endsWith(extension)) fileName += extension;

        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            if (!isText && (bytes.length < 5 || bytes[0] != '%' || bytes[1] != 'P' || bytes[2] != 'D' || bytes[3] != 'F' || bytes[4] != '-')) {
                call.reject("The server did not return a valid PDF.");
                return;
            }
            File file = new File(getContext().getCacheDir(), fileName);
            try (FileOutputStream output = new FileOutputStream(file)) {
                output.write(bytes);
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, isText ? "text/plain" : "application/pdf");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException error) {
            call.reject(isText ? "No text viewer is available on this device." : "No PDF viewer is available on this device.");
        } catch (IOException | IllegalArgumentException error) {
            call.reject("Unable to open invoice PDF.", error);
        }
    }

}
