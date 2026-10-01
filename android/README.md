# Android packaging

Canonical native sources live in [`../src-tauri/gen/android`](../src-tauri/gen/android). This directory provides packaging tools, not a competing Gradle project. See [building](../docs/BUILDING.md) and [validation](../docs/VALIDATION.md).

Initial APK: Android 7+, ARM64, release-optimized but **development-signed**. APKs are release assets, not tracked source. No signing key or password is included.
