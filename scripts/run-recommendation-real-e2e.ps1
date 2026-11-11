[CmdletBinding()]
param([switch]$KeepE2EStack)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$RepositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$ProjectName = 'core-smoke-' + [Guid]::NewGuid().ToString('N')
$RunDirectory = Join-Path $RepositoryRoot ('e2e/.local/' + $ProjectName)
$DatabaseName = 'student_job_recommendation'
$started = $false
$failure = $null
$cleanupFailed = $false
$RegistrationCompanyStatus = $null
$EnvironmentBefore = @{}
$OutputEncodingBefore = $OutputEncoding
$OutputEncoding = [Text.UTF8Encoding]::new($false)
New-Item -ItemType Directory -Path $RunDirectory -Force | Out-Null
$secrets = @{
    COMPOSE_PROJECT_NAME = $ProjectName
    POSTGRES_DB = $DatabaseName
    POSTGRES_USER = 'postgres'
    POSTGRES_PASSWORD = [Guid]::NewGuid().ToString('N')
    AI_INTERNAL_API_KEY = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
    APP_JWT_SECRET = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
}
foreach ($name in $secrets.Keys) {
    $EnvironmentBefore[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    [Environment]::SetEnvironmentVariable($name, $secrets[$name], 'Process')
}
$envFile = Join-Path $RunDirectory 'stack.env'
[IO.File]::WriteAllLines($envFile, @($secrets.Keys | Sort-Object | ForEach-Object { "$_=$($secrets[$_])" }), [Text.UTF8Encoding]::new($false))
$override = Join-Path $RunDirectory 'isolated.yml'
# Override fixed ports and shared image tags; only this invocation owns these resources.
[IO.File]::WriteAllText($override, @"
services:
  postgres:
    ports: !override []
  ai-service:
    image: ${ProjectName}-ai:local
    ports: !override
      - "127.0.0.1::8000"
  backend:
    image: ${ProjectName}-backend:local
    environment:
      SPRING_JPA_HIBERNATE_DDL_AUTO: validate
      SPRING_SQL_INIT_MODE: never
    ports: !override
      - "127.0.0.1::8080"
volumes:
  candidate_ranking_e2e_postgres:
    name: ${ProjectName}_postgres
  candidate_ranking_e2e_cvs:
    name: ${ProjectName}_cvs
"@, [Text.UTF8Encoding]::new($false))
$ComposeArgs = @('--env-file', $envFile, '-p', $ProjectName, '-f', (Join-Path $RepositoryRoot 'docker-compose.yml'), '-f', (Join-Path $RepositoryRoot 'docker-compose.e2e.yml'), '-f', $override)
$BackendUrl = ''
$AiUrl = ''
$protocol = [Collections.Generic.List[object]]::new()
Push-Location $RepositoryRoot

function Invoke-Compose { param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Arguments) & docker compose @ComposeArgs @Arguments; if ($LASTEXITCODE -ne 0) { throw "Compose failed: $($Arguments -join ' ')" } }
function Assert-Condition { param([bool]$Condition,[string]$Message) if (-not $Condition) { throw "Assertion failed: $Message" } }
function Invoke-DatabaseScalar { param([string]$Sql) $value = @($Sql | & docker compose @ComposeArgs exec -T postgres psql -X -q -t -A -U postgres -d $DatabaseName -v ON_ERROR_STOP=1 | Where-Object { $_ -and $_.Trim() }) ; if ($LASTEXITCODE -ne 0 -or $value.Count -ne 1) { throw 'Expected exactly one isolated database value.' }; return $value[0].Trim() }
function Invoke-Api {
    param([ValidateSet('GET','POST','PATCH')][string]$Method,[string]$Path,[object]$Body,[hashtable]$Headers)
    $p = @{ Uri = "$BackendUrl$Path"; Method = $Method; UseBasicParsing = $true; ErrorAction = 'Stop' }
    if ($Headers) { $p.Headers = $Headers }
    if ($null -ne $Body) { $p.ContentType = 'application/json; charset=utf-8'; $p.Body = [Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Compress -Depth 8)) }
    try { $response = Invoke-WebRequest @p }
    catch {
        $status = if ($_.Exception.PSObject.Properties['Response'] -and $_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'transport-failed' }
        $protocol.Add(@{ method = $Method; path = $Path; status = $status })
        throw "Public API $Method $Path failed (HTTP $status); request/response bodies suppressed."
    }
    $protocol.Add(@{ method = $Method; path = $Path; status = [int]$response.StatusCode })
    Assert-Condition ($response.StatusCode -eq 200 -or $response.StatusCode -eq 201) "$Method $Path returned HTTP $($response.StatusCode)."
    return $response.Content | ConvertFrom-Json
}
function Assert-Forbidden {
    param([string]$Path,[object]$Body,[hashtable]$Headers)
    $forbidden = $false
    try { $null = Invoke-Api PATCH $Path $Body $Headers }
    catch { if ($_.Exception.Message -match 'HTTP 403') { $forbidden = $true } else { throw } }
    Assert-Condition $forbidden "Company must not perform forbidden mutation $Path."
}
function Get-AiCounts {
    $logs = @(& docker compose @ComposeArgs logs --no-color ai-service 2>&1)
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect isolated AI request counts.' }
    return @{ v3 = @($logs | Select-String -SimpleMatch 'POST /internal/v3/recommendations HTTP/1.1"').Count; v3Success = @($logs | Select-String -SimpleMatch 'POST /internal/v3/recommendations HTTP/1.1" 200').Count; v2 = @($logs | Select-String -SimpleMatch 'POST /internal/v2/recommendations HTTP/1.1"').Count }
}
function Write-FixtureDiagnostics {
    param([object]$Run)
    $fixture = Invoke-DatabaseScalar "SELECT json_build_object('companyStatus',c.status,'companyId',c.id,'jobs',(SELECT coalesce(json_agg(json_build_object('id',j.id,'companyId',j.company_id,'status',j.status,'deadline',j.deadline) ORDER BY j.id),'[]'::json) FROM jobs j WHERE j.company_id=c.id),'eligibleJobs',(SELECT count(*) FROM jobs j JOIN companies co ON co.id=j.company_id WHERE j.status='ACTIVE' AND co.status='VERIFIED' AND (j.deadline IS NULL OR j.deadline>=CURRENT_DATE)))::text FROM companies c JOIN users u ON u.id=c.user_id WHERE u.email='recommendation-e2e-company@example.test';" | ConvertFrom-Json
    $results = @($Run.results)
    $diagnostic = @{ companyStatusAfterRegistration = $RegistrationCompanyStatus; fixture = $fixture; runStatus = $Run.status; resultCount = $results.Count; primaryCount = @($results | Where-Object rankingTier -eq 'PRIMARY').Count; fallbackCount = @($results | Where-Object rankingTier -eq 'FALLBACK').Count; ai = (Get-AiCounts); protocol = @($protocol.ToArray()) }
    $diagnostic.postgresMajor = [int](Invoke-DatabaseScalar "SELECT current_setting('server_version_num')::int/10000;")
    $diagnostic.migrationVersions = (Invoke-DatabaseScalar "SELECT string_agg(version,',' ORDER BY installed_rank) FROM flyway_schema_history WHERE success AND version IS NOT NULL;")
    $diagnostic.processingRuns = [int](Invoke-DatabaseScalar "SELECT COUNT(*) FROM recommendation_runs WHERE status='PROCESSING';")
    $diagnostic.persistedResults = (Invoke-DatabaseScalar "SELECT coalesce(json_agg(json_build_object('jobId',job_id,'rankingTier',ranking_tier,'scoringStrategy',scoring_strategy,'rankingScore',score,'overallScore',overall_score,'textScore',text_score,'skillScore',skill_score,'rankPosition',rank_position,'tierRankPosition',tier_rank_position) ORDER BY rank_position),'[]'::json)::text FROM recommendation_results WHERE run_id=$([long]$Run.id);" | ConvertFrom-Json)
    $diagnostic | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $RunDirectory 'diagnostics.json') -Encoding UTF8
    Write-Host ('Sanitized fixture diagnostics: ' + ($diagnostic | ConvertTo-Json -Depth 8 -Compress))
}
function Assert-Score { param([object]$Value,[string]$Label) Assert-Condition ($null -ne $Value) "$Label must be present."; $n=[decimal]$Value;Assert-Condition ($n -ge 0 -and $n -le 1) "$Label must be in [0,1]." }

try {
    & docker version *> $null; if ($LASTEXITCODE -ne 0) { throw 'Docker is unavailable.' }
    $existing = @(& docker ps -a -q --filter "label=com.docker.compose.project=$ProjectName")
    Assert-Condition ($existing.Count -eq 0) 'Generated project must not already exist.'
    Invoke-Compose config --quiet
    $started = $true # Also clean a partially failed startup; never down an unowned project.
    Invoke-Compose up -d --build --wait --wait-timeout 180
    $backendBinding = (& docker compose @ComposeArgs port backend 8080).Trim()
    $aiBinding = (& docker compose @ComposeArgs port ai-service 8000).Trim()
    Assert-Condition ($backendBinding -match '^127\.0\.0\.1:\d+$' -and $aiBinding -match '^127\.0\.0\.1:\d+$') 'Owned services must bind random loopback ports.'
    $BackendUrl = "http://$backendBinding"; $AiUrl = "http://$aiBinding"
    Assert-Condition ((Invoke-DatabaseScalar 'SELECT COUNT(*) FROM users;') -eq '0') 'Isolated database must start empty without dev seeders.'
    Assert-Condition ((Invoke-WebRequest -Uri "$AiUrl/health" -UseBasicParsing).StatusCode -eq 200) 'AI health must be 200.'

    $studentEmail='recommendation-e2e-student@example.test'; $companyEmail='recommendation-e2e-company@example.test'; $password=[Guid]::NewGuid().ToString('N') + 'Aa9!'
    $studentRegister=Invoke-Api POST '/api/auth/register' @{email=$studentEmail;password=$password;role='STUDENT';fullName='Recommendation E2E Student'}
    $companyRegister=Invoke-Api POST '/api/auth/register' @{email=$companyEmail;password=$password;role='COMPANY';fullName='Recommendation E2E Company';companyName='Recommendation E2E Company'}
    Assert-Condition ($studentRegister.success -and $companyRegister.success) 'Public registrations must succeed.'
    $studentLogin=Invoke-Api POST '/api/auth/login' @{email=$studentEmail;password=$password}
    Assert-Condition $studentLogin.success 'Student login must succeed.'; $headers=@{Authorization="Bearer $($studentLogin.data.token)"}

    $seed=@'
INSERT INTO skills (name, normalized_name, category) VALUES
 ('Java','java','Backend'),('Spring Boot','spring boot','Backend'),('PostgreSQL','postgresql','Database'),('Docker','docker','DevOps');
INSERT INTO cv_files (student_id,file_name,original_file_name,stored_file_name,file_url,file_path,content_type,file_size,extracted_text,processed_text,extracted_skills,is_active,analysis_status,language_code,language_confidence,processing_version,analyzed_at)
SELECT s.id,'student.pdf','student.pdf','student.pdf','e2e/student.pdf','e2e/student.pdf','application/pdf',128,'ignored','Java Spring Boot developer builds REST APIs with PostgreSQL and Docker.','["docker","java","postgresql","spring boot"]',TRUE,'READY','en',0.99,'bilingual-nlp-v2-skills-v1',CURRENT_TIMESTAMP FROM students s JOIN users u ON u.id=s.user_id WHERE u.email='recommendation-e2e-student@example.test';
-- There is no public Admin registration. Bootstrap one NEW test-only identity
-- in this fresh owned DB, reusing only the random fixture password's BCrypt hash.
INSERT INTO users (email,password_hash,full_name,role,status)
SELECT 'recommendation-e2e-admin@example.test',password_hash,'Isolated Smoke Admin','ADMIN','ACTIVE'
FROM users WHERE email='recommendation-e2e-student@example.test';
'@
    $seed | & docker compose @ComposeArgs exec -T postgres psql -X -q -U postgres -d $DatabaseName -v ON_ERROR_STOP=1; if($LASTEXITCODE -ne 0){throw 'Could not seed isolated Student fixture.'}
    $cvId=Invoke-DatabaseScalar "SELECT cv.id FROM cv_files cv JOIN students s ON s.id=cv.student_id JOIN users u ON u.id=s.user_id WHERE u.email='$studentEmail';"
    $companyLogin = Invoke-Api POST '/api/auth/login' @{ email = $companyEmail; password = $password }
    Assert-Condition $companyLogin.success 'Company login must succeed.'
    $companyHeaders = @{ Authorization = "Bearer $($companyLogin.data.token)" }
    $company = Invoke-Api GET '/api/companies/me' $null $companyHeaders
    $companyId = [long]$company.data.id
    $RegistrationCompanyStatus = $company.data.status
    Assert-Condition ($RegistrationCompanyStatus -eq 'PENDING') 'Company registration must remain PENDING.'
    $adminLogin = Invoke-Api POST '/api/auth/login' @{ email = 'recommendation-e2e-admin@example.test'; password = $password }
    Assert-Condition ($adminLogin.success -and $adminLogin.data.user.role -eq 'ADMIN') 'Isolated Admin login must have ADMIN role.'
    $adminHeaders = @{ Authorization = "Bearer $($adminLogin.data.token)" }
    $skills = (Invoke-DatabaseScalar "SELECT json_agg(json_build_object('skillId',id,'importance','REQUIRED','minLevel','BEGINNER') ORDER BY id)::text FROM skills;" | ConvertFrom-Json)
    # Windows PowerShell 5 decorates ConvertFrom-Json arrays with ETS Count/value.
    # Rebuild exact request DTO records so ConvertTo-Json emits a JSON array, never that wrapper.
    $skills = @($skills | ForEach-Object { @{ skillId = [long]$_.skillId; importance = 'REQUIRED'; minLevel = 'BEGINNER' } })
    Assert-Condition ($skills.Count -eq 4) 'Fixture must declare exactly four canonical Job skills.'
    $jobBodies = @(
        @{ title = 'English Backend Role'; description = 'Build reliable backend systems with Java and Spring Boot.'; requirements = 'Java Spring Boot PostgreSQL Docker.'; benefits = 'Mentoring' },
        @{ title = 'Vietnamese Backend Role'; description = 'Xây dựng hệ thống backend bằng Java Spring Boot và PostgreSQL.'; requirements = 'Yêu cầu Java, Spring Boot, PostgreSQL và Docker.'; benefits = 'Hướng dẫn' }
    )
    $fixtureJobs = @()
    foreach ($body in $jobBodies) {
        $body.location = 'HCM'; $body.jobType = 'INTERNSHIP'; $body.workingModel = 'HYBRID'; $body.status = 'DRAFT'
        $body.deadline = (Get-Date).AddDays(30).ToString('yyyy-MM-dd'); $body.skills = $skills
        $draft = Invoke-Api POST '/api/jobs' $body $companyHeaders
        Assert-Condition ($draft.success -and $draft.data.status -eq 'DRAFT' -and [long]$draft.data.companyId -eq $companyId) 'Company must create only its own DRAFT Job.'
        $fixtureJobs += $draft.data
    }
    Assert-Forbidden "/api/admin/companies/$companyId/status" @{ status = 'VERIFIED' } $companyHeaders
    Assert-Forbidden "/api/jobs/$($fixtureJobs[0].id)/status" @{ status = 'PENDING_APPROVAL' } $companyHeaders
    $verified = Invoke-Api PATCH "/api/admin/companies/$companyId/status" @{ status = 'VERIFIED' } $adminHeaders
    Assert-Condition ($verified.success -and $verified.data.status -eq 'VERIFIED') 'Only the legitimate Admin API must verify the fixture Company.'
    Assert-Forbidden "/api/jobs/$($fixtureJobs[0].id)/status" @{ status = 'ACTIVE' } $companyHeaders
    foreach ($job in $fixtureJobs) {
        $submitted = Invoke-Api PATCH "/api/jobs/$($job.id)/status" @{ status = 'PENDING_APPROVAL' } $companyHeaders
        Assert-Condition ($submitted.data.status -eq 'PENDING_APPROVAL') 'Verified Company must submit for review.'
        $approved = Invoke-Api PATCH "/api/jobs/$($job.id)/status" @{ status = 'ACTIVE' } $adminHeaders
        Assert-Condition ($approved.data.status -eq 'ACTIVE') 'Admin must approve each submitted Job.'
        $public = Invoke-Api GET "/api/public/jobs/$($job.id)" $null $null
        Assert-Condition ([long]$public.data.id -eq [long]$job.id) 'Each independently identified fixture Job must be publicly eligible.'
    }
    $primaryJobId = [long]$fixtureJobs[0].id; $fallbackJobId = [long]$fixtureJobs[1].id
    Assert-Condition ((Invoke-DatabaseScalar "SELECT COUNT(*) FROM jobs j JOIN companies c ON c.id=j.company_id WHERE j.status='ACTIVE' AND c.status='VERIFIED' AND (j.deadline IS NULL OR j.deadline>=CURRENT_DATE);") -eq '2') 'Exactly two real Jobs must enter the V3 eligible corpus.'
    Assert-Condition ((Invoke-DatabaseScalar "SELECT current_setting('server_version_num')::int/10000;") -eq '17') 'Smoke must use PostgreSQL 17.'
    Assert-Condition ((Invoke-DatabaseScalar "SELECT string_agg(version,',' ORDER BY installed_rank) FROM flyway_schema_history WHERE success AND version IS NOT NULL;") -eq ((1..25) -join ',')) 'Exactly Flyway V1-V25 must be applied.'
    Assert-Condition ((Invoke-DatabaseScalar "SELECT COUNT(*) FROM flyway_schema_history WHERE NOT success OR (version IS NOT NULL AND checksum IS NULL);") -eq '0') 'All applied migrations must have successful checksums.'
    $created=Invoke-Api POST '/api/students/me/recommendations/generate' @{cvId=[long]$cvId;threshold=0;limit=10} $headers; Assert-Condition $created.success 'Public Student generation must succeed.'
    $run=$created.data; Assert-Condition ($run.status -eq 'SUCCESS' -and $run.algorithm -eq 'tfidf-cosine-hybrid' -and $run.algorithmVersion -eq 'bilingual-recommendation-v3') 'Student V3 run metadata is invalid.'
    Write-FixtureDiagnostics $run
    $results=@($run.results);Assert-Condition ($results.Count -eq 2) 'Fixture must return one PRIMARY and one FALLBACK.'
    Assert-Condition (@($results | Where-Object rankingTier -eq 'PRIMARY').Count -eq 1 -and @($results | Where-Object rankingTier -eq 'FALLBACK').Count -eq 1) 'Exactly one result per V3 tier is required.'
    Assert-Condition ([int]$run.totalJobsScanned -eq 2) 'Backend must scan the two eligible fixture Jobs.'
    $primary=@($results|Where-Object{$_.rankingTier -eq 'PRIMARY'})[0];$fallback=@($results|Where-Object{$_.rankingTier -eq 'FALLBACK'})[0]
    Assert-Condition ($null -ne $primary -and $null -ne $fallback) 'Both V3 tiers must be present.'
    Assert-Condition ([long]$primary.jobId -eq [long]$primaryJobId -and [long]$fallback.jobId -eq [long]$fallbackJobId) 'Fixture jobs must route to expected tiers.'
    Assert-Condition ([int]$primary.rankPosition -eq 1 -and [int]$primary.tierRankPosition -eq 1 -and [int]$fallback.rankPosition -eq 2 -and [int]$fallback.tierRankPosition -eq 1) 'Global and tier ranks must be authoritative.'
    foreach($r in $results){Assert-Score $r.rankingScore 'rankingScore';Assert-Condition ([decimal]$r.score -eq [decimal]$r.rankingScore) 'score must alias rankingScore.';Assert-Condition ($null -ne $r.rankingTier -and $null -ne $r.tierRankPosition) 'V3 public fields must be present.'}
    Assert-Condition ($primary.scoringStrategy -eq 'SAME_LANGUAGE_HYBRID' -and $null -ne $primary.textScore -and $null -ne $primary.overallScore -and [decimal]$primary.rankingScore -eq [decimal]$primary.overallScore) 'PRIMARY semantics are invalid.'
    Assert-Condition ($fallback.scoringStrategy -eq 'CROSS_LANGUAGE_SKILL_BASED' -and $null -eq $fallback.textScore -and $null -eq $fallback.overallScore -and [decimal]$fallback.rankingScore -eq 1 -and [decimal]$fallback.skillScore -eq 1) 'FALLBACK 100% Skill Match semantics are invalid.'
    Assert-Condition ([decimal]$primary.rankingScore -lt 1 -and [int]$primary.rankPosition -lt [int]$fallback.rankPosition) 'PRIMARY must precede FALLBACK 1.0 cross-tier.'
    Assert-Condition ((@($fallback.matchedKeywords) -join '|') -eq 'docker|java|postgresql|spring boot' -and @($fallback.missingSkills).Count -eq 0) 'FALLBACK canonical skill evidence is invalid.'
    # Public and SQL scores are NUMERIC(8,5); allow only its maximum rounding discrepancy.
    $weighted = [decimal]'0.65' * [decimal]$primary.textScore + [decimal]'0.35' * [decimal]$primary.skillScore
    Assert-Condition ([Math]::Abs([decimal]$primary.overallScore - $weighted) -le [decimal]'0.00001') 'PRIMARY must preserve 0.65 text / 0.35 skill weighting at persisted precision.'
    $runId=[long]$run.id
    $db=Invoke-DatabaseScalar "SELECT ranking_tier || '|' || score || '|' || skill_score || '|' || COALESCE(overall_score::text,'NULL') || '|' || COALESCE(text_score::text,'NULL') || '|' || rank_position || '|' || tier_rank_position FROM recommendation_results WHERE run_id=$runId AND ranking_tier='FALLBACK';"
    Assert-Condition ($db -match '^FALLBACK\|1\.00000\|1\.00000\|NULL\|NULL\|2\|1$') 'Persisted Student FALLBACK V3 state is invalid.'
    Assert-Condition ((Invoke-DatabaseScalar "SELECT COUNT(*) FROM recommendation_runs WHERE id=$runId AND status='PROCESSING';") -eq '0') 'No Student PROCESSING run may remain.'
    $persisted = (Invoke-DatabaseScalar "SELECT json_agg(json_build_object('jobId',job_id,'rankingTier',ranking_tier,'scoringStrategy',scoring_strategy,'rankingScore',score,'overallScore',overall_score,'textScore',text_score,'skillScore',skill_score,'rankPosition',rank_position,'tierRankPosition',tier_rank_position) ORDER BY rank_position)::text FROM recommendation_results WHERE run_id=$runId;" | ConvertFrom-Json)
    Assert-Condition ($persisted.Count -eq 2) 'Exactly two recommendation rows must persist.'
    for ($i = 0; $i -lt 2; $i++) {
        foreach ($field in @('jobId','rankingTier','scoringStrategy','rankingScore','overallScore','textScore','skillScore','rankPosition','tierRankPosition')) {
            Assert-Condition ($persisted[$i].$field -eq $results[$i].$field) "Persisted $field must match the authoritative public response."
        }
    }
    $readBack = Invoke-Api GET "/api/students/me/recommendation-runs/$runId" $null $headers
    Assert-Condition ($readBack.success -and @($readBack.data.results).Count -eq 2 -and $readBack.data.status -eq 'SUCCESS') 'Persisted public read-back must confirm SUCCESS and both rows.'
    Assert-Condition ((Invoke-DatabaseScalar "SELECT COUNT(*) FROM recommendation_runs;") -eq '1' -and (Invoke-DatabaseScalar "SELECT COUNT(*) FROM recommendation_runs WHERE status='PROCESSING';") -eq '0') 'Only one completed generation and no stuck PROCESSING run are allowed.'
    $counts = Get-AiCounts
    Assert-Condition ($counts.v3 -eq 1 -and $counts.v3Success -eq 1 -and $counts.v2 -eq 0) 'Exactly one actual internal V3 request (200) and no V2 substitution are required.'
    $v3=@((& docker compose @ComposeArgs logs ai-service 2>&1|Select-String -SimpleMatch 'POST /internal/v3/recommendations HTTP/1.1" 200'));$v2=@((& docker compose @ComposeArgs logs ai-service 2>&1|Select-String -SimpleMatch 'POST /internal/v2/recommendations HTTP/1.1"'))
    Assert-Condition ($v3.Count -eq 1 -and $v2.Count -eq 0) 'Exactly one V3 Student AI request and no V2 recommendation call are required.'
    Write-Host 'Real Student Recommendation V3 E2E passed.';Write-Host 'AI HTTP: POST /internal/v3/recommendations=1; /internal/v2/recommendations=0.'
} catch {
    $failure = $_
    [Console]::Error.WriteLine(('Core smoke failed: ' + $_.Exception.Message))
} finally {
    $protocol.ToArray() | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $RunDirectory 'http-summary.json') -Encoding UTF8
    if ($KeepE2EStack -and $started) { Write-Host "Keeping owned E2E stack '$ProjectName'; metadata: $RunDirectory" }
    elseif ($started) {
        & docker compose @ComposeArgs down --volumes
        $cleanupFailed = $LASTEXITCODE -ne 0
        foreach ($image in @("${ProjectName}-backend:local", "${ProjectName}-ai:local")) {
            $ownedImage = @(& docker image ls -q $image)
            if ($ownedImage.Count -gt 0) {
                & docker image rm $image
                if ($LASTEXITCODE -ne 0) { $cleanupFailed = $true }
            }
        }
        $containers = @(& docker ps -a -q --filter "label=com.docker.compose.project=$ProjectName")
        $volumes = @(& docker volume ls -q --filter "label=com.docker.compose.project=$ProjectName")
        $networks = @(& docker network ls -q --filter "label=com.docker.compose.project=$ProjectName")
        $cleanupFailed = $cleanupFailed -or $containers.Count -gt 0 -or $volumes.Count -gt 0 -or $networks.Count -gt 0
        @{ project = $ProjectName; remainingContainers = $containers.Count; remainingVolumes = $volumes.Count; remainingNetworks = $networks.Count; clean = !$cleanupFailed } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $RunDirectory 'cleanup.json') -Encoding UTF8
        if (!$cleanupFailed) { Write-Host "Cleaned owned E2E project '$ProjectName'." }
    }
    foreach ($name in $EnvironmentBefore.Keys) { [Environment]::SetEnvironmentVariable($name, $EnvironmentBefore[$name], 'Process') }
    $OutputEncoding = $OutputEncodingBefore
    Pop-Location
    Write-Host "Ignored sanitized evidence: $RunDirectory"
}
if ($failure -or $cleanupFailed) { exit 1 }
exit 0
