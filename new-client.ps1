# Sets up E-Presence for a brand-new client: their own Google Sheet + backend, their own copy of the pages,
# a live end-to-end test, then publishes. Usage:  .\new-client.ps1 -Client "MUST"
param([Parameter(Mandatory = $true)][string]$Client)
$ErrorActionPreference = 'Stop'
$env:Path += ";$((npm config get prefix).Trim());$env:ProgramFiles\GitHub CLI"
$env:NODE_OPTIONS = '--dns-result-order=ipv4first'
function Step($m) { Write-Host "`n== $m" -ForegroundColor Cyan }
function Must($what) { if ($LASTEXITCODE -ne 0) { throw "$what failed (exit code $LASTEXITCODE)" } }
$slug = ($Client.ToLower() -replace '[^a-z0-9]+', '-').Trim('-')
if (-not $slug) { throw 'Give the client a name, for example: -Client "MUST"' }
$base  = Join-Path ([Environment]::GetFolderPath('Desktop')) 'e-presence'
$repo  = Join-Path $base 'repo-check'
$cdir  = Join-Path $base "clients-backend\$slug"
$pages = Join-Path $repo "clients\$slug"
if (Test-Path $cdir) { throw "Client '$slug' already exists: $cdir" }
foreach ($f in 'index.html', 'lecturer.html', 'smoke-test.ps1', 'apps-script\Code.gs', 'apps-script\appsscript.json') { if (-not (Test-Path "$repo\$f")) { throw "Missing $repo\$f" } }

Step "Creating the Google Sheet and backend for '$Client'"
New-Item -ItemType Directory -Force $cdir | Out-Null
Copy-Item "$repo\apps-script\Code.gs" $cdir
Set-Location $cdir
$created = (clasp create --type sheets --title "E-Presence - $Client" --rootDir . 2>&1 | Out-String); Must 'clasp create'
$sheet = [regex]::Match($created, 'document:\s*(\S+)').Groups[1].Value
Copy-Item "$repo\apps-script\appsscript.json" $cdir -Force
clasp push -f; Must 'clasp push'
$dep = (clasp deploy --description "Setup for $Client" 2>&1 | Out-String); Must 'clasp deploy'
$id = [regex]::Match($dep, 'Deployed\s+(AKfy[\w-]+)').Groups[1].Value
if (-not $id) { throw "Could not read the deployment id from: $dep" }
Set-Content -Path "$cdir\deployment.txt" -Value $id
$url = "https://script.google.com/macros/s/$id/exec"

Step 'Approve the permissions (one time)'
Start-Process $url
Write-Host "In the browser: Review permissions > choose the account > Advanced > Go to project > Allow."
Write-Host "When the page says 'E-Presence is running', come back here."
Read-Host 'Press Enter to continue'

Step 'Making the client pages'
New-Item -ItemType Directory -Force $pages | Out-Null
foreach ($f in 'index.html', 'lecturer.html') {
  $t = [IO.File]::ReadAllText("$repo\$f")
  $t = [regex]::Replace($t, 'https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec', $url)
  [IO.File]::WriteAllText("$pages\$f", $t)
}

Step 'Live test against the new backend'
& "$repo\smoke-test.ps1" -Url $url
if ($LASTEXITCODE -ne 0) { Write-Host "`nA check failed. Nothing was published. The client's backend exists at: $cdir" -ForegroundColor Red; exit 1 }

Step 'Publishing'
Set-Location $repo
git add "clients/$slug"
git commit -q -m "Add client: $Client"; Must 'git commit'
git push; Must 'git push'
$link = "https://muhumuza684.github.io/E-PRESENT-/clients/$slug/lecturer.html"
Write-Host "`nDONE for '$Client'." -ForegroundColor Green
Write-Host "Lecturer link : $link   (wait about a minute for GitHub Pages)"
Write-Host "Google Sheet  : $sheet"
Write-Host "Backend folder: $cdir"
Write-Host "Delete the rows named 'SMOKE class' from their Sheet's Classes, Sessions and Attendance tabs."
