param([string]$JavaHome = $env:JAVA_HOME)
$ErrorActionPreference = 'Stop'
$taskRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskBackend = Join-Path $taskRoot 'backend'
$taskFrontend = Join-Path $taskRoot 'frontend'
$taskE2e = Join-Path $taskRoot 'e2e'
$taskLocal = Join-Path $taskE2e '.local'
$taskFixture = Join-Path $taskLocal 'settings-isolated-fixture.json'
$taskStop = $taskFixture + '.stop'
$taskJvm = $null
$taskVite = $null
$taskOldJava = $env:JAVA_HOME
$taskOldProxy = $env:VITE_API_PROXY_TARGET
$taskJavaExe = Join-Path $JavaHome 'bin/java.exe'
if (!(Test-Path -LiteralPath $taskJavaExe)) { throw 'Supply -JavaHome for an installed Java 21 JDK.' }
# Never stop an existing service on this port. The runner only owns processes it starts.
$taskListener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 5175)
try { $taskListener.Start() } finally { $taskListener.Stop() }
New-Item -ItemType Directory -Path $taskLocal -Force | Out-Null
if (Test-Path -LiteralPath $taskFixture) { Remove-Item -LiteralPath $taskFixture }
Push-Location $taskBackend
try {
    $env:JAVA_HOME = $JavaHome
    # Native stderr warnings are diagnostic output; the process exit code is authoritative.
    $ErrorActionPreference = 'Continue'
    & .\mvnw.cmd -B -ntp test-compile org.apache.maven.plugins:maven-dependency-plugin:3.8.1:build-classpath '-Dmdep.outputFile=target/settings-browser-classpath.txt'
    $taskCompileExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($taskCompileExit -ne 0) { throw 'Isolated fixture compilation failed.' }
    $taskClasspath = (Join-Path $taskBackend 'target/test-classes') + ';' + (Join-Path $taskBackend 'target/classes') + ';' + [System.IO.File]::ReadAllText((Join-Path $taskBackend 'target/settings-browser-classpath.txt')).Trim()
    $taskJvm = Start-Process -FilePath $taskJavaExe -WindowStyle Hidden -PassThru -WorkingDirectory $taskBackend `
        -ArgumentList @('-cp', ('"' + $taskClasspath + '"'), 'com.tttn.jobrecommendation.integration.NotificationBrowserFixture', ('"' + $taskFixture + '"')) `
        -RedirectStandardOutput (Join-Path $taskLocal 'settings-isolated-server.log') -RedirectStandardError (Join-Path $taskLocal 'settings-isolated-server.err.log')
    $taskDeadline = (Get-Date).AddSeconds(60)
    while (!(Test-Path -LiteralPath $taskFixture)) {
        if ($taskJvm.HasExited -or (Get-Date) -gt $taskDeadline) { throw 'Isolated fixture did not become ready; inspect local server logs.' }
        Start-Sleep -Milliseconds 500
    }
    $taskMetadata = Get-Content -LiteralPath $taskFixture -Raw | ConvertFrom-Json
    if ($taskMetadata.backendUrl -notmatch '^http://127\.0\.0\.1:\d+$') { throw 'Expected a disposable loopback Backend.' }
    $env:VITE_API_PROXY_TARGET = $taskMetadata.backendUrl
    $taskVite = Start-Process -FilePath (Get-Command node.exe).Source -WindowStyle Hidden -PassThru -WorkingDirectory $taskFrontend `
        -ArgumentList @(('"' + (Join-Path $taskFrontend 'node_modules/vite/bin/vite.js') + '"'), '--host', '127.0.0.1', '--port', '5175', '--strictPort') `
        -RedirectStandardOutput (Join-Path $taskLocal 'settings-isolated-vite.log') -RedirectStandardError (Join-Path $taskLocal 'settings-isolated-vite.err.log')
    $taskReady = $false
    $taskDeadline = (Get-Date).AddSeconds(20)
    while (!$taskReady) {
        if ($taskVite.HasExited -or (Get-Date) -gt $taskDeadline) { throw 'Isolated Vite did not become ready.' }
        try { $taskReady = (Invoke-WebRequest 'http://127.0.0.1:5175/' -UseBasicParsing -TimeoutSec 1).StatusCode -eq 200 }
        catch { Start-Sleep -Milliseconds 300 }
    }
    Set-Location $taskE2e
    $ErrorActionPreference = 'Continue'
    & .\node_modules\.bin\playwright.cmd test --config=settings-isolated.playwright.config.mjs
    $taskBrowserExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($taskBrowserExit -ne 0) { throw 'Isolated browser checks failed; inspect local Playwright results.' }
} finally {
    if ($taskVite -and !$taskVite.HasExited) { Stop-Process -Id $taskVite.Id }
    if ($taskJvm -and !$taskJvm.HasExited) {
        New-Item -ItemType File -Path $taskStop -Force | Out-Null
        if (!$taskJvm.WaitForExit(10000)) { Stop-Process -Id $taskJvm.Id }
    }
    $env:JAVA_HOME = $taskOldJava
    $env:VITE_API_PROXY_TARGET = $taskOldProxy
    Pop-Location
}
