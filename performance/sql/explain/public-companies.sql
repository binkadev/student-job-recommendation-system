\set ON_ERROR_STOP on
\ir /performance/sql/00_guard.sql

BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';

\echo __PLAN_content_BEGIN__
EXPLAIN (
  ANALYZE,
  BUFFERS,
  SETTINGS,
  FORMAT JSON
)
SELECT
  c.id, c.user_id, c.company_name, c.tax_code, c.website_url, c.logo_url,
  c.industry, c.company_size, c.description, c.address, c.phone, c.status,
  c.created_at, c.updated_at
FROM companies AS c
WHERE c.status = 'VERIFIED'
ORDER BY c.created_at DESC
OFFSET 0 ROWS FETCH FIRST 20 ROWS ONLY;
\echo __PLAN_content_END__

\echo __PLAN_count_BEGIN__
EXPLAIN (
  ANALYZE,
  BUFFERS,
  SETTINGS,
  FORMAT JSON
)
SELECT count(c.id)
FROM companies AS c
WHERE c.status = 'VERIFIED';
\echo __PLAN_count_END__

\echo __PLAN_secondary_BEGIN__
EXPLAIN (
  ANALYZE,
  BUFFERS,
  SETTINGS,
  FORMAT JSON
)
SELECT j.company_id, count(j.id)
FROM jobs AS j
WHERE j.company_id IN (61, 62, 63, 64, 65, 66, 67, 68, 69, 70,
                       71, 72, 73, 74, 75, 76, 77, 78, 79, 80)
  AND j.status = 'ACTIVE'
GROUP BY j.company_id;
\echo __PLAN_secondary_END__

ROLLBACK;

