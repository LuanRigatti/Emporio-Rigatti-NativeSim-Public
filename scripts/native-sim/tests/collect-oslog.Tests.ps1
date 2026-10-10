$ErrorActionPreference = 'Stop'

$scriptPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\collect-oslog.ps1'))
$powershellExe = (Get-Command powershell.exe -ErrorAction Stop).Source
$testRoot = Join-Path $env:TEMP ('collect-oslog-tests-' + [Guid]::NewGuid().ToString('N'))
$fixtureRoot = Join-Path $testRoot 'fixture'
$outputRoot = Join-Path $testRoot 'output'
$mockGhPath = Join-Path $testRoot 'gh-mock.ps1'
$mockAgePath = Join-Path $testRoot 'age-mock.ps1'
$identityPath = Join-Path $testRoot 'identity.txt'
$plainFixture = Join-Path $fixtureRoot 'synthetic.log'
$cipherFixture = Join-Path $fixtureRoot 'native-sim-oslog.age'
$manifestFixture = Join-Path $fixtureRoot 'manifest.json'
$sha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
$repository = 'LuanRigatti/Emporio-Rigatti-NativeSim-Public'
$runId = '12345'
$testCount = 0

New-Item -ItemType Directory -Path $fixtureRoot -Force | Out-Null
Set-Content -LiteralPath $identityPath -Value 'mock identity only' -NoNewline
Set-Content -LiteralPath $plainFixture -Value @(
  '2026-10-10 12:00:00.000+0000 App[1:2] [com.example:OpenPaymentPeekPopReturn] [PeekPopReturn] willShow customer=PRIVATE_SENTINEL'
  '2026-10-10 12:00:01.000+0000 App[1:2] [com.example:OpenPaymentPeekPopReturn] [PeekPopReturn] didShow customer=PRIVATE_SENTINEL'
) -Encoding UTF8
Set-Content -LiteralPath $cipherFixture -Value 'synthetic ciphertext placeholder' -NoNewline -Encoding ASCII

$cipherHash = (Get-FileHash -LiteralPath $cipherFixture -Algorithm SHA256).Hash.ToLowerInvariant()
$manifest = [ordered]@{
  schema_version = 2
  repository = $repository
  run_id = $runId
  run_attempt = 1
  session = 'synthetic-session'
  commit = $sha
  category = 'OpenPaymentPeekPopReturn'
  categories = @('OpenPaymentPeekPopReturn')
  predicate = 'category == "OpenPaymentPeekPopReturn"'
  stream_level = 'debug'
  started_at_utc = '2026-10-10T12:00:00Z'
  finished_at_utc = '2026-10-10T12:00:02Z'
  event_count = 2
  capture_outcome = 'graceful-stop'
  ciphertext_sha256 = $cipherHash
}
$manifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $manifestFixture -Encoding UTF8

$mockGh = @'
param()
$global:LASTEXITCODE = 0
$all = @($args | ForEach-Object { [string]$_ })
$scenario = $env:NATIVE_SIM_MOCK_SCENARIO
$root = $env:NATIVE_SIM_MOCK_ROOT
$repo = 'LuanRigatti/Emporio-Rigatti-NativeSim-Public'
$sha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
$ids = @('12345')
if ($scenario -eq 'ambiguous') { $ids = @('12345', '12346') }

function Emit-Json($value) {
  ConvertTo-Json -InputObject $value -Depth 20 -Compress
}

if ($all.Count -gt 0 -and $all[0] -eq 'api') {
  $post = $all -contains '--method' -and $all -contains 'POST'
  $endpoint = $all | Where-Object { $_ -match '^repos/' } | Select-Object -First 1
  if ($post -and $endpoint -match '/statuses/') {
    Add-Content -LiteralPath (Join-Path $root 'status-posts.txt') -Value ($all -join '|')
    Set-Content -LiteralPath (Join-Path $root 'stop-posted.txt') -Value 'yes'
    Emit-Json @{ state = 'success' }
    return
  }
  if ($endpoint -match '/actions/workflows/native-sim\.yml/runs\?') {
    $workflowRuns = @($ids | ForEach-Object {
      $listedStatus = if ($scenario -in @('auto-active', 'auto-unresolved')) { 'in_progress' } else { 'completed' }
      @{ id = [long]$_; path = '.github/workflows/native-sim.yml'; event = 'workflow_dispatch'; status = $listedStatus; run_attempt = 1; created_at = '2026-10-10T12:00:00Z'; name = "native-sim $_" }
    })
    Emit-Json @{ workflow_runs = $workflowRuns }
    return
  }
  if ($endpoint -match '/actions/runs/(\d+)(?:/attempts/\d+)?/jobs') {
    if ($scenario -eq 'auto-smoke') {
      Emit-Json @{ jobs = @(@{ name = 'OSLog capture smoke tests'; status = 'in_progress'; conclusion = $null; steps = @() }) }
      return
    }
    if ($scenario -eq 'auto-unresolved') {
      Emit-Json @{ jobs = @(@{ name = 'setup'; status = 'in_progress'; conclusion = $null; steps = @() }) }
      return
    }
    $isTimeout = $scenario -in @('timeout', 'auto-active')
    $isStopped = Test-Path -LiteralPath (Join-Path $root 'stop-posted.txt')
    $stopObserved = Test-Path -LiteralPath (Join-Path $root 'stop-observed.txt')
    if ($isTimeout -or
        ($scenario -eq 'stop' -and -not $isStopped) -or
        ($scenario -eq 'stop-repeated' -and -not $stopObserved) -or
        $scenario -eq 'stop-stale') {
      $steps = @(
        @{ name = 'Start PeekPop OSLog capture'; status = 'completed'; conclusion = 'success' }
        @{ name = 'Hold the stream open'; status = 'in_progress'; conclusion = $null }
      )
    } elseif ($scenario -eq 'no-capture') {
      $steps = @(
        @{ name = 'Start PeekPop OSLog capture'; status = 'completed'; conclusion = 'skipped' }
        @{ name = 'Finalize PeekPop OSLog capture'; status = 'completed'; conclusion = 'skipped' }
        @{ name = 'Upload encrypted PeekPop logs'; status = 'completed'; conclusion = 'skipped' }
      )
    } elseif ($scenario -eq 'finalizer-failed') {
      $steps = @(
        @{ name = 'Start PeekPop OSLog capture'; status = 'completed'; conclusion = 'success' }
        @{ name = 'Finalize PeekPop OSLog capture'; status = 'completed'; conclusion = 'failure' }
        @{ name = 'Upload encrypted PeekPop logs'; status = 'completed'; conclusion = 'skipped' }
      )
    } elseif ($scenario -eq 'current-step-names') {
      $steps = @(
        @{ name = 'Start OSLog capture'; status = 'completed'; conclusion = 'success' }
        @{ name = 'Hold the stream open'; status = 'completed'; conclusion = 'success' }
        @{ name = 'Finalize OSLog capture'; status = 'completed'; conclusion = 'success' }
        @{ name = 'Upload encrypted OSLog capture'; status = 'completed'; conclusion = 'success' }
      )
    } else {
      $steps = @(
        @{ name = 'Start PeekPop OSLog capture'; status = 'completed'; conclusion = 'success' }
        @{ name = 'Hold the stream open'; status = 'completed'; conclusion = 'success' }
        @{ name = 'Finalize PeekPop OSLog capture'; status = 'completed'; conclusion = 'success' }
        @{ name = 'Upload encrypted PeekPop logs'; status = 'completed'; conclusion = 'success' }
      )
    }
    Emit-Json @{ jobs = @(@{ name = 'stream'; status = 'completed'; conclusion = 'success'; steps = $steps }) }
    return
  }
  if ($endpoint -match '/actions/runs/(\d+)/artifacts') {
    $artifactRunId = [string]$Matches[1]
    if ($scenario -eq 'artifact-missing') {
      Emit-Json @{ artifacts = @() }
    } else {
      $artifactAttempt = if ($scenario -eq 'artifact-other-attempt') { 2 } else { 1 }
      $expired = $scenario -eq 'artifact-expired'
      Emit-Json @{ artifacts = @(@{ name = "native-sim-oslog-$artifactRunId-$artifactAttempt"; expired = $expired; id = 9876 }) }
    }
    return
  }
  if ($endpoint -match '/actions/runs/(\d+)/attempts/(\d+)$') {
    $id = [string]$Matches[1]
    $attempt = [int]$Matches[2]
    $status = 'completed'
    $conclusion = 'success'
    $stopObserved = Test-Path -LiteralPath (Join-Path $root 'stop-observed.txt')
    if ($scenario -in @('timeout', 'auto-active') -or
        ($scenario -eq 'stop' -and -not (Test-Path -LiteralPath (Join-Path $root 'stop-posted.txt'))) -or
        ($scenario -eq 'stop-repeated' -and -not $stopObserved) -or
        $scenario -eq 'stop-stale') {
      $status = 'in_progress'
      $conclusion = $null
    }
    Emit-Json @{
      id = [long]$id
      path = '.github/workflows/native-sim.yml'
      event = 'workflow_dispatch'
      status = $status
      conclusion = $conclusion
      run_attempt = $attempt
      run_started_at = '2026-10-10T11:00:00Z'
      head_sha = $sha
      repository = @{ full_name = $repo }
    }
    return
  }
  if ($endpoint -match '/actions/runs/(\d+)$') {
    $id = [string]$Matches[1]
    $status = 'completed'
    $conclusion = 'success'
    $stopObserved = Test-Path -LiteralPath (Join-Path $root 'stop-observed.txt')
    if ($scenario -in @('timeout', 'auto-active') -or
        ($scenario -eq 'stop' -and -not (Test-Path -LiteralPath (Join-Path $root 'stop-posted.txt'))) -or
        ($scenario -eq 'stop-repeated' -and -not $stopObserved) -or
        $scenario -eq 'stop-stale') {
      $status = 'in_progress'
      $conclusion = $null
    }
    $path = '.github/workflows/native-sim.yml'
    if ($scenario -eq 'wrong-workflow') { $path = '.github/workflows/other.yml' }
    Emit-Json @{
      id = [long]$id
      path = $path
      event = 'workflow_dispatch'
      status = $status
      conclusion = $conclusion
      run_attempt = $(if ($scenario -eq 'explicit-old-attempt') { 2 } else { 1 })
      run_started_at = '2026-10-10T12:00:00Z'
      head_sha = $sha
      repository = @{ full_name = $repo }
    }
    return
  }
  if ($endpoint -match '/commits/.+/statuses') {
    if ($scenario -eq 'stop-repeated') {
      Set-Content -LiteralPath (Join-Path $root 'stop-observed.txt') -Value 'yes'
      Emit-Json @(@{ context = 'native-sim-stop/12345'; state = 'success'; description = 'stop requested'; created_at = '2026-10-10T12:00:30Z' })
      return
    }
    if ($scenario -eq 'stop-stale') {
      Emit-Json @(@{ context = 'native-sim-stop/12345'; state = 'success'; description = 'stop requested'; created_at = '2026-10-10T11:00:00Z' })
      return
    }
    Emit-Json @()
    return
  }
}

if ($all.Count -gt 0 -and $all[0] -eq 'run' -and $all.Count -gt 1 -and $all[1] -eq 'download') {
  $destination = $all[$all.IndexOf('-D') + 1]
  Copy-Item -LiteralPath (Join-Path $root 'fixture\manifest.json') -Destination (Join-Path $destination 'manifest.json')
  Copy-Item -LiteralPath (Join-Path $root 'fixture\native-sim-oslog.age') -Destination (Join-Path $destination 'native-sim-oslog.age')
  return
}

$global:LASTEXITCODE = 2
'unsupported mock gh request' | Write-Error
'@
Set-Content -LiteralPath $mockGhPath -Value $mockGh -Encoding UTF8

$mockAge = @'
param()
$global:LASTEXITCODE = 0
$all = @($args | ForEach-Object { [string]$_ })
if ($env:NATIVE_SIM_MOCK_SCENARIO -eq 'decrypt-failure') {
  $global:LASTEXITCODE = 23
  return
}
$outputIndex = [Array]::IndexOf($all, '-o')
if ($outputIndex -lt 0 -or -not $env:NATIVE_SIM_MOCK_PLAINTEXT) {
  $global:LASTEXITCODE = 24
  return
}
Copy-Item -LiteralPath $env:NATIVE_SIM_MOCK_PLAINTEXT -Destination $all[$outputIndex + 1]
'@
Set-Content -LiteralPath $mockAgePath -Value $mockAge -Encoding UTF8

function Assert-Test {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw "TEST FAILED: $Message" }
  $script:testCount++
}

function Invoke-Collector {
  param(
    [string]$Scenario,
    [string[]]$ExtraArguments = @(),
    [string]$OutputName = $Scenario
  )

  $env:NATIVE_SIM_MOCK_SCENARIO = $Scenario
  $env:NATIVE_SIM_MOCK_ROOT = $testRoot
  $env:NATIVE_SIM_MOCK_PLAINTEXT = $plainFixture
  $caseOutput = Join-Path $testRoot $OutputName
  $arguments = @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $scriptPath,
    '-Repository', $repository,
    '-GhPath', $mockGhPath,
    '-AgePath', $mockAgePath,
    '-IdentityPath', $identityPath,
    '-OutputRoot', $caseOutput,
    '-TimeoutSeconds', '2',
    '-PollIntervalSeconds', '1'
  ) + $ExtraArguments
  $previousErrorAction = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = & $powershellExe @arguments 2>&1 | Out-String
  $ErrorActionPreference = $previousErrorAction
  $output = ($output -replace '\s+', ' ').Trim()
  $exitCode = $LASTEXITCODE
  return [pscustomobject]@{ ExitCode = $exitCode; Output = $output; OutputRoot = $caseOutput }
}

try {
  $success = Invoke-Collector -Scenario 'success' -ExtraArguments @('-RunId', $runId)
  Assert-Test ($success.ExitCode -eq 0) 'synthetic encrypted artifact should recover successfully'
  Assert-Test ($success.Output -notmatch 'PRIVATE_SENTINEL') 'raw log data must not appear in terminal output'
  $report = Get-ChildItem -LiteralPath $success.OutputRoot -Recurse -Filter analysis-report.md | Select-Object -First 1
  $peekPopReport = Get-ChildItem -LiteralPath $success.OutputRoot -Recurse -Filter analysis-peek-pop.md | Select-Object -First 1
  $unexpectedWidgetReport = Get-ChildItem -LiteralPath $success.OutputRoot -Recurse -Filter analysis-widget.md | Select-Object -First 1
  $log = Get-ChildItem -LiteralPath $success.OutputRoot -Recurse -Filter decrypted.log | Select-Object -First 1
  Assert-Test ($null -ne $report -and $null -ne $peekPopReport -and $null -ne $log) 'success should save general and selected-category reports plus the full local log'
  Assert-Test ($null -eq $unexpectedWidgetReport) 'a category absent from the manifest must not get a report'
  Assert-Test ((Get-Content -LiteralPath $report.FullName -Raw) -notmatch 'PRIVATE_SENTINEL') 'sanitized report must omit raw message data'
  $peekPopReportText = Get-Content -LiteralPath $peekPopReport.FullName -Raw
  Assert-Test ($peekPopReportText -notmatch 'PRIVATE_SENTINEL') 'Peek & Pop report must omit raw message data'
  Assert-Test ($peekPopReportText -match 'willShow' -and $peekPopReportText -match 'didShow') 'Peek & Pop report should contain its category-specific safe event labels'

  $explicitAttempt = Invoke-Collector -Scenario 'explicit-old-attempt' -ExtraArguments @('-RunId', $runId, '-Attempt', '1') -OutputName 'explicit-old-attempt'
  Assert-Test ($explicitAttempt.ExitCode -eq 0) 'an explicitly requested historical attempt should be recoverable'
  $explicitAttemptReport = Get-ChildItem -LiteralPath $explicitAttempt.OutputRoot -Recurse -Filter analysis-report.md | Select-Object -First 1
  Assert-Test ((Get-Content -LiteralPath $explicitAttemptReport.FullName -Raw) -match "Run ID / attempt: $runId / 1") 'historical attempt report should retain the requested attempt identity'
  $explicitOldStop = Invoke-Collector -Scenario 'explicit-old-attempt' -ExtraArguments @('-RunId', $runId, '-Attempt', '1', '-Stop') -OutputName 'explicit-old-attempt-stop'
  Assert-Test ($explicitOldStop.ExitCode -ne 0 -and $explicitOldStop.Output -match 'historical; -Stop is allowed only for the current attempt') 'an explicit historical attempt must never be stopped'
  Assert-Test (-not (Test-Path -LiteralPath (Join-Path $testRoot 'status-posts.txt'))) 'historical attempt rejection must not publish a stop status'

  $multiLines = @(
    '2026-10-10 12:00:00.000+0000 App[1:2] [com.example:OpenPaymentPeekPopReturn] [PeekPopReturn] willShow customer=PRIVATE_SENTINEL'
    '2026-10-10 12:00:01.000+0000 App[1:2] [com.example:OpenPaymentPeekPopReturn] [PeekPopReturn] didShow customer=PRIVATE_SENTINEL'
    '2026-10-10 12:00:02.000+0000 App[1:2] [com.example:RigattiWidgetSync] [RigattiWidgetSync] timeline-published amount=9876.54 FINANCIAL_SENTINEL'
  )
  Set-Content -LiteralPath $plainFixture -Value $multiLines -Encoding UTF8
  $multiManifest = Get-Content -LiteralPath $manifestFixture -Raw | ConvertFrom-Json
  $multiManifest.category = 'OpenPaymentPeekPopReturn'
  $multiManifest.categories = @('OpenPaymentPeekPopReturn', 'RigattiWidgetSync')
  $multiManifest.predicate = 'category == "OpenPaymentPeekPopReturn" OR category == "RigattiWidgetSync"'
  $multiManifest.event_count = 3
  $multiManifest.session = 'SESSION_PRIVATE_SENTINEL'
  $multiManifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $manifestFixture -Encoding UTF8
  $multi = Invoke-Collector -Scenario 'multiple-categories' -ExtraArguments @('-RunId', $runId) -OutputName 'multiple-categories'
  Assert-Test ($multi.ExitCode -eq 0) 'generic analysis should accept multiple selected OSLog categories'
  $multiReport = Get-ChildItem -LiteralPath $multi.OutputRoot -Recurse -Filter analysis-report.md | Select-Object -First 1
  $multiReportText = Get-Content -LiteralPath $multiReport.FullName -Raw
  Assert-Test ($multiReportText -match 'OpenPaymentPeekPopReturn' -and $multiReportText -match 'RigattiWidgetSync') 'general report should identify both selected categories'
  Assert-Test ($multiReportText -match 'Manifest event count: 3' -and $multiReportText -match 'OpenPaymentPeekPopReturn: 2' -and $multiReportText -match 'RigattiWidgetSync: 1') 'general report should distinguish the manifest total from category counts'
  $multiPeekReport = Get-ChildItem -LiteralPath $multi.OutputRoot -Recurse -Filter analysis-peek-pop.md | Select-Object -First 1
  $multiWidgetReport = Get-ChildItem -LiteralPath $multi.OutputRoot -Recurse -Filter analysis-widget.md | Select-Object -First 1
  Assert-Test ($null -ne $multiPeekReport -and $null -ne $multiWidgetReport) 'both enabled diagnostic categories should get independent reports'
  $multiPeekText = Get-Content -LiteralPath $multiPeekReport.FullName -Raw
  $multiWidgetText = Get-Content -LiteralPath $multiWidgetReport.FullName -Raw
  Assert-Test ($multiPeekText -match 'Manifest event count across all selected categories: 3' -and $multiPeekText -match 'Records explicitly labeled for this category: 2' -and $multiPeekText -match 'willShow' -and $multiPeekText -match 'didShow') 'Peek & Pop report should contain its own attributed records and labels'
  Assert-Test ($multiWidgetText -match 'Manifest event count across all selected categories: 3' -and $multiWidgetText -match 'Records explicitly labeled for this category: 1' -and $multiWidgetText -match 'timeline-published') 'widget report should contain its own attributed records and labels'
  Assert-Test (($multiReportText + $multiPeekText + $multiWidgetText) -notmatch 'PRIVATE_SENTINEL|FINANCIAL_SENTINEL|9876\.54|SESSION_PRIVATE_SENTINEL') 'all reports must omit raw customer, financial, and arbitrary session values'
  Assert-Test ($multiPeekText -notmatch 'timeline-published' -and $multiWidgetText -notmatch 'willShow|didShow') 'the two category reports must not mix event sequences'

  Set-Content -LiteralPath $plainFixture -Value @(
    '2026-10-10 12:00:03.000+0000 App[1:2] [com.pareact.mobile:AppDiagnostics] [AppDiagnostics] app-start PRIVATE_SENTINEL'
    '2026-10-10 12:00:04.000+0000 Widget[3:4] [com.pareact.mobile.ExpoWidgetsTarget:RigattiWidgetSync] [RigattiWidgetSync] timeline-published FINANCIAL_SENTINEL'
    '2026-10-10 12:00:05.000+0000 App[1:2] [NativeAppleIntelligence:Search] [Search] query-start PRIVATE_SENTINEL'
    '2026-10-10 12:00:06.000+0000 SpringBoard[5:6] [com.apple.springboard:Lifecycle] [Lifecycle] unrelated-system-event'
  ) -Encoding UTF8
  $autoManifest = Get-Content -LiteralPath $manifestFixture -Raw | ConvertFrom-Json
  $autoManifest.schema_version = 3
  $autoManifest | Add-Member -NotePropertyName filter_mode -NotePropertyValue 'subsystem' -Force
  $autoManifest.category = $null
  $autoManifest.categories = @()
  $autoSubsystems = @(
    [pscustomobject]@{ match = 'prefix'; value = 'com.pareact.mobile' },
    [pscustomobject]@{ match = 'exact'; value = 'NativeAppleIntelligence' }
  )
  $autoManifest | Add-Member -NotePropertyName subsystems -NotePropertyValue $autoSubsystems -Force
  $autoManifest.predicate = 'subsystem BEGINSWITH "com.pareact.mobile" OR subsystem == "NativeAppleIntelligence"'
  $autoManifest.event_count = 4
  $autoManifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $manifestFixture -Encoding UTF8
  $autoCapture = Invoke-Collector -Scenario 'success' -ExtraArguments @('-RunId', $runId) -OutputName 'auto-subsystems'
  Assert-Test ($autoCapture.ExitCode -eq 0) 'subsystem-mode manifest should be validated and analyzed'
  $autoReport = Get-ChildItem -LiteralPath $autoCapture.OutputRoot -Recurse -Filter analysis-report.md | Select-Object -First 1
  $autoWidgetReport = Get-ChildItem -LiteralPath $autoCapture.OutputRoot -Recurse -Filter analysis-widget.md | Select-Object -First 1
  Assert-Test ($null -ne $autoReport -and $null -ne $autoWidgetReport) 'auto mode should discover known widget category without a category list in the manifest'
  $autoReportText = Get-Content -LiteralPath $autoReport.FullName -Raw
  Assert-Test ($autoReportText -match 'Filter mode: subsystem' -and $autoReportText -match 'prefix:com.pareact.mobile' -and $autoReportText -match 'exact:NativeAppleIntelligence') 'auto-mode report should state its subsystem filter'
  Assert-Test ($autoReportText -match 'AppDiagnostics: 1' -and $autoReportText -match 'RigattiWidgetSync: 1' -and $autoReportText -match 'Search: 1' -and $autoReportText -notmatch 'Lifecycle') 'auto-mode analysis should include app/widget/owned legacy subsystem categories and exclude unrelated system subsystems'
  $autoWidgetText = Get-Content -LiteralPath $autoWidgetReport.FullName -Raw
  Assert-Test ($autoWidgetText -match 'timeline-published' -and $autoWidgetText -notmatch 'FINANCIAL_SENTINEL') 'auto-discovered widget report should retain only safe event labels'
  Assert-Test (($autoReportText + $autoWidgetText) -notmatch 'PRIVATE_SENTINEL|FINANCIAL_SENTINEL') 'auto-mode reports must omit raw messages and sensitive values'

  $unsafeSubsystemManifest = Get-Content -LiteralPath $manifestFixture -Raw | ConvertFrom-Json
  $unsafeSubsystemManifest.subsystems = @([pscustomobject]@{ match = 'prefix'; value = 'com.apple' })
  $unsafeSubsystemManifest.predicate = 'subsystem BEGINSWITH "com.apple"'
  $unsafeSubsystemManifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $testRoot 'fixture\manifest.json') -Encoding UTF8
  $unsafeSubsystemCapture = Invoke-Collector -Scenario 'success' -ExtraArguments @('-RunId', $runId) -OutputName 'unsafe-subsystem-filter'
  Assert-Test ($unsafeSubsystemCapture.ExitCode -ne 0 -and $unsafeSubsystemCapture.Output -match 'outside the app-owned allowlist') 'collector must reject broad system subsystem filters before decryption'
  Assert-Test (-not (Get-ChildItem -LiteralPath $unsafeSubsystemCapture.OutputRoot -Filter decrypted.log -Recurse -ErrorAction SilentlyContinue)) 'unsafe subsystem filter must fail before plaintext log creation'

  $manifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $manifestFixture -Encoding UTF8

  [IO.File]::WriteAllText($plainFixture, '')
  $emptyManifest = Get-Content -LiteralPath $manifestFixture -Raw | ConvertFrom-Json
  $emptyManifest.category = 'OpenPaymentPeekPopReturn'
  $emptyManifest.categories = @('OpenPaymentPeekPopReturn')
  $emptyManifest.predicate = 'category == "OpenPaymentPeekPopReturn"'
  $emptyManifest.event_count = 0
  $emptyManifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $manifestFixture -Encoding UTF8
  $emptyCapture = Invoke-Collector -Scenario 'zero-event' -ExtraArguments @('-RunId', $runId) -OutputName 'zero-event'
  Assert-Test ($emptyCapture.ExitCode -eq 0) 'zero-event encrypted artifacts should still be analyzed'
  $emptyReport = Get-ChildItem -LiteralPath $emptyCapture.OutputRoot -Recurse -Filter analysis-report.md | Select-Object -First 1
  Assert-Test ((Get-Content -LiteralPath $emptyReport.FullName -Raw) -match 'No log events were recorded') 'zero events should be explicit in the report'
  $emptyPeekReport = Get-ChildItem -LiteralPath $emptyCapture.OutputRoot -Recurse -Filter analysis-peek-pop.md | Select-Object -First 1
  $emptyPeekText = Get-Content -LiteralPath $emptyPeekReport.FullName -Raw
  Assert-Test ($emptyPeekText -match 'No records carried an explicit label' -and $emptyPeekText -match 'does not prove the feature did not execute') 'zero category events must be reported as insufficient evidence'

  Set-Content -LiteralPath $plainFixture -Value '2026-10-10 12:00:00.000+0000 App[1:2] [com.example] runtime-message' -Encoding UTF8
  $unlabeledManifest = Get-Content -LiteralPath $manifestFixture -Raw | ConvertFrom-Json
  $unlabeledManifest.event_count = 1
  $unlabeledManifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $manifestFixture -Encoding UTF8
  $unlabeledCapture = Invoke-Collector -Scenario 'unlabeled-category' -ExtraArguments @('-RunId', $runId) -OutputName 'unlabeled-category'
  Assert-Test ($unlabeledCapture.ExitCode -eq 0) 'compact records without category labels should still be analyzed'
  $unlabeledPeekReport = Get-ChildItem -LiteralPath $unlabeledCapture.OutputRoot -Recurse -Filter analysis-peek-pop.md | Select-Object -First 1
  $unlabeledPeekText = Get-Content -LiteralPath $unlabeledPeekReport.FullName -Raw
  Assert-Test ($unlabeledPeekText -match 'unknown \(category not encoded per record\)' -and $unlabeledPeekText -match 'Per-category event counts are unknown') 'missing category labels must be marked unknown rather than counted as zero'

  Set-Content -LiteralPath $plainFixture -Value @(
    '2026-10-10 12:00:00.000+0000 App[1:2] [com.example:OpenPaymentPeekPopReturn] [PeekPopReturn] willShow customer=PRIVATE_SENTINEL'
    '2026-10-10 12:00:01.000+0000 App[1:2] [com.example:OpenPaymentPeekPopReturn] [PeekPopReturn] didShow customer=PRIVATE_SENTINEL'
  ) -Encoding UTF8
  $manifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $manifestFixture -Encoding UTF8

  $timeout = Invoke-Collector -Scenario 'timeout' -ExtraArguments @('-RunId', $runId) -OutputName 'timeout'
  Assert-Test ($timeout.ExitCode -ne 0 -and $timeout.Output -match 'No stop or cancellation was sent') 'timeout must not stop or cancel an active run'
  Assert-Test (-not (Test-Path -LiteralPath (Join-Path $testRoot 'status-posts.txt'))) 'normal invocation must not post a stop status'

  $missingArtifact = Invoke-Collector -Scenario 'artifact-missing' -ExtraArguments @('-RunId', $runId) -OutputName 'artifact-missing'
  Assert-Test ($missingArtifact.ExitCode -ne 0 -and $missingArtifact.Output -match 'was not found') 'missing artifact should produce a clear error'

  $expiredArtifact = Invoke-Collector -Scenario 'artifact-expired' -ExtraArguments @('-RunId', $runId) -OutputName 'artifact-expired'
  Assert-Test ($expiredArtifact.ExitCode -ne 0 -and $expiredArtifact.Output -match 'has expired') 'expired artifact should be rejected clearly'

  $otherAttemptArtifact = Invoke-Collector -Scenario 'artifact-other-attempt' -ExtraArguments @('-RunId', $runId) -OutputName 'artifact-other-attempt'
  Assert-Test ($otherAttemptArtifact.ExitCode -ne 0 -and $otherAttemptArtifact.Output -match 'other attempts exist') 'artifact from another attempt must not be selected'

  $wrongAttemptManifest = Get-Content -LiteralPath $manifestFixture -Raw | ConvertFrom-Json
  $wrongAttemptManifest.run_attempt = 2
  $wrongAttemptManifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $testRoot 'fixture\manifest.json') -Encoding UTF8
  $incompatibleManifest = Invoke-Collector -Scenario 'incompatible-manifest' -ExtraArguments @('-RunId', $runId) -OutputName 'incompatible-manifest'
  Assert-Test ($incompatibleManifest.ExitCode -ne 0 -and $incompatibleManifest.Output -match 'run_attempt does not match') 'manifest from another attempt must be rejected'
  Assert-Test (-not (Get-ChildItem -LiteralPath $incompatibleManifest.OutputRoot -Filter decrypted.log -Recurse -ErrorAction SilentlyContinue)) 'incompatible manifest must be rejected before decryption'
  $manifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $manifestFixture -Encoding UTF8

  $badManifest = Get-Content -LiteralPath $manifestFixture -Raw | ConvertFrom-Json
  $badManifest.ciphertext_sha256 = ('0' * 64)
  $badManifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $testRoot 'fixture\manifest.json') -Encoding UTF8
  $badHash = Invoke-Collector -Scenario 'bad-hash' -ExtraArguments @('-RunId', $runId) -OutputName 'bad-hash'
  Assert-Test ($badHash.ExitCode -ne 0 -and $badHash.Output -match 'Ciphertext SHA-256') 'bad ciphertext hash must be rejected before decryption'
  Assert-Test (-not (Get-ChildItem -LiteralPath (Join-Path $badHash.OutputRoot 'artifact-download') -Filter decrypted.log -ErrorAction SilentlyContinue)) 'bad hash must not produce plaintext'

  $manifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $testRoot 'fixture\manifest.json') -Encoding UTF8
  $decryptFailure = Invoke-Collector -Scenario 'decrypt-failure' -ExtraArguments @('-RunId', $runId) -OutputName 'decrypt-failure'
  Assert-Test ($decryptFailure.ExitCode -ne 0 -and $decryptFailure.Output -match 'age decryption failed') 'age failure should be visible without revealing key material'
  Assert-Test (-not (Get-ChildItem -LiteralPath $decryptFailure.OutputRoot -Filter decrypted.log -Recurse -ErrorAction SilentlyContinue)) 'failed decryption must remove partial plaintext'

  $wrongWorkflow = Invoke-Collector -Scenario 'wrong-workflow' -ExtraArguments @('-RunId', $runId, '-Stop') -OutputName 'wrong-workflow'
  Assert-Test ($wrongWorkflow.ExitCode -ne 0 -and $wrongWorkflow.Output -match 'not the NativeSim workflow') 'wrong workflow must be rejected before stop'
  Assert-Test (-not (Test-Path -LiteralPath (Join-Path $testRoot 'status-posts.txt'))) 'wrong workflow must never receive stop status'

  $stop = Invoke-Collector -Scenario 'stop' -ExtraArguments @('-RunId', $runId, '-Stop') -OutputName 'stop'
  Assert-Test ($stop.ExitCode -eq 0) 'authorized graceful-stop should finalize and recover'
  $stopPosts = @(Get-Content -LiteralPath (Join-Path $testRoot 'status-posts.txt'))
  Assert-Test ($stopPosts.Count -eq 1 -and ($stopPosts[0] -match 'native-sim-stop/12345') -and ($stopPosts[0] -match 'stop requested')) 'graceful-stop should post the scoped context and description once'
  Assert-Test ($stopPosts[0] -notmatch 'cancel') 'graceful-stop must not use GitHub cancel'

  $repeatedStop = Invoke-Collector -Scenario 'stop-repeated' -ExtraArguments @('-RunId', $runId, '-Stop') -OutputName 'stop-repeated'
  $stopPostsAfterRepeat = @(Get-Content -LiteralPath (Join-Path $testRoot 'status-posts.txt'))
  Assert-Test ($repeatedStop.ExitCode -eq 0 -and $repeatedStop.Output -match 'idempotent') 'repeated graceful-stop should reuse the existing status'
  Assert-Test ($stopPostsAfterRepeat.Count -eq $stopPosts.Count) 'repeated stop must not create a duplicate status'

  $staleStop = Invoke-Collector -Scenario 'stop-stale' -ExtraArguments @('-RunId', $runId, '-Stop') -OutputName 'stop-stale'
  Assert-Test ($staleStop.ExitCode -ne 0 -and $staleStop.Output -match 'stale stop status') 'a stop status from an earlier attempt must block an ambiguous new signal'
  Assert-Test ($stopPostsAfterRepeat.Count -eq 1) 'stale stop detection must not post a new status'

  $auto = Invoke-Collector -Scenario 'auto-single' -OutputName 'auto-single'
  Assert-Test ($auto.ExitCode -eq 0 -and $auto.Output -match 'Selected the only completed NativeSim session') 'one unambiguous completed session may be selected automatically'

  $currentStepNames = Invoke-Collector -Scenario 'current-step-names' -ExtraArguments @('-RunId', $runId) -OutputName 'current-step-names'
  Assert-Test ($currentStepNames.ExitCode -eq 0) 'current generic OSLog workflow step names should remain compatible with collection'

  $autoSmoke = Invoke-Collector -Scenario 'auto-smoke' -OutputName 'auto-smoke'
  Assert-Test ($autoSmoke.ExitCode -ne 0 -and $autoSmoke.Output -notmatch 'Could not verify the NativeSim session job') 'current OSLog smoke job name should not be mistaken for an unresolved NativeSim session'

  $postsBeforeAutoActive = @(Get-Content -LiteralPath (Join-Path $testRoot 'status-posts.txt')).Count
  $autoActive = Invoke-Collector -Scenario 'auto-active' -OutputName 'auto-active'
  $postsAfterAutoActive = @(Get-Content -LiteralPath (Join-Path $testRoot 'status-posts.txt')).Count
  Assert-Test ($autoActive.ExitCode -ne 0 -and $autoActive.Output -match 'Selected the only active NativeSim session') 'one active stream session may be identified automatically'
  Assert-Test ($autoActive.Output -match 'No -Stop was supplied' -and $postsAfterAutoActive -eq $postsBeforeAutoActive) 'auto-selection alone must never stop an active session'

  $autoUnresolved = Invoke-Collector -Scenario 'auto-unresolved' -OutputName 'auto-unresolved'
  Assert-Test ($autoUnresolved.ExitCode -ne 0 -and $autoUnresolved.Output -match 'NativeSim session job' -and $autoUnresolved.Output -match 'Specify only the intended -RunId') 'unverified active workflow jobs must block auto-selection'

  $ambiguous = Invoke-Collector -Scenario 'ambiguous' -OutputName 'ambiguous'
  Assert-Test ($ambiguous.ExitCode -ne 0 -and $ambiguous.Output -match 'More than one') 'multiple completed capture candidates must not be selected arbitrarily'

  Write-Host "Passed $testCount synthetic collection checks."
} finally {
  Remove-Item Env:NATIVE_SIM_MOCK_SCENARIO -ErrorAction SilentlyContinue
  Remove-Item Env:NATIVE_SIM_MOCK_ROOT -ErrorAction SilentlyContinue
  Remove-Item Env:NATIVE_SIM_MOCK_PLAINTEXT -ErrorAction SilentlyContinue
  if (Test-Path -LiteralPath $testRoot) {
    Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
