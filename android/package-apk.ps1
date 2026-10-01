param(
  [Parameter(Mandatory=$true)][string]$ApkSigner,
  [Parameter(Mandatory=$true)][string]$KeyStore,
  [Parameter(Mandatory=$true)][string]$KeyAlias,
  [Parameter(Mandatory=$true)][string]$OutputFile
)
$ErrorActionPreference = 'Stop'
if (!$env:PARSIFY_KEYSTORE_PASSWORD -or !$env:PARSIFY_KEY_PASSWORD) {
  throw 'Set PARSIFY_KEYSTORE_PASSWORD and PARSIFY_KEY_PASSWORD outside the repository.'
}
$project = Split-Path $PSScriptRoot -Parent
$unsigned = Join-Path $project 'src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk'
if (!(Test-Path -LiteralPath $unsigned)) { throw 'Build the unsigned APK first.' }
if (Test-Path -LiteralPath $OutputFile) { throw 'Choose a new output filename; refusing to overwrite.' }
& $ApkSigner sign --ks $KeyStore --ks-key-alias $KeyAlias --ks-pass env:PARSIFY_KEYSTORE_PASSWORD --key-pass env:PARSIFY_KEY_PASSWORD --out $OutputFile $unsigned
if ($LASTEXITCODE -ne 0) { throw 'APK signing failed.' }
& $ApkSigner verify --verbose $OutputFile
if ($LASTEXITCODE -ne 0) { throw 'APK verification failed.' }
Get-FileHash -LiteralPath $OutputFile -Algorithm SHA256
