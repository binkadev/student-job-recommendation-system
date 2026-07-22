Set-StrictMode -Version Latest

$script:PerformanceLockSchemaVersion = 1

function Get-PerformanceLockContext {
    param([Parameter(Mandatory = $true)][string]$PerformanceRoot)

    $fullRoot = [IO.Path]::GetFullPath($PerformanceRoot).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    $normalizedRoot = if ([Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT) { $fullRoot.ToLowerInvariant() } else { $fullRoot }
    $hashAlgorithm = [Security.Cryptography.SHA256]::Create()
    try {
        $hashBytes = $hashAlgorithm.ComputeHash([Text.Encoding]::UTF8.GetBytes($normalizedRoot))
    }
    finally {
        $hashAlgorithm.Dispose()
    }
    $hash = ([BitConverter]::ToString($hashBytes)).Replace('-', '').Substring(0, 24)
    $mutexPrefix = if ([Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT) { 'Local\' } else { '' }
    $locksDirectory = Join-Path $fullRoot '.locks'
    try {
        [IO.Directory]::CreateDirectory($locksDirectory) | Out-Null
    }
    catch {
        throw "Unable to create the performance lock directory. Isolation cannot be proven: $($_.Exception.Message)"
    }

    return [pscustomobject]@{
        LocksDirectory = $locksDirectory
        MutexName = "${mutexPrefix}StudentJobPerformanceMeasurement_$hash"
        LoadTestPath = Join-Path $locksDirectory 'load-test.lock.json'
        QueryCountPath = Join-Path $locksDirectory 'query-count.lock.json'
    }
}

function Read-PerformanceLockMetadata {
    param([Parameter(Mandatory = $true)][string]$Path)

    try {
        $raw = Get-Content -LiteralPath $Path -Raw -ErrorAction Stop
        if ([string]::IsNullOrWhiteSpace($raw)) { throw 'the file is empty' }
        $metadata = $raw | ConvertFrom-Json -ErrorAction Stop
    }
    catch {
        throw "Lock metadata at $Path is unreadable or invalid; manual inspection is required and isolation cannot be proven: $($_.Exception.Message)"
    }

    foreach ($property in @('schemaVersion', 'leaseId', 'lockKind', 'workloadType', 'pid', 'processStartedUtc', 'processStartUtcTicks', 'acquiredUtc')) {
        if ($null -eq $metadata.PSObject.Properties[$property]) {
            throw "Lock metadata at $Path is missing '$property'; manual inspection is required and isolation cannot be proven."
        }
    }
    if ([int]$metadata.schemaVersion -ne $script:PerformanceLockSchemaVersion) {
        throw "Lock metadata at $Path uses unsupported schema version '$($metadata.schemaVersion)'; isolation cannot be proven."
    }
    if ([string]$metadata.lockKind -notin @('load-test', 'query-count')) {
        throw "Lock metadata at $Path has invalid lockKind '$($metadata.lockKind)'; isolation cannot be proven."
    }
    if ([string]::IsNullOrWhiteSpace([string]$metadata.workloadType)) {
        throw "Lock metadata at $Path has an empty workloadType; isolation cannot be proven."
    }
    $parsedLeaseId = [Guid]::Empty
    if (-not [Guid]::TryParse([string]$metadata.leaseId, [ref]$parsedLeaseId)) {
        throw "Lock metadata at $Path has an invalid leaseId; isolation cannot be proven."
    }
    $parsedProcessTime = [DateTimeOffset]::MinValue
    $parsedAcquiredTime = [DateTimeOffset]::MinValue
    if (-not [DateTimeOffset]::TryParse([string]$metadata.processStartedUtc, [ref]$parsedProcessTime) -or
        -not [DateTimeOffset]::TryParse([string]$metadata.acquiredUtc, [ref]$parsedAcquiredTime)) {
        throw "Lock metadata at $Path has an invalid timestamp; isolation cannot be proven."
    }
    if ([int]$metadata.pid -le 0 -or [int64]$metadata.processStartUtcTicks -le 0) {
        throw "Lock metadata at $Path has invalid process identity fields; isolation cannot be proven."
    }

    return $metadata
}

function Get-PerformanceLockOwnerState {
    param([Parameter(Mandatory = $true)]$Metadata)

    try {
        $process = Get-Process -Id ([int]$Metadata.pid) -ErrorAction Stop
    }
    catch {
        if ($_.FullyQualifiedErrorId -like 'NoProcessFoundForGivenId*') {
            return 'dead'
        }
        throw "Unable to inspect PID $($Metadata.pid) from the lock metadata; isolation cannot be proven: $($_.Exception.Message)"
    }

    try {
        $actualStartTicks = $process.StartTime.ToUniversalTime().Ticks
    }
    catch {
        throw "PID $($Metadata.pid) exists but its start time cannot be inspected; isolation cannot be proven: $($_.Exception.Message)"
    }

    if ($actualStartTicks -eq [int64]$Metadata.processStartUtcTicks) { return 'live' }
    return 'pid-reused'
}

function Get-ExistingPerformanceLockSummary {
    param([Parameter(Mandatory = $true)]$Context)

    $summaries = @()
    foreach ($path in @($Context.LoadTestPath, $Context.QueryCountPath)) {
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { continue }
        $metadata = Read-PerformanceLockMetadata -Path $path
        $summaries += "lockKind=$($metadata.lockKind), workloadType=$($metadata.workloadType), pid=$($metadata.pid), acquiredUtc=$($metadata.acquiredUtc)"
    }
    if ($summaries.Count -eq 0) {
        return 'the atomic isolation gate is held but no readable lease file is present'
    }
    return ($summaries -join '; ')
}

function Move-StalePerformanceLock {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)]$Metadata,
        [Parameter(Mandatory = $true)][string]$OwnerState,
        [Parameter(Mandatory = $true)][string]$LocksDirectory
    )

    $timestamp = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmssfff')
    $archiveName = "stale-$timestamp-$($Metadata.lockKind)-$($Metadata.leaseId).json"
    $archivePath = Join-Path $LocksDirectory $archiveName
    try {
        Move-Item -LiteralPath $Path -Destination $archivePath -ErrorAction Stop
    }
    catch {
        throw "A stale $($Metadata.lockKind) lock was detected but could not be archived safely; isolation cannot be proven: $($_.Exception.Message)"
    }
    Write-Warning "Recovered stale $($Metadata.lockKind) lock for workload '$($Metadata.workloadType)' (PID $($Metadata.pid), state $OwnerState). Metadata was archived as $archiveName."
}

function Enter-PerformanceMeasurementLock {
    param(
        [Parameter(Mandatory = $true)][string]$PerformanceRoot,
        [Parameter(Mandatory = $true)][ValidateSet('load-test', 'query-count')][string]$LockKind,
        [Parameter(Mandatory = $true)][string]$WorkloadType
    )

    if ([string]::IsNullOrWhiteSpace($WorkloadType)) { throw 'WorkloadType must not be empty.' }
    $context = Get-PerformanceLockContext -PerformanceRoot $PerformanceRoot
    $mutex = $null
    $mutexAcquired = $false
    try {
        $createdNew = $false
        $mutex = [Threading.Mutex]::new($false, $context.MutexName, [ref]$createdNew)
        try {
            $mutexAcquired = $mutex.WaitOne(0)
        }
        catch [Threading.AbandonedMutexException] {
            $mutexAcquired = $true
            Write-Warning 'Recovered an abandoned performance-measurement mutex; validating stale lease metadata before continuing.'
        }

        if (-not $mutexAcquired) {
            $summary = Get-ExistingPerformanceLockSummary -Context $context
            throw "Another performance measurement is active ($summary). Refusing to continue because isolation cannot be proven."
        }

        foreach ($path in @($context.LoadTestPath, $context.QueryCountPath)) {
            if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { continue }
            $metadata = Read-PerformanceLockMetadata -Path $path
            $ownerState = Get-PerformanceLockOwnerState -Metadata $metadata
            if ($ownerState -eq 'live') {
                throw "A live $($metadata.lockKind) lease exists for '$($metadata.workloadType)' (PID $($metadata.pid)). Refusing to continue because isolation cannot be proven."
            }
            Move-StalePerformanceLock -Path $path -Metadata $metadata -OwnerState $ownerState -LocksDirectory $context.LocksDirectory
        }

        $currentProcess = Get-Process -Id $PID -ErrorAction Stop
        $processStartUtc = $currentProcess.StartTime.ToUniversalTime()
        $leaseId = [Guid]::NewGuid().ToString('D')
        $metadata = [ordered]@{
            schemaVersion = $script:PerformanceLockSchemaVersion
            leaseId = $leaseId
            lockKind = $LockKind
            workloadType = $WorkloadType
            pid = $PID
            processStartedUtc = $processStartUtc.ToString('o')
            processStartUtcTicks = $processStartUtc.Ticks
            acquiredUtc = [DateTime]::UtcNow.ToString('o')
        }
        $sentinelPath = if ($LockKind -eq 'load-test') { $context.LoadTestPath } else { $context.QueryCountPath }
        $json = $metadata | ConvertTo-Json -Depth 5
        $encoding = [Text.UTF8Encoding]::new($false)
        $stream = $null
        try {
            $stream = [IO.File]::Open($sentinelPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
            $bytes = $encoding.GetBytes($json)
            $stream.Write($bytes, 0, $bytes.Length)
            $stream.Flush($true)
        }
        finally {
            if ($null -ne $stream) { $stream.Dispose() }
        }

        Write-Host "Acquired $LockKind isolation lock for '$WorkloadType' (PID $PID)."
        return [pscustomobject]@{
            Mutex = $mutex
            MutexAcquired = $true
            SentinelPath = $sentinelPath
            LeaseId = $leaseId
            LockKind = $LockKind
            WorkloadType = $WorkloadType
            Released = $false
        }
    }
    catch {
        if ($mutexAcquired -and $null -ne $mutex) {
            try { $mutex.ReleaseMutex() } catch { }
        }
        if ($null -ne $mutex) { $mutex.Dispose() }
        throw
    }
}

function Exit-PerformanceMeasurementLock {
    param([Parameter(Mandatory = $true)]$Lease)

    if ([bool]$Lease.Released) { throw 'The performance measurement lock was already released.' }
    $cleanupFailure = $null
    try {
        if (-not (Test-Path -LiteralPath $Lease.SentinelPath -PathType Leaf)) {
            throw "The $($Lease.LockKind) lease file disappeared before release; isolation state is inconsistent."
        }
        $metadata = Read-PerformanceLockMetadata -Path $Lease.SentinelPath
        if ([string]$metadata.leaseId -ne [string]$Lease.LeaseId) {
            throw "The $($Lease.LockKind) lease ID changed before release; refusing to delete another lease."
        }
        Remove-Item -LiteralPath $Lease.SentinelPath -Force -ErrorAction Stop
    }
    catch {
        $cleanupFailure = $_
    }
    finally {
        try {
            if ([bool]$Lease.MutexAcquired) { $Lease.Mutex.ReleaseMutex() }
        }
        catch {
            if ($null -eq $cleanupFailure) { $cleanupFailure = $_ }
        }
        finally {
            $Lease.Mutex.Dispose()
            $Lease.Released = $true
        }
    }

    if ($null -ne $cleanupFailure) {
        throw "Failed to release the $($Lease.LockKind) isolation lock cleanly: $($cleanupFailure.Exception.Message)"
    }
    Write-Host "Released $($Lease.LockKind) isolation lock for '$($Lease.WorkloadType)'."
}

function Test-GrafanaK6ImageReference {
    param([string[]]$References)

    foreach ($reference in $References) {
        if (-not [string]::IsNullOrWhiteSpace($reference) -and $reference -match '(?i)(^|/)grafana/k6(?::|@|$)') {
            return $true
        }
    }
    return $false
}

function Get-IsolationDockerExecutable {
    try {
        $command = Get-Command docker -CommandType Application -ErrorAction Stop
    }
    catch {
        throw "Docker cannot be resolved as an executable; isolation cannot be proven: $($_.Exception.Message)"
    }
    return $command.Source
}

function Get-RunningDockerContainers {
    param([Parameter(Mandatory = $true)][string]$DockerExecutable)

    $savedErrorPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $idsOutput = (& $DockerExecutable ps --quiet --no-trunc 2>&1 | Out-String).Trim()
        $invocationSucceeded = $?
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $savedErrorPreference
    }
    if (-not $invocationSucceeded -or $exitCode -ne 0) {
        throw "Unable to enumerate Docker containers; isolation cannot be proven: $idsOutput"
    }
    if ([string]::IsNullOrWhiteSpace($idsOutput)) { return @() }
    return @($idsOutput -split '\r?\n' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
}

function Assert-NoExternalK6Workload {
    try {
        $localK6 = @(Get-Process -Name k6 -ErrorAction Stop)
    }
    catch {
        if ($_.FullyQualifiedErrorId -like 'NoProcessFoundForGivenName*') {
            $localK6 = @()
        }
        else {
            throw "Unable to inspect native k6 processes; isolation cannot be proven: $($_.Exception.Message)"
        }
    }
    if ($localK6.Count -gt 0) {
        $pids = ($localK6 | ForEach-Object { $_.Id }) -join ', '
        throw "A native k6 process is running (PID(s): $pids). Refusing to continue because isolation cannot be proven."
    }

    $dockerExecutable = Get-IsolationDockerExecutable
    for ($attempt = 1; $attempt -le 2; $attempt++) {
        $retry = $false
        $containerIds = @(Get-RunningDockerContainers -DockerExecutable $dockerExecutable)
        foreach ($containerId in $containerIds) {
            $savedErrorPreference = $ErrorActionPreference
            try {
                $ErrorActionPreference = 'Continue'
                $containerJson = (& $dockerExecutable inspect $containerId 2>&1 | Out-String).Trim()
                $containerInvocationSucceeded = $?
                $containerExitCode = $LASTEXITCODE
            }
            finally {
                $ErrorActionPreference = $savedErrorPreference
            }
            if (-not $containerInvocationSucceeded -or $containerExitCode -ne 0) {
                $retry = $true
                break
            }

            try { $container = @($containerJson | ConvertFrom-Json -ErrorAction Stop)[0] }
            catch { throw "Docker returned invalid container metadata; isolation cannot be proven: $($_.Exception.Message)" }
            $configuredImage = [string]$container.Config.Image
            $labels = $container.Config.Labels
            $workloadLabel = if ($null -ne $labels -and $null -ne $labels.PSObject.Properties['com.tttn.performance.workload']) { [string]$labels.'com.tttn.performance.workload' } else { '' }

            $imageReferences = @($configuredImage)
            if (-not (Test-GrafanaK6ImageReference -References $imageReferences) -and $workloadLabel -ne 'k6') {
                $savedErrorPreference = $ErrorActionPreference
                try {
                    $ErrorActionPreference = 'Continue'
                    $imageJson = (& $dockerExecutable image inspect ([string]$container.Image) 2>&1 | Out-String).Trim()
                    $imageInvocationSucceeded = $?
                    $imageExitCode = $LASTEXITCODE
                }
                finally {
                    $ErrorActionPreference = $savedErrorPreference
                }
                if (-not $imageInvocationSucceeded -or $imageExitCode -ne 0) {
                    throw "Unable to inspect Docker image $($container.Image); isolation cannot be proven."
                }
                try { $image = @($imageJson | ConvertFrom-Json -ErrorAction Stop)[0] }
                catch { throw "Docker returned invalid image metadata; isolation cannot be proven: $($_.Exception.Message)" }
                $imageReferences += @($image.RepoTags) + @($image.RepoDigests)
            }

            if ($workloadLabel -eq 'k6' -or (Test-GrafanaK6ImageReference -References $imageReferences)) {
                throw "A Dockerized Grafana k6 container is running (container $($container.Id.Substring(0, 12)), image '$configuredImage'). Refusing to continue because isolation cannot be proven."
            }
        }

        if (-not $retry) { return }
    }

    throw 'Docker container state changed repeatedly during inspection; isolation cannot be proven.'
}
