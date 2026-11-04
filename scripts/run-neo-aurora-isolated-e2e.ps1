param([string]$JavaHome = $env:JAVA_HOME, [ValidatePattern('^[a-z0-9-]+$')][string]$RunName = 'neo-aurora-isolated')
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskBackend = Join-Path $taskRoot 'backend'
$taskFrontend = Join-Path $taskRoot 'frontend'
$taskE2e = Join-Path $taskRoot 'e2e'
$taskLocal = Join-Path $taskE2e ('.local/' + $RunName)
$taskFixture = Join-Path $taskLocal 'fixture.json'
$taskJava = Join-Path $JavaHome 'bin/java.exe'
if (!(Test-Path -LiteralPath $taskJava)) { throw 'An installed Java 21 JDK is required.' }
if (Test-Path -LiteralPath $taskLocal) { throw 'Do not overwrite an existing isolated run directory; use a unique RunName.' }
New-Item -ItemType Directory -Path $taskLocal -Force | Out-Null
$taskJvm = $null
$taskVite = $null
$taskOriginal = @{}
foreach ($taskName in @('JAVA_HOME','E2E_BACKEND_URL','E2E_FRONTEND_URL','E2E_LOCAL_DIR','E2E_USE_DEV_SEED_ADMIN','E2E_RESULTS_FILE','UIUX_BASE_URL')) { $taskOriginal[$taskName] = [Environment]::GetEnvironmentVariable($taskName, 'Process') }
Push-Location $taskBackend
try {
    $env:JAVA_HOME = $JavaHome
    $ErrorActionPreference = 'Continue'
    & .\mvnw.cmd -B -ntp test-compile org.apache.maven.plugins:maven-dependency-plugin:3.8.1:build-classpath '-Dmdep.outputFile=target/neo-browser-classpath.txt'
    $taskExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($taskExit -ne 0) { throw 'Fixture compilation failed.' }
    $taskClasspath = (Join-Path $taskBackend 'target/test-classes') + ';' + (Join-Path $taskBackend 'target/classes') + ';' + [IO.File]::ReadAllText((Join-Path $taskBackend 'target/neo-browser-classpath.txt')).Trim()
    $taskJvm = Start-Process -FilePath $taskJava -WindowStyle Hidden -PassThru -WorkingDirectory $taskBackend -ArgumentList @('-cp', ('"' + $taskClasspath + '"'), 'com.tttn.jobrecommendation.integration.NeoAuroraBrowserFixture', ('"' + $taskFixture + '"')) -RedirectStandardOutput (Join-Path $taskLocal 'backend.log') -RedirectStandardError (Join-Path $taskLocal 'backend.err.log')
    $taskDeadline = (Get-Date).AddSeconds(90)
    while (!(Test-Path -LiteralPath $taskFixture)) {
        if ($taskJvm.HasExited -or (Get-Date) -gt $taskDeadline) { throw 'Isolated services did not become ready; inspect private logs.' }
        Start-Sleep -Milliseconds 500
    }
    $taskMetadata = Get-Content -LiteralPath $taskFixture -Raw | ConvertFrom-Json
    if ($taskMetadata.backendUrl -notmatch '^http://127\.0\.0\.1:\d+$') { throw 'Expected disposable loopback backend.' }
    $env:E2E_BACKEND_URL = $taskMetadata.backendUrl
    $env:E2E_FRONTEND_URL = 'http://127.0.0.1:5178'
    $env:UIUX_BASE_URL = $env:E2E_FRONTEND_URL
    $env:E2E_LOCAL_DIR = $taskLocal
    $env:E2E_USE_DEV_SEED_ADMIN = '1'
    $env:E2E_RESULTS_FILE = Join-Path $taskLocal 'default-results.json'
    $taskConfig = Join-Path $taskLocal 'vite.config.mjs'
    $taskTarget = $taskMetadata.backendUrl | ConvertTo-Json -Compress
    [IO.File]::WriteAllText($taskConfig, "export default { preview: { proxy: { '/api': { target: $taskTarget, changeOrigin: true, configure(proxy) { proxy.on('proxyReq', req => req.removeHeader('origin')); } } } } };")
    $taskVite = Start-Process -FilePath (Get-Command node.exe).Source -WindowStyle Hidden -PassThru -WorkingDirectory $taskFrontend -ArgumentList @('node_modules/vite/bin/vite.js', 'preview', '--config', ('"' + $taskConfig + '"'), '--host', '127.0.0.1', '--port', '5178', '--strictPort') -RedirectStandardOutput (Join-Path $taskLocal 'preview.log') -RedirectStandardError (Join-Path $taskLocal 'preview.err.log')
    $taskDeadline = (Get-Date).AddSeconds(20)
    while ($true) {
        if ($taskVite.HasExited -or (Get-Date) -gt $taskDeadline) { throw 'Production preview did not become ready.' }
        try { if ((Invoke-WebRequest $env:E2E_FRONTEND_URL -UseBasicParsing -TimeoutSec 1).StatusCode -eq 200) { break } } catch { Start-Sleep -Milliseconds 300 }
    }
    Set-Location $taskE2e
    # Synthetic CV inputs only; private demo CVs and credentials never enter this runtime.
    Get-ChildItem -LiteralPath (Join-Path $taskE2e '.local') -Filter 'datn-e2e-v1-*' -File | Where-Object { $_.Extension -in '.pdf','.docx' } | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $taskLocal }
    $ErrorActionPreference = 'Continue'
    & node.exe setup.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Isolated setup failed.' }
    & node.exe node_modules/playwright/cli.js test --config=playwright.config.mjs
    $taskDefaultExit = $LASTEXITCODE
    $env:E2E_RESULTS_FILE = Join-Path $taskLocal 'uiux-results.json'
    & node.exe node_modules/playwright/cli.js test --config=uiux-acceptance.playwright.config.mjs
    $taskUiExit = $LASTEXITCODE
    if ($taskDefaultExit -ne 0 -or $taskUiExit -ne 0) { throw "Browser verification failed: default=$taskDefaultExit, UI=$taskUiExit. Inspect private results." }
} finally {
    if ($taskVite -and !$taskVite.HasExited) { Stop-Process -Id $taskVite.Id }
    if ($taskJvm -and !$taskJvm.HasExited) {
        New-Item -ItemType File -Path ($taskFixture + '.stop') -Force | Out-Null
        if (!$taskJvm.WaitForExit(10000)) { Stop-Process -Id $taskJvm.Id }
    }
    foreach ($taskName in $taskOriginal.Keys) { [Environment]::SetEnvironmentVariable($taskName, $taskOriginal[$taskName], 'Process') }
    Pop-Location
}
