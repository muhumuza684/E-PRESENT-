# Live end-to-end check of the deployed E-Presence backend.
# Creates a test course "SMOKE" and a test student "SMOKE/001" (delete those rows from the Sheet afterwards).
param([string]$Url, [string]$LecturerId, [string]$Pin, [string]$Email)
$ErrorActionPreference = 'Stop'
$script:fail = 0
function Call($o) { ([string](Invoke-RestMethod -Method Post -Uri $Url -ContentType 'text/plain' -Body ($o | ConvertTo-Json -Compress))).Trim() }
function Check($name, $ok, $got) {
  if ($ok) { Write-Host "PASS  $name" -ForegroundColor Green }
  else { Write-Host "FAIL  $name   (got: $got)" -ForegroundColor Red; $script:fail++ }
}

$g = ([string](Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 90).Content).Trim()
Check 'backend running and tabs ready' ($g -eq 'E-Presence is running') $g

$r = Call @{ action = 'init'; lecturer_id = $LecturerId; pin = $Pin; email = $Email }
Check 'lecturer account ready' (@('READY', 'ALREADY_SETUP') -contains $r) $r

$room = @{ lat = 0.3476; lng = 32.5825 }
$r = Call (@{ action = 'start'; lecturer_id = $LecturerId; pin = $Pin; course = 'SMOKE'; accuracy = 10; radius = 60; minutes = 10; mode = 'flag' } + $room)
Check 'lecturer starts a session' ($r -like 'STARTED:*') "$r  (BAD_LECTURER = this ID/PIN is not the one saved in the Lecturers tab)"

$scan = @{ course = 'SMOKE'; student_no = 'SMOKE/001'; pin = '1234'; name = 'Smoke Test'; device_id = 'smoke-device'; accuracy = 10 } + $room
$r = Call $scan
Check 'new student registers and signs in' (@('OK', 'ALREADY_MARKED') -contains $r) $r
$r = Call $scan
Check 'second scan is refused as already marked' ($r -eq 'ALREADY_MARKED') $r
$r = Call ($scan + @{ pin = '9999' })
Check 'wrong PIN is refused' ($r -eq 'BAD_PIN') $r

$today = (Get-Date).ToUniversalTime().AddHours(3).ToString('yyyy-MM-dd')
$r = Call @{ action = 'list'; lecturer_id = $LecturerId; pin = $Pin; course = 'SMOKE'; date = $today }
$list = $r | ConvertFrom-Json
Check 'lecturer list shows the student' ($list.found -and (@($list.rows | Where-Object { $_.name -eq 'Smoke Test' }).Count -ge 1)) $r

Write-Host ""
if ($script:fail -eq 0) { Write-Host "ALL CHECKS PASSED" -ForegroundColor Green; exit 0 }
else { Write-Host "$($script:fail) CHECK(S) FAILED" -ForegroundColor Red; exit 1 }
