param([string]$JavaHome = $env:JAVA_HOME)
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskBackend = Join-Path $taskRoot 'backend'
$taskFrontend = Join-Path $taskRoot 'frontend'
$taskE2e = Join-Path $taskRoot 'e2e'
$taskLocal = Join-Path $taskE2e ('.local/recruiting-workflows-' + [Guid]::NewGuid().ToString('N'))
$taskFixture = Join-Path $taskLocal 'fixture.json'
$taskJvm = $null
$taskVite = $null
$taskOldJava = $env:JAVA_HOME
$taskOldProxy = $env:VITE_API_PROXY_TARGET
$taskOldApiBase = $env:VITE_API_BASE_URL
$taskOldFixture = $env:RECRUITING_WORKFLOWS_FIXTURE
$taskOldFrontend = $env:RECRUITING_WORKFLOWS_FRONTEND
$taskJavaExe = Join-Path $JavaHome 'bin/java.exe'
if (!(Test-Path -LiteralPath $taskJavaExe)) { throw 'Supply -JavaHome for Java 21.' }
# Pick an available loopback port; strictPort fails on a race without touching its owner.
$taskListener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
try { $taskListener.Start(); $taskPort = $taskListener.LocalEndpoint.Port } finally { $taskListener.Stop() }
New-Item -ItemType Directory -Path $taskLocal -Force | Out-Null
Push-Location $taskBackend
try {
    $env:JAVA_HOME = $JavaHome
    $ErrorActionPreference = 'Continue'
    & .\mvnw.cmd -B -ntp test-compile org.apache.maven.plugins:maven-dependency-plugin:3.8.1:build-classpath '-Dmdep.outputFile=target/recruiting-workflows-browser-classpath.txt' *> (Join-Path $taskLocal 'compile.log')
    $taskCompileExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($taskCompileExit -ne 0) { throw 'Fixture compilation failed; inspect ignored compile.log.' }
    $taskClasspath = (Join-Path $taskBackend 'target/test-classes') + ';' + (Join-Path $taskBackend 'target/classes') + ';' + [IO.File]::ReadAllText((Join-Path $taskBackend 'target/recruiting-workflows-browser-classpath.txt')).Trim()
    $taskJvm = Start-Process -FilePath $taskJavaExe -WindowStyle Hidden -PassThru -WorkingDirectory $taskBackend -ArgumentList @('-cp', ('"' + $taskClasspath + '"'), 'com.tttn.jobrecommendation.integration.RecruitingWorkflowsBrowserFixture', ('"' + $taskFixture + '"')) -RedirectStandardOutput (Join-Path $taskLocal 'server.log') -RedirectStandardError (Join-Path $taskLocal 'server.err.log')
    $taskDeadline = (Get-Date).AddSeconds(90)
    while (!(Test-Path -LiteralPath $taskFixture)) {
        if ($taskJvm.HasExited -or (Get-Date) -gt $taskDeadline) { throw 'Fixture did not become ready; inspect ignored server logs.' }
        Start-Sleep -Milliseconds 300
    }
    $taskMetadata = Get-Content -LiteralPath $taskFixture -Raw | ConvertFrom-Json
    if ($taskMetadata.backendUrl -notmatch '^http://127\.0\.0\.1:\d+$') { throw 'Expected isolated loopback Backend.' }
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
    $ErrorActionPreference = 'Continue'
    & (Get-Command node.exe).Source (Join-Path $taskE2e 'node_modules/playwright/cli.js') test --config=recruiting-workflows-isolated.playwright.config.mjs
    $taskBrowserExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($taskBrowserExit -ne 0) { throw 'Focused browser suite failed; inspect ignored results.' }
} finally {
    if ($taskVite -and !$taskVite.HasExited) { Stop-Process -Id $taskVite.Id; $null = $taskVite.WaitForExit(5000) }
    if ($taskJvm -and !$taskJvm.HasExited) {
        New-Item -ItemType File -Path ($taskFixture + '.stop') -Force | Out-Null
        if (!$taskJvm.WaitForExit(20000)) { Stop-Process -Id $taskJvm.Id; Write-Warning 'Fixture force-stopped; inspect cleanup evidence.' }
    }
    $taskClean = $true
    if (Test-Path -LiteralPath $taskFixture) {
        $taskFinal = Get-Content -LiteralPath $taskFixture -Raw | ConvertFrom-Json
        $taskStorageGone = !(Test-Path -LiteralPath $taskFinal.temporaryRoot)
        $taskRunning = & docker ps -q --filter ('id=' + $taskFinal.containerId)
        $taskClean = $taskStorageGone -and !$taskRunning -and (!$taskJvm -or $taskJvm.HasExited) -and (!$taskVite -or $taskVite.HasExited)
        @{ temporaryStorageRemoved = $taskStorageGone; ownedPostgresStopped = !$taskRunning; ownedJvmStopped = (!$taskJvm -or $taskJvm.HasExited); ownedViteStopped = (!$taskVite -or $taskVite.HasExited) } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskLocal 'cleanup.json')
    }
    $env:JAVA_HOME = $taskOldJava
    $env:VITE_API_PROXY_TARGET = $taskOldProxy
    $env:VITE_API_BASE_URL = $taskOldApiBase
    $env:RECRUITING_WORKFLOWS_FIXTURE = $taskOldFixture
    $env:RECRUITING_WORKFLOWS_FRONTEND = $taskOldFrontend
    Pop-Location
    Write-Output ('Ignored run evidence: ' + $taskLocal)
    if (!$taskClean) { throw 'Owned resources did not clean up; inspect cleanup.json.' }
}
