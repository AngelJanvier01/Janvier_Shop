# Proposal Studio — A.1: legacy validation closure

This closure hardens Hito A without opening the import interface. Its purpose
is simple: no historic source receives `VALID` from migration SQL before the
JANVIER parser has examined it.

## Post-migration repair

The original A migration remains untouched because it is already committed and
may be deployed. Two additive migrations add `PENDING_VALIDATION` and replace
the provisional `legacy-generated-v1` AST with `NULL` plus an informational
diagnostic. The idempotent task
[backfill-markdown-ast.ts](../scripts/proposals/backfill-markdown-ast.ts) runs
after `prisma migrate deploy`:

```text
npm run proposals:backfill-markdown
npm run proposals:backfill-markdown -- --dry-run
```

It considers only `legacy-generated-v1` sources with a null or SQL-provisional
AST. For each one it recomputes SHA-256, calls `parseJanvierMarkdown`, and—only
if the historical hash matches—updates exactly `parseStatus`, `parseWarnings`,
`normalizedAst`, `parserVersion`, and `lastParsedAt`.

It never changes `Proposal.status`, `ProposalRevision.lockedAt`, invites,
decisions, acceptances, or historical acceptance hashes. Historical HTML and
unsafe links are recorded as `ERROR`, never `VALID`. An inconsistent hash is
left untouched, included in the report, and makes the command return a non-zero
exit code. Rerunning the task skips already repaired sources and does not create
checkpoints or duplicate data.

`db:bootstrap` and the Docker `migrate` service now run this task between
`prisma migrate deploy` and seed creation.

## Security boundary

`toSafeNode` transforms MDAST into a recursive, strict Zod-validated
`JanvierDocument`. That document is the sole AST allowed to persist or render.
Raw HTML, unsupported nodes, unsafe URLs, and unknown directive attributes
produce `ERROR` and do not survive the safe AST.

`assertAstCanBeSafelyRendered` performs an extra HAST conversion with
`rehype-sanitize`; it is a secondary safety assertion and is not the persisted
object. `assertMarkdownCanPersist` is the write boundary for Hito B: it rejects
every `ERROR` result and JSON which fails the strict schema. No path uses
`dangerouslySetInnerHTML`.

## Upload metadata boundary

The parser validates bytes and document content, not browser-provided metadata.
`validateMarkdownUploadMetadata` is an application-layer helper ready for the
Hito B endpoint. It accepts `.md` / `.markdown` (case-insensitive),
`text/markdown`, `text/x-markdown`, or browser-standard `text/plain`, safe file
names and at most 1 MiB. It rejects double extensions, paths, inconsistent MIME
types, and invalid declared sizes.

## Covered contracts

Unit tests cover valid and invalid contracts for `janvier-callout`,
`janvier-metrics` (1–12 pairs), `janvier-decision`, `janvier-ascii`,
`janvier-page-break`, and `janvier-internal`, including forbidden attributes and
nested directives. They also cover historical HTML, `javascript:` URLs,
injected AST properties, provisional ASTs, and source-hash mismatches.

## Isolated database evidence

A temporary PostgreSQL database received all eight migrations and four
`legacy-generated-v1` sources. The first task run produced the following
result; the expected non-zero exit came only from the deliberately altered hash.

| Fixture            | Stored hash | Parser status                            | Write result                                     |
| ------------------ | ----------- | ---------------------------------------- | ------------------------------------------------ |
| Safe Markdown      | matches     | `VALID`                                  | AST, diagnostics, version and parse time updated |
| Historic raw HTML  | matches     | `ERROR`                                  | persisted as `ERROR`, never `VALID`              |
| `javascript:` link | matches     | `ERROR`                                  | persisted as `ERROR`, never `VALID`              |
| Altered SHA-256    | mismatch    | parser result calculated but not trusted | untouched; command exits non-zero                |

After correcting only the test hash, one subsequent run repaired that final
fixture. A final `--dry-run` reported `legacySources: 0`, `pendingSources: 0`,
and no writes. The temporary database was then dropped; no user data was used.
