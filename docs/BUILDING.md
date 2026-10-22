# Building Parsify

Prerequisites: Node.js 22 LTS, pnpm 10.15.1 and Rust stable. Initial local packages used Node 20.19.5. Windows additionally requires MSVC C++ Build Tools and WebView2. Android uses JDK 21, SDK 36, Build Tools 36.0.0, NDK 27.2.12479018 and wrapper-managed Gradle 8.14.3.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm extension:build
pnpm extension:firefox:build
pnpm extension:firefox:lint
pnpm tauri build --bundles nsis
```

Windows installer output: `src-tauri/target/release/bundle/nsis/`. Packages are currently unsigned. Existing product names/identifiers remain compatible with earlier local versions.

## Android

Set `JAVA_HOME`, `ANDROID_HOME`, and `NDK_HOME` to your toolchain locations, then:

```sh
rustup target add aarch64-linux-android
node android/prepare.mjs
pnpm tauri android build --apk --target aarch64
```

Keep the checked-in customized project at `src-tauri/gen/android`; do not delete/reinitialize it, because it contains the native PDF bridge. `android/prepare.mjs` regenerates only ignored machine-local Cargo dependency paths from the lockfile. Portable generated activity sources are retained with their upstream notices; generated application assets remain ignored.

Unsigned APK: `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk`. Despite the Gradle variant name, this target contains **ARM64 only**. Sign using `android/package-apk.ps1` and a privately managed keystore. The initial release is development-signed; a production signing strategy requires key custody and an upgrade migration plan. Never commit keystores or passwords.

## Browser extensions

Chrome packages zip the contents of `extension/dist/` with `manifest.json` at the root. Firefox packages are built from `extension/dist-firefox/`, which shares all renderer code but substitutes Firefox MV3 metadata and relative content-style font URLs. Use:

```sh
npx web-ext build --source-dir extension/dist-firefox --artifacts-dir release --filename Parsify-firefox.xpi
```

An XPI is a ZIP-format Firefox add-on. The package is suitable for `about:debugging` temporary loading once extracted. Standard Firefox requires Mozilla signing for permanent file-based installation; no store submission or signing is automated.

## Notices and validation

`node scripts/collect-notices.mjs` collects production npm/Rust licenses. Upstream notices missing from packages are retained in `licenses/overrides/`. Cargo may download locked crates. `public/licenses/` ships with all targets.

Run `pnpm extension:preview` and then `./qa/render-print-fixtures.ps1` in another terminal to produce local Chromium reference PDFs. Install Python `pypdf` and `pdfplumber`, then run `python qa/check-print-fixtures.py`. Inspect rendered pages with Poppler as well. These checks supplement rather than replace native end-to-end testing.

Release checklist: tests; all builds; no secrets/private captures; APK signature/ABI; archive contents; SHA-256 checksums; documented verification limits. Inspect output before deleting build caches. First-time dependencies require internet; local document rendering does not.
