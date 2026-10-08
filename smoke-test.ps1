# Live end-to-end check of the deployed E-Presence backend.
# Creates a class called "SMOKE class" with test people (delete those rows from the Sheet afterwards).
param([string]$Url)
$script:fail = 0
function Call($o) { (Invoke-WebRequest -Method Post -Uri $Url -ContentType 'text/plain' -Body ($o | ConvertTo-Json -Compress -Depth 5) -UseBasicParsing).Content.Trim() }
function Get-Info($q) { (Invoke-WebRequest "${Url}?$q" -UseBasicParsing).Content | ConvertFrom-Json }
function Check($name, $ok, $got) {
  if ($ok) { Write-Host "PASS  $name" -ForegroundColor Green }
  else { Write-Host "FAIL  $name   (got: $got)" -ForegroundColor Red; $script:fail++ }
}
try {
  $g = ([string](Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 90).Content).Trim()
  Check 'backend running and tabs ready' ($g -eq 'E-Presence is running') $g

  $r = Call @{ action = 'newclass'; name = 'SMOKE class'; ask_regno = $true }
  $c = $null; if ($r.StartsWith('{')) { $c = $r | ConvertFrom-Json }
  Check 'lecturer creates a class (no login needed)' ($c -and $c.class_id -and $c.host_key) $r
  if (-not $c) { throw "Could not create a class, stopping." }
  $cid = $c.class_id
  $auth = @{ class_id = $cid; host_key = $c.host_key }

  $i = Get-Info "class=$cid"
  Check 'permanent QR works before any session (shows closed)' ((-not $i.open) -and $i.name -eq 'SMOKE class') ($i | ConvertTo-Json -Compress)

  $r = Call (@{ action = 'start'; pin = '0482'; title = 'Week 1' } + $auth)
  Check 'lecturer starts a session' ($r.StartsWith('{')) $r
  $i = Get-Info "class=$cid"
  Check 'same QR now open, shows the session title' ($i.open -and $i.title -eq 'Week 1') ($i | ConvertTo-Json -Compress)

  $scan = @{ class_id = $cid; pin = '0482'; reg_no = 'SMOKE/001'; name = 'Smoke Alice'; device_id = 'smoke-1' }
  $bad = $scan.Clone(); $bad.pin = '9999'
  $r = Call $bad;  Check 'wrong PIN is refused' ($r -eq 'BAD_PIN') $r
  $r = Call $scan; Check 'right PIN signs in (PIN starting with 0 works)' ($r -eq 'OK') $r
  $r = Call $scan; Check 'second sign-in is refused as already signed in' ($r -eq 'ALREADY_MARKED') $r

  $r = Call (@{ action = 'manual'; lines = @("SMOKE/900`tSmoke Zed", "Smoke Amy`tSMOKE/910") } + $auth)
  Check 'add by hand (pasted rows) merges' ($r -eq 'ADDED:2') $r
  $l = (Call (@{ action = 'list' } + $auth)) | ConvertFrom-Json
  Check 'lecturer list shows all 3 people' (@($l.rows).Count -eq 3) ($l | ConvertTo-Json -Compress)
  $r = Call @{ action = 'list'; class_id = $cid; host_key = 'wrong-key' }
  Check 'list is refused without the private key' ($r -eq 'BAD_SESSION') $r

  $r = Call (@{ action = 'end' } + $auth); Check 'lecturer ends sign-in' ($r -eq 'OK') $r
  $late = $scan.Clone(); $late.reg_no = 'SMOKE/002'; $late.name = 'Smoke Late'; $late.device_id = 'smoke-2'
  $r = Call $late; Check 'sign-in is refused after sign-in ended' ($r -eq 'NO_OPEN_SESSION') $r
  $i = Get-Info "class=$cid"; Check 'same QR shows closed again' (-not $i.open) ($i | ConvertTo-Json -Compress)

  $r = Call (@{ action = 'setreg'; ask_regno = $false } + $auth); $i = Get-Info "class=$cid"
  Check 'switching to Name only reaches the student page' ($r -eq 'OK' -and -not $i.ask_regno) ($i | ConvertTo-Json -Compress)
  $r = Call (@{ action = 'setreg'; ask_regno = $true } + $auth)
  $r = Call (@{ action = 'start'; pin = '2222'; title = 'Week 2' } + $auth)
  Check 'week 2 starts under the SAME QR' ($r.StartsWith('{')) $r
  $w2 = $scan.Clone(); $w2.pin = '2222'; $w2.device_id = 'smoke-3'
  $r = Call $w2; Check 'same student signs in again in week 2' ($r -eq 'OK') $r
  $r = Call (@{ action = 'end' } + $auth)
  $sem = (Call (@{ action = 'semester' } + $auth)) | ConvertFrom-Json
  $alice = @($sem.people | Where-Object { $_.name -eq 'Smoke Alice' })[0]
  $tot = ($alice.marks | Measure-Object -Sum).Sum
  Check 'whole-semester table: 2 sessions, Alice attended both' (@($sem.sessions).Count -eq 2 -and $tot -eq 2) ($sem | ConvertTo-Json -Compress -Depth 5)
} catch {
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  $script:fail++
}
Write-Host ""
if ($script:fail -eq 0) { Write-Host "ALL CHECKS PASSED" -ForegroundColor Green; exit 0 }
else { Write-Host "$($script:fail) CHECK(S) FAILED" -ForegroundColor Red; exit 1 }
