# Live end-to-end check of the deployed E-Presence backend.
# Creates a session called "SMOKE test" with a few test people (delete those rows from the Sheet afterwards).
param([string]$Url)
$script:fail = 0
function Call($o) { (Invoke-WebRequest -Method Post -Uri $Url -ContentType 'text/plain' -Body ($o | ConvertTo-Json -Compress) -UseBasicParsing).Content.Trim() }
function Check($name, $ok, $got) {
  if ($ok) { Write-Host "PASS  $name" -ForegroundColor Green }
  else { Write-Host "FAIL  $name   (got: $got)" -ForegroundColor Red; $script:fail++ }
}
try {
  $g = ([string](Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 90).Content).Trim()
  Check 'backend running and tabs ready' ($g -eq 'E-Presence is running') $g

  $r = Call @{ action = 'start'; name = 'SMOKE test'; pin = '0482'; ask_regno = $true }
  $s = $null; if ($r.StartsWith('{')) { $s = $r | ConvertFrom-Json }
  Check 'lecturer starts a session (no login needed)' ($s -and $s.session_id -and $s.host_key) $r
  if (-not $s) { throw "Could not start a session, stopping." }
  $id = $s.session_id
  $host_ = @{ session_id = $id; host_key = $s.host_key }

  $info = (Invoke-WebRequest "$Url`?s=$id" -UseBasicParsing).Content | ConvertFrom-Json
  Check 'student page can read the session name' ($info.open -and $info.name -eq 'SMOKE test') ($info | ConvertTo-Json -Compress)

  $scan = @{ session_id = $id; pin = '0482'; reg_no = 'SMOKE/001'; name = 'Smoke Alice'; device_id = 'smoke-1' }
  $bad = $scan.Clone(); $bad.pin = '9999'
  $r = Call $bad;  Check 'wrong PIN is refused' ($r -eq 'BAD_PIN') $r
  $r = Call $scan; Check 'right PIN signs in (PIN starting with 0 works)' ($r -eq 'OK') $r
  $r = Call $scan; Check 'second sign-in is refused as already signed in' ($r -eq 'ALREADY_MARKED') $r

  $r = Call (@{ action = 'manual'; lines = @("SMOKE/900`tSmoke Zed", "Smoke Amy`tSMOKE/910") } + $host_)
  Check 'add by hand (pasted rows) merges' ($r -eq 'ADDED:2') $r

  $r = Call (@{ action = 'list' } + $host_)
  $list = $r | ConvertFrom-Json
  Check 'lecturer list shows all 3 people' (@($list.rows).Count -eq 3) $r

  $r = Call @{ action = 'list'; session_id = $id; host_key = 'wrong-key' }
  Check 'list is refused without the private key' ($r -eq 'BAD_SESSION') $r

  $r = Call (@{ action = 'end' } + $host_)
  Check 'lecturer ends the session' ($r -eq 'OK') $r
  $scan2 = $scan.Clone(); $scan2.reg_no = 'SMOKE/002'; $scan2.name = 'Smoke Late'; $scan2.device_id = 'smoke-2'
  $r = Call $scan2; Check 'sign-in is refused after the session ended' ($r -eq 'NO_OPEN_SESSION') $r
} catch {
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  $script:fail++
}
Write-Host ""
if ($script:fail -eq 0) { Write-Host "ALL CHECKS PASSED" -ForegroundColor Green; exit 0 }
else { Write-Host "$($script:fail) CHECK(S) FAILED" -ForegroundColor Red; exit 1 }
