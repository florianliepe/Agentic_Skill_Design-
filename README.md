# Skill Design Studio

A focused Eraneos-style workbench for role profiles, emerging skills and qualitative department capability assessment. Static Next.js export for GitHub Pages. No PMO or project management surface.

## Feedback refinement release

Personal password access with email-code setup/reset, six connected specialist functions, parameter-driven trend research, upskilling formats, contextual support, searchable role selection, profile/JRD comparison and readable result review are described in [Feedback refinement](docs/FEEDBACK_REFINEMENT.md). The new public login uses its own n8n sign-in workflow and server-verified workspace membership. No internal source content is bundled.

## Search, bulk import and scoped skill intelligence

Searchable cases, reversible archives, validated CSV/XLSX import with agent-assisted mapping, a five-skill research evidence gate and role/business-area heatmaps are specified in [Import and radar design](docs/IMPORT_RADAR_DESIGN.md).

## AI skills and role evolution

The AI topic lens preserves primary categories and supports explained contextual/secondary annotations. Role evolution compares saved JRD profiles with sourced emerging skills, scenario assumptions and interactive own-anchor targets, then saves a separate future draft. See [AI role evolution and workflow audit](docs/AI_ROLE_EVOLUTION.md).

## Initial release status

The protected n8n workspace and asynchronous mapping worker were deployed and tested on 23 November 2026. The workspace contains 1,012 source concepts (974 skills and 38 competencies) and 825 global roles behind header authentication. The mapping worker calls the Eraneos gateway and returns evidence-bound drafts for SME review. Enable the frontend with `NEXT_PUBLIC_SBO_ENABLED=true` only after the live acceptance checks below pass. The synthetic example remains available; its edits last only for the current browser tab.

Implemented: case intake, canonical concept search and own-anchor detail, evidence-linked core/depth profiles, three-horizon signal radar, gap heatmap, separate catalogue/profile/proficiency/coverage statuses, qualitative SME baseline, proposed development formats, contribution review, explicit saves, draft-preserving API errors, versioned assessment export. The synthetic example also supports individual self-assessments and reviewer assessments as separate evidence records. Real individual records are blocked in the shared-access API until verified subject-level access is connected; no automatic employee ranking or averaging is performed.

The command reducer, idempotent retries and atomic concurrent-write protection have passed live checks (one concurrent save succeeds; the other receives HTTP 409). Unauthorised data reads and shared-access approvals are rejected. The live mapping worker validates canonical identities and exact JRD evidence before making a result available. The refinement connects curated-source trend research, upskilling and support. Formal named-role approvals, scheduled business review and a release publisher remain separate integrations. Real individual records still require subject-level identity.

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

`output: export` is intentional. GitHub Pages cannot host Next.js API routes. The browser calls a separately authenticated workspace API through `src/lib/sbo-client.ts`. Personal session tokens use sessionStorage for tab-scoped reload recovery and are revoked on logout. Internal workspaces and evidence are not stored in browser storage. The legacy header credential remains a technical migration endpoint until personal-access publication is verified.

## Data boundary

Only synthetic examples are bundled. Internal CSV/XLSX files must remain outside this repository. `scripts/import-sbo-sources.py` is a read-only adapter, requiring Python with openpyxl; it writes to the gitignored `.local/source-workspace.json`. It preserves canonical identities, source positions and source status, and does not grant approval. Never place this output in `public`, `src`, Git or a Pages artifact.

The public-bundle verifier checks credential patterns and, when the private local snapshot is present, compares definitions, anchors and JRD purpose text against the build. The CI build has no private source material.

## Integration

1. Verify access to the existing n8n instance. Do not reuse or modify frozen campaigns or production workflows.
2. Provision an isolated workspace data table with `workspace` (string), `revision` (number), `payload` (string), one row `main`. Import the private snapshot only into the authorised protected service. Confirm size limits and backup/restore.
3. Generate `n8n/sbo-workspace-api.template.json`; replace the table and existing header-auth credential placeholders. The credential must validate `x-n8n-webhook-secret`. Do not commit resolved credentials or private seed data.
4. Test unauthorised reads, allowed-origin CORS/preflight, two concurrent writes, identical-request retry after dropped response, invalid input and source immutability. Activate only the isolated workflow after those checks.
5. Verify the asynchronous worker template using `n8n/sbo-agent.mjs`: atomic queued-to-running claim, bounded gateway call, output validation, reread and CAS completion, no completion after interruption. Model timeout is 120 seconds, workflow timeout 180 seconds and claim lease 240 seconds. Expired running leases become timed_out; retries create new run IDs. A completion CAS conflict currently discards the uncommitted proposal and eventually times out the lease; result-artifact recovery remains an explicit follow-up. The refinement uses direct, allowlisted substantive source retrieval and exact quotation validation. It does not claim unrestricted internet search.
6. Enable agent capabilities only after worker acceptance. Enable the frontend connection with repository variables `NEXT_PUBLIC_SBO_API_URL` and `NEXT_PUBLIC_SBO_ENABLED=true` after smoke testing.
7. Connect verified identities before implementing actual approval/publishing commands and person-level storage. Confirmed governance: HR BP validates, Business Lead releases profiles, CoE approves catalogue changes. JRD changes remain subject to approval. Shared pilot access cannot approve.

## Contracts

POST request: `{contractVersion:'sbo.case.v1',command,requestId,idempotencyKey,expectedVersion,payload}`. Mutations require an exact workspace revision and stable idempotency key. Same-key/same-payload retries do not create a second version; changed payloads with a used key are rejected. HTTP 409 preserves the local draft for comparison. Successful changes invalidate prior decisions.

Case operations: `sbo.case.save`, `sbo.contribution.submit`, `sbo.contribution.resolve`, `sbo.change.submit`, `sbo.review.trigger`. Reads: `sbo.workspace.read`, `sbo.run.status`, `sbo.run.result`, `sbo.tna.export`. Run commands: `sbo.profile.draft.start`, `sbo.trend.scan.start`, `sbo.run.interrupt`, `sbo.run.adopt`. Agent starts fail closed until a runtime capability is enabled. CoE/business decisions and publication return 403 in this release.

Execution status, output quality and business state are distinct. Structural canonical/source validation does not establish semantic correctness: an SME must review each mapping rationale. Unknown proficiency or non-comparable context remains unknown. Coverage and proficiency are assessed independently. Priorities use the documented qualitative relevance/severity matrix in `sbo-rules.mjs`; no fake decimal precision is produced.

## Provenance

The predecessor pilot was analysed read-only at commit `cb5acfff772ee22cb17495aadcd324d7df732537`. This checkout evolves its static-export deployment pattern and guided skill-design approach with new case-centric components and contracts. PMO components, legacy sync scripts and historical campaign data are not shipped. The predecessor and its uncommitted changes remain untouched.

The worker uses n8n's [Basic LLM Chain](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.chainllm/) with a separate system message, and the [OpenAI-compatible Chat Model](https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.lmchatopenai/) node's timeout and retry controls. Live acceptance uses claude-sonnet-5 with temperature 1, an explicit Chat Completions configuration (`responsesApiEnabled:false`) and a 16,000-token output budget. The initial temperature-0 call was rejected and earlier responses were incomplete; failures were retained as failures, never adopted. One complete JSON code fence is accepted as a transport wrapper, while truncated JSON and surrounding prose remain invalid. Canonical names, IDs, hashes and exact source quotations are still checked. A structurally valid result is a draft, not business acceptance.

## Repeatable live verification

Use the gitignored `.local/deployment.json` for isolated resource references and `.local/source-workspace.json` for the protected source snapshot. Credentials are read from the user home `.codex/secrets/agentic-skill-design` directory and are never printed or bundled. The worker reuses existing server-side credentials without changing other workflows; the newly saved gateway key was separately verified by a direct model call.

- `node scripts/smoke-sbo-live.mjs`: creates an explicitly labelled technical case and checks access denial, CORS, source counts, idempotency, concurrent saves and approval denial.
- `node scripts/start-sbo-live-run.mjs`: starts a real mapping run for that case.
- After success, `node scripts/smoke-sbo-lifecycle.mjs`: verifies source immutability, draft adoption, interruption and a new retry run.

These checks consume model tokens and mutate only the labelled technical test case. They do not grant profile or catalogue approval. Diagnostic execution saving is normally disabled on the worker; private troubleshooting snapshots stay outside Git.
