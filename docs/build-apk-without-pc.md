# Build the APK v6.3.1 from your phone (no PC needed)

The app version is set to **6.3.1** (`versionCode 60301`) and GitHub builds the APK for you in the cloud.

## One-time setup
1. In Lovable, use **GitHub → Connect / Export to GitHub** so the project lives in your own GitHub repo.

## Every time you want an APK
1. Open your repo on your phone browser (github.com).
2. Go to the **Actions** tab → **Build Android APK**.
3. Tap **Run workflow**, keep `6.3.1` / `60301` (bump both for later versions), tap the green **Run workflow** button.
4. Wait ~5–10 minutes for the green check.
5. Two ways to get the file:
   - **Releases tab** → `Reports v6.3.1` → download `reports-v6.3.1.apk` (easiest on a phone), or
   - open the workflow run → **Artifacts** → `reports-v6.3.1-apk` (downloads as a .zip).
6. Open the downloaded APK, allow "Install unknown apps" for your browser/files app, and install.

## Signing
The workflow generates a keystore in CI so the APK is installable. To keep the **same signature across
versions** (required to update in place instead of uninstalling), add a repo secret
`KEYSTORE_PASSWORD`, or better, store a fixed keystore as a base64 secret and load it instead of
generating one. Without a fixed keystore, each build has a new signature and Android will ask you to
uninstall the previous version first.

## Notes
- Screenshot blocking (FLAG_SECURE) is compiled in — verified by the `android-flag-secure` workflow.
- The APK is fully offline; it does not point at the Lovable preview URL.
- Google Play requires an `.aab` (`./gradlew bundleRelease`) and a permanent keystore.