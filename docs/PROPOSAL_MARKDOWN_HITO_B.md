# Proposal Studio — Hito B: import and persist Markdown drafts

**Commit target:** `feat(proposals): import and persist markdown drafts`
**Scope:** administrative DRAFT workflow only. Project Room continues to use its
existing hardened snapshot and receives no Markdown renderer in this milestone.

## Delivered flow

1. An editor can paste Markdown or choose a `.md` / `.markdown` file.
2. The server validates file metadata separately from document bytes, then
   parses a candidate without writing a source, section, checkpoint, or event.
3. The candidate shows localizable diagnostics and a text-only preview made
   from the safe JANVIER AST.
4. Explicit confirmation reparses the exact source on the server, rejects
   `ERROR` documents, and writes the source, derived sections, checkpoint and
   audit event in one transaction.
5. Later edits auto-save after a 1.2 second debounce only while the revision is
   a DRAFT. Session storage protects unsaved local text, and the original source
   can be downloaded from the browser.

No raw HTML renderer, private assets, economic data model, Project Room
Markdown, variables frozen at sharing, dual hashes, PDF, CRM, or payments are
introduced here.

## Concurrency and synchronization

Every write receives both the current `expectedSourceHash` and `expectedVersion`.
`ProposalMarkdownSource.updateMany` matches both values and increments version
atomically. A stale browser receives a conflict instead of replacing another
editor's source.

The transaction synchronizes `ProposalSection` by `(revisionId, sourceId)`:

- matching source IDs retain their relational identity and update content, AST,
  range, title, type, inclusion and internal marker;
- new source IDs create new sections;
- absent IDs become `removedAt` / excluded rather than being deleted;
- positions are shifted before replacement to preserve the unique order index.

The first confirmed source creates an `IMPORT` checkpoint. Subsequent explicit
imports use `REIMPORT_REPLACE`; autosaves use `MANUAL_SAVE`. Each new editable
revision clones source bytes and references with a single `REVISION_CLONED`
checkpoint, never the source revision's history.

## Safety boundary

`validateMarkdownUploadMetadata` checks file name, extension, MIME, and
declared size. `parseJanvierMarkdown` validates bytes and content. Before a
transaction, `assertMarkdownCanPersist` rejects every parser `ERROR` and any
AST that fails the strict JANVIER schema. The text preview reads that safe AST;
it never renders user HTML.

## Production evidence

The end-to-end test `proposal-markdown-draft.spec.ts` uses a real PostgreSQL
fixture and authenticated admin browser. It proves candidate analysis leaves no
source behind, confirmation writes `VALID` source + `IMPORT` checkpoint,
sections synchronize to `context`/`scope`, download returns
`pasted-markdown.md`, session storage restores a pending draft, and the debounce
updates source version from 1 to 2.
