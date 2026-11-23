# Skill Design Studio

A focused Eraneos-style workbench for role profiles, emerging skills and qualitative department capability assessment. Static Next.js export for GitHub Pages. No PMO or project management surface.

## Release status

Version 0.2 is an interactive frontend preview with a synthetic example. The protected n8n workspace and LLM gateway are **not deployed or verified**. Login stays disabled until `NEXT_PUBLIC_SBO_ENABLED=true` is explicitly set after integration tests. Example edits last only for the current browser tab.

Implemented: case intake, canonical concept search and own-anchor detail, evidence-linked core/depth profiles, three-horizon signal radar, gap heatmap, separate catalogue/profile/proficiency/coverage statuses, qualitative SME baseline, proposed development formats, contribution review, explicit saves, draft-preserving API errors, versioned assessment export.

Backend code includes a tested command reducer, idempotency receipts, revision checks, run state/adoption guards, canonical-output validation and an inactive n8n workspace API template. Its atomic storage behavior still requires a live concurrent-writer test. No live AI worker, search-provider integration, named-role approvals, scheduled review or release publisher is included in this release.

## Local development

Use Node 22 and npm:

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run workflow:build
npm run build
```

`output: export` is intentional. GitHub Pages cannot host Next.js API routes. The browser calls a separately authenticated workspace API through `src/lib/sbo-client.ts`. Team access remains in memory; neither credentials nor internal workspaces use browser localStorage.

## Data boundary

Only synthetic examples are bundled. Internal CSV/XLSX files must remain outside this repository. `scripts/import-sbo-sources.py` is a read-only adapter, requiring Python with openpyxl; it writes to the gitignored `.local/source-workspace.json`. It preserves canonical identities, source positions and source status, and does not grant approval. Never place this output in `public`, `src`, Git or a Pages artifact.

The public-bundle verifier checks credential patterns and, when the private local snapshot is present, compares definitions, anchors and JRD purpose text against the build. The CI build has no private source material.

## Integration

1. Verify access to the existing n8n instance. Do not reuse or modify frozen campaigns or production workflows.
2. Provision an isolated workspace data table with `workspace` (string), `revision` (number), `payload` (string), one row `main`. Import the private snapshot only into the authorised protected service. Confirm size limits and backup/restore.
3. Generate `n8n/sbo-workspace-api.template.json`; replace the table and existing header-auth credential placeholders. The credential must validate `x-n8n-webhook-secret`. Do not commit resolved credentials or private seed data.
4. Test unauthorised reads, allowed-origin CORS/preflight, two concurrent writes, identical-request retry after dropped response, invalid input and source immutability. Activate only the isolated workflow after those checks.
5. Implement/verify an asynchronous worker using `n8n/sbo-agent.mjs`: atomic queued-to-running claim, bounded gateway call, output validation, reread and CAS completion, no completion after interruption. Expired running leases become timed_out; retries create new run IDs. Trend research additionally needs a verified evidence-search provider and source validation.
6. Enable agent capabilities only after worker acceptance. Enable the frontend connection with repository variables `NEXT_PUBLIC_SBO_API_URL` and `NEXT_PUBLIC_SBO_ENABLED=true` after smoke testing.
7. Connect verified identities and confirm the governance policy before implementing actual approval/publishing commands. Shared pilot access cannot approve.

## Contracts

POST request: `{contractVersion:'sbo.case.v1',command,requestId,idempotencyKey,expectedVersion,payload}`. Mutations require an exact workspace revision and stable idempotency key. Same-key/same-payload retries do not create a second version; changed payloads with a used key are rejected. HTTP 409 preserves the local draft for comparison. Successful changes invalidate prior decisions.

Case operations: `sbo.case.save`, `sbo.contribution.submit`, `sbo.contribution.resolve`, `sbo.change.submit`, `sbo.review.trigger`. Reads: `sbo.workspace.read`, `sbo.run.status`, `sbo.run.result`, `sbo.tna.export`. Run commands: `sbo.profile.draft.start`, `sbo.trend.scan.start`, `sbo.run.interrupt`, `sbo.run.adopt`. Agent starts fail closed until a runtime capability is enabled. CoE/business decisions and publication return 403 in this release.

Execution status, output quality and business state are distinct. Structural canonical/source validation does not establish semantic correctness: an SME must review each mapping rationale. Unknown proficiency or non-comparable context remains unknown. Coverage and proficiency are assessed independently. Priorities use the documented qualitative relevance/severity matrix in `sbo-rules.mjs`; no fake decimal precision is produced.

## Provenance

The predecessor pilot was analysed read-only at commit `cb5acfff772ee22cb17495aadcd324d7df732537`. This checkout evolves its static-export deployment pattern and guided skill-design approach with new case-centric components and contracts. PMO components, legacy sync scripts and historical campaign data are not shipped. The predecessor and its uncommitted changes remain untouched.
