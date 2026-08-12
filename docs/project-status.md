# Project Status

Verification date: 2026-08-03
Source commit: `56a21db4e99815dbcfd25d4da6ca9f7bd404cd69`
Branch: `chore/final-regression-demo-package`

## Purpose

This is a full-stack recruitment system for IT students, companies, and
administrators. It parses English and Vietnamese PDF/DOCX CVs, extracts
canonical technical skills, and provides deterministic content-based job
recommendation and recruiter-side Candidate Ranking.

## Architecture

```text
React Frontend -> Spring Boot Backend -> PostgreSQL
                                  \-> stateless FastAPI AI Service
```

The Frontend calls the Backend only. The Backend owns authentication,
authorization, eligibility, transactions, response validation, official
ordering, rank assignment, and persistence. The AI Service owns document
parsing, bilingual preprocessing, skill canonicalization, TF-IDF/Cosine
Similarity, and component scoring. AI receives no user JWT and has no database
access.

## Completed modules

- Spring Boot public and role-protected APIs, JWT security, business rules,
  PostgreSQL persistence, and Flyway migrations through `V16`.
- FastAPI Contract V1 compatibility and Contract V2 CV parsing/recommendation
  services.
- English/Vietnamese deterministic preprocessing and canonical skill aliases.
- Student-to-Job recommendation and recruiter-side Candidate Ranking.
- React recruiter Candidate Ranking page with run history, score breakdown,
  CV opening, saved-candidate action, and application-status action.
- CI workflows, normal Compose stack, isolated Candidate Ranking E2E harness,
  and offline evaluation tooling.

## Candidate Ranking status

Candidate Ranking is implemented in source code. The locked behavior is defined
in [candidate-ranking-contract.md](candidate-ranking-contract.md): eligible
Applications are prepared by the Backend, one bulk AI request scores the full
eligible corpus, AI returns component scores only, and the Backend assigns
continuous `rankPosition` values after deterministic validation and sorting.

## Evidence matrix

| Classification | Evidence at this source commit |
|---|---|
| Implemented in source code | Candidate Ranking Controller, services, V16 migration, AI ranker/service, Frontend page/API/components |
| Covered by automated tests | Backend unit/integration Candidate Ranking tests, AI Candidate Ranking tests, Frontend Candidate Ranking tests |
| Successfully executed locally | Backend 388 tests, AI 646 tests, Frontend 51 tests, lint/build, and both Compose config validations passed on 2026-08-03 |
| Proven through real cross-service E2E | Isolated runner passed: healthy three-service stack, registration/login, POST/list/detail, one AI bulk call, three persisted deterministic results, cleanup |
| Documented but not directly evidenced | Full manual Student -> Company -> Admin browser journey, human ranking-quality metrics, production operations |
| Not implemented | OCR for image-only CVs, semantic multilingual embeddings, learned ranking, queue/background worker |
| Known limitation | Lexical matching depends on parsed text and declared canonical skills; ranking supports screening and does not replace human judgment |

## Current limitations and non-goals

- TF-IDF is lexical and does not understand meaning, seniority, or transferable
  experience beyond configured preprocessing and aliases.
- CV parsing quality, declared skills, and language detection affect scores.
- Cross-language or low-confidence pairs use skill-only scoring.
- CV analysis and Candidate Ranking are synchronous; there is no queue or
  background worker.
- Historical CV/Job/corpus text is not stored as an immutable full snapshot.
- No production deployment, monitoring, backup/restore drill, rollback drill,
  or large real-user ranking evaluation is proven by this repository alone.
- Human review is required because rankings can reproduce source-data and
  recruiter bias and do not guarantee hiring quality.

Unfinished or explicitly out of scope for this package: new ranking features,
semantic model training, admin approval-policy redesign, production release,
and a claim that the Frontend has passed the complete manual browser journey.

## Final verification

The authoritative command results, totals, warnings, E2E assertions, cleanup
result, and retry notes are recorded in [final-verification.md](final-verification.md).
The final conclusion is READY WITH NAMED LIMITATIONS. No production-readiness
claim is made.
