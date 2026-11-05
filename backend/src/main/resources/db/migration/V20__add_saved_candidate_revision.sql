-- Preserve existing bookmarks/notes; stale note drafts must not overwrite newer notes.
ALTER TABLE saved_candidates ADD COLUMN revision BIGINT NOT NULL DEFAULT 0;
