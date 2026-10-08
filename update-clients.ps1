# Rolls the current Code.gs and pages out to EVERY client, tests each one, then publishes.
$ErrorActionPreference = 'Stop'
$env:Path += ";$((npm config get prefix).Trim());$env:ProgramFiles\GitHub CLI"
$env:NODE_OPTIONS = '--dns-result-order=ipv4first'
function Step($m) { Write-Host "`n== $m" -ForegroundColor Cyan }
$base = Join-Path ([Environment]::GetFolderPath('Desktop')) 'e-presence'
$repo = Join-Path $base 'repo-check'
$root = Join-Path $base 'clients-backend'
if (-not (Test-Path $root)) { throw "No clients yet ($root). Use new-client.ps1 first." }
$failed = @(); $done = @()
foreach ($d in Get-ChildItem $root -Directory) {
  $slug = $d.Name
  $depFile = Join-Path $d.FullName 'deployment.txt'
  if (-not (Test-Path $depFile)) { Write-Host "Skipping $slug (no deployment.txt)" -ForegroundColor Yellow; continue }
  Step "Updating $slug"
  try {
    $id = (Get-Content $depFile -Raw).Trim(); $url = "https://script.google.com/macros/s/$id/exec"
    Copy-Item "$repo\apps-script\Code.gs", "$repo\apps-script\appsscript.json" $d.FullName -Force
    Set-Location $d.FullName
    clasp push -f; if ($LASTEXITCODE -ne 0) { throw 'clasp push failed' }
    clasp deploy --deploymentId $id --description "Update $(Get-Date -Format 'yyyy-MM-dd')"; if ($LASTEXITCODE -ne 0) { throw 'clasp deploy failed' }
    $pg = Join-Path $repo "clients\$slug"; New-Item -ItemType Directory -Force $pg | Out-Null
    foreach ($f in 'index.html', 'lecturer.html') {
      $t = [IO.File]::ReadAllText("$repo\$f")
      [IO.File]::WriteAllText("$pg\$f", [regex]::Replace($t, 'https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec', $url))
    }
    & "$repo\smoke-test.ps1" -Url $url
    if ($LASTEXITCODE -ne 0) { throw 'live test failed' }
    $done += $slug
  } catch { Write-Host "FAILED $slug : $($_.Exception.Message)" -ForegroundColor Red; $failed += $slug }
}
Set-Location $repo
git add -A
if (git status --porcelain) { git commit -q -m "Update clients: $($done -join ', ')"; git push }
Write-Host "`nUpdated: $($done -join ', ')" -ForegroundColor Green
if ($failed.Count) { Write-Host "Check these: $($failed -join ', ')" -ForegroundColor Red }
