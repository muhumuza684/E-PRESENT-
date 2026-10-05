# Live end-to-end check of the deployed E-Presence backend.
# Creates a test course "SMOKE" and test students "SMOKE/001", "SMOKE/002" (delete those rows afterwards).
param([string]$Url, [string]$LecturerId, [string]$Pin, [string]$Email)
$script:fail = 0
function Call($o) { (Invoke-WebRequest -Method Post -Uri $Url -ContentType 'text/plain' -Body ($o | ConvertTo-Json -Compress) -UseBasicParsing).Content.Trim() }
function Check($name, $ok, $got) {
  if ($ok) { Write-Host "PASS  $name" -ForegroundColor Green }
  else { Write-Host "FAIL  $name   (got: $got)" -ForegroundColor Red; $script:fail++ }
}
try {
  $g = ([string](Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 90).Content).Trim()
  Check 'backend running and tabs ready' ($g -eq 'E-Presence is running') $g

  $r = Call @{ action = 'init'; lecturer_id = $LecturerId; pin = $Pin; email = $Email }
  Check 'lecturer account ready' (@('READY', 'ALREADY_SETUP') -contains $r) $r

  $room = @{ lat = 0.3476; lng = 32.5825 }
  $r = Call (@{ action = 'start'; lecturer_id = $LecturerId; pin = $Pin; course = 'SMOKE'; accuracy = 10; radius = 60; minutes = 10; mode = 'flag' } + $room)
  Check 'lecturer starts a session' ($r -like 'STARTED:*') "$r  (BAD_LECTURER = type the ID and PIN exactly as they are in the Lecturers tab)"

  $scan = @{ course = 'SMOKE'; student_no = 'SMOKE/001'; pin = '1234'; name = 'Smoke Test'; device_id = 'smoke-device'; accuracy = 10; lat = 0.3476; lng = 32.5825 }
  $r = Call $scan
  Check 'new student registers and signs in' (@('OK', 'ALREADY_MARKED') -contains $r) $r
  $r = Call $scan
  Check 'second scan is refused as already marked' ($r -eq 'ALREADY_MARKED') $r
  $bad = $scan.Clone(); $bad.pin = '9999'
  $r = Call $bad
  Check 'wrong PIN is refused' ($r -eq 'BAD_PIN') $r

  $zero = $scan.Clone(); $zero.student_no = 'SMOKE/002'; $zero.name = 'Zero Pin'; $zero.pin = '0123'; $zero.device_id = 'smoke-device-2'
  $r = Call $zero
  Check 'PIN starting with 0 registers' (@('OK', 'ALREADY_MARKED') -contains $r) $r
  $r = Call $zero
  Check 'PIN starting with 0 is accepted again (not BAD_PIN)' ($r -eq 'ALREADY_MARKED') $r

  $today = (Get-Date).ToUniversalTime().AddHours(3).ToString('yyyy-MM-dd')
  $r = Call @{ action = 'list'; lecturer_id = $LecturerId; pin = $Pin; course = 'SMOKE'; date = $today }
  $list = $r | ConvertFrom-Json
  Check 'lecturer list shows both students' ($list.found -and (@($list.rows).Count -ge 2)) $r
} catch {
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  $script:fail++
}
Write-Host ""
if ($script:fail -eq 0) { Write-Host "ALL CHECKS PASSED" -ForegroundColor Green; exit 0 }
else { Write-Host "$($script:fail) CHECK(S) FAILED" -ForegroundColor Red; exit 1 }

