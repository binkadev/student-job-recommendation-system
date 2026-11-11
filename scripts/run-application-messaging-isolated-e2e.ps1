param([string]$JavaHome = $env:JAVA_HOME, [switch]$CleanupProbe, [string]$TemporaryBase = [IO.Path]::GetTempPath())
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskBackend = Join-Path $taskRoot 'backend'
$taskFrontend = Join-Path $taskRoot 'frontend'
$taskE2e = Join-Path $taskRoot 'e2e'
$taskLocal = Join-Path $taskE2e ('.local/application-messaging-' + [Guid]::NewGuid().ToString('N'))
$taskFixture = Join-Path $taskLocal 'fixture.json'
$taskScratchBase = [IO.Path]::GetFullPath($TemporaryBase).TrimEnd('\') + '\'
$taskScratch = [IO.Path]::GetFullPath((Join-Path $taskScratchBase ('sjrs-messaging-e2e-run-' + [Guid]::NewGuid().ToString('N'))))
if (!$taskScratch.StartsWith($taskScratchBase, [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid owned scratch directory.' }
$taskTargetLink = [IO.Path]::GetFullPath((Join-Path $taskBackend 'target'))
$taskOwnTargetLink = $false
$taskOldTmp = $env:TMP
$taskOldTemp = $env:TEMP
$taskJvm = $null
$taskVite = $null
$taskOldJava = $env:JAVA_HOME
$taskOldProxy = $env:VITE_API_PROXY_TARGET
$taskOldApiBase = $env:VITE_API_BASE_URL
$taskOldFixture = $env:APPLICATION_MESSAGING_FIXTURE
$taskOldFrontend = $env:APPLICATION_MESSAGING_FRONTEND
$taskJavaExe = Join-Path $JavaHome 'bin/java.exe'
if (!(Test-Path -LiteralPath $taskJavaExe)) { throw 'Supply -JavaHome for Java 21.' }
# Pick an available loopback port; strictPort fails on a race without touching its owner.
$taskListener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
try { $taskListener.Start(); $taskPort = $taskListener.LocalEndpoint.Port } finally { $taskListener.Stop() }
New-Item -ItemType Directory -Path $taskLocal -Force | Out-Null
Push-Location $taskBackend
try {
    New-Item -ItemType Directory -Path $taskScratch -Force | Out-Null
    $env:TMP = $taskScratch
    $env:TEMP = $taskScratch
    if (!(Test-Path -LiteralPath $taskTargetLink)) {
        $taskBuild = Join-Path $taskScratch 'backend-target'
        New-Item -ItemType Directory -Path $taskBuild -Force | Out-Null
        New-Item -ItemType Junction -Path $taskTargetLink -Target $taskBuild | Out-Null
        $taskOwnTargetLink = $true
    }
    $env:JAVA_HOME = $JavaHome
    $ErrorActionPreference = 'Continue'
    & .\mvnw.cmd -B -ntp test-compile org.apache.maven.plugins:maven-dependency-plugin:3.8.1:build-classpath '-Dmdep.outputFile=target/application-messaging-browser-classpath.txt' *> (Join-Path $taskLocal 'compile.log')
    $taskCompileExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($taskCompileExit -ne 0) { throw 'Fixture compilation failed; inspect ignored compile.log.' }
    $taskClasspath = (Join-Path $taskBackend 'target/test-classes') + ';' + (Join-Path $taskBackend 'target/classes') + ';' + [IO.File]::ReadAllText((Join-Path $taskBackend 'target/application-messaging-browser-classpath.txt')).Trim()
    $taskJvm = Start-Process -FilePath $taskJavaExe -WindowStyle Hidden -PassThru -WorkingDirectory $taskBackend -ArgumentList @(('-Djava.io.tmpdir=' + $taskScratch), '-cp', ('"' + $taskClasspath + '"'), 'com.tttn.jobrecommendation.integration.ApplicationMessagingBrowserFixture', ('"' + $taskFixture + '"')) -RedirectStandardOutput (Join-Path $taskLocal 'server.log') -RedirectStandardError (Join-Path $taskLocal 'server.err.log')
    $taskDeadline = (Get-Date).AddSeconds(90)
    while (!(Test-Path -LiteralPath $taskFixture)) {
        if ($taskJvm.HasExited -or (Get-Date) -gt $taskDeadline) { throw 'Fixture did not become ready; inspect ignored server logs.' }
        Start-Sleep -Milliseconds 300
    }
    $taskMetadata = Get-Content -LiteralPath $taskFixture -Raw | ConvertFrom-Json
    if ($taskMetadata.backendUrl -notmatch '^http://127\.0\.0\.1:\d+$') { throw 'Expected isolated loopback Backend.' }
    $env:VITE_API_PROXY_TARGET = $taskMetadata.backendUrl
    $env:VITE_API_BASE_URL = '/api'
    $env:APPLICATION_MESSAGING_FIXTURE = $taskFixture
    $env:APPLICATION_MESSAGING_FRONTEND = 'http://127.0.0.1:' + $taskPort
    # Keep optimizer caches isolated even when node_modules is shared through a worktree junction.
    $taskViteUri = ([Uri](Join-Path $taskFrontend 'node_modules/vite/dist/node/index.js')).AbsoluteUri
    $taskViteOptions = @{ cacheDir = (Join-Path $taskScratch 'vite-cache'); server = @{ host = '127.0.0.1'; port = $taskPort; strictPort = $true } } | ConvertTo-Json -Depth 3 -Compress
    $taskBootstrap = Join-Path $taskLocal 'start-vite.mjs'
    [IO.File]::WriteAllText($taskBootstrap, ("import { createServer } from '" + $taskViteUri + "';`nconst server = await createServer(" + $taskViteOptions + ");`nawait server.listen();server.printUrls();`n"), [Text.UTF8Encoding]::new($false))
    $taskVite = Start-Process -FilePath (Get-Command node.exe).Source -WindowStyle Hidden -PassThru -WorkingDirectory $taskFrontend -ArgumentList @(('"' + $taskBootstrap + '"')) -RedirectStandardOutput (Join-Path $taskLocal 'vite.log') -RedirectStandardError (Join-Path $taskLocal 'vite.err.log')
    $taskReady = $false
    $taskDeadline = (Get-Date).AddSeconds(30)
    while (!$taskReady) {
        if ($taskVite.HasExited -or (Get-Date) -gt $taskDeadline) { throw 'Dedicated Vite failed to start.' }
        try { $taskReady = (Invoke-WebRequest $env:APPLICATION_MESSAGING_FRONTEND -UseBasicParsing -TimeoutSec 1).StatusCode -eq 200 }
        catch { Start-Sleep -Milliseconds 300 }
    }
    if ($CleanupProbe) { throw 'Intentional cleanup probe before browser execution.' }
    Set-Location $taskE2e
    $ErrorActionPreference = 'Continue'
    & (Get-Command node.exe).Source (Join-Path $taskE2e 'node_modules/playwright/cli.js') test --config=application-messaging-isolated.playwright.config.mjs
    $taskBrowserExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($taskBrowserExit -ne 0) { throw 'Focused browser suite failed; inspect ignored results.' }
} finally {
    if ($taskVite -and !$taskVite.HasExited) { Stop-Process -Id $taskVite.Id; $null = $taskVite.WaitForExit(5000) }
    if ($taskJvm -and !$taskJvm.HasExited) {
        New-Item -ItemType File -Path ($taskFixture + '.stop') -Force | Out-Null
        if (!$taskJvm.WaitForExit(20000)) { Stop-Process -Id $taskJvm.Id; Write-Warning 'Fixture force-stopped; inspect cleanup evidence.' }
    }
    $taskOwnerPath = Join-Path $taskLocal 'ownership.json'
    $taskStorageGone = $true
    $taskRunning = $null
    if (Test-Path -LiteralPath $taskOwnerPath) {
        $taskOwner = Get-Content -LiteralPath $taskOwnerPath -Raw | ConvertFrom-Json
        if ($taskOwner.containerId -notmatch '^[a-f0-9]{64}$') { throw 'Invalid owned container ID.' }
        $taskRunning = & docker ps -q --filter ('id=' + $taskOwner.containerId)
        if ($taskRunning) {
            # Only the exact container created by this fixture, never a shared/manual service.
            & docker stop $taskOwner.containerId | Out-Null
            $taskRunning = & docker ps -q --filter ('id=' + $taskOwner.containerId)
        }
        $taskTempPath = [IO.Path]::GetFullPath($taskOwner.temporaryRoot)
        $taskTempRoot = $taskScratch.TrimEnd('\') + '\'
        if (!$taskTempPath.StartsWith($taskTempRoot, [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($taskTempPath) -notmatch '^sjrs-messaging-e2e-[A-Za-z0-9-]+$') { throw 'Unexpected temporary storage target.' }
        if (Test-Path -LiteralPath $taskTempPath) { Remove-Item -LiteralPath $taskTempPath -Recurse -Force }
        $taskStorageGone = !(Test-Path -LiteralPath $taskTempPath)
    }
    if ($taskOwnTargetLink) {
        if ($taskTargetLink -ne [IO.Path]::GetFullPath((Join-Path $taskBackend 'target'))) { throw 'Unexpected build link.' }
        # Delete only this run's junction, without recursively following it.
        [IO.Directory]::Delete($taskTargetLink)
    }
    if (!$taskScratch.StartsWith($taskScratchBase, [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($taskScratch) -notmatch '^sjrs-messaging-e2e-run-[a-f0-9]{32}$') { throw 'Unexpected owned scratch cleanup target.' }
    if (Test-Path -LiteralPath $taskScratch) { Remove-Item -LiteralPath $taskScratch -Recurse -Force }
    $taskEvidence = @{ temporaryStorageRemoved = $taskStorageGone; ownedPostgresStopped = !$taskRunning; ownedJvmStopped = (!$taskJvm -or $taskJvm.HasExited); ownedViteStopped = (!$taskVite -or $taskVite.HasExited); ownedScratchRemoved = !(Test-Path -LiteralPath $taskScratch); ownedBuildLinkRemoved = (!$taskOwnTargetLink -or !(Test-Path -LiteralPath $taskTargetLink)); cleanupProbe = [bool]$CleanupProbe }
    $taskClean = $taskEvidence.temporaryStorageRemoved -and $taskEvidence.ownedPostgresStopped -and $taskEvidence.ownedJvmStopped -and $taskEvidence.ownedViteStopped -and $taskEvidence.ownedScratchRemoved -and $taskEvidence.ownedBuildLinkRemoved
    $taskEvidence | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskLocal 'cleanup.json')
    $env:TMP = $taskOldTmp
    $env:TEMP = $taskOldTemp
    $env:JAVA_HOME = $taskOldJava
    $env:VITE_API_PROXY_TARGET = $taskOldProxy
    $env:VITE_API_BASE_URL = $taskOldApiBase
    $env:APPLICATION_MESSAGING_FIXTURE = $taskOldFixture
    $env:APPLICATION_MESSAGING_FRONTEND = $taskOldFrontend
    Pop-Location
    Write-Output ('Ignored run evidence: ' + $taskLocal)
    if (!$taskClean) { throw 'Owned resources did not clean up; inspect cleanup.json.' }
}
