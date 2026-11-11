param([string]$JavaHome = $env:JAVA_HOME)
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskBackend = Join-Path $taskRoot 'backend'
$taskFrontend = Join-Path $taskRoot 'frontend'
$taskE2e = Join-Path $taskRoot 'e2e'
$taskLocal = Join-Path $taskE2e ('.local/company-verification-' + [Guid]::NewGuid().ToString('N'))
$taskFixture = Join-Path $taskLocal 'fixture.json'
$taskJvm = $null
$taskVite = $null
$taskOldJava = $env:JAVA_HOME
$taskOldProxy = $env:VITE_API_PROXY_TARGET
$taskOldFixture = $env:COMPANY_VERIFICATION_FIXTURE
$taskOldFrontend = $env:COMPANY_VERIFICATION_FRONTEND
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
    & .\mvnw.cmd -B -ntp test-compile org.apache.maven.plugins:maven-dependency-plugin:3.8.1:build-classpath '-Dmdep.outputFile=target/company-verification-browser-classpath.txt' *> (Join-Path $taskLocal 'compile.log')
    $taskCompileExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($taskCompileExit -ne 0) { throw 'Fixture compilation failed; inspect ignored compile.log.' }
    $taskClasspath = (Join-Path $taskBackend 'target/test-classes') + ';' + (Join-Path $taskBackend 'target/classes') + ';' + [IO.File]::ReadAllText((Join-Path $taskBackend 'target/company-verification-browser-classpath.txt')).Trim()
    $taskJvm = Start-Process -FilePath $taskJavaExe -WindowStyle Hidden -PassThru -WorkingDirectory $taskBackend -ArgumentList @('-cp', ('"' + $taskClasspath + '"'), 'com.tttn.jobrecommendation.integration.CompanyVerificationBrowserFixture', ('"' + $taskFixture + '"')) -RedirectStandardOutput (Join-Path $taskLocal 'server.log') -RedirectStandardError (Join-Path $taskLocal 'server.err.log')
    $taskDeadline = (Get-Date).AddSeconds(90)
    while (!(Test-Path -LiteralPath $taskFixture)) {
        if ($taskJvm.HasExited -or (Get-Date) -gt $taskDeadline) { throw 'Fixture did not become ready; inspect ignored server logs.' }
        Start-Sleep -Milliseconds 300
    }
    $taskMetadata = Get-Content -LiteralPath $taskFixture -Raw | ConvertFrom-Json
    if ($taskMetadata.backendUrl -notmatch '^http://127\.0\.0\.1:\d+$') { throw 'Expected isolated loopback Backend.' }
    $env:VITE_API_PROXY_TARGET = $taskMetadata.backendUrl
    $env:COMPANY_VERIFICATION_FIXTURE = $taskFixture
    $env:COMPANY_VERIFICATION_FRONTEND = 'http://127.0.0.1:' + $taskPort
    $taskVite = Start-Process -FilePath (Get-Command node.exe).Source -WindowStyle Hidden -PassThru -WorkingDirectory $taskFrontend -ArgumentList @(('"' + (Join-Path $taskFrontend 'node_modules/vite/bin/vite.js') + '"'), '--host', '127.0.0.1', '--port', $taskPort, '--strictPort') -RedirectStandardOutput (Join-Path $taskLocal 'vite.log') -RedirectStandardError (Join-Path $taskLocal 'vite.err.log')
    $taskReady = $false
    $taskDeadline = (Get-Date).AddSeconds(30)
    while (!$taskReady) {
        if ($taskVite.HasExited -or (Get-Date) -gt $taskDeadline) { throw 'Dedicated Vite failed to start.' }
        try { $taskReady = (Invoke-WebRequest $env:COMPANY_VERIFICATION_FRONTEND -UseBasicParsing -TimeoutSec 1).StatusCode -eq 200 }
        catch { Start-Sleep -Milliseconds 300 }
    }
    Set-Location $taskE2e
    $ErrorActionPreference = 'Continue'
    & (Get-Command node.exe).Source (Join-Path $taskE2e 'node_modules/playwright/cli.js') test --config=company-verification-isolated.playwright.config.mjs
    $taskBrowserExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($taskBrowserExit -ne 0) { throw 'Focused browser suite failed; inspect ignored results.' }
} finally {
    if ($taskVite -and !$taskVite.HasExited) { Stop-Process -Id $taskVite.Id }
    if ($taskJvm -and !$taskJvm.HasExited) {
        New-Item -ItemType File -Path ($taskFixture + '.stop') -Force | Out-Null
        if (!$taskJvm.WaitForExit(20000)) { Stop-Process -Id $taskJvm.Id; Write-Warning 'Fixture force-stopped; inspect cleanup evidence.' }
    }
    $taskClean = $true
    if (Test-Path -LiteralPath $taskFixture) {
        $taskFinal = Get-Content -LiteralPath $taskFixture -Raw | ConvertFrom-Json
        $taskStorageGone = !(Test-Path -LiteralPath $taskFinal.temporaryRoot)
        $taskRunning = & docker ps -q --filter ('id=' + $taskFinal.containerId)
        $taskClean = $taskStorageGone -and !$taskRunning
        @{ temporaryStorageRemoved = $taskStorageGone; ownedPostgresStopped = !$taskRunning; ownedJvmStopped = (!$taskJvm -or $taskJvm.HasExited); ownedViteStopped = (!$taskVite -or $taskVite.HasExited) } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskLocal 'cleanup.json')
    }
    $env:JAVA_HOME = $taskOldJava
    $env:VITE_API_PROXY_TARGET = $taskOldProxy
    $env:COMPANY_VERIFICATION_FIXTURE = $taskOldFixture
    $env:COMPANY_VERIFICATION_FRONTEND = $taskOldFrontend
    Pop-Location
    Write-Output ('Ignored run evidence: ' + $taskLocal)
    if (!$taskClean) { throw 'Owned resources did not clean up; inspect cleanup.json.' }
}
