package app.lovable.k541b7c83680c47fe8dfc25833fe24b42;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Belt-and-braces: SecureApplication already applies FLAG_SECURE to every
        // activity in the process; re-assert it here for the main window.
        SecureApplication.applySecureFlag(this);
    }
}
