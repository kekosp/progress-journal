package app.lovable.k541b7c83680c47fe8dfc25833fe24b42;

import android.app.Activity;
import android.app.Application;
import android.os.Bundle;
import android.view.WindowManager;

/**
 * Applies FLAG_SECURE to EVERY activity in the process, not just MainActivity.
 *
 * Capacitor plugins (camera, file picker, barcode, OAuth/browser, crop, etc.)
 * launch their own activities. Setting the flag only on MainActivity would
 * leave those screens screenshot-able. Registering a process-wide
 * ActivityLifecycleCallbacks guarantees the flag is set before any activity
 * becomes visible, for every build variant (debug and release share this
 * single main source set / manifest).
 */
public class SecureApplication extends Application {

    @Override
    public void onCreate() {
        super.onCreate();

        registerActivityLifecycleCallbacks(new ActivityLifecycleCallbacks() {
            @Override
            public void onActivityCreated(Activity activity, Bundle savedInstanceState) {
                applySecureFlag(activity);
            }

            @Override
            public void onActivityStarted(Activity activity) {
                // Re-assert in case an activity or plugin cleared the flag.
                applySecureFlag(activity);
            }

            @Override
            public void onActivityResumed(Activity activity) {
                applySecureFlag(activity);
            }

            @Override
            public void onActivityPaused(Activity activity) { }

            @Override
            public void onActivityStopped(Activity activity) { }

            @Override
            public void onActivitySaveInstanceState(Activity activity, Bundle outState) { }

            @Override
            public void onActivityDestroyed(Activity activity) { }
        });
    }

    static void applySecureFlag(Activity activity) {
        if (activity == null || activity.getWindow() == null) {
            return;
        }
        activity.getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        );
    }
}