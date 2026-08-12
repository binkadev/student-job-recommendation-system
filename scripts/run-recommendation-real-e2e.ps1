[CmdletBinding()]
param([switch]$KeepE2EStack)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$ProjectName = 'recommendation-real-e2e'
$BackendUrl = 'http://127.0.0.1:18080'
$AiUrl = 'http://127.0.0.1:18000'
$DatabaseName = 'student_job_recommendation'
$ComposeArgs = @('-p', $ProjectName, '-f', 'docker-compose.yml', '-f', 'docker-compose.e2e.yml')
$started = $false

function Invoke-Compose { param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Arguments) & docker compose @ComposeArgs @Arguments; if ($LASTEXITCODE -ne 0) { throw "Compose failed: $($Arguments -join ' ')" } }
function Assert-Condition { param([bool]$Condition,[string]$Message) if (-not $Condition) { throw "Assertion failed: $Message" } }
function Invoke-DatabaseScalar { param([string]$Sql) $value = @($Sql | & docker compose @ComposeArgs exec -T postgres psql -X -q -t -A -U postgres -d $DatabaseName -v ON_ERROR_STOP=1 | Where-Object { $_ -and $_.Trim() }) ; if ($LASTEXITCODE -ne 0 -or $value.Count -ne 1) { throw 'Expected exactly one isolated database value.' }; return $value[0].Trim() }
function Invoke-Api { param([ValidateSet('GET','POST')][string]$Method,[string]$Path,[object]$Body,[hashtable]$Headers) $p=@{Uri="$BackendUrl$Path";Method=$Method;UseBasicParsing=$true;ErrorAction='Stop'}; if($Headers){$p.Headers=$Headers};if($null -ne $Body){$p.ContentType='application/json';$p.Body=$Body|ConvertTo-Json -Compress};$r=Invoke-WebRequest @p;Assert-Condition ($r.StatusCode -eq 200 -or $r.StatusCode -eq 201) "$Method $Path returned HTTP $($r.StatusCode).";return $r.Content|ConvertFrom-Json }
function Assert-Score { param([object]$Value,[string]$Label) Assert-Condition ($null -ne $Value) "$Label must be present."; $n=[decimal]$Value;Assert-Condition ($n -ge 0 -and $n -le 1) "$Label must be in [0,1]." }

try {
    & docker version *> $null; if ($LASTEXITCODE -ne 0) { throw 'Docker is unavailable.' }
    Invoke-Compose down --volumes --remove-orphans
    Invoke-Compose up -d --build --wait --wait-timeout 180; $started=$true
    Assert-Condition ((Invoke-WebRequest -Uri "$AiUrl/health" -UseBasicParsing).StatusCode -eq 200) 'AI health must be 200.'

    $studentEmail='recommendation-e2e-student@example.test'; $companyEmail='recommendation-e2e-company@example.test'; $password='RecommendationE2E!1'
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
INSERT INTO jobs (company_id,title,description,requirements,benefits,location,job_type,working_model,status,published_at) VALUES
 ((SELECT c.id FROM companies c JOIN users u ON u.id=c.user_id WHERE u.email='recommendation-e2e-company@example.test'),'English Backend Role','Build reliable backend systems with Java and Spring Boot.','Java Spring Boot PostgreSQL Docker.','Mentoring','HCM','INTERNSHIP','HYBRID','ACTIVE',CURRENT_TIMESTAMP),
 ((SELECT c.id FROM companies c JOIN users u ON u.id=c.user_id WHERE u.email='recommendation-e2e-company@example.test'),'Vietnamese Backend Role','Xây dựng hệ thống backend bằng Java Spring Boot và PostgreSQL.','Yêu cầu Java, Spring Boot, PostgreSQL và Docker.','Hướng dẫn','HCM','INTERNSHIP','HYBRID','ACTIVE',CURRENT_TIMESTAMP);
INSERT INTO job_skills (job_id,skill_id,importance,min_level) SELECT j.id,s.id,'REQUIRED','BEGINNER' FROM jobs j JOIN skills s ON s.normalized_name IN ('docker','java','postgresql','spring boot') WHERE j.title IN ('English Backend Role','Vietnamese Backend Role');
'@
    $seed | & docker compose @ComposeArgs exec -T postgres psql -X -q -U postgres -d $DatabaseName -v ON_ERROR_STOP=1; if($LASTEXITCODE -ne 0){throw 'Could not seed isolated Student fixture.'}
    $cvId=Invoke-DatabaseScalar "SELECT cv.id FROM cv_files cv JOIN students s ON s.id=cv.student_id JOIN users u ON u.id=s.user_id WHERE u.email='$studentEmail';"
    $primaryJobId=Invoke-DatabaseScalar "SELECT id FROM jobs WHERE title='English Backend Role';"; $fallbackJobId=Invoke-DatabaseScalar "SELECT id FROM jobs WHERE title='Vietnamese Backend Role';"
    $created=Invoke-Api POST '/api/students/me/recommendations/generate' @{cvId=[long]$cvId;threshold=0;limit=10} $headers; Assert-Condition $created.success 'Public Student generation must succeed.'
    $run=$created.data; Assert-Condition ($run.status -eq 'SUCCESS' -and $run.algorithm -eq 'tfidf-cosine-hybrid' -and $run.algorithmVersion -eq 'bilingual-recommendation-v3') 'Student V3 run metadata is invalid.'
    $results=@($run.results);Assert-Condition ($results.Count -eq 2) 'Fixture must return one PRIMARY and one FALLBACK.'
    $primary=@($results|Where-Object{$_.rankingTier -eq 'PRIMARY'})[0];$fallback=@($results|Where-Object{$_.rankingTier -eq 'FALLBACK'})[0]
    Assert-Condition ($null -ne $primary -and $null -ne $fallback) 'Both V3 tiers must be present.'
    Assert-Condition ([long]$primary.jobId -eq [long]$primaryJobId -and [long]$fallback.jobId -eq [long]$fallbackJobId) 'Fixture jobs must route to expected tiers.'
    Assert-Condition ([int]$primary.rankPosition -eq 1 -and [int]$primary.tierRankPosition -eq 1 -and [int]$fallback.rankPosition -eq 2 -and [int]$fallback.tierRankPosition -eq 1) 'Global and tier ranks must be authoritative.'
    foreach($r in $results){Assert-Score $r.rankingScore 'rankingScore';Assert-Condition ([decimal]$r.score -eq [decimal]$r.rankingScore) 'score must alias rankingScore.';Assert-Condition ($null -ne $r.rankingTier -and $null -ne $r.tierRankPosition) 'V3 public fields must be present.'}
    Assert-Condition ($primary.scoringStrategy -eq 'SAME_LANGUAGE_HYBRID' -and $null -ne $primary.textScore -and $null -ne $primary.overallScore -and [decimal]$primary.rankingScore -eq [decimal]$primary.overallScore) 'PRIMARY semantics are invalid.'
    Assert-Condition ($fallback.scoringStrategy -eq 'CROSS_LANGUAGE_SKILL_BASED' -and $null -eq $fallback.textScore -and $null -eq $fallback.overallScore -and [decimal]$fallback.rankingScore -eq 1 -and [decimal]$fallback.skillScore -eq 1) 'FALLBACK 100% Skill Match semantics are invalid.'
    Assert-Condition ([decimal]$primary.rankingScore -lt 1 -and [int]$primary.rankPosition -lt [int]$fallback.rankPosition) 'PRIMARY must precede FALLBACK 1.0 cross-tier.'
    Assert-Condition ((@($fallback.matchedKeywords) -join '|') -eq 'docker|java|postgresql|spring boot' -and @($fallback.missingSkills).Count -eq 0) 'FALLBACK canonical skill evidence is invalid.'
    $runId=[long]$run.id
    $db=Invoke-DatabaseScalar "SELECT ranking_tier || '|' || score || '|' || skill_score || '|' || COALESCE(overall_score::text,'NULL') || '|' || COALESCE(text_score::text,'NULL') || '|' || rank_position || '|' || tier_rank_position FROM recommendation_results WHERE run_id=$runId AND ranking_tier='FALLBACK';"
    Assert-Condition ($db -match '^FALLBACK\|1\.00000\|1\.00000\|NULL\|NULL\|2\|1$') 'Persisted Student FALLBACK V3 state is invalid.'
    Assert-Condition ((Invoke-DatabaseScalar "SELECT COUNT(*) FROM recommendation_runs WHERE id=$runId AND status='PROCESSING';") -eq '0') 'No Student PROCESSING run may remain.'
    $v3=@((& docker compose @ComposeArgs logs ai-service 2>&1|Select-String -SimpleMatch 'POST /internal/v3/recommendations HTTP/1.1" 200'));$v2=@((& docker compose @ComposeArgs logs ai-service 2>&1|Select-String -SimpleMatch 'POST /internal/v2/recommendations HTTP/1.1"'))
    Assert-Condition ($v3.Count -eq 1 -and $v2.Count -eq 0) 'Exactly one V3 Student AI request and no V2 recommendation call are required.'
    Write-Host 'Real Student Recommendation V3 E2E passed.';Write-Host 'AI HTTP: POST /internal/v3/recommendations=1; /internal/v2/recommendations=0.'
} catch { Write-Error $_;if($started){& docker compose @ComposeArgs ps};exit 1 } finally { if($KeepE2EStack){Write-Host "Keeping isolated E2E stack '$ProjectName'."}else{& docker compose @ComposeArgs down --volumes --remove-orphans;if($LASTEXITCODE -eq 0){Write-Host "Cleaned isolated E2E project '$ProjectName'."}else{Write-Warning 'Could not completely clean E2E stack.'}} }
