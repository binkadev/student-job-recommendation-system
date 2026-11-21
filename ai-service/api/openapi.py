"""OpenAPI schema helpers for custom multipart and bounded-JSON routes."""

from __future__ import annotations

from collections.abc import Mapping
from copy import deepcopy
from typing import Any

from schemas.candidate_ranking import CandidateRankingRequest


CV_MULTIPART_OPENAPI: dict[str, Any] = {
    "requestBody": {
        "required": True,
        "content": {
            "multipart/form-data": {
                "schema": {
                    "type": "object",
                    "required": ["file"],
                    "properties": {
                        "file": {
                            "type": "string",
                            "format": "binary",
                        }
                    },
                }
            }
        },
    }
}


def dereference_json_schema(schema: Mapping[str, Any]) -> dict[str, Any]:
    """Inline generated local definitions without mutating the source schema."""

    copied_schema = deepcopy(schema)
    definitions = copied_schema.pop("$defs", {})
    if not isinstance(definitions, Mapping):
        raise RuntimeError("Generated JSON schema has invalid $defs")

    def resolve(value: Any, resolving: frozenset[str] = frozenset()) -> Any:
        if isinstance(value, dict):
            reference = value.get("$ref")
            if isinstance(reference, str) and reference.startswith("#/$defs/"):
                encoded_name = reference.removeprefix("#/$defs/")
                definition_name = encoded_name.replace("~1", "/").replace(
                    "~0", "~"
                )
                if definition_name not in definitions:
                    raise RuntimeError(
                        "Generated JSON schema references missing "
                        f"definition: {reference}"
                    )
                if definition_name in resolving:
                    raise RuntimeError(
                        "Generated JSON schema contains recursive "
                        f"definition: {reference}"
                    )
                replacement = deepcopy(definitions[definition_name])
                siblings = {
                    key: item for key, item in value.items() if key != "$ref"
                }
                replacement.update(siblings)
                return resolve(replacement, resolving | {definition_name})
            return {key: resolve(item, resolving) for key, item in value.items()}
        if isinstance(value, list):
            return [resolve(item, resolving) for item in value]
        return value

    resolved_schema = resolve(copied_schema)
    if not isinstance(resolved_schema, dict):
        raise RuntimeError("Generated JSON schema root is not an object")
    return resolved_schema


CANDIDATE_RANKING_OPENAPI: dict[str, Any] = {
    "requestBody": {
        "required": True,
        "content": {
            "application/json": {
                "schema": dereference_json_schema(
                    CandidateRankingRequest.model_json_schema()
                ),
            }
        },
    }
}
