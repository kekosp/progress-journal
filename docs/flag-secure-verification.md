# FLAG_SECURE Verification (screenshots & recent-apps preview)

Date: 2026-08-16

## What was checked

FLAG_SECURE is applied process-wide by
`android/app/src/main/java/app/lovable/k541b7c83680c47fe8dfc25833fe24b42/SecureApplication.java`,
registered as `android:name=".SecureApplication"` on `<application>`. It uses
`registerActivityLifecycleCallbacks` to set
`WindowManager.LayoutParams.FLAG_SECURE` on **every** activity at
created/started/resumed — covering `MainActivity` and any plugin-launched
activity (camera, file picker, barcode scanner, browser/OAuth, crop dialogs).
`MainActivity` re-asserts the flag as a fallback.

Because the project has a single `main` source set and a single
`AndroidManifest.xml` (no `src/debug` or `src/release` overrides, no product
flavors in `app/build.gradle`), this applies to **all build variants**.

## Static verification of the release APK in the repo (`app-release.apk`)

The APK was decompiled (apktool) and inspected:

| Check | Result |
| --- | --- |
| Manifest package | `co.median.android.mbznoyk` (NOT `app.lovable.k541b7c83680c47fe8dfc25833fe24b42`) |
| Main activity | `co.median.android.MainActivity` (Median/GoNative wrapper, not Capacitor `BridgeActivity`) |
| `Window.setFlags` / `addFlags` call | none found |
| `FLAG_SECURE` constant (`0x2000`) | not present in any smali class |

**Conclusion: the `app-release.apk` currently committed in the project was NOT
built from this Capacitor source. It is a Median web-wrapper build and it does
not contain FLAG_SECURE, so it does not block screenshots or recent-apps
previews.** The protection only takes effect after rebuilding the app from the
`android/` Capacitor project in this repo.

## How to produce a protected release APK

```bash
npm install
npm run build
npx cap sync android
cd android && ./gradlew assembleRelease
# output: android/app/build/outputs/apk/release/app-release.apk
```

Re-run the static check on the new APK:

```bash
apktool d -f -o /tmp/apkout app/build/outputs/apk/release/app-release.apk
grep -R "0x2000" /tmp/apkout/smali*/app/lovable/*/MainActivity.smali
grep -R "Landroid/view/Window;->setFlags" /tmp/apkout/smali*/app/lovable/*/MainActivity.smali
```
Both greps must return a match.

## On-device manual test procedure

Requires a physical device or emulator (not available in this build sandbox — no
adb/emulator/JDK toolchain here, so runtime confirmation could not be executed).

1. Install the freshly built release APK: `adb install -r app-release.apk`.
2. Open the app on any screen (Reports list, report detail with photos, Vault).
3. **Screenshot test** — press Power+VolumeDown, or run
   `adb shell input keyevent 120`. Expected: a system toast such as
   *"Can't take screenshot due to security policy"* and no file created in
   `/sdcard/Pictures/Screenshots`. Verify with
   `adb shell ls -t /sdcard/Pictures/Screenshots | head`.
4. **Screen recording test** — start the system screen recorder while the app is
   in the foreground. Expected: the app area records as a black frame.
5. **Recent-apps preview test** — press the Recents/Overview button. Expected:
   the app card shows a blank/black thumbnail, not the last screen.
6. **adb screencap test** — `adb exec-out screencap -p > /tmp/shot.png`.
   Expected: the app window area is black.
7. Repeat step 3 on at least one screen inside the Credential Vault and one
   report detail with an open image lightbox.

Record pass/fail per step, plus device model and Android version.

## Known limitations

- FLAG_SECURE is Android-only; the Lovable web preview and any browser build are
  not protected and cannot be.
- It does not stop a second camera photographing the screen.
- Some rooted devices / custom ROMs can bypass FLAG_SECURE.
## Automated CI enforcement

`.github/workflows/android-flag-secure.yml` runs on every push to `main`, every
pull request, and every release. It builds **all** Android variants
(`./gradlew assemble`) and runs `scripts/verify-flag-secure.sh` against each
produced APK. The scan fails the build unless every APK contains:

1. `android:name=...SecureApplication` in the packaged manifest (`aapt2 dump xmltree`)
2. the `SecureApplication` class in `classes*.dex` (`dexdump -d`)
3. a call to `Landroid/view/Window;->setFlags`
4. the `FLAG_SECURE` constant `0x2000`
5. `registerActivityLifecycleCallbacks` (proves process-wide, not MainActivity-only)

Run the same check locally:

```bash
cd android && ./gradlew assemble && cd ..
./scripts/verify-flag-secure.sh android/app/build/outputs/apk/**/*.apk
```
