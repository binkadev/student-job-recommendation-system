[CmdletBinding()]
param(
    [string]$BackendBaseUrl = "http://localhost:8080",
    [string]$AiBaseUrl = "http://localhost:8000",
    [string]$CvPath = "",
    [int]$TimeoutSeconds = 120,
    [decimal]$Threshold = 0.0,
    [int]$Limit = 100
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($CvPath)) {
    $CvPath = Join-Path $RepoRoot "ai-service\tests\fixtures\vietnamese_cv.docx"
}
$CvPath = (Resolve-Path -LiteralPath $CvPath).Path

$StudentEmail = if ([string]::IsNullOrWhiteSpace($env:SMOKE_STUDENT_EMAIL)) {
    "student@example.com"
}
else {
    $env:SMOKE_STUDENT_EMAIL
}

$CompanyEmail = if ([string]::IsNullOrWhiteSpace($env:SMOKE_COMPANY_EMAIL)) {
    "company@example.com"
}
else {
    $env:SMOKE_COMPANY_EMAIL
}

$DemoPassword = if ([string]::IsNullOrWhiteSpace($env:SMOKE_DEMO_PASSWORD)) {
    "123456"
}
else {
    $env:SMOKE_DEMO_PASSWORD
}

$VietnameseJobTitle = "Thực tập sinh Backend Java - Smoke"
$ExpectedProcessingVersion = "bilingual-nlp-v2-skills-v1"
$ExpectedAlgorithm = "tfidf-cosine-hybrid"
$ExpectedAlgorithmVersion = "bilingual-recommendation-v2"
$ExpectedCvSkills = @(
    "ci/cd",
    "docker",
    "java",
    "microservices",
    "postgresql",
    "rest api",
    "spring boot"
)

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw "ASSERTION FAILED: $Message"
    }
}

function Get-HttpErrorBody {
    param([System.Management.Automation.ErrorRecord]$ErrorRecord)

    if ($ErrorRecord.ErrorDetails -and -not [string]::IsNullOrWhiteSpace($ErrorRecord.ErrorDetails.Message)) {
        return $ErrorRecord.ErrorDetails.Message
    }

    $response = $ErrorRecord.Exception.Response
    if ($null -eq $response) {
        return $ErrorRecord.Exception.Message
    }

    try {
        $stream = $response.GetResponseStream()
        if ($null -eq $stream) {
            return $ErrorRecord.Exception.Message
        }

        $reader = New-Object System.IO.StreamReader($stream)
        try {
            return $reader.ReadToEnd()
        }
        finally {
            $reader.Dispose()
            $stream.Dispose()
        }
    }
    catch {
        return $ErrorRecord.Exception.Message
    }
}

function Invoke-JsonApi {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet("GET", "POST", "PUT", "PATCH", "DELETE")]
        [string]$Method,

        [Parameter(Mandatory = $true)]
        [string]$Uri,

        [string]$Token,
        [object]$Body
    )

    $headers = @{ Accept = "application/json" }
    if (-not [string]::IsNullOrWhiteSpace($Token)) {
        $headers.Authorization = "Bearer $Token"
    }

    $parameters = @{
        Method     = $Method
        Uri        = $Uri
        Headers    = $headers
        TimeoutSec = $TimeoutSeconds
    }

    if ($PSBoundParameters.ContainsKey("Body")) {
        $parameters.ContentType = "application/json"
        $parameters.Body = $Body | ConvertTo-Json -Depth 20 -Compress
    }

    try {
        return Invoke-RestMethod @parameters
    }
    catch {
        $bodyText = Get-HttpErrorBody -ErrorRecord $_
        throw "HTTP $Method $Uri failed. $bodyText"
    }
}

function Assert-ApiSuccess {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Response,

        [Parameter(Mandatory = $true)]
        [string]$Context
    )

    Assert-True ($null -ne $Response) "$Context returned no response"
    Assert-True ([bool]$Response.success) "$Context returned success=false; errorCode=$($Response.errorCode); message=$($Response.message)"
    return $Response.data
}

function Wait-ForEndpoint {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Uri,

        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $lastError = $null

    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-RestMethod -Method Get -Uri $Uri -TimeoutSec 5
            return $response
        }
        catch {
            $lastError = $_.Exception.Message
            Start-Sleep -Seconds 2
        }
    }

    throw "$Name did not become ready within $TimeoutSeconds seconds. Last error: $lastError"
}

function Get-LoginToken {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Email,

        [Parameter(Mandatory = $true)]
        [string]$Password,

        [Parameter(Mandatory = $true)]
        [string]$RoleLabel
    )

    $response = Invoke-JsonApi \
        -Method POST \
        -Uri "$BackendBaseUrl/api/auth/login" \
        -Body @{ email = $Email; password = $Password }

    $data = Assert-ApiSuccess -Response $response -Context "$RoleLabel login"
    Assert-True (-not [string]::IsNullOrWhiteSpace([string]$data.token)) "$RoleLabel login returned no token"
    return [string]$data.token
}

function Upload-CvMultipart {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string]$Token
    )

    Add-Type -AssemblyName System.Net.Http

    $client = [System.Net.Http.HttpClient]::new()
    $multipart = [System.Net.Http.MultipartFormDataContent]::new()
    $fileStream = $null
    $fileContent = $null
    $response = $null

    try {
        $client.Timeout = [TimeSpan]::FromSeconds($TimeoutSeconds)
        $client.DefaultRequestHeaders.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $Token)
        $client.DefaultRequestHeaders.Accept.Add([System.Net.Http.Headers.MediaTypeWithQualityHeaderValue]::new("application/json"))

        $fileStream = [System.IO.File]::OpenRead($Path)
        $fileContent = [System.Net.Http.StreamContent]::new($fileStream)
        $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
        $multipart.Add($fileContent, "file", [System.IO.Path]::GetFileName($Path))

        $uri = "$BackendBaseUrl/api/students/me/cv?active=true"
        $response = $client.PostAsync($uri, $multipart).GetAwaiter().GetResult()
        $json = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()

        if (-not $response.IsSuccessStatusCode) {
            throw "HTTP POST $uri failed with status $([int]$response.StatusCode). $json"
        }

        return $json | ConvertFrom-Json
    }
    finally {
        if ($null -ne $response) { $response.Dispose() }
        if ($null -ne $fileContent) { $fileContent.Dispose() }
        if ($null -ne $fileStream) { $fileStream.Dispose() }
        $multipart.Dispose()
        $client.Dispose()
    }
}

function Get-AllSkills {
    param([string]$Token)

    $response = Invoke-JsonApi \
        -Method GET \
        -Uri "$BackendBaseUrl/api/skills?page=1&size=100" \
        -Token $Token

    $data = Assert-ApiSuccess -Response $response -Context "List skills"
    return @($data.items)
}

function Ensure-VietnameseSmokeJob {
    param([string]$CompanyToken)

    $encodedTitle = [System.Uri]::EscapeDataString($VietnameseJobTitle)
    $queryResponse = Invoke-JsonApi \
        -Method GET \
        -Uri "$BackendBaseUrl/api/jobs?keyword=$encodedTitle&page=1&size=100" \
        -Token $CompanyToken

    $queryData = Assert-ApiSuccess -Response $queryResponse -Context "Find Vietnamese smoke job"
    $today = (Get-Date).Date

    $existing = @($queryData.items) | Where-Object {
        $_.title -eq $VietnameseJobTitle -and
        $_.status -eq "ACTIVE" -and
        ($null -eq $_.deadline -or [datetime]::Parse([string]$_.deadline).Date -ge $today)
    } | Select-Object -First 1

    if ($null -ne $existing) {
        Write-Host "Reusing Vietnamese smoke job id=$($existing.id)" -ForegroundColor DarkGray
        return [long]$existing.id
    }

    $skills = Get-AllSkills -Token $CompanyToken
    $requiredNames = @("java", "spring boot", "postgresql", "docker", "rest api")
    $skillRequests = @()

    foreach ($requiredName in $requiredNames) {
        $skill = $skills | Where-Object {
            ([string]$_.normalizedName).ToLowerInvariant() -eq $requiredName
        } | Select-Object -First 1

        Assert-True ($null -ne $skill) "Required seeded skill '$requiredName' was not found"
        $skillRequests += @{
            skillId   = [long]$skill.id
            importance = "REQUIRED"
            minLevel   = "BEGINNER"
        }
    }

    $request = @{
        title        = $VietnameseJobTitle
        description  = "Thực tập sinh phát triển hệ thống backend cho sinh viên công nghệ thông tin, tham gia xây dựng dịch vụ web và xử lý dữ liệu thực tế."
        requirements = "Yêu cầu Java, Spring Boot, PostgreSQL, Docker và REST API. Ưu tiên hiểu kiến trúc microservices và quy trình CI/CD."
        benefits     = "Được hướng dẫn kỹ thuật, review mã nguồn, làm việc cùng đội phát triển và nhận phụ cấp thực tập."
        location     = "Ho Chi Minh City"
        jobType      = "INTERNSHIP"
        workingModel = "HYBRID"
        status       = "ACTIVE"
        salaryMin    = 2000000
        salaryMax    = 5000000
        currency     = "VND"
        deadline     = (Get-Date).AddMonths(3).ToString("yyyy-MM-dd")
        skills       = $skillRequests
    }

    $createResponse = Invoke-JsonApi \
        -Method POST \
        -Uri "$BackendBaseUrl/api/jobs" \
        -Token $CompanyToken \
        -Body $request

    $created = Assert-ApiSuccess -Response $createResponse -Context "Create Vietnamese smoke job"
    Assert-True ($null -ne $created.id) "Created Vietnamese smoke job has no id"
    Write-Host "Created Vietnamese smoke job id=$($created.id)" -ForegroundColor DarkGray
    return [long]$created.id
}

function Wait-ForCvReady {
    param(
        [long]$CvId,
        [string]$StudentToken
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    while ((Get-Date) -lt $deadline) {
        $response = Invoke-JsonApi \
            -Method GET \
            -Uri "$BackendBaseUrl/api/students/me/cv/$CvId/analysis" \
            -Token $StudentToken

        $analysis = Assert-ApiSuccess -Response $response -Context "Read CV analysis"
        if ($analysis.status -eq "READY") {
            return $analysis
        }
        if ($analysis.status -eq "FAILED") {
            throw "CV analysis failed: $($analysis.analysisError)"
        }

        Start-Sleep -Seconds 2
    }

    throw "CV analysis did not reach READY within $TimeoutSeconds seconds"
}

function Wait-ForRunSuccess {
    param(
        [long]$RunId,
        [string]$StudentToken
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    while ((Get-Date) -lt $deadline) {
        $response = Invoke-JsonApi \
            -Method GET \
            -Uri "$BackendBaseUrl/api/students/me/recommendation-runs/$RunId" \
            -Token $StudentToken

        $run = Assert-ApiSuccess -Response $response -Context "Read recommendation run"
        if ($run.status -eq "SUCCESS") {
            return $run
        }
        if ($run.status -eq "FAILED") {
            throw "Recommendation run failed: $($run.errorMessage)"
        }

        Start-Sleep -Seconds 2
    }

    throw "Recommendation run did not reach SUCCESS within $TimeoutSeconds seconds"
}

function Assert-Ranking {
    param([object[]]$Results)

    Assert-True ($Results.Count -gt 0) "Recommendation result list is empty"

    $jobIds = @($Results | ForEach-Object { [long]$_.jobId })
    $uniqueJobIds = @($jobIds | Select-Object -Unique)
    Assert-True ($uniqueJobIds.Count -eq $jobIds.Count) "Recommendation results contain duplicate job ids"

    for ($index = 0; $index -lt $Results.Count; $index++) {
        $current = $Results[$index]
        $expectedRank = $index + 1
        Assert-True ([int]$current.rankPosition -eq $expectedRank) "Expected rankPosition=$expectedRank but received $($current.rankPosition)"

        if ($index -eq 0) {
            continue
        }

        $previous = $Results[$index - 1]
        $previousScore = [decimal]$previous.score
        $currentScore = [decimal]$current.score

        Assert-True ($currentScore -le $previousScore) "Results are not sorted by score descending"
        if ($currentScore -eq $previousScore) {
            Assert-True ([long]$current.jobId -gt [long]$previous.jobId) "Equal-score results are not sorted by jobId ascending"
        }
    }
}

Write-Host "Student Job Recommendation — Docker Core Smoke" -ForegroundColor Green
Write-Host "Backend: $BackendBaseUrl" -ForegroundColor DarkGray
Write-Host "AI:      $AiBaseUrl" -ForegroundColor DarkGray
Write-Host "CV:      $CvPath" -ForegroundColor DarkGray

Write-Step "Wait for AI and Backend readiness"
$aiHealth = Wait-ForEndpoint -Uri "$AiBaseUrl/health" -Name "AI Service"
Assert-True ($aiHealth.status -eq "ok") "AI health status is not ok"
Assert-True ($aiHealth.recommendationVersion -eq $ExpectedAlgorithmVersion) "Unexpected AI recommendationVersion"
Assert-True ($aiHealth.processingVersion -eq $ExpectedProcessingVersion) "Unexpected AI processingVersion"

$backendStatistics = Wait-ForEndpoint -Uri "$BackendBaseUrl/api/public/statistics" -Name "Backend"
Assert-True ([bool]$backendStatistics.success) "Backend public statistics returned success=false"

Write-Step "Login seeded Student and Company accounts"
$studentToken = Get-LoginToken -Email $StudentEmail -Password $DemoPassword -RoleLabel "Student"
$companyToken = Get-LoginToken -Email $CompanyEmail -Password $DemoPassword -RoleLabel "Company"

Write-Step "Ensure one eligible Vietnamese Job through Company API"
$vietnameseJobId = Ensure-VietnameseSmokeJob -CompanyToken $companyToken

Write-Step "Upload Vietnamese DOCX through Backend"
$uploadResponse = Upload-CvMultipart -Path $CvPath -Token $studentToken
$uploadedCv = Assert-ApiSuccess -Response $uploadResponse -Context "Upload CV"
$cvId = [long]$uploadedCv.id
Assert-True ($cvId -gt 0) "Uploaded CV has an invalid id"
Assert-True ([bool]$uploadedCv.isActive) "Uploaded CV is not active"

Write-Step "Reanalyze uploaded CV"
$reanalyzeResponse = Invoke-JsonApi \
    -Method POST \
    -Uri "$BackendBaseUrl/api/students/me/cv/$cvId/reanalyze" \
    -Token $studentToken
$null = Assert-ApiSuccess -Response $reanalyzeResponse -Context "Reanalyze CV"
$analysis = Wait-ForCvReady -CvId $cvId -StudentToken $studentToken

Assert-True ($analysis.languageCode -eq "vi") "Expected languageCode=vi but received $($analysis.languageCode)"
Assert-True ($analysis.processingVersion -eq $ExpectedProcessingVersion) "Unexpected processingVersion"
Assert-True (-not [string]::IsNullOrWhiteSpace([string]$analysis.processedText)) "processedText is empty"

$actualSkills = @($analysis.skills | ForEach-Object { ([string]$_).ToLowerInvariant() })
foreach ($expectedSkill in $ExpectedCvSkills) {
    Assert-True ($actualSkills -contains $expectedSkill) "Expected canonical CV skill '$expectedSkill' was not extracted"
}

Write-Step "Generate recommendations through Backend"
$generateResponse = Invoke-JsonApi \
    -Method POST \
    -Uri "$BackendBaseUrl/api/students/me/recommendations/generate" \
    -Token $studentToken \
    -Body @{ cvId = $cvId; threshold = $Threshold; limit = $Limit }
$generatedRun = Assert-ApiSuccess -Response $generateResponse -Context "Generate recommendations"
$runId = [long]$generatedRun.id
Assert-True ($runId -gt 0) "Generated recommendation run has an invalid id"

$run = Wait-ForRunSuccess -RunId $runId -StudentToken $studentToken
Assert-True ($run.algorithm -eq $ExpectedAlgorithm) "Unexpected recommendation algorithm"
Assert-True ($run.algorithmVersion -eq $ExpectedAlgorithmVersion) "Unexpected recommendation algorithmVersion"

$results = @($run.results)
Assert-Ranking -Results $results
Assert-True ([int]$run.totalRecommended -eq $results.Count) "totalRecommended does not match persisted result count"

Write-Step "Verify same-language and cross-language strategies"
$sameLanguage = $results | Where-Object { [long]$_.jobId -eq $vietnameseJobId } | Select-Object -First 1
Assert-True ($null -ne $sameLanguage) "Vietnamese smoke job is missing from recommendation results"
Assert-True ($sameLanguage.scoringStrategy -eq "SAME_LANGUAGE_HYBRID") "Vietnamese job did not use SAME_LANGUAGE_HYBRID"
Assert-True ($null -ne $sameLanguage.textScore) "Same-language textScore must not be null"
Assert-True (-not [string]::IsNullOrWhiteSpace([string]$sameLanguage.reason)) "Same-language reason is empty"

$crossLanguage = $results | Where-Object {
    $_.scoringStrategy -eq "CROSS_LANGUAGE_SKILL_BASED"
} | Select-Object -First 1
Assert-True ($null -ne $crossLanguage) "No CROSS_LANGUAGE_SKILL_BASED result was observed"
Assert-True ($null -eq $crossLanguage.textScore) "Cross-language textScore must be null"
Assert-True ([decimal]$crossLanguage.score -eq [decimal]$crossLanguage.skillScore) "Cross-language score must equal skillScore"
Assert-True (-not [string]::IsNullOrWhiteSpace([string]$crossLanguage.reason)) "Cross-language reason is empty"

Write-Step "Verify latest persisted results"
$latestResponse = Invoke-JsonApi \
    -Method GET \
    -Uri "$BackendBaseUrl/api/students/me/recommendation-results/latest" \
    -Token $studentToken
$latestResults = @(Assert-ApiSuccess -Response $latestResponse -Context "Read latest recommendation results")
Assert-True ($latestResults.Count -eq $results.Count) "Latest result count does not match generated run"

$runJobSequence = ($results | ForEach-Object { [string]$_.jobId }) -join ","
$latestJobSequence = ($latestResults | ForEach-Object { [string]$_.jobId }) -join ","
Assert-True ($runJobSequence -eq $latestJobSequence) "Latest result order does not match generated run"

Write-Host "`nSMOKE RESULT: PASS" -ForegroundColor Green
Write-Host "CV id:                 $cvId"
Write-Host "CV language:           $($analysis.languageCode)"
Write-Host "Recommendation run:    $runId"
Write-Host "Eligible jobs scanned: $($run.totalJobsScanned)"
Write-Host "Persisted results:     $($results.Count)"
Write-Host "Rank sequence:         1..$($results.Count)"
Write-Host "Same-language job:     $($sameLanguage.jobId) / $($sameLanguage.scoringStrategy)"
Write-Host "Cross-language job:    $($crossLanguage.jobId) / $($crossLanguage.scoringStrategy)"
Write-Host "`nNo password, JWT, raw CV text, or storage path was printed." -ForegroundColor DarkGray
