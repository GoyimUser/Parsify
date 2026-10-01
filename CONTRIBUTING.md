# Contributing

Use focused branches/pull requests and minimal synthetic Markdown/DOM regressions. Run `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm build` and `pnpm extension:build` before submitting rendering changes.

Separate math syntax from prose conversion; preserve code, inline typography and original-view fallbacks. Keep Windows and Android PDF entry points isolated. Test screen scrolling and paper layout separately.

Never commit secrets, signing keys, private captures, machine-local paths or generated packages. Document redistribution rights before adding fonts. Keep runtime scripts/fonts bundled rather than remotely executable.
