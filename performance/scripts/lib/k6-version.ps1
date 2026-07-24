Set-StrictMode -Version Latest

$script:RequiredK6Version = '2.1.0'
$script:PinnedK6DockerImage = 'grafana/k6:2.1.0@sha256:65c920dc067d5e2e00befbf982af6ad6ad0117034e8b1c65817c7975c52d4669'

function Assert-K6VersionOutput {
    param(
        [Parameter(Mandatory = $true)][string]$VersionOutput,
        [Parameter(Mandatory = $true)][string]$RunnerDescription
    )

    $match = [regex]::Match($VersionOutput, '(?im)\bk6(?:\.exe)?\s+v(?<version>\d+\.\d+\.\d+)\b')
    if (-not $match.Success) {
        throw "Unable to parse the k6 version reported by $RunnerDescription. Refusing to run an unverified load-test binary."
    }

    $actualVersion = $match.Groups['version'].Value
    if ($actualVersion -ne $script:RequiredK6Version) {
        throw "k6 $actualVersion was reported by $RunnerDescription, but official baseline reproduction requires exactly $($script:RequiredK6Version). Use -ForceDocker for the pinned fallback or install the required native version."
    }

    return $actualVersion
}

function Get-CanonicalK6VersionOutput {
    param([Parameter(Mandatory = $true)][string]$VersionOutput)

    $match = [regex]::Match($VersionOutput, '(?im)^[^\r\n]*\bk6(?:\.exe)?\s+v\d+\.\d+\.\d+[^\r\n]*$')
    if (-not $match.Success) { throw 'Unable to extract the validated k6 version line.' }
    return $match.Value.Trim()
}

function Get-NativeK6Runtime {
    param([Parameter(Mandatory = $true)][System.Management.Automation.CommandInfo]$Command)

    $savedErrorPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $versionOutput = (& $Command.Source version 2>&1 | Out-String).Trim()
        $invocationSucceeded = $?
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $savedErrorPreference
    }

    if (-not $invocationSucceeded -or $exitCode -ne 0) {
        throw "Unable to execute the native k6 version check (exit code $exitCode)."
    }

    $version = Assert-K6VersionOutput -VersionOutput $versionOutput -RunnerDescription 'the native executable'
    $canonicalVersionOutput = Get-CanonicalK6VersionOutput -VersionOutput $versionOutput
    Write-Host "Validated native k6 $($version): $canonicalVersionOutput"
    return [pscustomobject]@{
        Kind = 'native'
        Version = $version
        FullVersion = $canonicalVersionOutput
        Executable = $Command.Source
        DockerImage = $null
    }
}

function Get-DockerK6Runtime {
    try {
        $dockerCommand = Get-Command docker -CommandType Application -ErrorAction Stop
    }
    catch {
        throw "Docker cannot be resolved for the pinned k6 fallback: $($_.Exception.Message)"
    }
    $savedErrorPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $versionOutput = (& $dockerCommand.Source run --rm $script:PinnedK6DockerImage version 2>&1 | Out-String).Trim()
        $invocationSucceeded = $?
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $savedErrorPreference
    }

    if (-not $invocationSucceeded -or $exitCode -ne 0) {
        throw "Unable to execute the pinned Dockerized k6 version check (exit code $exitCode)."
    }

    $version = Assert-K6VersionOutput -VersionOutput $versionOutput -RunnerDescription $script:PinnedK6DockerImage
    $canonicalVersionOutput = Get-CanonicalK6VersionOutput -VersionOutput $versionOutput
    Write-Host "Validated Dockerized k6 $version from $($script:PinnedK6DockerImage): $canonicalVersionOutput"
    return [pscustomobject]@{
        Kind = 'docker'
        Version = $version
        FullVersion = $canonicalVersionOutput
        Executable = $null
        DockerImage = $script:PinnedK6DockerImage
    }
}

function Resolve-K6Runtime {
    param([switch]$ForceDocker)

    if ($ForceDocker) {
        return Get-DockerK6Runtime
    }

    $localK6 = Get-Command k6 -ErrorAction SilentlyContinue
    if ($null -ne $localK6) {
        return Get-NativeK6Runtime -Command $localK6
    }

    Write-Host "Native k6 was not found; using pinned Docker image $($script:PinnedK6DockerImage)."
    return Get-DockerK6Runtime
}
