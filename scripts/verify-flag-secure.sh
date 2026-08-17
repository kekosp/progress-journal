#!/usr/bin/env bash
# Bytecode-scan an Android build artifact (APK) to confirm that screenshot
# blocking (SecureApplication + FLAG_SECURE) is compiled into the binary.
#
# Usage: scripts/verify-flag-secure.sh <path-to-apk> [more.apk ...]
#
# Requires Android SDK build-tools on PATH (aapt2, dexdump) — present on
# GitHub-hosted runners via android-actions/setup-android.
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: $0 <apk> [apk ...]" >&2
  exit 2
fi

fail=0

for apk in "$@"; do
  echo "=============================================================="
  echo "Scanning: $apk"
  echo "=============================================================="

  if [ ! -f "$apk" ]; then
    echo "  FAIL: file not found"
    fail=1
    continue
  fi

  work="$(mktemp -d)"
  trap 'rm -rf "$work"' EXIT

  # ---- 1. Manifest must register the SecureApplication class -------------
  manifest="$(aapt2 dump xmltree --file AndroidManifest.xml "$apk" 2>/dev/null || true)"
  if echo "$manifest" | grep -q "SecureApplication"; then
    echo "  OK   manifest registers SecureApplication"
  else
    echo "  FAIL manifest does not declare android:name=...SecureApplication"
    fail=1
  fi

  # ---- 2. Bytecode must contain the SecureApplication class --------------
  unzip -o -q "$apk" 'classes*.dex' -d "$work" || true
  dexes=("$work"/classes*.dex)
  if [ ! -e "${dexes[0]}" ]; then
    echo "  FAIL no classes.dex found in APK"
    fail=1
    continue
  fi

  dump="$work/dexdump.txt"
  : > "$dump"
  for dex in "${dexes[@]}"; do
    dexdump -d "$dex" >> "$dump" 2>/dev/null || true
  done

  if grep -q "SecureApplication" "$dump"; then
    echo "  OK   SecureApplication class present in bytecode"
  else
    echo "  FAIL SecureApplication class missing from bytecode"
    fail=1
  fi

  # ---- 3. FLAG_SECURE (0x2000) must be passed to Window.setFlags ---------
  if grep -q "Landroid/view/Window;->setFlags" "$dump"; then
    echo "  OK   Window.setFlags invoked"
  else
    echo "  FAIL no call to Window.setFlags found"
    fail=1
  fi

  if grep -Eqi "0x2000|#\+?8192" "$dump"; then
    echo "  OK   FLAG_SECURE constant (0x2000) present"
  else
    echo "  FAIL FLAG_SECURE constant (0x2000) not found"
    fail=1
  fi

  # ---- 4. Lifecycle-wide application (not just MainActivity) -------------
  if grep -q "registerActivityLifecycleCallbacks" "$dump"; then
    echo "  OK   process-wide ActivityLifecycleCallbacks registration present"
  else
    echo "  FAIL FLAG_SECURE is not applied process-wide"
    fail=1
  fi

  rm -rf "$work"
  trap - EXIT
done

echo
if [ "$fail" -ne 0 ]; then
  echo "RESULT: FAILED — screenshot protection is not present in every variant."
  exit 1
fi
echo "RESULT: PASSED — FLAG_SECURE screenshot protection verified in all scanned variants."
