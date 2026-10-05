package app.enough.movement;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(EnoughMovementPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
