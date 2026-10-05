package app.enough.movement;
import android.app.Activity;
import android.os.Bundle;
import android.widget.TextView;
public class PrivacyActivity extends Activity {
    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        TextView text = new TextView(this); text.setTextSize(18); text.setPadding(32,48,32,48);
        text.setText("ENOUGH movement privacy\n\nAccess is optional and read-only. ENOUGH reads steps and recorded exercise sessions to show daily movement and support your own activity check-ins.\n\nDaily summaries stay in memory. If you choose a movement check for a planned activity, its time window and totals are saved with that activity to your ENOUGH account (or the explicitly chosen local preview).\n\nNo raw health samples, heart rate or location are collected. We do not use health data for advertising. A health reading never confirms an activity automatically.\n\nDisconnect stops reads in ENOUGH. Revoke permission in Health Connect settings. Delete saved check-ins through ENOUGH account deletion. The preview requires your private Site sign-in.");
        setContentView(text);
    }
}
