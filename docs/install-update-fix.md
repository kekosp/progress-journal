# Keep Android updates installable

Android accepts an update only when the package ID and signing key match the
installed app. Keep using the same permanent keystore for every build; never
create a replacement key unless you are prepared for a one-time uninstall and
data restore.

## GitHub Actions signing setup

Before running **Build Android APK**, add these four repository Actions secrets
in GitHub under **Settings → Secrets and variables → Actions**:

| Secret name | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded bytes of the existing `reports-keystore.jks` file |
| `ANDROID_KEYSTORE_PASSWORD` | Existing keystore password |
| `ANDROID_KEY_ALIAS` | Existing key alias |
| `ANDROID_KEY_PASSWORD` | Existing key password |

Do not paste these values into chat, issues, workflow files, or committed files.
The workflow restores the keystore only for the build and removes the temporary
file afterward. If any secret is missing, the build stops with a clear error.

For local Android Studio builds, keep the same keystore outside the repository
and create an ignored `android/keystore.properties` file with:

```properties
storeFile=../reports-keystore.jks
storePassword=<existing keystore password>
keyAlias=<existing alias>
keyPassword=<existing key password>
```

Keep a secure offline backup of the keystore. GitHub Actions secrets cannot be
downloaded later, and losing the key prevents future in-place updates.

## Important security note

The repository was public while signing files were committed, so moving them to
Actions secrets protects future builds but does not erase copies from Git
history or existing clones. The requested same key is retained to avoid breaking
updates. Anyone who copied the old public files may still have signing material;
making the repository private and removing the old files from repository history
reduces further exposure, but cannot revoke copies already downloaded.

## If the phone says “App not installed”

1. Confirm the new APK was built with the four secrets above and the same package.
2. Confirm the version code is higher than the installed version.
3. If the installed app was signed with a different key, export its data, uninstall
   it once, install the new APK, and import the data again.

After the phone has a build signed with the permanent key, later builds using that
same key install as normal updates.