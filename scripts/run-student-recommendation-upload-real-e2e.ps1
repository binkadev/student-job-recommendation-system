[CmdletBinding()]
param(
    [ValidateRange(5, 120)][int]$ReadyTimeoutSeconds = 30
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.Net.Http
Add-Type -AssemblyName System.IO.Compression

$RepositoryRoot = Split-Path -Parent $PSScriptRoot
$ProjectName = 'student-recommendation-upload-e2e'
$BackendUrl = 'http://127.0.0.1:18080'
$ComposeArgs = @('-p', $ProjectName, '-f', 'docker-compose.yml', '-f', 'docker-compose.e2e.yml')
$ExpectedSkills = @('docker', 'java', 'postgresql', 'spring boot')
$ProcessingVersion = 'bilingual-nlp-v2-skills-v1'
$ownsProject = $false
$passed = $false
$http = $null
$stage = 'environment'
$OriginalProcessPath = $env:PATH

function Assert-Condition {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "Assertion failed: $Message" }
}

function Invoke-Compose {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    & $DockerExecutable compose @ComposeArgs @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Compose failed: $($Arguments -join ' ')" }
}

function Invoke-DatabaseScalar {
    param([string]$Sql)
    # Read database/user from the isolated container, rather than printing .env.
    $rows = @($Sql | & $DockerExecutable compose @ComposeArgs exec -T postgres sh -c `
        'exec psql -X -q -t -A -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1')
    if ($LASTEXITCODE -ne 0) { throw 'Isolated database query failed.' }
    $rows = @($rows | Where-Object { $_ -and $_.Trim() })
    Assert-Condition ($rows.Count -eq 1) 'Expected one isolated database value.'
    return $rows[0].Trim()
}

function Invoke-JsonApi {
    param([ValidateSet('GET', 'POST')][string]$Method, [string]$Path, [object]$Body,
        [System.Net.Http.HttpContent]$Content)
    $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($Method), "$BackendUrl$Path")
    $response = $null
    try {
        if ($null -ne $Content) { $request.Content = $Content }
        elseif ($null -ne $Body) {
            $request.Content = [System.Net.Http.StringContent]::new(
                ($Body | ConvertTo-Json -Depth 12 -Compress), [System.Text.Encoding]::UTF8, 'application/json')
        }
        $response = $http.SendAsync($request).GetAwaiter().GetResult()
        $text = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        if (-not $response.IsSuccessStatusCode) {
            # Never emit response bodies, raw CV text, tokens, or credentials.
            $code = 'UNAVAILABLE'
            try {
                $errorBody = $text | ConvertFrom-Json
                if ($errorBody.errorCode -match '^[A-Z_]+$') { $code = $errorBody.errorCode }
            } catch { $code = 'UNREADABLE_ERROR_ENVELOPE' }
            throw "Public API $Method $Path returned HTTP $([int]$response.StatusCode), errorCode=$code."
        }
        $body = $text | ConvertFrom-Json
        Assert-Condition ($body.success -eq $true -and $null -eq $body.errorCode) "Successful envelope required for $Method $Path."
        return $body.data
    } finally {
        if ($null -ne $response) { $response.Dispose() }
        $request.Dispose()
    }
}

function New-SyntheticDocx {
    # Minimal valid OOXML package. No new dependency or on-disk private fixture.
    $paragraphs = @(
        'Synthetic Student CV - demonstration data only.',
        'Major: Information Technology and Computer Science.',
        'Education: Bachelor degree in Information Technology at Synthetic University.',
        'Experience: I developed a synthetic backend internship project with our team.',
        'We built reliable software services and tested backend APIs for our users.',
        'I have project experience with Java and Spring Boot using PostgreSQL and Docker.',
        'Skills: Java, Spring Boot, PostgreSQL, Docker.'
    )
    $xmlParagraphs = ($paragraphs | ForEach-Object {
        '<w:p><w:r><w:t>' + [System.Security.SecurityElement]::Escape($_) + '</w:t></w:r></w:p>'
    }) -join ''
    $parts = [ordered]@{
        '[Content_Types].xml' = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
        '_rels/.rels' = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
        'word/document.xml' = '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + $xmlParagraphs + '<w:sectPr/></w:body></w:document>'
    }
    $memory = [System.IO.MemoryStream]::new()
    $zip = [System.IO.Compression.ZipArchive]::new($memory, [System.IO.Compression.ZipArchiveMode]::Create, $true)
    try {
        foreach ($part in $parts.GetEnumerator()) {
            $entry = $zip.CreateEntry($part.Key)
            $entry.LastWriteTime = [DateTimeOffset]::new(2020, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
            $stream = $entry.Open()
            try {
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($part.Value)
                $stream.Write($bytes, 0, $bytes.Length)
            } finally { $stream.Dispose() }
        }
    } finally { $zip.Dispose() }
    try { return ,$memory.ToArray() } finally { $memory.Dispose() }
}

function Assert-SameList {
    param([object[]]$Actual, [object[]]$Expected, [string]$Label)
    Assert-Condition (($Actual -join '|') -ceq ($Expected -join '|')) "$Label differs."
}

function Assert-Score {
    param([object]$Value, [string]$Label)
    Assert-Condition ($null -ne $Value) "$Label must be present."
    $number = [double]$Value
    Assert-Condition (-not [double]::IsNaN($number) -and -not [double]::IsInfinity($number) `
        -and $number -ge 0 -and $number -le 1) "$Label must be finite in [0,1]."
}

function Assert-Run {
    param([object]$Run, [long]$CvId, [long[]]$ExpectedJobIds)
    Assert-Condition ($Run.status -eq 'SUCCESS' -and $Run.sourceType -eq 'CV' -and [long]$Run.cvId -eq $CvId) 'Run must use the uploaded CV and finish SUCCESS.'
    Assert-Condition ($Run.algorithm -eq 'tfidf-cosine-hybrid' -and $Run.algorithmVersion -eq 'bilingual-recommendation-v3') 'V3 algorithm metadata required.'
    Assert-Condition ($Run.totalJobsScanned -eq 3 -and $null -ne $Run.finishedAt -and $null -eq $Run.errorMessage) 'Completed run counters/timestamps required.'
    $results = @($Run.results)
    Assert-Condition ($results.Count -eq $ExpectedJobIds.Count -and $Run.totalRecommended -eq $results.Count) 'Global Top-K/result counts differ.'
    Assert-SameList @($results | ForEach-Object { [long]$_.jobId }) $ExpectedJobIds 'Official Job ordering'
    $tierRanks = @{ PRIMARY = 0; FALLBACK = 0 }
    for ($index = 0; $index -lt $results.Count; $index++) {
        $result = $results[$index]
        Assert-Condition (@('PRIMARY', 'FALLBACK') -contains $result.rankingTier) 'Unsupported tier.'
        $tierRanks[$result.rankingTier]++
        Assert-Condition ($result.rankPosition -eq $index + 1 -and $result.tierRankPosition -eq $tierRanks[$result.rankingTier]) 'Backend global/tier ranks must be continuous.'
        Assert-Score $result.rankingScore 'rankingScore'
        Assert-Score $result.skillScore 'skillScore'
        Assert-Condition ([decimal]$result.score -eq [decimal]$result.rankingScore) 'Legacy score alias differs.'
        Assert-SameList @($result.matchedKeywords) $ExpectedSkills 'Matched canonical skills'
        if ($result.rankingTier -eq 'PRIMARY') {
            Assert-Condition ($result.scoringStrategy -eq 'SAME_LANGUAGE_HYBRID') 'PRIMARY strategy mismatch.'
            Assert-Score $result.textScore 'PRIMARY textScore'
            Assert-Score $result.overallScore 'PRIMARY overallScore'
            Assert-Condition ([decimal]$result.overallScore -eq [decimal]$result.rankingScore -and [decimal]$result.textScore -gt 0) 'PRIMARY must have positive text evidence and rankingScore=overallScore.'
            Assert-SameList @($result.missingSkills) @('redis') 'PRIMARY missing skills'
            Assert-Condition ([decimal]$result.skillScore -eq [decimal]0.8) 'PRIMARY must cover 4 of 5 declared skills.'
            $expected = [decimal]0.65 * [decimal]$result.textScore + [decimal]0.35 * [decimal]$result.skillScore
            Assert-Condition ([Math]::Abs([decimal]$result.overallScore - $expected) -le [decimal]0.00002) 'Persisted PRIMARY formula outside five-decimal rounding tolerance.'
        } else {
            Assert-Condition ($result.scoringStrategy -eq 'CROSS_LANGUAGE_SKILL_BASED' -and $null -eq $result.textScore -and $null -eq $result.overallScore) 'FALLBACK strategy/null semantics differ.'
            Assert-Condition ([decimal]$result.rankingScore -eq [decimal]$result.skillScore -and [decimal]$result.skillScore -eq 1) 'FALLBACK must cover all four declared skills.'
            Assert-SameList @($result.missingSkills) @() 'FALLBACK missing skills'
        }
    }
    # Identical English documents prove deterministic score ties by Job ID.
    Assert-Condition ([decimal]$results[0].rankingScore -eq [decimal]$results[1].rankingScore) 'Identical PRIMARY documents must tie.'
    if ($results.Count -eq 3) {
        Assert-Condition ([decimal]$results[1].rankingScore -lt [decimal]$results[2].rankingScore) 'Fixture must exercise PRIMARY precedence over higher FALLBACK skill coverage.'
    }
}

function Assert-PersistedAndHistory {
    param([object]$Run, [long]$CvId, [long[]]$ExpectedJobIds)
    $runId = [long]$Run.id
    $storedRun = (Invoke-DatabaseScalar "SELECT json_build_object('status',status,'cvId',cv_file_id,'algorithm',algorithm,'algorithmVersion',algorithm_version,'totalJobsScanned',total_jobs_scanned,'finished',finished_at IS NOT NULL) FROM recommendation_runs WHERE id=$runId;") | ConvertFrom-Json
    Assert-Condition ($storedRun.status -eq 'SUCCESS' -and [long]$storedRun.cvId -eq $CvId -and $storedRun.finished -eq $true -and $storedRun.totalJobsScanned -eq 3) 'Persisted run metadata differs.'
    Assert-Condition ($storedRun.algorithm -eq $Run.algorithm -and $storedRun.algorithmVersion -eq $Run.algorithmVersion) 'Persisted algorithm metadata differs.'
    $stored = @((Invoke-DatabaseScalar "SELECT COALESCE(json_agg(json_build_object('jobId',job_id,'rankingTier',ranking_tier,'rankingScore',score,'overallScore',overall_score,'textScore',text_score,'skillScore',skill_score,'scoringStrategy',scoring_strategy,'rankPosition',rank_position,'tierRankPosition',tier_rank_position,'matchedKeywords',matched_keywords,'missingSkills',missing_skills) ORDER BY rank_position),'[]'::json) FROM recommendation_results WHERE run_id=$runId;") | ConvertFrom-Json | ForEach-Object { $_ })
    $detail = Invoke-JsonApi GET "/api/students/me/recommendation-runs/$runId"
    Assert-Run $detail $CvId $ExpectedJobIds
    Assert-Condition ($stored.Count -eq @($Run.results).Count) 'Persisted result count differs.'
    foreach ($field in @('jobId','rankingTier','rankingScore','overallScore','textScore','skillScore','scoringStrategy','rankPosition','tierRankPosition','matchedKeywords','missingSkills')) {
        for ($index = 0; $index -lt $stored.Count; $index++) {
            $expected = $Run.results[$index].$field | ConvertTo-Json -Compress
            Assert-Condition (($stored[$index].$field | ConvertTo-Json -Compress) -ceq $expected) "DB result $field differs."
            Assert-Condition (($detail.results[$index].$field | ConvertTo-Json -Compress) -ceq $expected) "History result $field differs."
        }
    }
    return $runId
}

function Get-LexicalEvidence {
    param([string]$ProcessedText, [string[]]$Tokens)
    $actualTokens = @($ProcessedText -split '\s+')
    foreach ($token in $Tokens) {
        if ($actualTokens -cnotcontains $token) { return 'NOT_PROVEN' }
    }
    return 'LEXICAL_PROVEN'
}

Push-Location -LiteralPath $RepositoryRoot
try {
    $command = Get-Command docker -ErrorAction SilentlyContinue
    $DockerExecutable = if ($command) { $command.Source } else {
        @("$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe",
          "$env:ProgramFiles\Docker\Docker\resources\bin\docker.exe") |
            Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    }
    Assert-Condition (-not [string]::IsNullOrWhiteSpace($DockerExecutable)) 'Docker CLI is required.'
    # Compose also launches Docker's credential helper from this directory.
    $env:PATH = (Split-Path -Parent $DockerExecutable) + [System.IO.Path]::PathSeparator + $OriginalProcessPath
    & $DockerExecutable version *> $null
    Assert-Condition ($LASTEXITCODE -eq 0) 'Docker daemon must be available.'
    foreach ($resource in @('container', 'volume', 'network')) {
        $listArgs = if ($resource -eq 'container') { @('ls', '-a', '-q') } else { @('ls', '-q') }
        $existing = @(& $DockerExecutable $resource @listArgs --filter "label=com.docker.compose.project=$ProjectName")
        Assert-Condition ($LASTEXITCODE -eq 0 -and $existing.Count -eq 0) "Reserved project has existing $resource resources; leave them intact and resolve before running."
    }
    $ownsProject = $true # Also clean a partially failed startup.
    Invoke-Compose up -d --build --wait --wait-timeout 180
    $http = [System.Net.Http.HttpClient]::new()
    $http.Timeout = [TimeSpan]::FromSeconds(45)
    $stage = 'register/login'
    $studentEmail = 'upload-e2e-student@example.test'
    $password = 'SyntheticUploadE2E!1'
    $null = Invoke-JsonApi POST '/api/auth/register' @{email=$studentEmail;password=$password;role='STUDENT';fullName='Synthetic Upload Student'}
    $null = Invoke-JsonApi POST '/api/auth/register' @{email='upload-e2e-company@example.test';password=$password;role='COMPANY';fullName='Synthetic Company';companyName='Synthetic Company'}
    $login = Invoke-JsonApi POST '/api/auth/login' @{email=$studentEmail;password=$password}
    $http.DefaultRequestHeaders.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $login.token)

    $stage = 'minimal Job corpus'
    Assert-Condition ((Invoke-DatabaseScalar 'SELECT COUNT(*) FROM jobs;') -eq '0') 'Isolated Job corpus must start empty.'
    # Only Job/skill fixture data is seeded. Never write cv_files or analysis data.
    $seed = @'
INSERT INTO skills (name,normalized_name,category) VALUES
 ('Java','java','Backend'),('Spring Boot','spring boot','Backend'),('PostgreSQL','postgresql','Database'),('Docker','docker','DevOps'),('Redis','redis','Database');
INSERT INTO jobs (company_id,title,description,requirements,job_type,working_model,status,published_at)
SELECT c.id,'English Backend Internship','Our team develops reliable backend software services and APIs for users. We build internship projects with Java and Spring Boot.','Computer Science or Information Technology Bachelor degree. University project experience using PostgreSQL Docker and Redis.','INTERNSHIP','HYBRID','ACTIVE',CURRENT_TIMESTAMP
FROM companies c JOIN users u ON u.id=c.user_id WHERE u.email='upload-e2e-company@example.test';
INSERT INTO jobs (company_id,title,description,requirements,job_type,working_model,status,published_at)
SELECT company_id,title,description,requirements,job_type,working_model,status,published_at FROM jobs;
INSERT INTO jobs (company_id,title,description,requirements,job_type,working_model,status,published_at)
SELECT c.id,'Vietnamese Backend Internship',U&'Ph\00e1t tri\1ec3n ph\1ea7n m\1ec1m v\00e0 d\1ecbch v\1ee5 cho ng\01b0\1eddi d\00f9ng. X\00e2y d\1ef1ng h\1ec7 th\1ed1ng backend b\1eb1ng Java Spring Boot.',U&'Y\00eau c\1ea7u c\00f3 kinh nghi\1ec7m l\00e0m vi\1ec7c v\1edbi c\01a1 s\1edf d\1eef li\1ec7u PostgreSQL v\00e0 Docker.','INTERNSHIP','HYBRID','ACTIVE',CURRENT_TIMESTAMP
FROM companies c JOIN users u ON u.id=c.user_id WHERE u.email='upload-e2e-company@example.test';
INSERT INTO job_skills (job_id,skill_id,importance,min_level)
SELECT j.id,s.id,'REQUIRED','BEGINNER' FROM jobs j CROSS JOIN skills s WHERE j.title='English Backend Internship' OR s.normalized_name<>'redis';
SELECT COUNT(*) FROM jobs;
'@
    Assert-Condition ((Invoke-DatabaseScalar $seed) -eq '3') 'Three eligible Jobs required.'
    $jobIds = @((Invoke-DatabaseScalar 'SELECT json_agg(id ORDER BY id) FROM jobs;') | ConvertFrom-Json | ForEach-Object { $_ })

    $stage = 'real DOCX upload'
    [byte[]]$docx = New-SyntheticDocx
    $multipart = [System.Net.Http.MultipartFormDataContent]::new()
    $fileContent = [System.Net.Http.ByteArrayContent]::new($docx)
    $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::new('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    $multipart.Add($fileContent, 'file', 'synthetic-student.docx')
    $uploaded = Invoke-JsonApi POST '/api/students/me/cv?active=true' -Content $multipart
    $cvId = [long]$uploaded.id
    Assert-Condition ($cvId -gt 0 -and $uploaded.isActive -eq $true -and $uploaded.fileSize -eq $docx.Length) 'Uploaded CV metadata differs.'
    $initial = Invoke-JsonApi GET "/api/students/me/cv/$cvId/analysis"
    Assert-Condition ($initial.status -eq 'NOT_READY' -and $null -eq $initial.processedText -and @($initial.skills).Count -eq 0) 'Upload must start NOT_READY without analysis.'
    Write-Host 'Upload: PASS; multipart DOCX; initial NOT_READY.'

    $stage = 'real AI parse / READY snapshot'
    $null = Invoke-JsonApi POST "/api/students/me/cv/$cvId/reanalyze"
    $deadline = [DateTime]::UtcNow.AddSeconds($ReadyTimeoutSeconds)
    do {
        $analysis = Invoke-JsonApi GET "/api/students/me/cv/$cvId/analysis"
        if ($analysis.status -eq 'READY') { break }
        Assert-Condition ($analysis.status -ne 'FAILED') 'CV analysis entered FAILED.'
        Start-Sleep -Milliseconds 250
    } while ([DateTime]::UtcNow -lt $deadline)
    Assert-Condition ($analysis.status -eq 'READY') 'CV did not become READY before the bounded deadline.'
    Assert-Condition (-not [string]::IsNullOrWhiteSpace($analysis.processedText) -and $analysis.languageCode -eq 'en') 'Nonblank English processed snapshot required.'
    Assert-Score $analysis.languageConfidence 'languageConfidence'
    Assert-Condition ([decimal]$analysis.languageConfidence -ge [decimal]0.65 -and $analysis.processingVersion -eq $ProcessingVersion -and $null -ne $analysis.analyzedAt) 'Compatible confident CV snapshot required.'
    Assert-SameList @($analysis.skills) $ExpectedSkills 'Extracted canonical skills'
    $snapshotSql = "SELECT json_build_object('status',analysis_status,'processedText',processed_text,'skills',extracted_skills,'languageCode',language_code,'languageConfidence',language_confidence,'processingVersion',processing_version,'analyzed',analyzed_at IS NOT NULL) FROM cv_files WHERE id=$cvId;"
    $snapshot = (Invoke-DatabaseScalar $snapshotSql) | ConvertFrom-Json
    Assert-Condition ($snapshot.status -eq 'READY' -and $snapshot.analyzed -eq $true) 'READY snapshot must be persisted.'
    foreach ($field in @('processedText','languageCode','languageConfidence','processingVersion')) {
        Assert-Condition ($snapshot.$field -ceq $analysis.$field) "Persisted CV $field differs from analysis API."
    }
    Assert-SameList @($snapshot.skills) @($analysis.skills) 'Persisted extracted skills'
    $school = [ordered]@{
        Skill = 'STRUCTURED_PROVEN'
        Major = Get-LexicalEvidence $snapshot.processedText @('information','technology','computer','science')
        Experience = Get-LexicalEvidence $snapshot.processedText @('backend','internship','project','experience')
        Education = Get-LexicalEvidence $snapshot.processedText @('bachelor','degree','university')
    }
    Write-Host 'Parse/Snapshot: PASS; real parser; READY metadata and canonical skills match PostgreSQL.'

    $stage = 'Recommendation V3 / official Top-K'
    $fullRun = Invoke-JsonApi POST '/api/students/me/recommendations/generate' @{cvId=$cvId;threshold=0;limit=3}
    Assert-Run $fullRun $cvId $jobIds
    $fullRunId = Assert-PersistedAndHistory $fullRun $cvId $jobIds
    $topRun = Invoke-JsonApi POST '/api/students/me/recommendations/generate' @{cvId=$cvId;threshold=0;limit=2}
    Assert-Run $topRun $cvId @($jobIds[0], $jobIds[1])
    $topRunId = Assert-PersistedAndHistory $topRun $cvId @($jobIds[0], $jobIds[1])
    $history = @(Invoke-JsonApi GET '/api/students/me/recommendation-runs')
    Assert-SameList @($history | ForEach-Object { [long]$_.id }) @($topRunId, $fullRunId) 'Public run history'
    Assert-Condition (@($history | Where-Object { $_.status -ne 'SUCCESS' -or $_.algorithmVersion -ne 'bilingual-recommendation-v3' -or [long]$_.cvId -ne $cvId }).Count -eq 0) 'History metadata differs.'
    $latest = @(Invoke-JsonApi GET '/api/students/me/recommendation-results/latest')
    Assert-SameList @($latest | ForEach-Object { [long]$_.id }) @($topRun.results | ForEach-Object { [long]$_.id }) 'Latest official result IDs'
    Assert-Condition ((Invoke-DatabaseScalar "SELECT COUNT(*) FROM recommendation_runs WHERE status='PROCESSING';") -eq '0') 'No PROCESSING run may remain.'
    Assert-Condition ((Invoke-DatabaseScalar 'SELECT COUNT(*) FROM recommendation_runs;') -eq '2') 'Expected two persisted runs.'
    $afterScoring = (Invoke-DatabaseScalar $snapshotSql) | ConvertFrom-Json
    Assert-Condition (($afterScoring | ConvertTo-Json -Depth 8 -Compress) -ceq ($snapshot | ConvertTo-Json -Depth 8 -Compress)) 'Scoring must not rewrite the persisted CV snapshot.'

    $stage = 'real AI HTTP evidence'
    $aiLogs = @(& $DockerExecutable compose @ComposeArgs logs --no-color ai-service 2>&1)
    Assert-Condition ($LASTEXITCODE -eq 0) 'Could not read isolated AI access evidence.'
    $parseCount = @($aiLogs | Select-String -SimpleMatch 'POST /internal/v2/cv/parse HTTP/1.1" 200').Count
    $v3Count = @($aiLogs | Select-String -SimpleMatch 'POST /internal/v3/recommendations HTTP/1.1" 200').Count
    $v2Count = @($aiLogs | Select-String -SimpleMatch 'POST /internal/v2/recommendations HTTP/1.1"').Count
    Assert-Condition ($parseCount -eq 1 -and $v3Count -eq 2 -and $v2Count -eq 0) 'Require one real V2 parse, two V3 generations, and no V2 generation.'
    Write-Host 'Recommendation/Ranking: PASS; 2 PRIMARY + 1 FALLBACK; limit=2 retains only PRIMARY; deterministic ties and official ranks.'
    Write-Host 'Persistence/History: PASS; 2 SUCCESS runs, 5 results; detail/list/latest preserve official semantics; snapshot unchanged.'
    Write-Host "AI HTTP: parse-v2=$parseCount; recommendations-v3=$v3Count; recommendations-v2=$v2Count."
    foreach ($feature in $school.GetEnumerator()) { Write-Host "School $($feature.Key): $($feature.Value)" }
    Write-Host 'Lexical evidence proves retained tokens in the scored snapshot, not structured extraction or per-feature score attribution.'
    $passed = $true
} catch {
    Write-Host "FAIL at stage '$stage': $($_.Exception.Message)"
} finally {
    if ($null -ne $http) { $http.Dispose() }
    if ($ownsProject) {
        & $DockerExecutable compose @ComposeArgs down --volumes --remove-orphans
        $cleanupOk = $LASTEXITCODE -eq 0
        foreach ($resource in @('container', 'volume', 'network')) {
            $listArgs = if ($resource -eq 'container') { @('ls', '-a', '-q') } else { @('ls', '-q') }
            $remaining = @(& $DockerExecutable $resource @listArgs --filter "label=com.docker.compose.project=$ProjectName")
            if ($LASTEXITCODE -ne 0 -or $remaining.Count -ne 0) { $cleanupOk = $false }
        }
        if ($cleanupOk) { Write-Host "Cleanup: PASS; isolated project '$ProjectName' containers, volumes, and network removed." }
        else { $passed = $false; Write-Host 'Cleanup: FAIL; isolated resources need inspection.' }
    }
    $env:PATH = $OriginalProcessPath
    Pop-Location
}
if (-not $passed) { exit 1 }
Write-Host 'Real Student CV upload-to-ranking E2E: PASS.'
