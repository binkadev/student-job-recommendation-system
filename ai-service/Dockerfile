# syntax=docker/dockerfile:1.7

FROM python:3.11.9-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    AI_SPACY_MODEL_DIR=/app/built_models/spacy_custom_model \
    AI_TFIDF_MODEL_PATH=/app/models/tfidf/tfidf_model.pkl \
    AI_TFIDF_BOOTSTRAP_MODEL_PATH=/app/built_models/tfidf/tfidf_model.pkl

WORKDIR /app

RUN addgroup --system app \
    && adduser --system --ingroup app app

COPY requirements.lock ./requirements.lock
RUN python -m pip install --require-hashes --only-binary=:all: -r requirements.lock \
    && python -m pip check

COPY --chown=app:app . /app

# Compile immutable spaCy EntityRuler model and bootstrap Global-IDF .pkl into
# unmounted /app/built_models/ so mounted TF-IDF volumes never shadow spaCy.
RUN mkdir -p /app/built_models/tfidf /app/models/tfidf \
    && python -m offline.build_spacy_model \
        --output-dir /app/built_models/spacy_custom_model \
    && python -m offline.train_tfidf_incremental \
        --bootstrap \
        --force-rebuild \
        --bootstrap-dir /app/data/bootstrap_raw \
        --spacy-model-dir /app/built_models/spacy_custom_model \
        --state-path /app/built_models/tfidf/df_state.sqlite \
        --output-path /app/built_models/tfidf/tfidf_model.pkl \
    && chown -R app:app /app/built_models /app/models

USER app
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=10 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3).read()" || exit 1

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]


FROM runtime AS trainer

USER root
COPY requirements-offline.lock ./requirements-offline.lock
RUN python -m pip install --require-hashes --only-binary=:all: -r requirements-offline.lock \
    && python -m pip check

ENV AI_TFIDF_STATE_PATH=/app/models/tfidf/df_state.sqlite \
    AI_TFIDF_MODEL_PATH=/app/models/tfidf/tfidf_model.pkl

USER app
ENTRYPOINT ["python", "-m", "offline.train_tfidf_incremental"]
CMD ["--keep-bootstrap"]
