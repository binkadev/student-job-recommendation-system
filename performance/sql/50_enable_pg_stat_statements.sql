\set ON_ERROR_STOP on
\ir /performance/sql/00_guard.sql

DO $guard$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM unnest(string_to_array(current_setting('shared_preload_libraries'), ',')) AS library(name)
        WHERE btrim(library.name) = 'pg_stat_statements'
    ) THEN
        RAISE EXCEPTION 'pg_stat_statements is not preloaded. Recreate only the performance PostgreSQL container from performance/docker-compose.yml.';
    END IF;
END
$guard$;

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

DO $verify$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') THEN
        RAISE EXCEPTION 'pg_stat_statements extension is not installed in the performance database.';
    END IF;
END
$verify$;

\echo 'pg_stat_statements is enabled in the guarded performance database.'

