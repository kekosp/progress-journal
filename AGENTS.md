# Project Rules

- Android signing: `android/reports-keystore.jks` + `android/keystore.properties` are committed on purpose so GitHub Actions builds and Android Studio builds always sign with the SAME permanent key — otherwise every rebuild shows "App not installed" (signature mismatch) and needs a reinstall. Never regenerate these files or gitignore them; bump versionCode/versionName (defaults also in `.github/workflows/build-apk.yml` inputs) for each build.
