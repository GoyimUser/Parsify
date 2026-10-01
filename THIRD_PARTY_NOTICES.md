# Third-party notices

Parsify's original source is MIT. Dependencies and fonts retain their own licenses; the MIT license does not relicense them. Exact notices for installed production npm and locked Windows/Android Rust dependencies are collected in `public/licenses/DEPENDENCIES.txt` and shipped with packages. Dependency versions are recorded in `pnpm-lock.yaml` and `src-tauri/Cargo.lock`.

| Asset | Source / license |
| --- | --- |
| Yas.ttf (unmodified) | [farsi-fonts/Yas](https://github.com/farsi-fonts/Yas), copyright IRMUG, OFL-1.1; see `public/licenses/Yas-OFL.txt` |
| Vazirmatn | [Vazirmatn](https://github.com/rastikerdar/vazirmatn), OFL-1.1 |
| Ubuntu Mono | Ubuntu Font Licence 1.0, included from `@fontsource/ubuntu-mono` |
| KaTeX | [KaTeX](https://github.com/KaTeX/KaTeX), MIT, with packaged font notices |
| lowlight / highlight.js | MIT / BSD-3-Clause respectively |
| React, unified / remark / rehype, Vite ecosystem | Individual MIT or other notices in the dependency collection |
| Tauri and Rust dependencies | Individual MIT/Apache/BSD/MPL and other notices in the dependency collection |
| AndroidX / Material components | Apache-2.0; upstream [AndroidX](https://android.googlesource.com/platform/frameworks/support/) and [Material](https://github.com/material-components/material-components-android) |
| Gradle wrapper | Apache-2.0; [Gradle](https://github.com/gradle/gradle) |

Yas binary SHA-256: `d1a0a9dc482ed83222733158f7639959a03de057e223ee6743c25de66c678de2`. The bundled file was compared byte-for-byte with the upstream `Yas.ttf`; no glyph or font-name changes were made.

B Nazanin, IRANSans, Arial, Times New Roman and optional programming fonts are referenced as locally installed families only; proprietary binaries are not bundled. Obtain required font rights separately.

## Source availability

Some locked dependencies use MPL-2.0. They are unmodified. Corresponding source for each exact crate/version is available at `https://crates.io/api/v1/crates/NAME/VERSION/download`, with version/checksum recorded in Cargo.lock; for example [selectors 0.36.1 source](https://crates.io/api/v1/crates/selectors/0.36.1/download). Other source repositories and licenses are declared in package manifests. These dependency licenses do not change the license of Parsify's original code.

## Missing-package notice provenance

`licenses/overrides/` supplies upstream notices omitted from some published packages. Retrieved from the upstream repositories: remarkjs/remark-math (`license`), dropbox/rust-alloc-no-stdlib (`LICENSE`), knurling-rs/defmt (`LICENSE-MIT`), tauri-apps/tauri (`LICENSE-MIT`), open-i18n/rust-unic (`LICENSE-MIT`), wravery/webview2-rs (`LICENSE`), jni-rs/jni-sys (`LICENSE-MIT`), rust-mobile/ndk (`LICENSE-MIT`). Selectors uses the official [Mozilla MPL-2.0 text](https://www.mozilla.org/MPL/2.0/). MIT is selected where a dependency offers MIT/Apache dual licensing.

Redistributions should retain the bundled notices. Run `node scripts/collect-notices.mjs` when dependencies change and review new missing-license failures before release.
