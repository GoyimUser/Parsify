# Local file-generation QA only: no user browser profile or live chat access.
param([string]$Origin = "http://127.0.0.1:4180")
$ErrorActionPreference = "Stop"
$project = Split-Path $PSScriptRoot -Parent
$output = Join-Path $project "tmp/pdfs/native-tables"
New-Item -ItemType Directory -Force -Path $output | Out-Null
$edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
$cases = @(
  @{ Name="windows-a4"; Query="paper=a4" },
  @{ Name="windows-letter"; Query="paper=letter" },
  @{ Name="windows-a5"; Query="paper=a5" },
  @{ Name="windows-landscape"; Query="paper=landscape" },
  @{ Name="android-a4"; Query="paper=a4&platform=android" },
  @{ Name="android-fallback"; Query="paper=a4&platform=android&fallback=1" },
  @{ Name="android-landscape"; Query="paper=landscape&platform=android" },
  @{ Name="android-long"; Query="paper=a4&platform=android&long=1" }
)
foreach ($case in $cases) {
  $pdf = Join-Path $output ($case.Name + ".pdf")
  $profile = Join-Path $project ("tmp/pdfs/edge-" + $case.Name)
  $arguments = @("--headless", "--disable-gpu", "--no-first-run", "--no-pdf-header-footer",
    "--user-data-dir=`"$profile`"", "--print-to-pdf=`"$pdf`"", "--virtual-time-budget=10000",
    "`"$Origin/qa/native-tables.html?$($case.Query)`"")
  $process = Start-Process -FilePath $edge -ArgumentList $arguments -WindowStyle Hidden -PassThru
  if (!$process.WaitForExit(60000)) { throw "PDF renderer did not finish: $($case.Name)" }
  if (!(Test-Path -LiteralPath $pdf)) { throw "Missing PDF: $pdf" }
  Write-Output $pdf
}
