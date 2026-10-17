$ErrorActionPreference = 'Stop'

$projectId = 'demo-emporio-bulk-predeploy'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$javaHome = [Environment]::GetEnvironmentVariable('JAVA_HOME', 'Machine')
if ([string]::IsNullOrWhiteSpace($javaHome)) {
  $javaHome = [Environment]::GetEnvironmentVariable('JAVA_HOME', 'User')
}
if ([string]::IsNullOrWhiteSpace($javaHome)) {
  $javaCommand = Get-Command java -ErrorAction SilentlyContinue
  if ($javaCommand) {
    $javaHome = Split-Path (Split-Path $javaCommand.Source -Parent) -Parent
  }
}
if ([string]::IsNullOrWhiteSpace($javaHome)) {
  throw 'JDK 21+ was not found. Install it and define JAVA_HOME before running the emulator harness.'
}

$javaHome = $javaHome -replace '[\\/]+$', ''
if (!(Test-Path -LiteralPath (Join-Path $javaHome 'bin\java.exe'))) {
  throw 'JAVA_HOME does not point to a JDK containing bin\java.exe.'
}
if (!(Test-Path -LiteralPath (Join-Path $javaHome 'bin\javac.exe'))) {
  throw 'JAVA_HOME does not point to a JDK containing bin\javac.exe.'
}
if (!(Get-Command firebase -ErrorAction SilentlyContinue)) {
  throw 'Firebase CLI is not available in this PowerShell process.'
}

$env:JAVA_HOME = $javaHome
$env:Path = "$javaHome\bin;$env:Path"
$shortProfile = (& $env:ComSpec /d /c 'for %I in ("%USERPROFILE%") do @echo %~sI' | Select-Object -First 1).Trim()
if ([string]::IsNullOrWhiteSpace($shortProfile) -or $shortProfile.Length -gt 35) {
  throw 'A short Windows user profile path is required for Java NIO selector sockets.'
}
$emulatorTemp = Join-Path $shortProfile 'codex'
if (!(Test-Path -LiteralPath $emulatorTemp)) {
  New-Item -ItemType Directory -Path $emulatorTemp | Out-Null
}
$env:TEMP = $emulatorTemp
$env:TMP = $emulatorTemp
$env:OPEN_PAYMENT_BULK_TEST_PROJECT_ID = $projectId
$env:GCLOUD_PROJECT = $projectId
$env:GOOGLE_CLOUD_PROJECT = $projectId

Push-Location $repoRoot
try {
  & firebase emulators:exec `
    --config firebase.emulator.json `
    --only auth,firestore,functions `
    --project $projectId `
    'node --test functions/openPaymentBulkActions.emulator.test.js'
  $exitCode = $LASTEXITCODE
}
finally {
  Pop-Location
}

exit $exitCode
