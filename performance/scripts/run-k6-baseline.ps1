[CmdletBinding()]
param(
    [string]$BaseUrl = $(if ($env:BASE_URL) { $env:BASE_URL } else { 'http://localhost:8080' }),
    [int]$Vus = $(if ($env:VUS) { [int]$env:VUS } else { 10 }),
    [int]$Iterations = $(if ($env:ITERATIONS) { [int]$env:ITERATIONS } else { 10000 }),
    [string]$ResultDirectory = $env:RESULT_DIRECTORY,
    [string]$PerformancePassword = $env:PERFORMANCE_PASSWORD,
    [switch]$ForceDocker
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib/k6-runner.ps1')

$runDirectory = New-PerformanceRunDirectory -RequestedPath $ResultDirectory
Assert-K6Inputs -BaseUrl $BaseUrl -Vus $Vus -Iterations $Iterations -PerformancePassword $PerformancePassword

Write-Warning "This is the final baseline launcher: $Vus VUs and $Iterations iterations PER ENDPOINT."
& (Join-Path $PSScriptRoot 'collect-environment-metadata.ps1') -ResultDirectory $runDirectory -BaseUrl $BaseUrl
if ($LASTEXITCODE -ne 0) { throw 'Environment metadata collection failed.' }

foreach ($workload in @(
    @{ Script = 'jobs-list.js'; Endpoint = 'jobs-list' },
    @{ Script = 'company-applications.js'; Endpoint = 'company-applications' },
    @{ Script = 'public-companies.js'; Endpoint = 'public-companies' }
)) {
    Invoke-K6Endpoint `
        -ScriptName $workload.Script `
        -EndpointName $workload.Endpoint `
        -RunDirectory $runDirectory `
        -BaseUrl $BaseUrl `
        -Vus $Vus `
        -Iterations $Iterations `
        -PerformancePassword $PerformancePassword `
        -WorkloadKind baseline `
        -ForceDocker:$ForceDocker
}

Write-Host "Baseline workload complete. Result directory: $runDirectory"

