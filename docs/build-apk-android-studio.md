# Build the APK with Android Studio (local build)

This guide replaces the cloud GitHub Actions workflow with a local build using Android Studio. The project is already a Capacitor native Android project, so you build from the `android/` folder.

## What you need before you start

1. **A computer** (Windows, macOS, or Linux).
2. **Android Studio** — download the latest stable version from https://developer.android.com/studio.
3. **Git** — to pull the project from GitHub.
4. **Node.js LTS** — v20 or later recommended. Download from https://nodejs.org.
5. A USB cable to transfer the APK to your phone, or use email/cloud drive.

---

## Step 1: Get the project on your computer

1. Open a terminal (Command Prompt / PowerShell on Windows, Terminal on macOS/Linux).
2. Clone your GitHub repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   cd YOUR_REPO_NAME
   ```
   Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your actual GitHub details.
3. Pull the latest changes if you already have the repo:
   ```bash
   git pull
   ```

---

## Step 2: Install web dependencies

In the project root folder (the one containing `package.json`), run:

```bash
npm install
```

Wait until it finishes. This installs all the web-side packages (React, Capacitor, etc.).

---

## Step 3: Sync the web code into the native Android project

This is the important Capacitor step. It copies your built web app into `android/app/src/main/assets/public` and installs any native plugins.

```bash
npx cap sync android
```

You must run this every time you:
- Pull new code from GitHub.
- Change `capacitor.config.ts`.
- Add or update a Capacitor plugin (camera, barcode, filesystem, etc.).

---

## Step 4: Open the project in Android Studio

1. Launch Android Studio.
2. Choose **Open**.
3. Select the `android` folder inside the project (not the project root).
   - Example path: `YOUR_REPO_NAME/android`
4. Wait for Android Studio to finish syncing. This may take a few minutes the first time because it downloads Gradle and the Android SDK.

---

## Step 5: Build a debug APK (fastest for testing)

1. In Android Studio, make sure the top-left dropdown shows **app**.
2. Click **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
3. Wait for the build to finish.
4. A small popup appears at the bottom-right when done. Click **locate**.

The APK file is at:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

Transfer this file to your phone and install it.

---

## Step 6: Build a release APK (for sharing/publishing)

A release APK must be signed with a keystore. If you do not sign it, Android will not install it as an update over an existing version.

### Create a keystore (one time only)

1. In Android Studio, click **Build → Generate Signed App Bundle or APK**.
2. Select **APK**, click **Next**.
3. Click **Create new…** under **Key store path**.
4. Fill in the form:
   - **Key store path:** choose a safe folder and name it `reports-keystore.jks`.
   - **Password:** choose a strong password and remember it.
   - **Alias:** `reports`.
   - **Key password:** use the same as the keystore password for simplicity.
   - **Validity:** 25 years.
   - Fill in at least one name field.
5. Click **OK**.

### Build the signed release APK

1. In the same dialog, choose the keystore you just created.
2. Enter the passwords.
3. Select the `release` build type.
4. Click **Finish**.
5. Wait for the build.

The signed APK is at:

```
android/app/build/outputs/apk/release/app-release.apk
```

Keep the `reports-keystore.jks` file safe. If you lose it, you will never be able to update the app in place again.

---

## Step 7: Install the APK on your phone

### Option A: USB cable

1. Connect your phone to the computer with a USB cable.
2. On the phone, allow file transfer when prompted.
3. Copy the APK file to the phone’s Downloads folder.
4. On the phone, open the Files app, tap the APK, and install.
5. If you see **“Install unknown apps”**, allow it for your Files app.

### Option B: Email or cloud drive

1. Send the APK to yourself via email, WhatsApp, or upload it to Google Drive / Dropbox.
2. Download it on your phone.
3. Open the downloaded file and install.

---

## Important: signature conflict / “App not installed”

If you already have an old version of the app on your phone and you see **“App not installed”**, it means the existing app was signed with a different key.

- **Debug APKs** are signed with a temporary debug key from Android Studio.
- **Release APKs** are signed with your own keystore.
- The old app on your phone may have been signed by a different builder (for example the earlier Median wrapper build).

### To fix it once

1. Export your data from the old app: **Data transfer → Export JSON**.
2. Uninstall the old app.
3. Install the new APK.
4. Import your JSON back.

### To avoid it forever

Always sign release builds with the **same keystore**. Then every future version installs as a normal update and your data stays intact.

---

## Step 8: After every code update

Whenever you pull new code from GitHub or change native features, repeat these commands in the project root:

```bash
git pull
npm install
npx cap sync android
```

Then in Android Studio:

```
Build → Build Bundle(s) / APK(s) → Build APK(s)
```

---

## Troubleshooting

| Problem | Cause | Fix |
| --- | --- | --- |
| Build fails with SDK not found | Android SDK is not installed | Open Android Studio → SDK Manager → install the SDK platforms and build-tools |
| Gradle sync fails | Wrong Java version | In Android Studio: Settings → Build → Gradle → set Gradle JDK to JDK 17 or 21 |
| `npx cap sync` fails | Node modules missing | Run `npm install` first |
| App installs but crashes | Native plugins out of sync | Run `npx cap sync android` again |
| “App not installed” | Signature mismatch | See the signature section above |

---

## Summary

1. `git pull`
2. `npm install`
3. `npx cap sync android`
4. Open `android/` in Android Studio.
5. Build → Build APK(s) or Generate Signed APK.
6. Transfer the APK to your phone and install.

For a release build you can update in place, create one keystore and reuse it forever.
