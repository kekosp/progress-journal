# "App not installed as package conflicts with an existing package"

That message is **never** a broken file. It means the app already on the phone
was signed with a different key than the new file. Android only replaces an app
in place when the package name **and the signing key** both match.

You were building two different ways (Android Studio and the GitHub cloud build).
Each one used its own automatic key, so every new file conflicted with the last.

## The fix: one key for every build

The project now uses a single signing key for **debug and release, locally and in
the cloud**. Once the phone has one build made with that key, every future build
installs as a normal update — no uninstall, data kept.

### 1. Create the key once (Android Studio)

Build → Generate Signed App Bundle or APK → APK → **Create new…**
- Key store path: `reports-keystore.jks` (save it somewhere safe, e.g. Documents)
- Alias: `reports`
- Password: pick one and write it down
- Validity: 25 years

Losing this file means the uninstall problem comes back forever. Back it up.

### 2. Point the project at it

Create a file `android/keystore.properties` (it is git-ignored, never uploaded):

```
storeFile=/absolute/path/to/reports-keystore.jks
storePassword=YOUR_PASSWORD
keyAlias=reports
keyPassword=YOUR_PASSWORD
```

Now **every** build from Android Studio — debug or release — uses that key.

### 3. Use the same key in the cloud build
Automatic: the permanent keystore is committed (`android/reports-keystore.jks`
+ `android/keystore.properties`) and the GitHub workflow signs every build with
it. No repo secrets are needed — both build paths produce identical signatures.

### 4. One last uninstall

The version currently on the phone was signed by an older/other key, so this one
switch cannot be an update:

1. In the app: Data transfer → **Export JSON**, keep the file.
2. Uninstall **Reports**.
3. Install the new build (version 6.3.2).
4. Import the JSON back.

After that, updates just work.

## Also remember

Bump both numbers for each new build — Android refuses to install an older or
equal `versionCode` over an existing one. Current: `versionName 6.3.2`,
`versionCode 60302` in `android/app/build.gradle`.
