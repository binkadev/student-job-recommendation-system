param([string]$JavaHome = $env:JAVA_HOME, [switch]$SetupFailureProbe)
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskBackend = Join-Path $taskRoot 'backend'
$taskFrontend = Join-Path $taskRoot 'frontend'
$taskE2e = Join-Path $taskRoot 'e2e'
$taskRunId = 'recruiting-workflows-' + [Guid]::NewGuid().ToString('N')
$taskLocal = Join-Path $taskE2e ('.local/' + $taskRunId)
$taskFixture = Join-Path $taskLocal 'fixture.json'
$taskOwnership = Join-Path $taskLocal 'ownership.json'
$taskJvm = $null
$taskVite = $null
$taskFailed = $false
$taskStage = 'PREFLIGHT'
$taskOldJava = $env:JAVA_HOME
$taskOldProxy = $env:VITE_API_PROXY_TARGET
$taskOldApiBase = $env:VITE_API_BASE_URL
$taskOldFixture = $env:RECRUITING_WORKFLOWS_FIXTURE
$taskOldFrontend = $env:RECRUITING_WORKFLOWS_FRONTEND
New-Item -ItemType Directory -Path $taskLocal -Force | Out-Null
Push-Location $taskBackend
try {
    $taskJavaExe = Join-Path $JavaHome 'bin/java.exe'
    if (!(Test-Path -LiteralPath $taskJavaExe)) { throw 'Supply -JavaHome for Java 21.' }
    # strictPort rejects a race without touching the port's owner.
    $taskListener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    try { $taskListener.Start(); $taskPort = $taskListener.LocalEndpoint.Port } finally { $taskListener.Stop() }
    $env:JAVA_HOME = $JavaHome
    $taskStage = 'COMPILE'
    $ErrorActionPreference = 'Continue'
    & .\mvnw.cmd -B -ntp test-compile org.apache.maven.plugins:maven-dependency-plugin:3.8.1:build-classpath '-Dmdep.outputFile=target/recruiting-workflows-browser-classpath.txt' *> (Join-Path $taskLocal 'compile.log')
    $taskCompileExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($taskCompileExit -ne 0) { throw 'Fixture compilation failed; inspect ignored compile.log.' }
    $taskClasspath = (Join-Path $taskBackend 'target/test-classes') + ';' + (Join-Path $taskBackend 'target/classes') + ';' + [IO.File]::ReadAllText((Join-Path $taskBackend 'target/recruiting-workflows-browser-classpath.txt')).Trim()
    $taskStage = 'FIXTURE_STARTUP'
    $taskJavaArgs = @('-cp', ('"' + $taskClasspath + '"'), 'com.tttn.jobrecommendation.integration.RecruitingWorkflowsBrowserFixture', ('"' + $taskFixture + '"'))
    if ($SetupFailureProbe) { $taskJavaArgs += '--setup-failure-probe' }
    $taskJvm = Start-Process -FilePath $taskJavaExe -WindowStyle Hidden -PassThru -WorkingDirectory $taskBackend -ArgumentList $taskJavaArgs -RedirectStandardOutput (Join-Path $taskLocal 'server.log') -RedirectStandardError (Join-Path $taskLocal 'server.err.log')
    $taskDeadline = (Get-Date).AddSeconds(90)
    while (!(Test-Path -LiteralPath $taskFixture)) {
        if ($taskJvm.HasExited -or (Get-Date) -gt $taskDeadline) { throw 'Fixture did not become ready; inspect ignored server logs.' }
        Start-Sleep -Milliseconds 300
    }
    $taskMetadata = Get-Content -LiteralPath $taskFixture -Raw | ConvertFrom-Json
    if ($taskMetadata.backendUrl -notmatch '^http://127\.0\.0\.1:\d+$') { throw 'Expected isolated loopback Backend.' }
    $taskStage = 'VITE_STARTUP'
    $env:VITE_API_PROXY_TARGET = $taskMetadata.backendUrl
    $env:VITE_API_BASE_URL = '/api'
    $env:RECRUITING_WORKFLOWS_FIXTURE = $taskFixture
    $env:RECRUITING_WORKFLOWS_FRONTEND = 'http://127.0.0.1:' + $taskPort
    # Keep optimizer caches isolated even when node_modules is shared through a worktree junction.
    $taskViteUri = ([Uri](Join-Path $taskFrontend 'node_modules/vite/dist/node/index.js')).AbsoluteUri
    $taskViteOptions = @{ cacheDir = (Join-Path $taskLocal 'vite-cache'); server = @{ host = '127.0.0.1'; port = $taskPort; strictPort = $true } } | ConvertTo-Json -Depth 3 -Compress
    $taskBootstrap = Join-Path $taskLocal 'start-vite.mjs'
    [IO.File]::WriteAllText($taskBootstrap, ("import { createServer } from '" + $taskViteUri + "';`nconst server = await createServer(" + $taskViteOptions + ");`nawait server.listen();server.printUrls();`n"), [Text.UTF8Encoding]::new($false))
    $taskVite = Start-Process -FilePath (Get-Command node.exe).Source -WindowStyle Hidden -PassThru -WorkingDirectory $taskFrontend -ArgumentList @(('"' + $taskBootstrap + '"')) -RedirectStandardOutput (Join-Path $taskLocal 'vite.log') -RedirectStandardError (Join-Path $taskLocal 'vite.err.log')
    $taskReady = $false
    $taskDeadline = (Get-Date).AddSeconds(30)
    while (!$taskReady) {
        if ($taskVite.HasExited -or (Get-Date) -gt $taskDeadline) { throw 'Dedicated Vite failed to start.' }
        try { $taskReady = (Invoke-WebRequest $env:RECRUITING_WORKFLOWS_FRONTEND -UseBasicParsing -TimeoutSec 1).StatusCode -eq 200 }
        catch { Start-Sleep -Milliseconds 300 }
    }
    Set-Location $taskE2e
    $taskStage = 'BROWSER'
    $ErrorActionPreference = 'Continue'
    & (Get-Command node.exe).Source (Join-Path $taskE2e 'node_modules/playwright/cli.js') test --config=recruiting-workflows-isolated.playwright.config.mjs
    $taskBrowserExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($taskBrowserExit -ne 0) { throw 'Focused browser suite failed; inspect ignored results.' }
    $taskStage = 'COMPLETED'
} catch {
    # Details stay in ignored compile/server/browser logs; cleanup evidence contains only fixed reasons.
    $taskFailed = $true
} finally {
    $taskCleanupErrors = [Collections.Generic.List[string]]::new()
    $taskForcedJvmStop = $false
    try {
        if ($taskVite -and !$taskVite.HasExited) { Stop-Process -InputObject $taskVite; $null = $taskVite.WaitForExit(5000) }
    } catch { $taskCleanupErrors.Add('VITE_STOP_FAILED') }
    try {
        if ($taskJvm -and !$taskJvm.HasExited) {
            New-Item -ItemType File -Path ($taskFixture + '.stop') -Force | Out-Null
            if (!$taskJvm.WaitForExit(20000)) {
                $taskForcedJvmStop = $true
                Stop-Process -InputObject $taskJvm
                $null = $taskJvm.WaitForExit(5000)
            }
        }
    } catch { $taskCleanupErrors.Add('JVM_STOP_FAILED') }
    $taskOwnerVerified = !$taskJvm
    $taskStorageGone = !$taskJvm
    $taskContainerId = $null
    $taskOwnerPresent = Test-Path -LiteralPath $taskOwnership
    if ($taskOwnerPresent) {
        try {
            $taskOwner = Get-Content -LiteralPath $taskOwnership -Raw | ConvertFrom-Json
            if ($taskOwner.runId -ne $taskRunId) { throw 'Ownership mismatch.' }
            $taskTempPath = [IO.Path]::GetFullPath($taskOwner.temporaryRoot)
            $taskTempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
            if (!$taskTempPath.StartsWith($taskTempBase, [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($taskTempPath) -notmatch '^sjrs-recruiting-e2e-[A-Za-z0-9-]+$') { throw 'Unexpected owned storage.' }
            if ($taskOwner.containerId) {
                if ($taskOwner.containerId -notmatch '^[a-f0-9]{64}$') { throw 'Invalid owned container.' }
                $taskContainerId = $taskOwner.containerId
            }
            $taskOwnerVerified = $true
            $taskStorageGone = !(Test-Path -LiteralPath $taskTempPath)
        } catch { $taskCleanupErrors.Add('OWNERSHIP_METADATA_INVALID') }
    } elseif ($taskJvm) {
        # An exited JVM without ownership metadata does not prove that its storage was removed.
        $taskCleanupErrors.Add('OWNERSHIP_METADATA_MISSING')
    }
    $taskDockerVerified = $false
    $taskPostgresGone = $false
    try {
        # Query this UUID label even if start failed before a container ID could be recorded.
        $taskRemaining = @(& docker ps -a -q --no-trunc --filter ('label=sjrs.recruiting.run=' + $taskRunId) 2>> (Join-Path $taskLocal 'cleanup-docker.log'))
        if ($LASTEXITCODE -ne 0) { throw 'Owned Docker query failed.' }
        if ($taskContainerId) {
            $taskById = @(& docker ps -a -q --no-trunc --filter ('id=' + $taskContainerId) 2>> (Join-Path $taskLocal 'cleanup-docker.log'))
            if ($LASTEXITCODE -ne 0) { throw 'Owned Docker ID query failed.' }
            $taskRemaining += $taskById
        }
        $taskDockerVerified = $true
        $taskPostgresGone = $taskRemaining.Count -eq 0
    } catch { $taskCleanupErrors.Add('DOCKER_VERIFICATION_FAILED') }
    $taskProbeTriggered = [bool]($SetupFailureProbe -and (Test-Path -LiteralPath (Join-Path $taskLocal 'setup-failure-probe.json')))
    $taskClean = $taskOwnerVerified -and $taskDockerVerified -and $taskPostgresGone -and $taskStorageGone -and (!$taskJvm -or $taskJvm.HasExited) -and (!$taskVite -or $taskVite.HasExited) -and $taskCleanupErrors.Count -eq 0
    $taskReason = if ($taskProbeTriggered) { 'INTENTIONAL_SETUP_FAILURE_BEFORE_READINESS' } elseif ($taskFailed) { $taskStage + '_FAILED' } else { 'COMPLETED' }
    @{
        status = $(if ($taskClean) { 'CLEAN' } else { 'FAILED' }); reason = $taskReason; clean = $taskClean
        runFailed = $taskFailed; setupFailureProbe = $taskProbeTriggered; fixtureReady = (Test-Path -LiteralPath $taskFixture)
        ownershipMetadataPresent = $taskOwnerPresent; ownershipVerified = $taskOwnerVerified; dockerVerified = $taskDockerVerified
        ownedPostgresStopped = $taskPostgresGone; ownedPostgresRemoved = $taskPostgresGone; temporaryStorageRemoved = $taskStorageGone
        ownedJvmStopped = (!$taskJvm -or $taskJvm.HasExited); ownedViteStopped = (!$taskVite -or $taskVite.HasExited)
        forcedJvmStop = $taskForcedJvmStop; errors = @($taskCleanupErrors.ToArray())
    } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskLocal 'cleanup.json')
    $env:JAVA_HOME = $taskOldJava
    $env:VITE_API_PROXY_TARGET = $taskOldProxy
    $env:VITE_API_BASE_URL = $taskOldApiBase
    $env:RECRUITING_WORKFLOWS_FIXTURE = $taskOldFixture
    $env:RECRUITING_WORKFLOWS_FRONTEND = $taskOldFrontend
    Pop-Location
    Write-Output ('Ignored run evidence: ' + $taskLocal)
    if (!$taskClean) { throw 'Owned resources did not clean up; inspect cleanup.json.' }
}
if ($taskFailed) { throw ('Recruiting runner failed during ' + $taskStage + '; inspect ignored evidence and cleanup.json.') }
