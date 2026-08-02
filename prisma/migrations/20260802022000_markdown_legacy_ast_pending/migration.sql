-- Repair the historical A migration without rewriting its deployed history.
-- SQL cannot run the TypeScript/CommonMark parser, therefore its placeholder
-- AST must never be exposed as a validated JANVIER document.

UPDATE "ProposalMarkdownSource"
SET
    "parseStatus" = 'PENDING_VALIDATION',
    "parseWarnings" = jsonb_build_array(
        jsonb_build_object(
            'code', 'LEGACY_BACKFILL_PENDING',
            'column', 1,
            'line', 1,
            'message', 'La fuente histórica requiere validación con el parser JANVIER.',
            'severity', 'INFO'
        )
    ),
    "normalizedAst" = NULL
WHERE
    "parserVersion" = 'legacy-generated-v1'
    AND (
        "normalizedAst" IS NULL
        OR (
            "normalizedAst"->>'version' = 'legacy-generated-v1'
            AND jsonb_typeof("normalizedAst"->'blocks') = 'array'
            AND jsonb_array_length("normalizedAst"->'blocks') = 0
        )
    );
