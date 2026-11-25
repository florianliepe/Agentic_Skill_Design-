# Search, bulk import and scoped skill intelligence

## Agreed behaviour

The Overview selector chooses working cases, not source job roles. Search matches title, source role, department and SME. Business/test and department filters separate technical verification from business work. The Owner can archive/restore cases and bulk-archive matching technical cases. Active analyses block archiving. Archived evidence and history remain retained. Imported roles have a separate reversible archive; the global source role library cannot be archived or deleted by these commands.

## Import contract

Owner-only CSV and XLSX import follows: local parse → header mapping → validation preview → explicit confirmation → staged upload → atomic commit. Other roles cannot forge this permission through a payload. Source definitions are never overwritten.

- Limits: 5 MB file, 2,000 records, 100 unique nonempty headers, 3 MB extracted text; XLSX expansion limited to 25 MB. Formula workbooks must first be exported as values. CSV retains string identifiers and supports quoted/multiline values and detected delimiters. XLSX worksheet selection is available for multiple sheets.
- `sbo.import.mapping.start` sends headers and a shortened sample to the existing Eraneos gateway. Its real LLM specialist can select only supplied headers or leave a field unmapped. Confidence and reasoning remain reviewable. Exact header aliases are a separate local initial suggestion, never represented as an agent result.
- Skills require name, definition and Technical/Functional/Behavioural category (source value or explicitly selected default). Optional fields: family, group, external identifier and four own proficiency anchors. Missing anchors remain unknown. Partial anchors block import.
- Roles require title and purpose. Knowledge, problem solving, accountability, family, group and external identifier are optional.
- Preview reports new records, identical duplicates, conflicts and missing anchors. Equal names with different meaning, taxonomy or anchors block the whole commit. External identifiers never become internal canonical IDs.
- Sequential chunks (`sbo.import.stage`) are resumable and isolated from the catalogue. `sbo.import.commit` revalidates all rows against the latest state and appends draft records atomically with namespaced IDs, source filename, batch and logical record number. It returns refreshed catalogue data even to a compact client. Staged raw rows can be discarded; committed provenance remains.
- Uploaded drafts do not confer business/CoE approval, alter the global JRD or establish organisational proficiency.

## Research method and evidence gate

The analysis follows signal → changed work/task → distinct capability → target-specific applicability → development action. This adapts [OECD strategic foresight](https://www.oecd.org/en/about/programmes/strategic-foresight.html) and [UNDP horizon scanning / STEEP](https://www.undp.org/future-development/foresight-cpd-toolkit/chapter-1/chapter-1/chapter-1/horizon-scanning). Legal is an explicit additional driver. [WEF's skills outlook](https://www.weforum.org/publications/the-future-of-jobs-report-2025/3-skills-outlook/) supplies external context; [NIST AI RMF](https://airc.nist.gov/airmf-resources/airmf/) supports AI risk and accountability capabilities. Macro forecasts are context, not measured company benchmarks.

Parameters include business field, market, process/value stream, innovation focus, research question, horizon, up to six actual role IDs and six business areas. Eight curated source endpoints are allowlisted. The model cannot inject arbitrary retrieval URLs. Live fetches can use recent matching cached public evidence; retrieval date is not publication date. Unreachable sources remain unavailable.

Each recommendation links exactly one existing candidate skill or one genuinely uncovered proposed skill, and includes category, STEEP+Legal driver, changed task, human accountability, emergence/business effect, relevance, impact, urgency, evidential confidence, upskilling complexity with reason, next action and source evidence. Relevance/impact are separately estimated for every supplied target; unknown/non-applicable values are null. Source observations and inferred task impacts are distinguished. Proposed new skills remain separate from the catalogue.

At least five distinct source-backed capabilities are required. Repeated observations about one capability do not increase the count. Under five produces `incomplete_evidence` / run status `incomplete`, retains substantiated findings for inspection and blocks adoption. If enabled, one additional pass over unused curated sources may fill the gap. No invented fillers or hypothesis substitution. Quotes must match supplied source text; public excerpts are limited to 25 words per source/run with hashes and source links retained for verification.

An automated evidence/identity/schema gate does not establish semantic quality. SMEs must validate novelty, relevance, differentiation and task inference. Business/HRBP decisions and CoE release remain separate; research cannot approve a JRD change.

## Workflow and performance

One controlled n8n orchestrator routes five specialist functions: role mapping, trend research, upskilling, contextual support and import column mapping. These are prompts on shared model infrastructure, not five always-running autonomous agents. Support has an independent lane. Import mapping uses the existing bounded gateway route; no model key reaches the frontend.

Trend research has at most primary + transient fallback + one evidence expansion call. Trend attempts use a compact response and low reasoning route with a 75-second ceiling; other model attempts retain a 45-second bound, source requests 10 seconds, overall worker 360 seconds, trend lease ten minutes. Permanent authentication failures and invalid outputs do not trigger retry loops. Completion and imports use revision compare-and-swap and idempotency receipts. Raw import samples are removed from public run responses; staged rows are removed from public batch summaries.

The portfolio heatmap indexes requirements and scoped findings once per immutable workspace revision, pages 35 skills and shows up to eight comparison columns. Catalogue payloads remain cached across compact status responses; only import commit forces catalogue refresh. Excel dependencies are dynamically loaded.

## Frontend intelligence

The reference AI Vision Studio informed three views: catalogue assessment, skill heatmap and skill profiles. The Studio reuses its own source definitions, scale anchors and evidence model rather than copying reference ratings.

- Radar: driver/horizon rings, priority map, scope-specific matrix and detailed recommendations; filters by category, driver, action priority and horizon. Scores can be reviewed as draft SME edits.
- Portfolio heatmap: skills × roles or business areas, with separate current/target/gap/coverage/relevance/impact/urgency/confidence metrics. Cell details expose tasks, sources, own anchors and assessment context.
- `Unknown` means no comparable evidence; `Not mapped` means no relationship for this scope. `Partial` and `Mixed` expose incomplete/conflicting contexts. Values are never silently averaged or converted to zero. Future impact is not a measured proficiency gap.
- Catalogue assessment shows definition provenance, own-anchor completeness and profile coverage. Skill profiles reuse side-by-side source/profile comparison and profile visualisation.

## Acceptance evidence

Automated tests cover atomic/resumable import, conflicting/identical concepts, missing anchors, immutable sources, Owner-only lifecycle, active-run archive protection, actual file parsing, formula/archive limits, exact-header agent mapping, five-skill evidence gating and scope/score/source validation. Local browser checks exercise CSV/XLSX previews, manual mapping, formula rejection, evidence cell details and radar parameters. Live deployment acceptance must additionally record gateway mapping output, a scoped research result and archive/restore behaviour without changing the business case's baseline or source library.
