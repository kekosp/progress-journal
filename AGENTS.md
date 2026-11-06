# Project Rules

- Android signing: never commit the permanent keystore or passwords; GitHub Actions reads them from repository secrets, while local builds use ignored `android/keystore.properties`. Both must use the same existing key to preserve in-place updates; never regenerate it, and bump versionCode/versionName for each build.
