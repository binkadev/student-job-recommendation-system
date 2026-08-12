[CmdletBinding()]
param(
    [switch]$KeepE2EStack
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ProjectName = 'candidate-ranking-real-e2e'
$BackendUrl = 'http://127.0.0.1:18080'
$AiUrl = 'http://127.0.0.1:18000'
$DatabaseName = 'student_job_recommendation'
$ComposeArgs = @(
    '-p', $ProjectName,
    '-f', 'docker-compose.yml',
    '-f', 'docker-compose.e2e.yml'
)

function Invoke-Compose {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

    & docker compose @ComposeArgs @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose command failed: $($Arguments -join ' ')"
    }
}

function Invoke-DatabaseQuery {
    param([Parameter(Mandatory)][string]$Sql)

    $lines = $Sql | & docker compose @ComposeArgs exec -T postgres psql `
        -X -q -t -A -U postgres -d $DatabaseName -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) {
        throw 'The isolated E2E database query failed.'
    }
    return @($lines | Where-Object { $_ -and $_.Trim() } | ForEach-Object { $_.Trim() })
}

function Invoke-DatabaseScalar {
    param([Parameter(Mandatory)][string]$Sql)

    $results = @(Invoke-DatabaseQuery $Sql)
    if ($results.Count -ne 1) {
        throw "Expected exactly one database result, received $($results.Count)."
    }
    return [string]$results[0]
}

function Invoke-JsonApi {
    param(
        [Parameter(Mandatory)][ValidateSet('GET', 'POST')][string]$Method,
        [Parameter(Mandatory)][string]$Path,
        [object]$Body,
        [hashtable]$Headers,
        [int]$ExpectedStatus = 200
    )

    $request = @{
        Uri = "$BackendUrl$Path"
        Method = $Method
        UseBasicParsing = $true
        ErrorAction = 'Stop'
    }
    if ($Headers) {
        $request.Headers = $Headers
    }
    if ($null -ne $Body) {
        $request.ContentType = 'application/json'
        $request.Body = $Body | ConvertTo-Json -Compress
    }

    $response = Invoke-WebRequest @request
    if ($response.StatusCode -ne $ExpectedStatus) {
        throw "Unexpected HTTP status $($response.StatusCode) for $Method $Path."
    }
    return [pscustomobject]@{
        StatusCode = $response.StatusCode
        Body = $response.Content | ConvertFrom-Json
    }
}

function Assert-Condition {
    param([Parameter(Mandatory)][bool]$Condition, [Parameter(Mandatory)][string]$Message)

    if (-not $Condition) {
        throw "Assertion failed: $Message"
    }
}

function Assert-SortedSkills {
    param([object[]]$Skills, [string]$Label)

    $actual = @($Skills | ForEach-Object { [string]$_ })
    $sorted = @($actual | Sort-Object)
    $isSorted = $actual.Count -eq $sorted.Count -and (($actual -join '|') -eq ($sorted -join '|'))
    Assert-Condition $isSorted "$Label must be sorted."
}

function Assert-Score {
    param([object]$Score, [string]$Label)

    Assert-Condition ($null -ne $Score) "$Label must be present."
    $numeric = [double]$Score
    $isFinite = -not [double]::IsNaN($numeric) -and -not [double]::IsInfinity($numeric)
    Assert-Condition $isFinite "$Label must be finite."
    Assert-Condition ($numeric -ge 0.0 -and $numeric -le 1.0) "$Label must be between zero and one."
    Assert-Condition (([string]$Score) -match '^\d+(\.\d{1,8})?$') "$Label must use at most eight decimal places."
}

$started = $false
try {
    & docker version *> $null
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker is unavailable. Start Docker Desktop and retry.'
    }

    # This project name is dedicated to this runner; removing it cannot touch
    # the normal development Compose project or any unrelated Docker resource.
    Invoke-Compose down --volumes --remove-orphans
    Invoke-Compose up -d --build --wait --wait-timeout 180
    $started = $true

    $aiHealth = Invoke-WebRequest -Uri "$AiUrl/health" -UseBasicParsing -ErrorAction Stop
    Assert-Condition ($aiHealth.StatusCode -eq 200) 'AI health endpoint must return HTTP 200.'
    $backendHealth = Invoke-WebRequest -Uri "$BackendUrl/api/public/statistics" -UseBasicParsing -ErrorAction Stop
    Assert-Condition ($backendHealth.StatusCode -eq 200) 'Backend public health probe must return HTTP 200.'

    $registration = Invoke-JsonApi -Method POST -Path '/api/auth/register' -ExpectedStatus 201 -Body @{
        email = 'candidate-ranking-e2e-company@example.test'
        password = 'CandidateRankingE2E!1'
        role = 'COMPANY'
        fullName = 'Candidate Ranking E2E Company'
        companyName = 'Candidate Ranking E2E Company'
    }
    Assert-Condition $registration.Body.success 'Company registration must succeed.'

    $login = Invoke-JsonApi -Method POST -Path '/api/auth/login' -Body @{
        email = 'candidate-ranking-e2e-company@example.test'
        password = 'CandidateRankingE2E!1'
    }
    Assert-Condition $login.Body.success 'Company login must succeed.'
    $token = [string]$login.Body.data.token
    Assert-Condition (-not [string]::IsNullOrWhiteSpace($token)) 'Login must return a JWT.'

    $seedSql = @'
INSERT INTO skills (name, normalized_name, category) VALUES
    ('Java', 'java', 'Backend'),
    ('Spring Boot', 'spring boot', 'Backend'),
    ('PostgreSQL', 'postgresql', 'Database'),
    ('Docker', 'docker', 'DevOps');

INSERT INTO jobs (
    company_id, title, description, requirements, benefits, location,
    job_type, working_model, status, published_at
) VALUES (
    (SELECT c.id FROM companies c JOIN users u ON u.id = c.user_id
        WHERE u.email = 'candidate-ranking-e2e-company@example.test'),
    'Java Spring Boot Backend Intern',
    'Build Java Spring Boot REST APIs and PostgreSQL services for production systems.',
    'Strong Java, Spring Boot, PostgreSQL, and Docker skills are required.',
    'Mentorship and code review.', 'Ho Chi Minh City', 'INTERNSHIP', 'HYBRID', 'ACTIVE', CURRENT_TIMESTAMP
);

INSERT INTO job_skills (job_id, skill_id, importance, min_level)
SELECT j.id, s.id, 'REQUIRED', 'BEGINNER'
FROM jobs j
JOIN skills s ON s.normalized_name IN ('docker', 'java', 'postgresql', 'spring boot')
WHERE j.title = 'Java Spring Boot Backend Intern';

INSERT INTO users (email, password_hash, full_name, role, status) VALUES
    ('candidate-ranking-e2e-student-one@example.test', 'unused', 'E2E Candidate One', 'STUDENT', 'ACTIVE'),
    ('candidate-ranking-e2e-student-two@example.test', 'unused', 'E2E Candidate Two', 'STUDENT', 'ACTIVE'),
    ('candidate-ranking-e2e-student-three@example.test', 'unused', 'E2E Candidate Three', 'STUDENT', 'ACTIVE');

INSERT INTO students (user_id, student_code)
SELECT id, 'E2E-' || id FROM users
WHERE email LIKE 'candidate-ranking-e2e-student-%@example.test';

INSERT INTO cv_files (
    student_id, file_name, original_file_name, stored_file_name, file_url, file_path,
    content_type, file_size, extracted_text, processed_text, extracted_skills,
    is_active, analysis_status, language_code, language_confidence,
    processing_version, analyzed_at
)
SELECT s.id, values_row.file_name, values_row.file_name, values_row.file_name,
       'e2e/' || values_row.file_name, 'e2e/' || values_row.file_name,
       'application/pdf', 128, values_row.cv_text, values_row.cv_text,
       values_row.skills::jsonb, TRUE, 'READY', values_row.language_code,
       values_row.language_confidence, 'bilingual-nlp-v2-skills-v1', CURRENT_TIMESTAMP
FROM (
    VALUES
        ('candidate-ranking-e2e-student-one@example.test', 'candidate-one.pdf',
         'Java Spring Boot backend developer building REST APIs with PostgreSQL and Docker.',
         '["docker", "java", "postgresql", "spring boot"]', 'en', 0.99),
        ('candidate-ranking-e2e-student-two@example.test', 'candidate-two.pdf',
         'Lap trinh vien Java Spring Boot xay dung REST API va co so du lieu PostgreSQL.',
         '["docker", "java", "postgresql", "spring boot"]', 'vi', 0.99),
        ('candidate-ranking-e2e-student-three@example.test', 'candidate-three.pdf',
         'Junior Java developer familiar with Docker, Git, and backend development.',
         '["docker", "java"]', 'en', 0.99)
) AS values_row(email, file_name, cv_text, skills, language_code, language_confidence)
JOIN users u ON u.email = values_row.email
JOIN students s ON s.user_id = u.id;

INSERT INTO applications (student_id, job_id, cv_file_id, status)
SELECT s.id, j.id, cv.id, 'PENDING'
FROM students s
JOIN cv_files cv ON cv.student_id = s.id
CROSS JOIN (SELECT id FROM jobs WHERE title = 'Java Spring Boot Backend Intern') j
JOIN users u ON u.id = s.user_id
WHERE u.email LIKE 'candidate-ranking-e2e-student-%@example.test';
'@
    $seedSql | & docker compose @ComposeArgs exec -T postgres psql -X -q -U postgres -d $DatabaseName -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) {
        throw 'The isolated E2E fixture could not be seeded.'
    }

    $jobId = Invoke-DatabaseScalar "SELECT id FROM jobs WHERE title = 'Java Spring Boot Backend Intern';"
    Assert-Condition ($null -ne $jobId) 'Fixture job must exist.'
    $expectedApplicationIds = @(Invoke-DatabaseQuery "SELECT id FROM applications WHERE job_id = $jobId ORDER BY id;")
    Assert-Condition ($expectedApplicationIds.Count -eq 3) 'Fixture must contain exactly three eligible applications.'

    $headers = @{ Authorization = "Bearer $token" }
    $create = Invoke-JsonApi -Method POST -Path "/api/companies/me/jobs/$jobId/candidate-ranking-runs" `
        -Headers $headers -Body @{ threshold = 0; primaryLimit = 2; fallbackLimit = 1 }
    Assert-Condition $create.Body.success 'Candidate Ranking POST must succeed.'
    $run = $create.Body.data
    $runId = [string]$run.id
    Assert-Condition ($run.status -eq 'SUCCESS') 'Run must finish synchronously as SUCCESS.'
    Assert-Condition ($run.algorithm -eq 'tfidf-cosine-hybrid') 'Run algorithm must match the locked contract.'
    Assert-Condition ($run.algorithmVersion -eq 'bilingual-candidate-ranking-v3') 'Run algorithm version must match the locked contract.'
    Assert-Condition ([decimal]$run.threshold -eq [decimal]0) 'Run threshold must be preserved.'
    Assert-Condition ($null -eq $run.requestedLimit) 'V3 run requestedLimit must be null.'
    Assert-Condition ($run.requestedPrimaryLimit -eq 2 -and $run.requestedFallbackLimit -eq 1) 'V3 tier limits must be preserved.'
    Assert-Condition ($null -ne $run.startedAt -and $null -ne $run.finishedAt) 'Run timestamps must be populated.'
    Assert-Condition ([datetime]$run.finishedAt -ge [datetime]$run.startedAt) 'Run timestamps must be ordered.'
    Assert-Condition ([string]::IsNullOrWhiteSpace([string]$run.errorMessage)) 'Successful run must have no failure message.'
    Assert-Condition ($run.totalApplicationsScanned -eq 3 -and $run.eligibleCandidates -eq 3) 'Run corpus counters must include all three candidates.'
    Assert-Condition ($run.skippedNoCv -eq 0 -and $run.skippedNotReady -eq 0 -and $run.skippedTerminalStatus -eq 0) 'Fixture must have no skipped candidate.'
    Assert-Condition ($run.totalRanked -eq 3 -and @($run.results).Count -eq 3) 'No eligible candidate may be truncated.'

    $list = Invoke-JsonApi -Method GET -Path "/api/companies/me/jobs/$jobId/candidate-ranking-runs?page=1&size=20" -Headers $headers
    Assert-Condition $list.Body.success 'Candidate Ranking history GET must succeed.'
    Assert-Condition (@($list.Body.data.items | Where-Object { [string]$_.id -eq $runId }).Count -eq 1) 'History must contain the created run once.'

    $detail = Invoke-JsonApi -Method GET -Path "/api/companies/me/jobs/$jobId/candidate-ranking-runs/$runId" -Headers $headers
    Assert-Condition $detail.Body.success 'Candidate Ranking detail GET must succeed.'
    Assert-Condition ($detail.Body.data.status -eq 'SUCCESS' -and @($detail.Body.data.results).Count -eq 3) 'Stored detail must return all results.'

    $jobSkills = @('docker', 'java', 'postgresql', 'spring boot')
    $results = @($detail.Body.data.results)
    $actualApplicationIds = @($results | ForEach-Object { [string]$_.applicationId } | Sort-Object)
    Assert-Condition (($actualApplicationIds -join '|') -eq (($expectedApplicationIds | Sort-Object) -join '|')) 'All result applications must be eligible corpus applications.'
    $primaryCount = 0; $fallbackCount = 0; $seenFallback = $false
    $primaryTierRank = 0; $fallbackTierRank = 0
    for ($index = 0; $index -lt $results.Count; $index++) {
        $result = $results[$index]
        Assert-Condition ($result.rankPosition -eq ($index + 1)) 'Backend rank positions must be contiguous from one.'
        Assert-Score $result.rankingScore "result[$index].rankingScore"
        Assert-Condition ([decimal]$result.score -eq [decimal]$result.rankingScore) 'Legacy score must alias rankingScore.'
        Assert-Score $result.skillScore "result[$index].skillScore"
        $applicationId = [long]$result.applicationId

        $storedCvId = Invoke-DatabaseScalar "SELECT cv_file_id FROM applications WHERE id = $applicationId;"
        Assert-Condition ([string]$result.cvFileId -eq $storedCvId) 'Each result must preserve its submitted CV id.'
        $candidateSkillCsv = Invoke-DatabaseScalar "SELECT array_to_string(ARRAY(SELECT jsonb_array_elements_text(extracted_skills)), ',') FROM cv_files WHERE id = $storedCvId;"
        $candidateSkills = @($candidateSkillCsv -split ',' | ForEach-Object { [string]$_ })
        $expectedMatched = @($jobSkills | Where-Object { $candidateSkills -contains $_ })
        $expectedMissing = @($jobSkills | Where-Object { $candidateSkills -notcontains $_ })
        $actualMatched = @($result.matchedSkills | ForEach-Object { [string]$_ })
        $actualMissing = @($result.missingSkills | ForEach-Object { [string]$_ })
        Assert-SortedSkills $actualMatched "result[$index].matchedSkills"
        Assert-SortedSkills $actualMissing "result[$index].missingSkills"
        Assert-Condition (($actualMatched -join '|') -eq ($expectedMatched -join '|')) 'Matched skills must be complete.'
        Assert-Condition (($actualMissing -join '|') -eq ($expectedMissing -join '|')) 'Missing skills must be complete.'
        Assert-Condition (-not [string]::IsNullOrWhiteSpace([string]$result.reason)) 'Backend-generated reason must be nonblank.'

        if ($result.rankingTier -eq 'PRIMARY') {
            Assert-Condition (-not $seenFallback) 'All PRIMARY results must precede FALLBACK results.'
            Assert-Condition ($result.scoringStrategy -eq 'SAME_LANGUAGE_HYBRID') 'PRIMARY must use SAME_LANGUAGE_HYBRID.'
            Assert-Score $result.textScore "result[$index].textScore"
            Assert-Score $result.overallScore "result[$index].overallScore"
            Assert-Condition ([decimal]$result.rankingScore -eq [decimal]$result.overallScore) 'PRIMARY rankingScore must equal overallScore.'
            $primaryTierRank++; Assert-Condition ($result.tierRankPosition -eq $primaryTierRank) 'PRIMARY tier ranks must be contiguous.'
            $primaryCount++
        } elseif ($result.rankingTier -eq 'FALLBACK') {
            $seenFallback = $true
            Assert-Condition ($result.scoringStrategy -eq 'CROSS_LANGUAGE_SKILL_BASED') 'FALLBACK must use CROSS_LANGUAGE_SKILL_BASED.'
            Assert-Condition ($null -eq $result.textScore) 'Cross-language textScore must be null.'
            Assert-Condition ($null -eq $result.overallScore) 'FALLBACK overallScore must be null.'
            Assert-Condition ([decimal]$result.rankingScore -eq [decimal]$result.skillScore) 'FALLBACK rankingScore must equal skillScore.'
            $fallbackTierRank++; Assert-Condition ($result.tierRankPosition -eq $fallbackTierRank) 'FALLBACK tier ranks must reset and be contiguous.'
            $fallbackCount++
        } else {
            throw "Unexpected ranking tier: $($result.rankingTier)"
        }
    }
    Assert-Condition ($primaryCount -eq 2 -and $fallbackCount -eq 1) 'Fixture must prove independent primary/fallback limits.'
    $fallback = @($results | Where-Object { $_.rankingTier -eq 'FALLBACK' })[0]
    Assert-Condition ([decimal]$fallback.rankingScore -eq 1 -and [decimal]$fallback.skillScore -eq 1) 'Cross-language fixture must be a 100% skill match.'
    Assert-Condition ([int]$fallback.rankPosition -gt $primaryCount) 'FALLBACK 1.0 must persist after all PRIMARY results.'

    $persisted = Invoke-DatabaseScalar @"
SELECT r.status || '|' || r.algorithm || '|' || r.algorithm_version || '|' ||
       COUNT(cr.id) || '|' || COUNT(DISTINCT cr.application_id) || '|' ||
       COUNT(DISTINCT cr.rank_position)
FROM candidate_ranking_runs r
LEFT JOIN candidate_ranking_results cr ON cr.run_id = r.id
WHERE r.id = $runId
GROUP BY r.id, r.status, r.algorithm, r.algorithm_version;
"@
    $persistedParts = @($persisted -split '\|')
    Assert-Condition ($persistedParts.Count -eq 6) 'Persisted run summary must contain exactly six fields.'
    Assert-Condition ($persistedParts[0] -eq 'SUCCESS') 'Persisted run status must be SUCCESS.'
    Assert-Condition ($persistedParts[1] -eq 'tfidf-cosine-hybrid') 'Persisted run algorithm must match the locked contract.'
    Assert-Condition ($persistedParts[2] -eq 'bilingual-candidate-ranking-v3') 'Persisted run algorithm version must match the locked contract.'
    Assert-Condition ($persistedParts[3] -eq '3' -and $persistedParts[4] -eq '3' -and $persistedParts[5] -eq '3') 'Persisted result set must have no partial duplicates.'
    Assert-Condition ((Invoke-DatabaseScalar "SELECT COUNT(*) FROM candidate_ranking_runs WHERE job_id = $jobId AND status = 'PROCESSING';") -eq '0') 'No PROCESSING run may remain.'
    $runLimits = Invoke-DatabaseScalar "SELECT COALESCE(requested_limit::text, 'NULL') || '|' || requested_primary_limit || '|' || requested_fallback_limit FROM candidate_ranking_runs WHERE id = $runId;"
    Assert-Condition ($runLimits -eq 'NULL|2|1') 'Persisted V3 run must retain null legacy and independent tier limits.'
    $fallbackDb = Invoke-DatabaseScalar "SELECT ranking_tier || '|' || score || '|' || skill_score || '|' || COALESCE(overall_score::text, 'NULL') || '|' || COALESCE(text_score::text, 'NULL') || '|' || rank_position || '|' || tier_rank_position || '|' || COALESCE(cv_processing_version, 'NULL') || '|' || (cv_analyzed_at_snapshot IS NOT NULL) FROM candidate_ranking_results WHERE run_id = $runId AND ranking_tier = 'FALLBACK';"
    Assert-Condition ($fallbackDb -match '^FALLBACK\|1\.00000\|1\.00000\|NULL\|NULL\|3\|1\|bilingual-nlp-v2-skills-v1\|true$') 'Persisted FALLBACK row must retain V3 nullable score semantics and CV audit fields.'

    $aiV3LogMatches = @((& docker compose @ComposeArgs logs ai-service 2>&1 | Select-String -SimpleMatch 'POST /internal/v3/candidate-rankings HTTP/1.1" 200'))
    $aiV2LogMatches = @((& docker compose @ComposeArgs logs ai-service 2>&1 | Select-String -SimpleMatch 'POST /internal/v2/candidate-rankings HTTP/1.1"'))
    Assert-Condition ($aiV3LogMatches.Count -eq 1) 'Exactly one real V3 AI bulk HTTP request must be logged.'
    Assert-Condition ($aiV2LogMatches.Count -eq 0) 'V3 public flow must not call the V2 candidate-ranking endpoint.'

    Write-Host 'Real Candidate Ranking E2E passed.'
    Write-Host "Public API status: register=201 login=200 create=200 list=200 detail=200; runId=$runId"
    Write-Host 'Counters: scanned=3 eligible=3 primary=2 fallback=1; V3 tier limits=2/1; AI HTTP POST /internal/v3/candidate-rankings=200 (once), V2=0.'
} catch {
    Write-Error $_
    if ($started) {
        & docker compose @ComposeArgs ps
    }
    exit 1
} finally {
    if ($KeepE2EStack) {
        Write-Host "Keeping isolated E2E stack '$ProjectName' for debugging."
    } else {
        & docker compose @ComposeArgs down --volumes --remove-orphans
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Cleaned isolated E2E project '$ProjectName'."
        } else {
            Write-Warning "Could not completely clean isolated E2E project '$ProjectName'."
        }
    }
}
