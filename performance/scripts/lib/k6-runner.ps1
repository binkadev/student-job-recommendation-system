Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'k6-version.ps1')

function Get-RepositoryRoot {
    $scriptsDirectory = Split-Path -Parent $PSScriptRoot
    $performanceDirectory = Split-Path -Parent $scriptsDirectory
    return Split-Path -Parent $performanceDirectory
}

function Get-CompatibleRelativePath {
    param(
        [Parameter(Mandatory = $true)][string]$BasePath,
        [Parameter(Mandatory = $true)][string]$TargetPath
    )

    $baseFullPath = [IO.Path]::GetFullPath($BasePath).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    $targetFullPath = [IO.Path]::GetFullPath($TargetPath)
    $baseUri = [Uri]$baseFullPath
    $targetUri = [Uri]$targetFullPath
    return [Uri]::UnescapeDataString($baseUri.MakeRelativeUri($targetUri).ToString()).Replace('/', [IO.Path]::DirectorySeparatorChar)
}

function New-PerformanceRunDirectory {
    param([string]$RequestedPath)

    $repositoryRoot = Get-RepositoryRoot
    if ([string]::IsNullOrWhiteSpace($RequestedPath)) {
        $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $sha = (& git -c "safe.directory=$($repositoryRoot.Replace('\', '/'))" -C $repositoryRoot rev-parse --short HEAD).Trim()
        if ($LASTEXITCODE -ne 0) { throw 'Unable to resolve the Git SHA for the result directory.' }
        $RequestedPath = Join-Path $repositoryRoot "performance/results/baseline/$timestamp-$sha"
    }
    elseif (-not [IO.Path]::IsPathRooted($RequestedPath)) {
        $RequestedPath = Join-Path $repositoryRoot $RequestedPath
    }

    [IO.Directory]::CreateDirectory($RequestedPath) | Out-Null
    return [IO.Path]::GetFullPath($RequestedPath)
}

function Assert-K6Inputs {
    param(
        [Parameter(Mandatory = $true)][string]$BaseUrl,
        [Parameter(Mandatory = $true)][int]$Vus,
        [Parameter(Mandatory = $true)][int]$Iterations,
        [Parameter(Mandatory = $true)][string]$PerformancePassword
    )

    $uri = $null
    if (-not [Uri]::TryCreate($BaseUrl, [UriKind]::Absolute, [ref]$uri)) {
        throw 'BASE_URL must be an absolute http:// or https:// URL.'
    }
    if ($uri.Scheme -notin @('http', 'https')) { throw 'BASE_URL must use http or https.' }
    if ($Vus -lt 1) { throw 'VUS must be a positive integer.' }
    if ($Iterations -lt 1) { throw 'ITERATIONS must be a positive integer.' }
    if ([string]::IsNullOrWhiteSpace($PerformancePassword)) {
        throw 'PERFORMANCE_PASSWORD must be set in the current process environment or passed as a parameter.'
    }
}

function Invoke-K6Endpoint {
    param(
        [Parameter(Mandatory = $true)][string]$ScriptName,
        [Parameter(Mandatory = $true)][string]$EndpointName,
        [Parameter(Mandatory = $true)][string]$RunDirectory,
        [Parameter(Mandatory = $true)][string]$BaseUrl,
        [Parameter(Mandatory = $true)][int]$Vus,
        [Parameter(Mandatory = $true)][int]$Iterations,
        [Parameter(Mandatory = $true)][string]$PerformancePassword,
        [Parameter(Mandatory = $true)][ValidateSet('smoke', 'baseline')][string]$WorkloadKind,
        [Parameter(Mandatory = $true)]$K6Runtime
    )

    $repositoryRoot = Get-RepositoryRoot
    $scriptPath = Join-Path $repositoryRoot "performance/k6/$ScriptName"
    if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) { throw "Missing k6 script: $scriptPath" }

    $endpointDirectory = Join-Path (Join-Path $RunDirectory $(if ($WorkloadKind -eq 'smoke') { 'smoke' } else { 'k6' })) $EndpointName
    [IO.Directory]::CreateDirectory($endpointDirectory) | Out-Null
    $consolePath = Join-Path $endpointDirectory 'console.txt'

    $savedEnvironment = @{}
    foreach ($name in @('BASE_URL', 'VUS', 'ITERATIONS', 'RESULT_DIRECTORY', 'STUDENT_EMAIL', 'COMPANY_EMAIL', 'PERFORMANCE_PASSWORD', 'WORKLOAD_KIND')) {
        $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    }

    try {
        $env:BASE_URL = $BaseUrl.TrimEnd('/')
        $env:VUS = $Vus.ToString([Globalization.CultureInfo]::InvariantCulture)
        $env:ITERATIONS = $Iterations.ToString([Globalization.CultureInfo]::InvariantCulture)
        $env:STUDENT_EMAIL = if ([string]::IsNullOrWhiteSpace($env:STUDENT_EMAIL)) { 'perf.student.0001@example.test' } else { $env:STUDENT_EMAIL }
        $env:COMPANY_EMAIL = if ([string]::IsNullOrWhiteSpace($env:COMPANY_EMAIL)) { 'perf.company.001@example.test' } else { $env:COMPANY_EMAIL }
        $env:PERFORMANCE_PASSWORD = $PerformancePassword
        $env:WORKLOAD_KIND = $WorkloadKind

        if ($null -eq $K6Runtime.PSObject.Properties['Kind'] -or $K6Runtime.Kind -notin @('native', 'docker')) {
            throw 'Invoke-K6Endpoint requires a validated native or Docker k6 runtime.'
        }

        if ($K6Runtime.Kind -eq 'native') {
            if ([string]::IsNullOrWhiteSpace([string]$K6Runtime.Executable) -or -not (Test-Path -LiteralPath $K6Runtime.Executable -PathType Leaf)) {
                throw 'The validated native k6 executable is no longer available.'
            }
            $env:RESULT_DIRECTORY = [IO.Path]::GetFullPath($endpointDirectory).Replace('\', '/')
            $relativeScript = (Get-CompatibleRelativePath -BasePath $repositoryRoot -TargetPath $scriptPath).Replace('\', '/')
            Push-Location $repositoryRoot
            try {
                $savedErrorPreference = $ErrorActionPreference
                $ErrorActionPreference = 'Continue'
                & $K6Runtime.Executable run --summary-mode=full $relativeScript 2>&1 | Tee-Object -FilePath $consolePath
                $exitCode = $LASTEXITCODE
                $ErrorActionPreference = $savedErrorPreference
            }
            finally {
                $ErrorActionPreference = $savedErrorPreference
                Pop-Location
            }
        }
        else {
            if ([string]$K6Runtime.DockerImage -ne $script:PinnedK6DockerImage) {
                throw "The Dockerized k6 runtime is not the required pinned image $($script:PinnedK6DockerImage)."
            }
            $dockerBaseUrl = $env:BASE_URL
            $baseUri = [Uri]$dockerBaseUrl
            if ($baseUri.Host -in @('localhost', '127.0.0.1')) {
                $builder = [UriBuilder]$baseUri
                $builder.Host = 'host.docker.internal'
                $dockerBaseUrl = $builder.Uri.AbsoluteUri.TrimEnd('/')
            }

            $relativeScript = (Get-CompatibleRelativePath -BasePath $repositoryRoot -TargetPath $scriptPath).Replace('\', '/')
            $relativeResult = (Get-CompatibleRelativePath -BasePath $repositoryRoot -TargetPath $endpointDirectory).Replace('\', '/')
            $env:BASE_URL = $dockerBaseUrl
            $env:RESULT_DIRECTORY = "/workspace/$relativeResult"

            $arguments = @(
                'run', '--rm', '--add-host', 'host.docker.internal:host-gateway',
                '--label', 'com.tttn.performance.workload=k6',
                '--label', "com.tttn.performance.workload-type=$WorkloadKind",
                '--volume', "${repositoryRoot}:/workspace", '--workdir', '/workspace',
                '--env', 'BASE_URL', '--env', 'VUS', '--env', 'ITERATIONS',
                '--env', 'RESULT_DIRECTORY', '--env', 'STUDENT_EMAIL', '--env', 'COMPANY_EMAIL',
                '--env', 'PERFORMANCE_PASSWORD', '--env', 'WORKLOAD_KIND',
                $K6Runtime.DockerImage, 'run', '--summary-mode=full', $relativeScript
            )
            $savedErrorPreference = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            & docker @arguments 2>&1 | Tee-Object -FilePath $consolePath
            $exitCode = $LASTEXITCODE
            $ErrorActionPreference = $savedErrorPreference
        }

        if ($exitCode -ne 0) { throw "k6 failed for $EndpointName with exit code $exitCode." }
        $summaryPath = Join-Path $endpointDirectory 'summary.json'
        if (-not (Test-Path -LiteralPath $summaryPath -PathType Leaf)) {
            throw "k6 did not create $summaryPath."
        }
    }
    finally {
        foreach ($entry in $savedEnvironment.GetEnumerator()) {
            [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
        }
    }
}
