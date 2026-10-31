package in.co.meenaagencies.pharmasys;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(InvoicePdfOpener.class);
        super.onCreate(savedInstanceState);
    }
}
