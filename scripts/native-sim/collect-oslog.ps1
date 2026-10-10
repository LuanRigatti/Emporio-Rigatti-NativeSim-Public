[CmdletBinding()]
param(
  [Parameter()]
  [ValidatePattern('^\d{1,20}$')]
  [string]$RunId,

  [Parameter()]
  [ValidateRange(1, 2147483647)]
  [int]$Attempt = 0,

  [Parameter()]
  [switch]$Stop,

  [Parameter()]
  [ValidateRange(1, 86400)]
  [int]$TimeoutSeconds = 1800,

  [Parameter()]
  [ValidateRange(1, 300)]
  [int]$PollIntervalSeconds = 10,

  [Parameter()]
  [ValidatePattern('^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')]
  [string]$Repository = 'LuanRigatti/Emporio-Rigatti-NativeSim-Public',

  [Parameter()]
  [string]$GhPath = 'gh',

  [Parameter()]
  [string]$AgePath = (Join-Path $env:USERPROFILE 'Tools\age\age.exe'),

  [Parameter()]
  [string]$IdentityPath = (Join-Path $env:USERPROFILE '.config\age\native-sim-identity.txt'),

  [Parameter()]
  [string]$OutputRoot = $(
    if ($env:LOCALAPPDATA) {
      Join-Path $env:LOCALAPPDATA 'EmporioRigatti\NativeSim\OSLog'
    } else {
      Join-Path $env:USERPROFILE 'AppData\Local\EmporioRigatti\NativeSim\OSLog'
    }
  )
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$script:WorkflowPath = '.github/workflows/native-sim.yml'
$script:ArtifactPrefix = 'native-sim-oslog-'
$script:FinalizerStepName = 'Finalize OSLog capture'
$script:UploaderStepName = 'Upload encrypted OSLog capture'
$script:CaptureStartStepName = 'Start OSLog capture'
$script:ProjectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$script:Deadline = $null

function Resolve-ExecutablePath {
  param([Parameter(Mandatory = $true)][string]$PathOrCommand)

  if (Test-Path -LiteralPath $PathOrCommand -PathType Leaf) {
    return (Resolve-Path -LiteralPath $PathOrCommand).Path
  }

  try {
    $command = Get-Command -Name $PathOrCommand -ErrorAction Stop
  } catch {
    throw "Required local executable '$PathOrCommand' was not found."
  }

  if ($command.Source) { return $command.Source }
  if ($command.Path) { return $command.Path }
  throw "Could not resolve the executable '$PathOrCommand'."
}

function Invoke-Gh {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)

  $global:LASTEXITCODE = 0
  $output = & $script:GhExecutable @Arguments 2>$null
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    throw "GitHub CLI request failed (exit code $exitCode). Check gh authentication, repository access, and network connectivity."
  }

  return (@($output | ForEach-Object { [string]$_ }) -join [Environment]::NewLine).Trim()
}

function Invoke-GhJson {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)

  $text = Invoke-Gh -Arguments $Arguments
  if ([string]::IsNullOrWhiteSpace($text)) {
    throw 'GitHub returned an empty response while session metadata was expected.'
  }
  try {
    return ($text | ConvertFrom-Json -ErrorAction Stop)
  } catch {
    throw 'GitHub returned metadata that could not be parsed as JSON.'
  }
}

function Get-JsonValue {
  param(
    [Parameter(Mandatory = $false)]$Object,
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $false)]$Default = $null
  )

  if ($null -eq $Object) { return $Default }
  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) { return $Default }
  return $property.Value
}

function Get-NativeSimRun {
  param(
    [Parameter(Mandatory = $true)][string]$Id,
    [Parameter(Mandatory = $false)][int]$Attempt = 0
  )

  $endpoint = if ($Attempt -gt 0) {
    "repos/$Repository/actions/runs/$Id/attempts/$Attempt"
  } else {
    "repos/$Repository/actions/runs/$Id"
  }
  $run = Invoke-GhJson -Arguments @('api', $endpoint)
  if ([string](Get-JsonValue $run 'id') -ne $Id) {
    throw "GitHub returned a different run than requested ($Id)."
  }

  $path = [string](Get-JsonValue $run 'path')
  if ($path.TrimStart('/') -ne $script:WorkflowPath) {
    throw "Run $Id belongs to '$path', not the NativeSim workflow '$script:WorkflowPath'."
  }

  $actualRepository = [string](Get-JsonValue (Get-JsonValue $run 'repository') 'full_name')
  if (-not [string]::Equals($actualRepository, $Repository, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Run $Id belongs to '$actualRepository', not '$Repository'."
  }

  $sha = [string](Get-JsonValue $run 'head_sha')
  if ($sha -notmatch '^[0-9a-fA-F]{40}$') {
    throw "Run $Id has no valid workflow commit SHA; refusing status or artifact operations."
  }

  $parsedAttempt = 0
  if (-not [int]::TryParse([string](Get-JsonValue $run 'run_attempt'), [ref]$parsedAttempt) -or $parsedAttempt -lt 1) {
    throw "Run $Id has no valid run attempt."
  }
  if ($Attempt -gt 0 -and $parsedAttempt -ne $Attempt) {
    throw "GitHub returned attempt $parsedAttempt when attempt $Attempt was requested for run $Id."
  }

  if ([string](Get-JsonValue $run 'event') -ne 'workflow_dispatch') {
    throw "Run $Id was not started as a NativeSim workflow_dispatch session."
  }

  return $run
}

function Get-NativeSimJobs {
  param(
    [Parameter(Mandatory = $true)][string]$Id,
    [Parameter(Mandatory = $false)][int]$Attempt = 0
  )

  $endpoint = if ($Attempt -gt 0) {
    "repos/$Repository/actions/runs/$Id/attempts/$Attempt/jobs?per_page=100"
  } else {
    "repos/$Repository/actions/runs/$Id/jobs?per_page=100"
  }
  return (Invoke-GhJson -Arguments @('api', $endpoint))
}

function Get-StreamJob {
  param([Parameter(Mandatory = $false)]$JobsResponse)

  foreach ($job in @(Get-JsonValue $JobsResponse 'jobs' @())) {
    if ([string](Get-JsonValue $job 'name') -eq 'stream') { return $job }
  }
  return $null
}

function Get-JobStep {
  param(
    [Parameter(Mandatory = $false)]$Job,
    [Parameter(Mandatory = $true)][string]$Name
  )

  $acceptedNames = @($Name)
  switch ($Name) {
    'Start OSLog capture' { $acceptedNames += 'Start PeekPop OSLog capture' }
    'Finalize OSLog capture' { $acceptedNames += 'Finalize PeekPop OSLog capture' }
    'Upload encrypted OSLog capture' { $acceptedNames += 'Upload encrypted PeekPop logs' }
  }

  foreach ($step in @(Get-JsonValue $Job 'steps' @())) {
    if ([string](Get-JsonValue $step 'name') -in $acceptedNames) { return $step }
  }
  return $null
}

function Get-RunArtifacts {
  param([Parameter(Mandatory = $true)][string]$Id)

  return (Invoke-GhJson -Arguments @('api', "repos/$Repository/actions/runs/$Id/artifacts?per_page=100"))
}

function Get-RecentWorkflowRuns {
  $recentRuns = New-Object 'System.Collections.Generic.List[object]'
  $retentionWindowStart = [DateTimeOffset]::UtcNow.AddDays(-2)
  $page = 1
  $maxPages = 20

  while ($page -le $maxPages) {
    $response = Invoke-GhJson -Arguments @(
      'api',
      "repos/$Repository/actions/workflows/native-sim.yml/runs?per_page=100&page=$page"
    )
    $pageRuns = @(Get-JsonValue $response 'workflow_runs' @())
    if ($pageRuns.Count -eq 0) { return @($recentRuns.ToArray()) }
    foreach ($candidate in $pageRuns) { $recentRuns.Add($candidate) }

    $oldestCreatedAt = [DateTimeOffset]::MaxValue
    $oldestRun = $pageRuns[$pageRuns.Count - 1]
    $oldestCreatedText = [string](Get-JsonValue $oldestRun 'created_at')
    if (-not [DateTimeOffset]::TryParse(
      $oldestCreatedText,
      [Globalization.CultureInfo]::InvariantCulture,
      [Globalization.DateTimeStyles]::AssumeUniversal,
      [ref]$oldestCreatedAt
    )) {
      throw 'Could not verify the time coverage of GitHub workflow-run pages; provide -RunId instead of auto-selecting.'
    }
    if ($oldestCreatedAt -lt $retentionWindowStart -or $pageRuns.Count -lt 100) {
      return @($recentRuns.ToArray())
    }
    $page++
  }

  throw 'More than 2000 recent NativeSim workflow runs prevent safe automatic candidate enumeration. Specify only the intended -RunId.'
}

function Find-ExactAttemptArtifact {
  param(
    [Parameter(Mandatory = $true)][string]$Id,
    [Parameter(Mandatory = $true)][int]$Attempt
  )

  $response = Get-RunArtifacts -Id $Id
  $expectedName = "$script:ArtifactPrefix$Id-$Attempt"
  foreach ($artifact in @(Get-JsonValue $response 'artifacts' @())) {
    if ([string](Get-JsonValue $artifact 'name') -eq $expectedName) { return $artifact }
  }
  return $null
}

function Get-AutomaticRunSelection {
  $workflowRuns = @(Get-RecentWorkflowRuns)
  $eligibleRuns = @($workflowRuns | Where-Object {
    ([string](Get-JsonValue $_ 'path')).TrimStart('/') -eq $script:WorkflowPath -and
    [string](Get-JsonValue $_ 'event') -eq 'workflow_dispatch'
  })

  $activeCandidates = @()
  $unresolvedActiveCandidates = @()
  foreach ($candidate in @($eligibleRuns | Where-Object { [string](Get-JsonValue $_ 'status') -eq 'in_progress' })) {
    $candidateId = [string](Get-JsonValue $candidate 'id')
    $jobs = Get-NativeSimJobs -Id $candidateId
    if ($null -ne (Get-StreamJob -JobsResponse $jobs)) {
      $activeCandidates += $candidate
    } else {
      $jobNames = @((Get-JsonValue $jobs 'jobs' @()) | ForEach-Object { [string](Get-JsonValue $_ 'name') })
      $isKnownCaptureSmokeRun = @($jobNames | Where-Object { $_ -in @(
        'peekpop-capture-smoke', 'peekpop-capture-smoke-windows',
        'OSLog capture smoke tests', 'Verify OSLog artifact on Windows'
      ) }).Count -gt 0
      if (-not $isKnownCaptureSmokeRun) { $unresolvedActiveCandidates += $candidate }
    }
  }

  if ($unresolvedActiveCandidates.Count -gt 0) {
    $ids = (@($unresolvedActiveCandidates | ForEach-Object { [string](Get-JsonValue $_ 'id') }) -join ', ')
    throw "Could not verify the NativeSim session job for active run(s) $ids. Specify only the intended -RunId; no run was selected automatically."
  }
  if ($activeCandidates.Count -gt 1) {
    $ids = (@($activeCandidates | ForEach-Object { [string](Get-JsonValue $_ 'id') }) -join ', ')
    throw "More than one active NativeSim session is eligible ($ids). Specify only the intended -RunId."
  }
  if ($activeCandidates.Count -eq 1) {
    $id = [string](Get-JsonValue $activeCandidates[0] 'id')
    Write-Host "Selected the only active NativeSim session: run $id."
    return (Get-NativeSimRun -Id $id)
  }

  $completedCandidates = @()
  foreach ($candidate in @($eligibleRuns | Where-Object { [string](Get-JsonValue $_ 'status') -eq 'completed' })) {
    $candidateId = [string](Get-JsonValue $candidate 'id')
    $attempt = 0
    if (-not [int]::TryParse([string](Get-JsonValue $candidate 'run_attempt'), [ref]$attempt) -or $attempt -lt 1) {
      continue
    }
    $jobs = Get-NativeSimJobs -Id $candidateId
    if ($null -eq (Get-StreamJob -JobsResponse $jobs)) { continue }
    $artifact = Find-ExactAttemptArtifact -Id $candidateId -Attempt $attempt
    if ($null -ne $artifact -and -not [bool](Get-JsonValue $artifact 'expired' $true)) {
      $completedCandidates += $candidate
    }
  }

  if ($completedCandidates.Count -gt 1) {
    $ids = (@($completedCandidates | ForEach-Object { [string](Get-JsonValue $_ 'id') }) -join ', ')
    throw "More than one completed NativeSim session has a current, unexpired capture artifact ($ids). Specify the intended -RunId."
  }
  if ($completedCandidates.Count -eq 1) {
    $id = [string](Get-JsonValue $completedCandidates[0] 'id')
    Write-Host "Selected the only completed NativeSim session with a recoverable capture: run $id."
    return (Get-NativeSimRun -Id $id)
  }

  $recentIds = @($eligibleRuns | Select-Object -First 5 | ForEach-Object { [string](Get-JsonValue $_ 'id') })
  $hint = if ($recentIds.Count -gt 0) { " Recent NativeSim run IDs: $($recentIds -join ', ')." } else { '' }
  throw "Could not identify one active session or one completed session with an unexpired OSLog artifact.$hint Provide only the intended -RunId."
}

function Get-RemainingSeconds {
  $remaining = [int][Math]::Ceiling(($script:Deadline - [DateTime]::UtcNow).TotalSeconds)
  return [Math]::Max(0, $remaining)
}

function Wait-ForCaptureStart {
  param([Parameter(Mandatory = $true)]$Run)

  while ($true) {
    $attempt = [int](Get-JsonValue $Run 'run_attempt')
    $jobs = Get-NativeSimJobs -Id ([string]$Run.id) -Attempt $attempt
    $job = Get-StreamJob -JobsResponse $jobs
    $step = Get-JobStep -Job $job -Name $script:CaptureStartStepName
    $conclusion = [string](Get-JsonValue $step 'conclusion')
    if ($conclusion -eq 'success') { return }
    if ($conclusion -eq 'skipped') {
      throw 'The NativeSim capture start step was skipped; the current workflow cannot receive the graceful-stop status signal. No stop signal was sent.'
    }
    if ($conclusion -eq 'failure' -or $conclusion -eq 'cancelled') {
      throw "The '$script:CaptureStartStepName' step concluded '$conclusion'; no stop signal was sent."
    }

    $freshRun = Get-NativeSimRun -Id ([string]$Run.id) -Attempt $attempt
    if ([string](Get-JsonValue $freshRun 'status') -eq 'completed') {
      throw 'The NativeSim run ended before OSLog capture became active; no stop signal was sent.'
    }
    if ((Get-RemainingSeconds) -le 0) {
      throw "Timed out waiting for '$script:CaptureStartStepName'; no stop signal was sent."
    }
    Start-Sleep -Seconds ([Math]::Min($PollIntervalSeconds, (Get-RemainingSeconds)))
  }
}

function Request-GracefulStop {
  param([Parameter(Mandatory = $true)]$Run)

  $latestRun = Get-NativeSimRun -Id ([string]$Run.id)
  if ([int](Get-JsonValue $latestRun 'run_attempt') -ne [int](Get-JsonValue $Run 'run_attempt')) {
    throw "Run $($Run.id) attempt $($Run.run_attempt) is not the current attempt; no stop signal was sent."
  }

  $status = [string](Get-JsonValue $Run 'status')
  if (@('queued', 'in_progress', 'waiting', 'requested', 'pending') -notcontains $status) {
    throw "Run $($Run.id) is '$status'; graceful-stop is only sent to an active run."
  }

  Wait-ForCaptureStart -Run $Run

  $runIdText = [string]$Run.id
  $context = "native-sim-stop/$runIdText"
  $sha = [string]$Run.head_sha
  $statuses = @(Invoke-GhJson -Arguments @('api', "repos/$Repository/commits/$sha/statuses?per_page=100"))
  $matchingStatuses = @($statuses | Where-Object {
    [string](Get-JsonValue $_ 'context') -eq $context -and
    [string](Get-JsonValue $_ 'state') -eq 'success' -and
    [string](Get-JsonValue $_ 'description') -eq 'stop requested'
  })

  if ($matchingStatuses.Count -gt 0) {
    $startedAtText = [string](Get-JsonValue $Run 'run_started_at')
    $startedAt = [DateTimeOffset]::MinValue
    $hasStartedAt = [DateTimeOffset]::TryParse(
      $startedAtText,
      [Globalization.CultureInfo]::InvariantCulture,
      [Globalization.DateTimeStyles]::AssumeUniversal,
      [ref]$startedAt
    )
    $matchingAfterStart = $false
    foreach ($existing in $matchingStatuses) {
      $createdAt = [DateTimeOffset]::MinValue
      $hasCreatedAt = [DateTimeOffset]::TryParse(
        [string](Get-JsonValue $existing 'created_at'),
        [Globalization.CultureInfo]::InvariantCulture,
        [Globalization.DateTimeStyles]::AssumeUniversal,
        [ref]$createdAt
      )
      if ($hasStartedAt -and $hasCreatedAt -and $createdAt -ge $startedAt) {
        $matchingAfterStart = $true
      } elseif (-not $hasStartedAt -or -not $hasCreatedAt) {
        throw 'A prior stop status exists but its time cannot be compared with this run attempt. Refusing to send an ambiguous stop signal.'
      }
    }
    if ($matchingAfterStart) {
      Write-Host "Graceful-stop was already requested for run $runIdText; keeping the request idempotent."
      return
    }
    throw "A stale stop status for run $runIdText predates this run attempt. The workflow status signal cannot distinguish attempts safely; no new signal was sent."
  }

  $null = Invoke-Gh -Arguments @(
    'api', '--method', 'POST', "repos/$Repository/statuses/$sha",
    '-f', 'state=success',
    '-f', "context=$context",
    '-f', 'description=stop requested'
  )
  Write-Host "Graceful-stop requested for NativeSim run $runIdText (attempt $($Run.run_attempt))."
}

function Wait-ForRunFinalization {
  param([Parameter(Mandatory = $true)]$Run)

  $lastState = ''
  while ($true) {
    $attempt = [int](Get-JsonValue $Run 'run_attempt')
    $freshRun = Get-NativeSimRun -Id ([string]$Run.id) -Attempt $attempt
    $runStatus = [string](Get-JsonValue $freshRun 'status')
    $jobs = Get-NativeSimJobs -Id ([string]$Run.id) -Attempt $attempt
    $streamJob = Get-StreamJob -JobsResponse $jobs
    $finalizer = Get-JobStep -Job $streamJob -Name $script:FinalizerStepName
    $uploader = Get-JobStep -Job $streamJob -Name $script:UploaderStepName
    $finalizerConclusion = [string](Get-JsonValue $finalizer 'conclusion')
    $uploaderConclusion = [string](Get-JsonValue $uploader 'conclusion')
    $state = "$runStatus|$finalizerConclusion|$uploaderConclusion"
    if ($state -ne $lastState) {
      $finalizerDisplay = if ($finalizerConclusion) { $finalizerConclusion } else { 'pending' }
      $uploaderDisplay = if ($uploaderConclusion) { $uploaderConclusion } else { 'pending' }
      Write-Host "NativeSim run state: $runStatus; finalizer=$finalizerDisplay; upload=$uploaderDisplay."
      $lastState = $state
    }

    if ($uploaderConclusion -eq 'failure' -or $uploaderConclusion -eq 'cancelled') {
      throw "The '$script:UploaderStepName' step concluded '$uploaderConclusion'; the artifact may be unavailable or incomplete."
    }
    if ($runStatus -eq 'completed') {
      if ($null -eq $finalizer) {
        throw "The completed run has no '$script:FinalizerStepName' step. Verify that capture was enabled for this run."
      }
      if ($null -eq $uploader) {
        throw "The completed run has no '$script:UploaderStepName' step; successful workflow completion does not prove that an artifact was uploaded."
      }
      if ($finalizerConclusion -eq 'skipped') {
        throw "The '$script:FinalizerStepName' step was skipped; no capture artifact can be assumed."
      }
      if ($finalizerConclusion -in @('success', 'failure') -and $uploaderConclusion -eq 'success') {
        if ($finalizerConclusion -eq 'failure') {
          Write-Warning "The '$script:FinalizerStepName' step failed, but the upload completed; continuing to inspect the encrypted artifact and manifest."
        }
        return [pscustomobject]@{
          WorkflowConclusion = [string](Get-JsonValue $freshRun 'conclusion')
          FinalizerConclusion = $finalizerConclusion
          UploaderConclusion = $uploaderConclusion
        }
      }
      if ($uploaderConclusion -eq 'skipped') {
        throw "The '$script:UploaderStepName' step was skipped. Finalizer result: '$finalizerConclusion'. Check the capture step output and workflow run details."
      }
    }

    if ((Get-RemainingSeconds) -le 0) {
      if ($Stop) {
        throw "Timed out waiting for NativeSim run $($Run.id) to finalize after graceful-stop. The run was not cancelled."
      }
      throw "Timed out waiting for NativeSim run $($Run.id) to finish. No stop or cancellation was sent."
    }
    Start-Sleep -Seconds ([Math]::Min($PollIntervalSeconds, (Get-RemainingSeconds)))
  }
}

function Get-ArtifactForRun {
  param([Parameter(Mandatory = $true)]$Run)

  $id = [string]$Run.id
  $attempt = [int]$Run.run_attempt
  $expectedName = "$script:ArtifactPrefix$id-$attempt"
  $response = Get-RunArtifacts -Id $id
  $artifacts = @(Get-JsonValue $response 'artifacts' @())
  $artifact = @($artifacts | Where-Object { [string](Get-JsonValue $_ 'name') -eq $expectedName } | Select-Object -First 1)

  if ($artifact.Count -eq 0) {
    $otherAttempts = @($artifacts | Where-Object { [string](Get-JsonValue $_ 'name') -like "$script:ArtifactPrefix$id-*" } | ForEach-Object { [string](Get-JsonValue $_ 'name') })
    if ($otherAttempts.Count -gt 0) {
      throw "Artifact '$expectedName' is missing. Artifacts from other attempts exist: $($otherAttempts -join ', '). No older attempt was selected automatically."
    }
    throw "Artifact '$expectedName' was not found. Verify the finalizer and upload steps, capture opt-in, and artifact retention."
  }

  $selected = $artifact[0]
  if ([bool](Get-JsonValue $selected 'expired' $true)) {
    throw "Artifact '$expectedName' has expired and cannot be recovered."
  }
  return $selected
}

function Assert-OutputRootIsPrivateLocation {
  param([Parameter(Mandatory = $true)][string]$Path)

  $fullPath = [IO.Path]::GetFullPath($Path).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  $repoPath = [IO.Path]::GetFullPath($script:ProjectRoot).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  $repoPrefix = $repoPath + [IO.Path]::DirectorySeparatorChar
  if ([string]::Equals($fullPath, $repoPath, [StringComparison]::OrdinalIgnoreCase) -or
      $fullPath.StartsWith($repoPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Sensitive local paths must be outside the Git repository so private keys and plaintext logs cannot be versioned accidentally.'
  }
  return $fullPath
}

function New-SessionOutputDirectory {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)]$Run
  )

  if (-not (Test-Path -LiteralPath $Root -PathType Container)) {
    New-Item -ItemType Directory -Path $Root -Force | Out-Null
  }
  $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
  $directory = Join-Path $Root ("run-{0}-attempt-{1}-{2}" -f $Run.id, $Run.run_attempt, $timestamp)
  if (Test-Path -LiteralPath $directory) {
    throw 'The private output folder already exists; refusing to overwrite any previous capture.'
  }
  New-Item -ItemType Directory -Path $directory -ErrorAction Stop | Out-Null
  return $directory
}

function Get-ValidatedManifest {
  param(
    [Parameter(Mandatory = $true)][string]$ManifestPath,
    [Parameter(Mandatory = $true)]$Run
  )

  $manifestFile = Get-Item -LiteralPath $ManifestPath -ErrorAction Stop
  if ($manifestFile.Length -gt 65536) { throw 'manifest.json is larger than the 64 KiB safety limit.' }
  try {
    $manifest = Get-Content -LiteralPath $ManifestPath -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
  } catch {
    throw 'manifest.json is missing or is not valid JSON.'
  }

  $required = @(
    'schema_version', 'repository', 'run_id', 'run_attempt', 'commit',
    'categories', 'predicate', 'started_at_utc', 'finished_at_utc',
    'event_count', 'capture_outcome', 'ciphertext_sha256'
  )
  foreach ($name in $required) {
    if ($null -eq $manifest.PSObject.Properties[$name]) {
      throw "manifest.json is missing required field '$name'."
    }
  }

  $schemaVersion = [int]$manifest.schema_version
  if ($schemaVersion -notin @(2, 3)) { throw "Unsupported manifest schema version '$($manifest.schema_version)'." }
  if (-not [string]::Equals([string]$manifest.repository, $Repository, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'manifest.json repository does not match the selected workflow repository.'
  }
  if ([string]$manifest.run_id -ne [string]$Run.id) { throw 'manifest.json run_id does not match the selected run.' }
  if ([int]$manifest.run_attempt -ne [int]$Run.run_attempt) { throw 'manifest.json run_attempt does not match the selected attempt.' }
  if (-not [string]::Equals([string]$manifest.commit, [string]$Run.head_sha, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'manifest.json commit SHA does not match the workflow run.'
  }

  if ($manifest.categories -isnot [System.Array]) { throw 'manifest.json categories must be a JSON array.' }
  $categories = @($manifest.categories)
  $filterMode = if ($schemaVersion -eq 2) { 'category' } else { [string]$manifest.filter_mode }
  if ($filterMode -notin @('category', 'subsystem')) { throw 'manifest.json has an unsupported filter_mode.' }

  if ($filterMode -eq 'category' -and ($categories.Count -lt 1 -or $categories.Count -gt 8)) {
    throw 'Category-filtered manifest must contain 1 to 8 OSLog categories.'
  }
  if ($filterMode -eq 'subsystem' -and $categories.Count -ne 0) {
    throw 'Subsystem-filtered manifest must not claim a fixed OSLog category list.'
  }
  $seen = @()
  foreach ($category in $categories) {
    $value = [string]$category
    if ($value -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$') { throw 'manifest.json contains an invalid OSLog category.' }
    foreach ($priorCategory in $seen) {
      if ([string]::Equals([string]$priorCategory, $value, [StringComparison]::Ordinal)) {
        throw 'manifest.json contains duplicate OSLog categories.'
      }
    }
    $seen += $value
  }
  if ($filterMode -eq 'category') {
    $expectedPredicate = (@($categories | ForEach-Object { 'category == "' + [string]$_ + '"' }) -join ' OR ')
    if ([string]$manifest.predicate -ne $expectedPredicate) { throw 'manifest.json predicate does not exactly match its category list.' }
    if ([string]$manifest.category -ne [string]$categories[0]) { throw 'manifest.json primary category does not match its category list.' }
    if ($schemaVersion -eq 3 -and @($manifest.subsystems).Count -ne 0) {
      throw 'Category-filtered manifest must have an empty subsystem list.'
    }
  } else {
    if ($null -ne $manifest.category -and [string]$manifest.category -ne '') {
      throw 'Subsystem-filtered manifest must not declare a primary category.'
    }
    if ($manifest.subsystems -isnot [System.Array]) { throw 'Subsystem-filtered manifest must include a subsystem array.' }
    $subsystems = @($manifest.subsystems)
    if ($subsystems.Count -lt 1 -or $subsystems.Count -gt 8) { throw 'Subsystem-filtered manifest must contain 1 to 8 subsystem selectors.' }
    $selectorParts = New-Object 'System.Collections.Generic.List[string]'
    $selectorKeys = New-Object 'System.Collections.Generic.HashSet[string]'
    foreach ($selector in $subsystems) {
      $match = [string]$selector.match
      $value = [string]$selector.value
      if ($match -notin @('exact', 'prefix') -or $value -notmatch '^[A-Za-z0-9][A-Za-z0-9.-]{0,254}$') {
        throw 'manifest.json contains an invalid subsystem selector.'
      }
      $selectorKey = "$match|$value"
      if (-not $selectorKeys.Add($selectorKey)) { throw 'manifest.json contains duplicate subsystem selectors.' }
      if ($selectorKey -notin @('prefix|com.pareact.mobile', 'exact|NativeAppleIntelligence')) {
        throw 'manifest.json contains a subsystem outside the app-owned allowlist.'
      }
      if ($match -eq 'prefix') {
        $selectorParts.Add(('subsystem BEGINSWITH "' + $value + '"'))
      } else {
        $selectorParts.Add(('subsystem == "' + $value + '"'))
      }
    }
    if (-not $selectorKeys.Contains('prefix|com.pareact.mobile') -or
        -not $selectorKeys.Contains('exact|NativeAppleIntelligence')) {
      throw 'manifest.json omits an expected app-owned subsystem selector.'
    }
    $expectedPredicate = $selectorParts -join ' OR '
    if ([string]$manifest.predicate -ne $expectedPredicate) { throw 'manifest.json predicate does not exactly match its subsystem selectors.' }
  }

  $eventCount = 0
  if (-not [int]::TryParse([string]$manifest.event_count, [ref]$eventCount) -or $eventCount -lt 0) {
    throw 'manifest.json event_count must be a non-negative integer.'
  }
  if ([string]$manifest.ciphertext_sha256 -notmatch '^[0-9a-fA-F]{64}$') {
    throw 'manifest.json ciphertext_sha256 is not a valid SHA-256 hex digest.'
  }
  foreach ($field in @('started_at_utc', 'finished_at_utc')) {
    $parsedTime = [DateTimeOffset]::MinValue
    if (-not [DateTimeOffset]::TryParse(
      [string]$manifest.$field,
      [Globalization.CultureInfo]::InvariantCulture,
      [Globalization.DateTimeStyles]::AssumeUniversal,
      [ref]$parsedTime
    )) {
      throw "manifest.json field '$field' is not a valid timestamp."
    }
  }
  $startedAt = [DateTimeOffset]::Parse([string]$manifest.started_at_utc, [Globalization.CultureInfo]::InvariantCulture)
  $finishedAt = [DateTimeOffset]::Parse([string]$manifest.finished_at_utc, [Globalization.CultureInfo]::InvariantCulture)
  if ($finishedAt -lt $startedAt) { throw 'manifest.json finish timestamp precedes its start timestamp.' }
  if ([string]$manifest.capture_outcome -notmatch '^[A-Za-z0-9_-]{1,64}$') {
    throw 'manifest.json capture_outcome contains invalid characters.'
  }

  return $manifest
}

function Get-SanitizedLogAnalysis {
  param(
    [Parameter(Mandatory = $true)][string]$LogPath,
    [Parameter(Mandatory = $true)]$Manifest
  )

  $filterMode = if ($Manifest.PSObject.Properties['filter_mode']) { [string]$Manifest.filter_mode } else { 'category' }
  $categories = @($Manifest.categories | ForEach-Object { [string]$_ })
  $categoryCounts = New-Object 'System.Collections.Generic.Dictionary[string,int]'
  $perCategory = New-Object 'System.Collections.Generic.Dictionary[string,object]'
  foreach ($category in $categories) { $categoryCounts[$category] = 0 }
  foreach ($category in $categories) {
    $perCategory[$category] = [pscustomobject]@{
      RecordCount = 0
      TimestampFirst = ''
      TimestampLast = ''
      EventNameCounts = (New-Object 'System.Collections.Generic.Dictionary[string,int]')
      EventSequence = (New-Object 'System.Collections.Generic.List[string]')
      TruncationMarkers = 0
    }
  }
  $observedCategories = New-Object 'System.Collections.Generic.HashSet[string]'
  $eventSequence = New-Object 'System.Collections.Generic.List[string]'
  $eventNameCounts = New-Object 'System.Collections.Generic.Dictionary[string,int]'
  $eventLines = 0
  $headerLines = 0
  $blankLines = 0
  $timestampFirst = ''
  $timestampLast = ''
  $truncationMarkers = 0
  $categoryPattern = @($categories | ForEach-Object { [Regex]::Escape($_) }) -join '|'
  if ($filterMode -eq 'subsystem') {
    $categoryRecordRegex = [Regex]::new('\[(?<subsystem>[A-Za-z0-9][A-Za-z0-9.-]{0,254}):(?<category>[A-Za-z0-9][A-Za-z0-9._-]{0,63})\]')
    $eventRegex = [Regex]::new('\[(?<label>[A-Za-z0-9][A-Za-z0-9._-]{0,63})\]\s+(?<event>[A-Za-z][A-Za-z0-9._-]{0,63})(?=\s|$)')
  } else {
    $categoryRecordRegex = [Regex]::new("\[(?:[^\]\r\n]*:)?(?<category>$categoryPattern)\]")
    $eventRegex = [Regex]::new("\[(?<label>$categoryPattern|PeekPopReturn)\]\s+(?<event>[A-Za-z][A-Za-z0-9._-]{0,63})(?=\s|$)")
  }
  $timestampRegex = [Regex]::new('^\s*(?<timestamp>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)')

  $reader = New-Object IO.StreamReader($LogPath, [Text.Encoding]::UTF8, $true)
  try {
    while ($null -ne ($line = $reader.ReadLine())) {
      if ([string]::IsNullOrWhiteSpace($line)) {
        $blankLines++
        continue
      }
      if ($line -match '^\s*(Filtering the log data using\b|Timestamp\s+Thread\b|[-=]{3,}\s*$)') {
        $headerLines++
        continue
      }

      $eventLines++
      $timeMatch = $timestampRegex.Match($line)
      if ($timeMatch.Success) {
        $stamp = $timeMatch.Groups['timestamp'].Value
        if (-not $timestampFirst) { $timestampFirst = $stamp }
        $timestampLast = $stamp
      }

      $categoriesOnLine = New-Object 'System.Collections.Generic.HashSet[string]'
      foreach ($categoryMatch in $categoryRecordRegex.Matches($line)) {
        $observed = $categoryMatch.Groups['category'].Value
        if ($filterMode -eq 'subsystem') {
          $subsystem = $categoryMatch.Groups['subsystem'].Value
          $matchesSelectedSubsystem = $false
          foreach ($selector in $Manifest.subsystems) {
            $selectorValue = [string]$selector.value
            if (([string]$selector.match -eq 'exact' -and [string]::Equals($subsystem, $selectorValue, [StringComparison]::Ordinal)) -or
                ([string]$selector.match -eq 'prefix' -and $subsystem.StartsWith($selectorValue, [StringComparison]::Ordinal))) {
              $matchesSelectedSubsystem = $true
              break
            }
          }
          if (-not $matchesSelectedSubsystem) { continue }
          if (-not $perCategory.ContainsKey($observed)) {
            $categoryCounts[$observed] = 0
            $perCategory[$observed] = [pscustomobject]@{
              RecordCount = 0
              TimestampFirst = ''
              TimestampLast = ''
              EventNameCounts = (New-Object 'System.Collections.Generic.Dictionary[string,int]')
              EventSequence = (New-Object 'System.Collections.Generic.List[string]')
              TruncationMarkers = 0
            }
          }
        }
        $null = $observedCategories.Add($observed)
        $null = $categoriesOnLine.Add($observed)
      }
      $eventMatch = $eventRegex.Match($line)
      $eventName = ''
      $safeEventLabel = $false
      if ($eventMatch.Success) {
        $eventName = $eventMatch.Groups['event'].Value
        $safeEventLabel = $eventName -cmatch '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$' -or
          $eventName -cin @('willShow', 'didShow', 'viewDidLoad', 'viewWillAppear', 'viewDidDisappear')
      }

      foreach ($observed in $categoriesOnLine) {
        if ($categoryCounts.ContainsKey($observed)) { $categoryCounts[$observed]++ }

        if ($perCategory.ContainsKey($observed)) {
          $categoryAnalysis = $perCategory[$observed]
          $categoryAnalysis.RecordCount++
          if ($timeMatch.Success) {
            $categoryTimestamp = $timeMatch.Groups['timestamp'].Value
            if (-not $categoryAnalysis.TimestampFirst) { $categoryAnalysis.TimestampFirst = $categoryTimestamp }
            $categoryAnalysis.TimestampLast = $categoryTimestamp
          }

          $eventBelongsToCategory = $eventMatch.Success -and (
            [string]::Equals($eventMatch.Groups['label'].Value, $observed, [StringComparison]::Ordinal) -or
            ($filterMode -eq 'category' -and [string]::Equals($observed, 'OpenPaymentPeekPopReturn', [StringComparison]::Ordinal) -and
              [string]::Equals($eventMatch.Groups['label'].Value, 'PeekPopReturn', [StringComparison]::Ordinal))
          )
          if ($eventBelongsToCategory -and $safeEventLabel) {
            if (-not $categoryAnalysis.EventNameCounts.ContainsKey($eventName) -and $categoryAnalysis.EventNameCounts.Count -lt 100) {
              $categoryAnalysis.EventNameCounts[$eventName] = 0
            }
            if ($categoryAnalysis.EventNameCounts.ContainsKey($eventName)) {
              $categoryAnalysis.EventNameCounts[$eventName]++
              if ($categoryAnalysis.EventSequence.Count -lt 60) { $categoryAnalysis.EventSequence.Add($eventName) }
            }
          }
        }
      }

      $hasTruncationMarker = $line -match '(?i)\b(truncat(?:ed|ion)?|dropped\s+\d+\s+(?:messages|events|records)|buffer overflow|log stream.{0,32}(?:stopped|terminated))\b'
      if ($hasTruncationMarker) {
        $truncationMarkers++
        foreach ($observed in $categoriesOnLine) {
          if ($perCategory.ContainsKey($observed)) { $perCategory[$observed].TruncationMarkers++ }
        }
      }
    }
  } finally {
    $reader.Dispose()
  }

  $warnings = New-Object 'System.Collections.Generic.List[string]'
  if ([int]$Manifest.event_count -eq 0 -or $eventLines -eq 0) { $warnings.Add('No log events were recorded.') }
  if ($eventLines -ne [int]$Manifest.event_count) {
    $warnings.Add("Parsed non-header log records ($eventLines) differ from manifest event_count ($($Manifest.event_count)); inspect the capture format and headers.")
  }
  if ([string]$Manifest.capture_outcome -notin @('completed', 'graceful-stop')) {
    $warnings.Add("Capture outcome is '$($Manifest.capture_outcome)', which may indicate partial evidence.")
  }
  if ($truncationMarkers -gt 0) { $warnings.Add("Found $truncationMarkers possible truncation/drop marker(s) in event records.") }
  if ($observedCategories.Count -eq 0 -and $eventLines -gt 0) {
    if ($filterMode -eq 'subsystem') {
      $warnings.Add('Compact OSLog lines did not expose subsystem/category labels; the manifest identifies the selected app-owned subsystems, but category-level attribution is unknown.')
    } else {
      $warnings.Add('Compact OSLog lines did not expose category labels; manifest categories describe the exact capture predicate, not per-line observed attribution.')
    }
  }

  $sequenceText = if ($eventSequence.Count -gt 0) { $eventSequence -join ' -> ' } else { '(no recognized short technical event labels)' }
  $categorySummary = @()
  $summaryCategories = if ($filterMode -eq 'subsystem') { @($observedCategories | Sort-Object) } else { $categories }
  foreach ($category in $summaryCategories) {
    if ($categoryCounts[$category] -gt 0) {
      $categorySummary += "- $category`: $($categoryCounts[$category]) records with an explicit category label"
    } elseif ($observedCategories.Count -eq 0) {
      $categorySummary += "- $category`: selected by the manifest predicate; not individually encoded in parsed compact lines"
    } else {
      $categorySummary += "- $category`: 0 explicitly labeled records"
    }
  }
  $eventNameSummary = @($eventNameCounts.Keys | Sort-Object | ForEach-Object { "- $_`: $($eventNameCounts[$_])" })

  return [pscustomobject]@{
    EventLines = $eventLines
    HeaderLines = $headerLines
    BlankLines = $blankLines
    TimestampFirst = $timestampFirst
    TimestampLast = $timestampLast
    ObservedCategories = @($observedCategories | Sort-Object)
    CategorySummary = $categorySummary
    PerCategory = $perCategory
    EventNameSummary = $eventNameSummary
    EventSequence = $sequenceText
    TruncationMarkers = $truncationMarkers
    Warnings = @($warnings)
  }
}

function Write-TechnicalReport {
  param(
    [Parameter(Mandatory = $true)][string]$ReportPath,
    [Parameter(Mandatory = $true)]$Run,
    [Parameter(Mandatory = $true)]$Manifest,
    [Parameter(Mandatory = $true)]$Analysis,
    [Parameter(Mandatory = $true)]$Finalization
  )

  $categoryLines = if ($Analysis.CategorySummary.Count -gt 0) { $Analysis.CategorySummary -join "`n" } else { '- none' }
  $eventNameLines = if ($Analysis.EventNameSummary.Count -gt 0) { $Analysis.EventNameSummary -join "`n" } else { '- none' }
  $warningLines = if ($Analysis.Warnings.Count -gt 0) { @($Analysis.Warnings | ForEach-Object { "- $_" }) -join "`n" } else { '- No parser or manifest warnings.' }
  $observedText = if ($Analysis.ObservedCategories.Count -gt 0) { $Analysis.ObservedCategories -join ', ' } else { 'not encoded per line' }
  # Schema 2 predates subsystem metadata; treat the absent property as empty.
  $manifestSubsystems = @()
  if ($null -ne $Manifest.PSObject.Properties['subsystems']) {
    $manifestSubsystems = @($Manifest.subsystems)
  }
  $report = @"
# NativeSim OSLog analysis

- Repository: $Repository
- Workflow: $script:WorkflowPath
- Run ID / attempt: $($Run.id) / $($Run.run_attempt)
- Commit: $($Run.head_sha)
- Workflow result: $($Finalization.WorkflowConclusion)
- Finalizer step: $($Finalization.FinalizerConclusion)
- Encrypted upload step: $($Finalization.UploaderConclusion)
- Capture outcome: $($Manifest.capture_outcome)
  - Filter mode: $(if ($Manifest.PSObject.Properties['filter_mode']) { $Manifest.filter_mode } else { 'category (legacy schema)' })
  - Selected OSLog categories: $(if (@($Manifest.categories).Count -gt 0) { $Manifest.categories -join ', ' } else { 'dynamic; categories are reported only when exposed in compact records' })
  - Selected subsystems: $(if ($manifestSubsystems.Count -gt 0) { @($manifestSubsystems | ForEach-Object { "$($_.match):$($_.value)" }) -join ', ' } else { 'none' })
  - Capture predicate: $($Manifest.predicate)
- Categories explicitly labeled in records: $observedText
- Manifest event count: $($Manifest.event_count)
- Parsed non-header records: $($Analysis.EventLines)
- Header / blank lines: $($Analysis.HeaderLines) / $($Analysis.BlankLines)
- Time span: $(if ($Analysis.TimestampFirst) { "$($Analysis.TimestampFirst) through $($Analysis.TimestampLast)" } else { 'timestamps not recognized' })
- Ciphertext SHA-256: $($Manifest.ciphertext_sha256)

## Category counts

$categoryLines

## Recognized technical event labels

$eventNameLines

## Short event sequence

$($Analysis.EventSequence)

## Warnings

$warningLines

## Interpretation limits

This report contains metadata and short technical event labels only; it does not copy raw log messages. OSLog categories are selected by the workflow predicate. JavaScript `console.log` output and Xcode build logs are not captured by this artifact. The report is descriptive and does not assert a root cause.
"@

  [IO.File]::WriteAllText($ReportPath, $report, (New-Object Text.UTF8Encoding($false)))
}

function Write-CategoryTechnicalReport {
  param(
    [Parameter(Mandatory = $true)][string]$ReportPath,
    [Parameter(Mandatory = $true)][string]$Category,
    [Parameter(Mandatory = $true)][string]$Title,
    [Parameter(Mandatory = $true)][string[]]$DiagnosticScope,
    [Parameter(Mandatory = $true)]$Run,
    [Parameter(Mandatory = $true)]$Manifest,
    [Parameter(Mandatory = $true)]$Analysis,
    [Parameter(Mandatory = $true)]$Finalization
  )

  if (-not $Analysis.PerCategory.ContainsKey($Category)) {
    throw "No per-category analysis exists for '$Category'."
  }

  $categoryAnalysis = $Analysis.PerCategory[$Category]
  $eventCount = 0
  foreach ($name in $categoryAnalysis.EventNameCounts.Keys) {
    $eventCount += $categoryAnalysis.EventNameCounts[$name]
  }

  $eventNameLines = @($categoryAnalysis.EventNameCounts.Keys | Sort-Object | ForEach-Object {
    "- $_`: $($categoryAnalysis.EventNameCounts[$_])"
  })
  if ($eventNameLines.Count -eq 0) { $eventNameLines = @('- No recognized short event labels.') }

  $warnings = New-Object 'System.Collections.Generic.List[string]'
  $categoryAttributionUnknown = $Analysis.ObservedCategories.Count -eq 0 -and $Analysis.EventLines -gt 0
  if ($categoryAttributionUnknown) {
    $warnings.Add('Compact log records did not expose category labels. Per-category event counts are unknown; manifest selection is not a filtered line count.')
  } elseif ($categoryAnalysis.RecordCount -eq 0) {
    $warnings.Add('No records carried an explicit label for this category. This does not prove the feature did not execute.')
  }
  if ($eventCount -eq 0) { $warnings.Add('No allowlisted short event labels were attributed to this category.') }
  if ([string]$Manifest.capture_outcome -notin @('completed', 'graceful-stop')) {
    $warnings.Add("Capture outcome is '$($Manifest.capture_outcome)', which may indicate partial evidence.")
  }
  if ($categoryAnalysis.TruncationMarkers -gt 0) {
    $warnings.Add("Found $($categoryAnalysis.TruncationMarkers) possible truncation/drop marker(s) in explicitly labeled records for this category.")
  }

  $recordCountText = if ($categoryAttributionUnknown) { 'unknown (category not encoded per record)' } else { [string]$categoryAnalysis.RecordCount }
  $timeSpan = if ($categoryAnalysis.TimestampFirst) {
    "$($categoryAnalysis.TimestampFirst) through $($categoryAnalysis.TimestampLast)"
  } else {
    'timestamps not recognized for this category'
  }
  $sequence = if ($categoryAnalysis.EventSequence.Count -gt 0) {
    $categoryAnalysis.EventSequence -join ' -> '
  } else {
    '(no recognized category-specific event sequence)'
  }
  $scopeLines = @($DiagnosticScope | ForEach-Object { "- $_" }) -join "`n"
  $warningLines = if ($warnings.Count -gt 0) { @($warnings | ForEach-Object { "- $_" }) -join "`n" } else { '- No category-specific parser warnings.' }
  $report = @"
# NativeSim OSLog: $Title

- Repository: $Repository
- Workflow: $script:WorkflowPath
- Run ID / attempt: $($Run.id) / $($Run.run_attempt)
- Commit: $($Run.head_sha)
- Workflow result: $($Finalization.WorkflowConclusion)
- Finalizer step: $($Finalization.FinalizerConclusion)
- Encrypted upload step: $($Finalization.UploaderConclusion)
- Capture outcome: $($Manifest.capture_outcome)
  - Category: $Category
- Manifest event count across all selected categories: $($Manifest.event_count)
- Parsed non-header records across all selected categories: $($Analysis.EventLines)
- Records explicitly labeled for this category: $recordCountText
- Recognized short event labels for this category: $eventCount
- Category time span: $timeSpan

## Category-specific event labels

$($eventNameLines -join "`n")

## Short category-specific sequence

$sequence

## Facts recorded

  - $(if ($Manifest.PSObject.Properties['filter_mode'] -and $Manifest.filter_mode -eq 'subsystem') { "The parser observed $Category in a record whose subsystem matched the manifest filter." } else { "The manifest selected $Category for this run attempt." })
- Manifest event count is the total for all selected categories; it is not this category's filtered count.
- Explicitly labeled records and allowlisted event labels are counted separately above.

## Hypotheses

- The collector assigns no root cause. Counts and event labels alone do not prove a gesture, transition, timeline update, layout evaluation, or module load succeeded or failed.

## Diagnostic scope and evidence limits

$scopeLines

- Missing category labels mean per-category attribution is unknown, not zero.
- Zero matching records or labels do not prove the feature did not execute.
- The report omits raw messages, customer data, financial values, and arbitrary log fields.
- JavaScript `console.log` output and Xcode build logs are not captured by this artifact.

## Warnings

$warningLines
"@

  if (Test-Path -LiteralPath $ReportPath) {
    throw "Category report already exists; refusing to overwrite: $ReportPath"
  }
  [IO.File]::WriteAllText($ReportPath, $report, (New-Object Text.UTF8Encoding($false)))
}

function Invoke-Collection {
  $script:GhExecutable = Resolve-ExecutablePath -PathOrCommand $GhPath
  $script:AgeExecutable = Resolve-ExecutablePath -PathOrCommand $AgePath
  if (-not (Test-Path -LiteralPath $IdentityPath -PathType Leaf)) {
    throw "The local age identity file was not found at '$IdentityPath'. The private key was not read or transmitted."
  }

  $safeOutputRoot = Assert-OutputRootIsPrivateLocation -Path $OutputRoot
  $resolvedIdentityPath = (Resolve-Path -LiteralPath $IdentityPath).Path
  $null = Assert-OutputRootIsPrivateLocation -Path $resolvedIdentityPath
  if (-not (Test-Path -LiteralPath $safeOutputRoot -PathType Container)) {
    New-Item -ItemType Directory -Path $safeOutputRoot -Force | Out-Null
  }

  if ($Attempt -gt 0 -and -not $RunId) {
    throw 'The -Attempt parameter requires an explicit -RunId.'
  }

  if ($RunId -and $Attempt -gt 0) {
    $latestRun = Get-NativeSimRun -Id $RunId
    $latestAttempt = [int](Get-JsonValue $latestRun 'run_attempt')
    if ($Attempt -gt $latestAttempt) {
      throw "Run $RunId has no attempt $Attempt; latest attempt is $latestAttempt."
    }
    $selectedRun = Get-NativeSimRun -Id $RunId -Attempt $Attempt
  } elseif ($RunId) {
    $selectedRun = Get-NativeSimRun -Id $RunId
  } else {
    $selectedRun = Get-AutomaticRunSelection
  }

  $script:Deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  $status = [string](Get-JsonValue $selectedRun 'status')
  if ($Stop -and [int](Get-JsonValue $selectedRun 'run_attempt') -ne [int](Get-JsonValue (Get-NativeSimRun -Id ([string]$selectedRun.id)) 'run_attempt')) {
    throw "Run $($selectedRun.id) attempt $($selectedRun.run_attempt) is historical; -Stop is allowed only for the current attempt."
  }
  if ($Stop -and $status -ne 'completed') {
    Request-GracefulStop -Run $selectedRun
  } elseif ($status -ne 'completed') {
    Write-Host 'No -Stop was supplied. The session will not be stopped; waiting for its normal end or timeout.'
  }

  $finalization = Wait-ForRunFinalization -Run $selectedRun
  $artifact = Get-ArtifactForRun -Run $selectedRun
  $outputDirectory = New-SessionOutputDirectory -Root $safeOutputRoot -Run $selectedRun
  $downloadDirectory = Join-Path $outputDirectory 'artifact-download'
  New-Item -ItemType Directory -Path $downloadDirectory -ErrorAction Stop | Out-Null

  $artifactName = [string](Get-JsonValue $artifact 'name')
  $null = Invoke-Gh -Arguments @(
    'run', 'download', [string]$selectedRun.id,
    '--repo', $Repository,
    '--name', $artifactName,
    '-D', $downloadDirectory
  )

  $downloadedFiles = @(Get-ChildItem -LiteralPath $downloadDirectory -Recurse -File -ErrorAction Stop)
  $downloadedNames = @($downloadedFiles | ForEach-Object { $_.Name.ToLowerInvariant() } | Sort-Object)
  $expectedNames = @('manifest.json', 'native-sim-oslog.age' | Sort-Object)
  if ($downloadedFiles.Count -ne 2 -or ($downloadedNames -join '|') -ne ($expectedNames -join '|')) {
    throw "Artifact '$artifactName' is incomplete or contains unexpected files; expected only manifest.json and native-sim-oslog.age."
  }
  $cipherFiles = @($downloadedFiles | Where-Object { $_.Name -eq 'native-sim-oslog.age' })
  $manifestFiles = @($downloadedFiles | Where-Object { $_.Name -eq 'manifest.json' })
  if ($cipherFiles.Count -ne 1 -or $manifestFiles.Count -ne 1) {
    throw "Artifact '$artifactName' contains duplicate required filenames; refusing to choose one."
  }

  $manifest = Get-ValidatedManifest -ManifestPath $manifestFiles[0].FullName -Run $selectedRun
  $cipherHash = (Get-FileHash -LiteralPath $cipherFiles[0].FullName -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()
  if (-not [string]::Equals($cipherHash, ([string]$manifest.ciphertext_sha256).ToLowerInvariant(), [StringComparison]::Ordinal)) {
    throw 'Ciphertext SHA-256 does not match manifest.json; decryption was not attempted.'
  }

  $plainLogPath = Join-Path $outputDirectory 'decrypted.log'
  if (Test-Path -LiteralPath $plainLogPath) {
    throw 'The plaintext output file already exists; refusing to overwrite it.'
  }
  $ageArguments = @('-d', '-i', $resolvedIdentityPath, '-o', $plainLogPath, $cipherFiles[0].FullName)
  $global:LASTEXITCODE = 0
  $null = & $script:AgeExecutable @ageArguments 2>$null
  $ageExitCode = $LASTEXITCODE
  if ($ageExitCode -ne 0 -or -not (Test-Path -LiteralPath $plainLogPath -PathType Leaf)) {
    if (Test-Path -LiteralPath $plainLogPath) { Remove-Item -LiteralPath $plainLogPath -Force -ErrorAction SilentlyContinue }
    throw "age decryption failed (exit code $ageExitCode). Verify the local identity matches the artifact recipient; the key was not printed or transmitted."
  }

  $analysis = Get-SanitizedLogAnalysis -LogPath $plainLogPath -Manifest $manifest
  $reportPath = Join-Path $outputDirectory 'analysis-report.md'
  Write-TechnicalReport -ReportPath $reportPath -Run $selectedRun -Manifest $manifest -Analysis $analysis -Finalization $finalization

  $categoryReports = New-Object 'System.Collections.Generic.List[string]'
  $reportDefinitions = @(
    [pscustomobject]@{
      Category = 'OpenPaymentPeekPopReturn'
      FileName = 'analysis-peek-pop.md'
      Title = 'Peek & Pop'
      DiagnosticScope = @(
        'Native swipe-back and interactive pop gesture recognizers.'
        'Gesture delegates, state transitions, and conflicts.'
        'UIKit navigation transitions and view-controller lifecycle.'
        'Geometry, clipping, masks, safe areas, and visual cutoff on return.'
      )
    }
    [pscustomobject]@{
      Category = 'RigattiWidgetSync'
      FileName = 'analysis-widget.md'
      Title = 'Financial widget'
      DiagnosticScope = @(
        'Snapshot publication and widget timeline reads or refreshes.'
        'Native module loading and widget configuration/props.'
        'Layout evaluation and update failures or missing events.'
      )
    }
  )

  foreach ($definition in $reportDefinitions) {
    if ($manifest.categories -ccontains $definition.Category -or $analysis.PerCategory.ContainsKey($definition.Category)) {
      $categoryReportPath = Join-Path $outputDirectory $definition.FileName
      Write-CategoryTechnicalReport `
        -ReportPath $categoryReportPath `
        -Category $definition.Category `
        -Title $definition.Title `
        -DiagnosticScope $definition.DiagnosticScope `
        -Run $selectedRun `
        -Manifest $manifest `
        -Analysis $analysis `
        -Finalization $finalization
      $categoryReports.Add($categoryReportPath)
    }
  }

  Write-Host ''
  Write-Host 'NativeSim OSLog recovery completed.'
  Write-Host "Run / attempt: $($selectedRun.id) / $($selectedRun.run_attempt)"
  Write-Host "Commit: $($selectedRun.head_sha)"
  Write-Host "Categories: $($manifest.categories -join ', ')"
  Write-Host "Capture outcome: $($manifest.capture_outcome)"
  Write-Host "Manifest events / parsed records: $($manifest.event_count) / $($analysis.EventLines)"
  if ($analysis.Warnings.Count -gt 0) { Write-Warning ($analysis.Warnings -join ' ') }
  Write-Host "Full decrypted log (local): $plainLogPath"
  Write-Host "Sanitized report (local): $reportPath"
  foreach ($categoryReportPath in $categoryReports) {
    Write-Host "Sanitized category report (local): $categoryReportPath"
  }
  Write-Host "Encrypted artifact and manifest (local): $downloadDirectory"
  Write-Host 'Raw messages were not printed to the terminal or copied into the report.'
}

try {
  Invoke-Collection
} catch {
  Write-Error -Message $_.Exception.Message -ErrorAction Continue
  exit 1
}
