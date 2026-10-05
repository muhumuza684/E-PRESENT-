# One-command update for E-Presence: copies files, deploys the backend, runs the live test,
# and pushes to GitHub ONLY if every check passes.
$ErrorActionPreference = 'Stop'
$env:Path += ";$((npm config get prefix).Trim())"
$DeploymentId = 'AKfycbxrvdQluH9CZ-FB8zzxQ3RUgnOSw2zYmo1kqXT61VZMAhpSZnTgpTrrUKTLdnw9PaspEw'
$Url  = "https://script.google.com/macros/s/$DeploymentId/exec"
$base = Join-Path ([Environment]::GetFolderPath('Desktop')) 'e-presence'
$clasp = Join-Path $base 'e-presence-simple\apps-script'
$repo  = Join-Path $base 'repo-check'
$here  = $PSScriptRoot
function Step($m) { Write-Host "`n== $m" -ForegroundColor Cyan }
function Must($what) { if ($LASTEXITCODE -ne 0) { throw "$what failed (exit code $LASTEXITCODE)" } }
foreach ($p in $clasp, $repo) { if (-not (Test-Path $p)) { throw "Missing folder: $p" } }

Step "Copy files"
Copy-Item "$here\apps-script\Code.gs", "$here\apps-script\appsscript.json" $clasp -Force
New-Item -ItemType Directory -Force "$repo\apps-script" | Out-Null
Copy-Item "$here\apps-script\Code.gs", "$here\apps-script\appsscript.json" "$repo\apps-script" -Force
Copy-Item "$here\index.html", "$here\lecturer.html", "$here\README.md", "$here\smoke-test.ps1", "$here\deploy.ps1" $repo -Force

Step "Deploy backend to Google"
Set-Location $clasp
clasp push -f; Must 'clasp push'
clasp deploy --deploymentId $DeploymentId --description "E-Presence update $(Get-Date -Format 'yyyy-MM-dd HH:mm')"; Must 'clasp deploy'

Step "Live test against your real backend"
& "$here\smoke-test.ps1" -Url $Url
if ($LASTEXITCODE -ne 0) {
  Write-Host "`nA check failed. NOTHING was pushed to GitHub. Paste the red lines above to Claude." -ForegroundColor Red
  exit 1
}

Step "Push to GitHub"
Set-Location $repo
git add .
if (git status --porcelain) { git commit -q -m "E-Presence update"; Must 'git commit'; git push; Must 'git push' }
else { Write-Host "Nothing new to push." }
Write-Host "`nDONE. All checks passed and GitHub is up to date." -ForegroundColor Green
Write-Host "Reload the lecturer page with Ctrl+F5: https://muhumuza684.github.io/E-PRESENT-/lecturer.html"
