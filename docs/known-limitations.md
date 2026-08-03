# Known Limitations

## Accepted limitations

- Classical lexical TF-IDF/Cosine Similarity is sensitive to wording, token
  overlap, corpus composition, and preprocessing. It is not semantic
  multilingual understanding.
- Scores depend on PDF/DOCX extraction, language detection, and the quality of
  declared/canonical skills.
- Cross-language, mixed, or low-confidence pairs use skill-only fallback and
  therefore ignore textual similarity.
- There is no OCR for image-only CVs, no multilingual embeddings, no vector
  database, and no learned ranking model.
- Ranking and CV analysis are synchronous; there is no queue or background
  worker.
- The result is screening support, not a hiring decision or a guarantee of
  hiring quality. Source-data and recruiter bias require human review.
- The real E2E fixture is small and synthetic. It proves service integration,
  persistence, and deterministic behavior, not large-scale relevance.

## Future improvement candidates

These are improvement directions, not implemented features or commitments in
this package:

- OCR and stronger document extraction for scanned CVs.
- Human-labeled evaluation on an authorized, representative corpus.
- A reviewed semantic multilingual representation or learned ranking approach.
- An asynchronous architecture for larger corpora while preserving one shared
  comparable representation.

## Production prerequisites

Before any production claim, the project would need independently verified
deployment, secret management, monitoring/alerting, log-retention review,
backup/restore and rollback drills, capacity testing, privacy review, and a
human-labeled ranking-quality evaluation. The current repository does not
provide direct evidence for those gates.
