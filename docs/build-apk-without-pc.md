# Build the APK from GitHub (no PC needed)

GitHub builds the APK for you. Before running the workflow, make sure the four
Android signing secrets in `docs/install-update-fix.md` are configured.

## One-time setup
1. In Lovable, use **GitHub → Connect / Export to GitHub** so the project lives in your own GitHub repo.

## Every time you want an APK
1. Open your repo on your phone browser (github.com).
2. Go to the **Actions** tab → **Build Android APK**.
3. Tap **Run workflow**, use the version shown by the workflow (increase both values for each later build), then tap the green **Run workflow** button.
4. Wait ~5–10 minutes for the green check.
5. Two ways to get the file:
   - **Releases tab** → `Reports v6.3.1` → download `reports-v6.3.1.apk` (easiest on a phone), or
   - open the workflow run → **Artifacts** → `reports-v6.3.1-apk` (downloads as a .zip).
6. Open the downloaded APK, allow "Install unknown apps" for your browser/files app, and install.

## "App not installed" when opening the APK
This is a **signature conflict**, not a broken APK. An app with the same package name
(`app.lovable.k541b7c83680c47fe8dfc25833fe24b42`) is already on the phone — for example the older
Median-wrapper build — and it was signed with a different key.

Android only allows an in-place update when the new APK has the **same package id and the same
signing key** as the installed app. The app currently on your phone was produced by a different
builder with a key we don't have, so that very first switch cannot be an update — it must be a
one-time uninstall:

1. Export your data first (Data transfer → Export JSON) and keep the file.
2. Uninstall the existing **Reports** app.
3. Install `reports-v6.3.1.apk`, then import your JSON back.

After that one migration, every future build installs as a normal update (no uninstall, data kept) —
GitHub Actions signs each build with the same permanent key stored in repository secrets.

Other causes to check if it still fails:
- The download was incomplete → re-download from the **Releases** tab.
- "Install unknown apps" is not allowed for your browser/files app → enable it when prompted.
- Not enough free storage.

## Keep the same signature (so future versions update in place)
The workflow uses the permanent key saved as GitHub repository Actions secrets.
For local Android Studio builds, use the same key in an ignored local
`android/keystore.properties` file. Never create a new key for an update.
See `docs/install-update-fix.md` for secret names and the public-repository
security warning.

## Notes
- Screenshot blocking (FLAG_SECURE) is compiled in — verified by the `android-flag-secure` workflow.
- The APK is fully offline; it does not point at the Lovable preview URL.
- Google Play requires an `.aab` (`./gradlew bundleRelease`) and a permanent keystore.