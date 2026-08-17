# Test Plan — Screenshot Blocking on Deep Links & Plugin/Intent Screens

Scope: verify that `FLAG_SECURE` (applied process-wide by `SecureApplication`)
blocks screenshots, screen recording, and recent-apps previews on **every**
window the app can show in a **release** build — including screens launched by
Capacitor plugins and by external intents/deep links.

Applies to: `android/` Capacitor project, `assembleRelease` output.
Not applicable to: the Lovable web preview or any browser build (FLAG_SECURE is
Android-only).

## 0. Preconditions

| Item | Requirement |
| --- | --- |
| Build | Freshly built release APK from this repo (`npm run build && npx cap sync android && cd android && ./gradlew assembleRelease`) |
| CI gate | `.github/workflows/android-flag-secure.yml` green for the same commit |
| Devices | At least 2: one Android 11–13, one Android 14+ |
| Tools | `adb`, system screen recorder, a second phone/camera for the negative control |
| App state | App unlocked (PIN/password entered), at least 1 report with photos, 1 inventory item with photos, 1 vault entry with an image |

Install: `adb install -r android/app/build/outputs/apk/release/app-release.apk`

Confirm the installed package is the Capacitor build, not a wrapper:

```bash
adb shell pm path app.lovable.k541b7c83680c47fe8dfc25833fe24b42
```

## 1. Test methods (used by every case below)

| ID | Method | Pass criteria |
| --- | --- | --- |
| M1 | Hardware screenshot: `adb shell input keyevent 120` (or Power+VolDown) | System toast "Can't take screenshot due to security policy"; no new file in `/sdcard/Pictures/Screenshots` (`adb shell ls -t /sdcard/Pictures/Screenshots \| head`) |
| M2 | `adb exec-out screencap -p > /tmp/shot.png` | App window area is fully black |
| M3 | System screen recording while screen is in foreground | App area records as black frames |
| M4 | Recents/Overview button | App card thumbnail is blank/black, not the last screen |
| M5 | Negative control: photograph the screen with a second camera | Content visible — confirms the screen itself is not blank and M1–M4 are real blocks |

Every case is PASS only if M1, M2, M3 and M4 all pass and M5 confirms content
was actually on screen.

## 2. Cases — in-app screens (baseline)

| # | Screen | How to reach | Methods |
| --- | --- | --- | --- |
| A1 | Lock screen (PIN/password entry) | Cold start, before unlock | M1–M4 |
| A2 | Reports list | Default tab after unlock | M1–M5 |
| A3 | Report detail with photos | Open any report with attachments | M1–M5 |
| A4 | Report photo lightbox (zoomed, fullscreen) | Tap a photo, pinch to zoom, toggle fullscreen | M1–M5 |
| A5 | Report form / image annotator | Edit report → annotate a photo | M1–M4 |
| A6 | Signature pad | Report form → capture signature | M1–M4 |
| A7 | Inventory list + item detail dialog | Inventory tab → open an item | M1–M5 |
| A8 | Inventory photo lightbox (custody + return photos) | Item detail → tap photo | M1–M5 |
| A9 | Credential Vault list (secrets visible) | Vault tab, reveal a credential | M1–M5 |
| A10 | Vault image attachment lightbox | Vault entry → tap image thumbnail | M1–M5 |
| A11 | Admin gate + Activity Log | Triple-tap "Reports" title → log in | M1–M4 |
| A12 | Analytics dashboard | Analytics tab | M1–M4 |
| A13 | Maintenance calendar | Calendar tab | M1–M4 |
| A14 | PDF export dialog & post-export share sheet | Report → Export → Export PDF → Share | M1–M4 (see §4 for the share sheet caveat) |

## 3. Cases — plugin / intent-launched screens

These run in **separate activities**, some in the app's own process
(covered by `SecureApplication`) and some in a **different app's process**
(NOT coverable — record as N/A with the rationale).

| # | Screen | Launcher | Process | Expected |
| --- | --- | --- | --- | --- |
| B1 | Barcode/QR scanner (`html5-qrcode` in the WebView) | Inventory form → Scan | App process, same activity | Blocked (M1–M4) |
| B2 | Torch on during scan | B1 + torch toggle | Same as B1 | Blocked |
| B3 | Camera permission prompt | First camera use after `adb shell pm revoke ... android.permission.CAMERA` | System UI overlay | Underlying app window blocked; the system dialog itself is OS-owned — record observed behaviour |
| B4 | `@capacitor/camera` native capture activity | Inventory/report photo → Take photo | App process (Capacitor camera activity) | Blocked (M1–M4) |
| B5 | Third-party camera app, if the device routes capture to one | Same as B4 on a device with a default camera app | **Other app's process** | N/A — out of this app's control; document which devices do this |
| B6 | Gallery / document picker (`ACTION_GET_CONTENT`) | Photo field → Choose from gallery | Usually system Photos/Files process | N/A — OS-owned; verify that returning to the app is immediately blocked again |
| B7 | Share sheet after PDF/CSV export | Export → Share | System share UI | N/A for the sheet; app window behind it must be blocked |
| B8 | External browser / Custom Tab, if ever opened | Any external link | Browser process | N/A |
| B9 | Return-to-app after any B3–B8 | Press Back from the external screen | App process | Blocked again immediately (re-assert via `onActivityStarted`/`onActivityResumed`) |

For every N/A row, the required evidence is B9: after returning, the app window
is blocked again with no unprotected frame in Recents.

## 4. Cases — deep links & cold/warm entry points

`MainActivity` is `launchMode="singleTask"`. Each entry must be protected from
the **very first frame**, including before the WebView has rendered.

| # | Entry point | Command / action | Expected |
| --- | --- | --- | --- |
| C1 | Launcher icon, cold start | Force-stop then tap icon | Splash + first frame blocked (M2 immediately after launch, M4) |
| C2 | Explicit intent, cold start | `adb shell am start -n app.lovable.k541b7c83680c47fe8dfc25833fe24b42/.MainActivity` | Blocked |
| C3 | Explicit intent, warm start (app already in Recents) | Repeat C2 without force-stop | Blocked |
| C4 | `VIEW` intent to the app's host, if/when a deep link filter is added | `adb shell am start -a android.intent.action.VIEW -d "<url>"` | Blocked. If no `VIEW` filter exists today, record "no deep link filters declared" as the result and re-run this case whenever one is added |
| C5 | Notification tap (service-due reminder) | Trigger a service-due reminder, tap the notification | App opens on the target screen, blocked |
| C6 | Recents resume | Switch away, resume from Recents | Blocked, and the Recents card itself was blank (M4) |
| C7 | Rotation / multi-window / split screen | Rotate, then enter split-screen | Still blocked in both panes' app area |
| C8 | Process death restore | `adb shell am kill <pkg>` while backgrounded, then resume | Blocked on the restored first frame |

## 5. Automated pre-check (run before manual testing)

```bash
./scripts/verify-flag-secure.sh android/app/build/outputs/apk/release/app-release.apk
```

Must print `RESULT: PASSED`. A failure here means manual testing is pointless —
fix the build first.

Runtime spot check that the flag is live on the current window:

```bash
adb shell dumpsys window windows | grep -A 20 "app.lovable.k541b7c83680c47fe8dfc25833fe24b42"
```

Look for `FLAG_SECURE` in the window flags of each app window while it is in the
foreground. Repeat this while the barcode scanner (B1) and the native camera
(B4) are open — this is the fastest way to catch a plugin activity that missed
the flag.

## 6. Results template

| Case | Device / Android version | M1 | M2 | M3 | M4 | M5 | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | | | | | | | |
| ... | | | | | | | |

Record the build's git commit SHA and APK SHA-256
(`sha256sum app-release.apk`) at the top of every results sheet.

## 7. Exit criteria

- All A* and B1/B2/B4/B9 cases PASS on both test devices.
- All C* cases PASS, with C4 either PASS or explicitly recorded as "no deep link
  filters declared".
- Every N/A row (B3, B5–B8) has a documented rationale plus a passing B9.
- `scripts/verify-flag-secure.sh` PASSED for the exact APK tested.

## 8. Known limitations

- FLAG_SECURE cannot protect windows owned by other processes (system share
  sheet, gallery picker, third-party camera apps, browsers).
- It does not stop a second camera photographing the screen (M5 is a control,
  not a failure).
- Some rooted devices and custom ROMs can bypass FLAG_SECURE.
- Accessibility services with screen-capture privileges may still read content
  on some OEM builds.
