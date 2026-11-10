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
$saveAppRepository = 'LuanRigatti/SaveApp-NativeSim-Public'
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
$profile = $env:NATIVE_SIM_MOCK_PROFILE
$mockAttempt = if ($scenario -eq 'saveapp-rerun-stop') { 2 } else { 1 }
$stopPostedPath = Join-Path $root "stop-posted-$profile-$mockAttempt.txt"
$stopObservedPath = Join-Path $root "stop-observed-$profile-$mockAttempt.txt"
if ($profile -eq 'SaveApp') {
  $repo = 'LuanRigatti/SaveApp-NativeSim-Public'
  $jobName = 'Build and stream SaveApp'
  $startName = 'Start SaveApp OSLog capture'
  $finalizerName = 'Finalize SaveApp OSLog capture'
  $uploaderName = 'Upload encrypted SaveApp OSLog capture'
  $artifactPrefix = 'saveapp-native-sim-oslog-'
} else {
  $repo = 'LuanRigatti/Emporio-Rigatti-NativeSim-Public'
  $jobName = 'stream'
  $startName = 'Start PeekPop OSLog capture'
  $finalizerName = 'Finalize PeekPop OSLog capture'
  $uploaderName = 'Upload encrypted PeekPop logs'
  $artifactPrefix = 'native-sim-oslog-'
}
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
    Set-Content -LiteralPath $stopPostedPath -Value 'yes'
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
    $isStopped = Test-Path -LiteralPath $stopPostedPath
    $stopObserved = Test-Path -LiteralPath $stopObservedPath
    if ($isTimeout -or
        ($scenario -in @('stop', 'saveapp-rerun-stop') -and -not $isStopped) -or
        ($scenario -eq 'stop-repeated' -and -not $stopObserved) -or
        $scenario -eq 'stop-stale') {
      $steps = @(
        @{ name = $startName; status = 'completed'; conclusion = 'success' }
        @{ name = 'Hold the stream open'; status = 'in_progress'; conclusion = $null }
      )
    } elseif ($scenario -eq 'no-capture') {
      $steps = @(
        @{ name = $startName; status = 'completed'; conclusion = 'skipped' }
        @{ name = $finalizerName; status = 'completed'; conclusion = 'skipped' }
        @{ name = $uploaderName; status = 'completed'; conclusion = 'skipped' }
      )
    } elseif ($scenario -eq 'finalizer-failed') {
      $steps = @(
        @{ name = $startName; status = 'completed'; conclusion = 'success' }
        @{ name = $finalizerName; status = 'completed'; conclusion = 'failure' }
        @{ name = $uploaderName; status = 'completed'; conclusion = 'skipped' }
      )
    } elseif ($scenario -eq 'current-step-names') {
      $steps = if ($profile -eq 'SaveApp') { @(
          @{ name = $startName; status = 'completed'; conclusion = 'success' }
          @{ name = 'Keep the stream available'; status = 'completed'; conclusion = 'success' }
          @{ name = $finalizerName; status = 'completed'; conclusion = 'success' }
          @{ name = $uploaderName; status = 'completed'; conclusion = 'success' }
        ) } else { @(
          @{ name = 'Start OSLog capture'; status = 'completed'; conclusion = 'success' }
          @{ name = 'Hold the stream open'; status = 'completed'; conclusion = 'success' }
          @{ name = 'Finalize OSLog capture'; status = 'completed'; conclusion = 'success' }
          @{ name = 'Upload encrypted OSLog capture'; status = 'completed'; conclusion = 'success' }
        ) }
    } else {
      $steps = @(
        @{ name = $startName; status = 'completed'; conclusion = 'success' }
        @{ name = 'Hold the stream open'; status = 'completed'; conclusion = 'success' }
        @{ name = $finalizerName; status = 'completed'; conclusion = 'success' }
        @{ name = $uploaderName; status = 'completed'; conclusion = 'success' }
      )
    }
    Emit-Json @{ jobs = @(@{ name = $jobName; status = 'completed'; conclusion = 'success'; steps = $steps }) }
    return
  }
  if ($endpoint -match '/actions/runs/(\d+)/artifacts') {
    $artifactRunId = [string]$Matches[1]
    if ($scenario -eq 'artifact-missing') {
      Emit-Json @{ artifacts = @() }
    } else {
      $artifactAttempt = if ($scenario -in @('artifact-other-attempt', 'saveapp-rerun-stop')) { 2 } else { 1 }
      $expired = $scenario -eq 'artifact-expired'
      Emit-Json @{ artifacts = @(@{ name = "$artifactPrefix$artifactRunId-$artifactAttempt"; expired = $expired; id = 9876 }) }
    }
    return
  }
  if ($endpoint -match '/actions/runs/(\d+)/attempts/(\d+)$') {
    $id = [string]$Matches[1]
    $attempt = [int]$Matches[2]
    $status = 'completed'
    $conclusion = 'success'
    $stopObserved = Test-Path -LiteralPath $stopObservedPath
    if ($scenario -in @('timeout', 'auto-active') -or
        ($scenario -eq 'saveapp-rerun-stop' -and -not (Test-Path -LiteralPath $stopPostedPath)) -or
        ($scenario -eq 'stop' -and -not (Test-Path -LiteralPath $stopPostedPath)) -or
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
      head_branch = 'main'
      repository = @{ full_name = $repo }
    }
    return
  }
  if ($endpoint -match '/actions/runs/(\d+)$') {
    $id = [string]$Matches[1]
    $status = 'completed'
    $conclusion = 'success'
    $stopObserved = Test-Path -LiteralPath $stopObservedPath
    if ($scenario -in @('timeout', 'auto-active') -or
        ($scenario -eq 'saveapp-rerun-stop' -and -not (Test-Path -LiteralPath $stopPostedPath)) -or
        ($scenario -eq 'stop' -and -not (Test-Path -LiteralPath $stopPostedPath)) -or
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
      run_attempt = $(if ($scenario -in @('explicit-old-attempt', 'saveapp-rerun-stop')) { 2 } else { 1 })
      run_started_at = '2026-10-10T12:00:00Z'
      head_sha = $sha
      head_branch = 'main'
      repository = @{ full_name = $repo }
    }
    return
  }
  if ($endpoint -match '/commits/.+/statuses') {
    if ($scenario -eq 'stop-repeated') {
      Set-Content -LiteralPath $stopObservedPath -Value 'yes'
      $context = if ($profile -eq 'SaveApp') { 'native-sim-stop/12345/1' } else { 'native-sim-stop/12345' }
      Emit-Json @(@{ context = $context; state = 'success'; description = 'stop requested'; created_at = '2026-10-10T12:00:30Z' })
      return
    }
    if ($scenario -eq 'stop-stale') {
      $context = if ($profile -eq 'SaveApp') { 'native-sim-stop/12345/1' } else { 'native-sim-stop/12345' }
      Emit-Json @(@{ context = $context; state = 'success'; description = 'stop requested'; created_at = '2026-10-10T11:00:00Z' })
      return
    }
    if ($scenario -eq 'saveapp-rerun-stop') {
      Emit-Json @(@{ context = 'native-sim-stop/12345/1'; state = 'success'; description = 'stop requested'; created_at = '2026-10-10T12:00:30Z' })
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
    [ValidateSet('Emporio', 'SaveApp')][string]$Profile = 'Emporio',
    [string[]]$ExtraArguments = @(),
    [string]$RepositoryOverride,
    [string]$OutputName = $Scenario
  )

  $env:NATIVE_SIM_MOCK_SCENARIO = $Scenario
  $env:NATIVE_SIM_MOCK_ROOT = $testRoot
  $env:NATIVE_SIM_MOCK_PLAINTEXT = $plainFixture
  $env:NATIVE_SIM_MOCK_PROFILE = $Profile
  $caseOutput = Join-Path $testRoot $OutputName
  $selectedRepository = if ($RepositoryOverride) { $RepositoryOverride } elseif ($Profile -eq 'SaveApp') { $saveAppRepository } else { $repository }
  $arguments = @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $scriptPath,
    '-Profile', $Profile,
    '-Repository', $selectedRepository,
    '-GhPath', $mockGhPath,
    '-AgePath', $mockAgePath,
    '-IdentityPath', $identityPath,
    '-OutputRoot', $caseOutput,
    '-TimeoutSeconds', '2',
    '-PollIntervalSeconds', '1'
  ) + $ExtraArguments
  $processRoot = Join-Path $testRoot ($OutputName + '-process')
  New-Item -ItemType Directory -Path $processRoot -Force | Out-Null
  $stdoutPath = Join-Path $processRoot 'stdout.txt'
  $stderrPath = Join-Path $processRoot 'stderr.txt'
  $quotedArguments = (@($arguments | ForEach-Object {
    $argument = [string]$_
    if ($argument.Contains('"')) { throw 'Synthetic collector arguments cannot contain quote characters.' }
    if ($argument -match '\s') { '"' + $argument + '"' } else { $argument }
  }) -join ' ')
  $process = Start-Process -FilePath $powershellExe -ArgumentList $quotedArguments -NoNewWindow -Wait -PassThru `
    -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
  $output = (Get-Content -LiteralPath $stdoutPath -Raw -ErrorAction SilentlyContinue) + "`n" +
    (Get-Content -LiteralPath $stderrPath -Raw -ErrorAction SilentlyContinue)
  $output = ($output -replace '\s+', ' ').Trim()
  $exitCode = $process.ExitCode
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
  Assert-Test ($explicitOldStop.ExitCode -ne 0 -and $explicitOldStop.Output -match 'historical' -and $explicitOldStop.Output -match 'allowed only for the current attempt') 'an explicit historical attempt must never be stopped even when PowerShell wraps the diagnostic line'
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
  Assert-Test ($multiReportText -match 'widget_renderer_diagnostics system filter is not selected') 'base predicate must clearly report that the widget system profile is disabled'

  $widgetSystemPredicate = '((subsystem CONTAINS[c] "WidgetKit" OR subsystem CONTAINS[c] "SwiftUI" OR subsystem CONTAINS[c] "frontboard" OR subsystem CONTAINS[c] "runningboard" OR subsystem CONTAINS[c] "memorystatus") AND (messageType == error OR messageType == fault)) OR ((process == "SpringBoard" OR process == "runningboardd" OR process == "memorystatusd") AND (messageType == error OR messageType == fault OR eventMessage CONTAINS[c] "jetsam" OR eventMessage CONTAINS[c] "memory pressure" OR eventMessage CONTAINS[c] "killed"))'
  Set-Content -LiteralPath $plainFixture -Value @(
    '2026-10-10 12:00:00.000+0000 App[1:2] [com.pareact.mobile:RigattiWidgetSync] [RigattiWidgetSync] event=publish_start entry_count=2'
    '2026-10-10 12:00:01.000+0000 Widget[3:4] [com.pareact.mobile.ExpoWidgetsTarget:RigattiWidgetSync] [RigattiWidgetSync] event=renderer_redaction variant_name=static_test entry_index=0'
    '2026-10-10 12:00:02.000+0000 Widget[3:4] [com.pareact.mobile.ExpoWidgetsTarget:RigattiWidgetSync] [RigattiWidgetSync] event=renderer_enter view=TextView props_present=true'
    '===== widget renderer system diagnostics ====='
    '===== simulator process snapshot ====='
    '321 SpringBoard /private/var/PRIVATE_PROCESS_SENTINEL'
    '===== WidgetKit, SwiftUI, and termination OSLog errors ====='
    'Filtering the log data using the specified predicate'
    '2026-10-10 12:00:03.000+0000 WidgetKit[4:5] system-error PRIVATE_SYSTEM_SENTINEL'
    '===== recent app and widget crash/jetsam reports ====='
    '===== report_file=Widget-PRIVATE_DEVICE.ips ====='
    'PRIVATE_REPORT_SENTINEL'
  ) -Encoding UTF8
  $diagnosticManifest = Get-Content -LiteralPath $manifestFixture -Raw | ConvertFrom-Json
  $diagnosticManifest.schema_version = 3
  $diagnosticManifest | Add-Member -NotePropertyName filter_mode -NotePropertyValue 'subsystem' -Force
  $diagnosticManifest.category = $null
  $diagnosticManifest.categories = @()
  $diagnosticSubsystems = @(
    [pscustomobject]@{ match = 'prefix'; value = 'com.pareact.mobile' },
    [pscustomobject]@{ match = 'exact'; value = 'NativeAppleIntelligence' }
  )
  $diagnosticManifest | Add-Member -NotePropertyName subsystems -NotePropertyValue $diagnosticSubsystems -Force
  $diagnosticManifest.predicate = '(subsystem BEGINSWITH "com.pareact.mobile" OR subsystem == "NativeAppleIntelligence") OR (' + $widgetSystemPredicate + ')'
  $diagnosticManifest.event_count = 3
  $diagnosticManifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $manifestFixture -Encoding UTF8
  $diagnosticCapture = Invoke-Collector -Scenario 'widget-system-diagnostics' -ExtraArguments @('-RunId', $runId) -OutputName 'widget-system-diagnostics'
  Assert-Test ($diagnosticCapture.ExitCode -eq 0) 'approved subsystem diagnostics predicate and supplemental block should be accepted'
  $diagnosticReport = Get-ChildItem -LiteralPath $diagnosticCapture.OutputRoot -Recurse -Filter analysis-report.md | Select-Object -First 1
  $diagnosticReportText = Get-Content -LiteralPath $diagnosticReport.FullName -Raw
  $diagnosticWidgetReport = Get-ChildItem -LiteralPath $diagnosticCapture.OutputRoot -Recurse -Filter analysis-widget.md | Select-Object -First 1
  $diagnosticWidgetText = Get-Content -LiteralPath $diagnosticWidgetReport.FullName -Raw
  Assert-Test ($diagnosticReportText -match 'System diagnostics predicate selected: True' -and $diagnosticReportText -match 'Supplemental artifact block present: True') 'system profile selection and supplement marker should be reported'
  Assert-Test ($diagnosticReportText -match '1 / 0' -and $diagnosticReportText -match 'Matching crash/Jetsam report markers: 1') 'supplementary system and crash metadata counts should be reported without parsing raw records'
  Assert-Test ($diagnosticReportText -match 'Manifest event count: 3' -and $diagnosticReportText -notmatch 'differ from manifest event_count') 'supplementary lines must not be counted as log stream events'
  Assert-Test ($diagnosticWidgetText -match 'publish_start' -and $diagnosticWidgetText -match 'renderer_redaction' -and $diagnosticWidgetText -match 'renderer_enter') 'event= labels with underscores should be recognized for the widget category'
  Assert-Test (($diagnosticReportText + $diagnosticWidgetText) -notmatch 'PRIVATE_PROCESS_SENTINEL|PRIVATE_SYSTEM_SENTINEL|PRIVATE_REPORT_SENTINEL|PRIVATE_DEVICE') 'supplementary raw system logs, process details, report contents and filenames must not enter reports'

  Set-Content -LiteralPath $plainFixture -Value @(
    '2026-10-10 12:00:00.000+0000 App[1:2] [com.example:OpenPaymentPeekPopReturn] [PeekPopReturn] willShow customer=PRIVATE_SENTINEL'
  ) -Encoding UTF8
  $incompleteManifest = Get-Content -LiteralPath $manifestFixture -Raw | ConvertFrom-Json
  $incompleteManifest.predicate = '(category == "OpenPaymentPeekPopReturn") OR (' + $widgetSystemPredicate + ')'
  $incompleteManifest.categories = @('OpenPaymentPeekPopReturn')
  $incompleteManifest.category = 'OpenPaymentPeekPopReturn'
  $incompleteManifest | Add-Member -NotePropertyName filter_mode -NotePropertyValue 'category' -Force
  $incompleteManifest | Add-Member -NotePropertyName subsystems -NotePropertyValue @() -Force
  $incompleteManifest.event_count = 1
  $incompleteManifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $manifestFixture -Encoding UTF8
  $incompleteCapture = Invoke-Collector -Scenario 'widget-system-incomplete' -ExtraArguments @('-RunId', $runId) -OutputName 'widget-system-incomplete'
  Assert-Test ($incompleteCapture.ExitCode -eq 0) 'approved category predicate should be accepted when RigattiWidgetSync is omitted'
  $incompleteReport = Get-ChildItem -LiteralPath $incompleteCapture.OutputRoot -Recurse -Filter analysis-report.md | Select-Object -First 1
  $incompleteReportText = Get-Content -LiteralPath $incompleteReport.FullName -Raw
  Assert-Test ($incompleteReportText -match 'filter is selected but its encrypted-artifact supplement is missing' -and $incompleteReportText -match 'does not select RigattiWidgetSync') 'missing system supplement and widget category should be explicit'

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
  Assert-Test ($unsafeSubsystemCapture.ExitCode -ne 0 -and
    $unsafeSubsystemCapture.Output -match 'manifest.json contains a subsystem outside the' -and
    $unsafeSubsystemCapture.Output -match 'app-owned allowlist') 'collector must reject broad system subsystem filters before decryption even when PowerShell interleaves its error context'
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

  $saveAppLines = @(
    '2026-10-27 12:00:00.000+0000 SaveApp[1:2] [com.luanrigatti.saveapp:quick-save.intent] event=intent.started correlation=PRIVATE_SENTINEL'
    '2026-10-27 12:00:01.000+0000 SaveApp[1:2] [com.luanrigatti.saveapp:quick-save.sqlite] event=database.commit.confirmed correlation=PRIVATE_SENTINEL'
  )
  Set-Content -LiteralPath $plainFixture -Value $saveAppLines -Encoding UTF8
  $saveAppManifest = [ordered]@{
    schema_version = 3
    repository = $saveAppRepository
    run_id = $runId
    run_attempt = 1
    session = 'synthetic-saveapp-session'
    commit = $sha
    filter_mode = 'subsystem'
    category = $null
    categories = @()
    subsystems = @(@{ match = 'prefix'; value = 'com.luanrigatti.saveapp' })
    predicate = 'subsystem BEGINSWITH "com.luanrigatti.saveapp"'
    stream_level = 'debug'
    started_at_utc = '2026-10-27T12:00:00Z'
    finished_at_utc = '2026-10-27T12:00:02Z'
    event_count = 2
    capture_outcome = 'graceful-stop'
    ciphertext_sha256 = $cipherHash
  }
  $saveAppManifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $manifestFixture -Encoding UTF8

  $saveAppSuccess = Invoke-Collector -Scenario 'success' -Profile 'SaveApp' -ExtraArguments @('-RunId', $runId) -OutputName 'saveapp-success'
  Assert-Test ($saveAppSuccess.ExitCode -eq 0) 'SaveApp profile accepts only its exact subsystem manifest and recovers the encrypted artifact'
  Assert-Test ($saveAppSuccess.Output -notmatch 'PRIVATE_SENTINEL') 'SaveApp recovery never prints raw OSLog messages or correlation data'
  $saveAppReport = Get-ChildItem -LiteralPath $saveAppSuccess.OutputRoot -Recurse -Filter analysis-report.md | Select-Object -First 1
  $saveAppLog = Get-ChildItem -LiteralPath $saveAppSuccess.OutputRoot -Recurse -Filter decrypted.log | Select-Object -First 1
  Assert-Test ($null -ne $saveAppReport -and $null -ne $saveAppLog) 'SaveApp profile writes the existing private report and decrypted log outputs'
  $saveAppReportText = Get-Content -LiteralPath $saveAppReport.FullName -Raw
  Assert-Test ($saveAppReportText -match 'Capture scope' -and $saveAppReportText -match 'intent.started' -and $saveAppReportText -notmatch 'PRIVATE_SENTINEL') 'SaveApp event labels are summarized without messages or private correlation values'
  Assert-Test ($null -eq (Get-ChildItem -LiteralPath $saveAppSuccess.OutputRoot -Recurse -Filter analysis-widget.md -ErrorAction SilentlyContinue)) 'SaveApp profile does not generate Emporio-specific widget reports'

  $saveAppStopCountBefore = if (Test-Path -LiteralPath (Join-Path $testRoot 'status-posts.txt')) { @(Get-Content -LiteralPath (Join-Path $testRoot 'status-posts.txt')).Count } else { 0 }
  $saveAppStop = Invoke-Collector -Scenario 'stop' -Profile 'SaveApp' -ExtraArguments @('-RunId', $runId, '-Stop') -OutputName 'saveapp-stop'
  $saveAppStopPosts = @(Get-Content -LiteralPath (Join-Path $testRoot 'status-posts.txt'))
  Assert-Test ($saveAppStop.ExitCode -eq 0 -and $saveAppStopPosts.Count -eq ($saveAppStopCountBefore + 1) -and
    $saveAppStopPosts[-1] -match 'native-sim-stop/12345/1') 'SaveApp profile sends an attempt-scoped graceful-stop status and recovers the resulting artifact'

  $saveAppManifest.run_attempt = 2
  $saveAppManifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $manifestFixture -Encoding UTF8
  $saveAppRerunStop = Invoke-Collector -Scenario 'saveapp-rerun-stop' -Profile 'SaveApp' -ExtraArguments @('-RunId', $runId, '-Stop') -OutputName 'saveapp-rerun-stop'
  $saveAppStopPostsAfterRerun = @(Get-Content -LiteralPath (Join-Path $testRoot 'status-posts.txt'))
  Assert-Test ($saveAppRerunStop.ExitCode -eq 0 -and $saveAppStopPostsAfterRerun.Count -eq ($saveAppStopCountBefore + 2) -and
    $saveAppStopPostsAfterRerun[-1] -match 'native-sim-stop/12345/2') 'a prior SaveApp attempt stop cannot stop a rerun; the collector sends the exact current-attempt context'
  $saveAppManifest.run_attempt = 1
  $saveAppManifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $manifestFixture -Encoding UTF8

  $saveAppPostsBeforeNoCapture = @(Get-Content -LiteralPath (Join-Path $testRoot 'status-posts.txt')).Count
  $saveAppNoCapture = Invoke-Collector -Scenario 'no-capture' -Profile 'SaveApp' -ExtraArguments @('-RunId', $runId, '-Stop') -OutputName 'saveapp-no-capture'
  $saveAppPostsAfterNoCapture = @(Get-Content -LiteralPath (Join-Path $testRoot 'status-posts.txt')).Count
  Assert-Test ($saveAppNoCapture.ExitCode -ne 0 -and
    $saveAppNoCapture.Output -match 'capture start step was skipped|Finalize SaveApp OSLog capture.*step was skipped' -and
    $saveAppPostsAfterNoCapture -eq $saveAppPostsBeforeNoCapture) 'SaveApp profile refuses to stop a session whose capture did not start'

  $wrongSaveAppRepository = Invoke-Collector -Scenario 'success' -Profile 'SaveApp' `
    -ExtraArguments @('-RunId', $runId) -RepositoryOverride 'LuanRigatti/another-public-repo' -OutputName 'saveapp-wrong-repository'
  Assert-Test ($wrongSaveAppRepository.ExitCode -ne 0 -and $wrongSaveAppRepository.Output -match 'only permits its configured NativeSim repository') 'SaveApp profile rejects arbitrary repositories before any artifact operation'

  $invalidSaveAppManifest = $saveAppManifest | ConvertTo-Json -Depth 10 | ConvertFrom-Json
  $invalidSaveAppManifest.subsystems = @(@{ match = 'prefix'; value = 'com.example.other' })
  $invalidSaveAppManifest.predicate = 'subsystem BEGINSWITH "com.example.other"'
  $invalidSaveAppManifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $manifestFixture -Encoding UTF8
  $saveAppWrongSelector = Invoke-Collector -Scenario 'success' -Profile 'SaveApp' -ExtraArguments @('-RunId', $runId) -OutputName 'saveapp-wrong-selector'
  Assert-Test ($saveAppWrongSelector.ExitCode -ne 0 -and $saveAppWrongSelector.Output -match 'outside the app-owned allowlist') 'SaveApp profile rejects a manifest with an unapproved OSLog subsystem selector'

  Write-Host "Passed $testCount synthetic collection checks across Emporio and SaveApp profiles."
} finally {
  Remove-Item Env:NATIVE_SIM_MOCK_SCENARIO -ErrorAction SilentlyContinue
  Remove-Item Env:NATIVE_SIM_MOCK_ROOT -ErrorAction SilentlyContinue
  Remove-Item Env:NATIVE_SIM_MOCK_PLAINTEXT -ErrorAction SilentlyContinue
  Remove-Item Env:NATIVE_SIM_MOCK_PROFILE -ErrorAction SilentlyContinue
  if (Test-Path -LiteralPath $testRoot) {
    Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
