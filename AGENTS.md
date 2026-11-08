# Project Rules

- Android signing: release APKs use only the existing key from GitHub Actions secrets; missing or invalid secrets must stop release builds, with no generated or local-key fallback. Never regenerate or change the key or Git history without user approval; bump versionCode/versionName for each release build.
