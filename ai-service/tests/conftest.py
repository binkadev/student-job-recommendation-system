"""Shared test-only environment configuration loaded before test imports."""

import os


TEST_INTERNAL_API_KEY = "test-ai-internal-api-key-at-least-32-characters"

os.environ["AI_INTERNAL_API_KEY"] = TEST_INTERNAL_API_KEY
