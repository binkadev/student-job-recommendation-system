[CmdletBinding()]
param([switch]$KeepE2EStack)

$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'run-recommendation-real-e2e.ps1') @PSBoundParameters
exit $LASTEXITCODE
