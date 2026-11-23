# Skill Design Studio feedback refinement

23 November 2026. This release addresses the supplied usability screenshots and the missing trend, support and upskilling paths. The public frontend contains no internal catalogue or JRD content.

## User decisions

Personal email-code sign-in follows the Pandora pattern. The support assistant may explain and navigate, and may propose allowlisted analyses or limited draft edits that the user explicitly confirms. Sign-in does not grant CoE approval or enable a release publisher. Initially the existing pilot owner has personal SME membership; other users need explicit membership before codes are delivered.

## Findings incorporated

Korn Ferry Profile Manager connects reusable role definitions with skill reports, comparisons and development decisions. Its public documentation specifically describes side-by-side role comparison and evaluating skill availability, trainability and value. This informed the role/JRD comparison, explicit applicability and upskilling-complexity estimates, and development-format proposals. These are organisation-authored product features. No inaccessible licensed benchmarks, psychometric norms or proprietary scoring are represented as available data. [Profile Manager](https://www.kornferry.com/capabilities/talent-suite/talent-management-software)

Korn Ferry's Success Profiles connect work analysis and market evidence to future requirements. This informed the explicit analysis scope and the traceable source → task change → skill proposal sequence. A role's target level and an organisation's assessed capability remain different records. [Success Profiles](https://www.kornferry.com/capabilities/talent-suite/success-profiles)

The Pandora reference was inspected in the browser and its repository implementation examined read-only. Skill Studio reuses the email-code approach and the existing authorised Outlook sender credential through a separate mail workflow. It does not reuse Pandora sessions, data or project access. The AI Vision Studio reference informed contextual read-only explanations, draft protection and suggestions applied explicitly by the user.

## Delivered functions

- Searchable global-role and skill pickers with keyboard selection and bounded result lists.
- Role library with family filters, source JRD inspection and pagination; up to three saved case profiles/JRDs compared side by side.
- Profile overview with categories, own target/current anchors, demand status estimates, change strip and radar points. Unknown levels are omitted from the chart and retained in the equivalent table. Levels are ordinal, not percentages.
- Parameter-driven trend analysis: business field, market, process, technology, research question, horizon and curated source selection; radar, table and gap heatmap views.
- Source-bound findings with applicability, expected work changes, qualitative upskilling complexity and preserved limitations. Retrieval dates are not publication dates.
- Readable run review for profile requirements, trend signals and development formats. Raw JSON is no longer the review experience.
- Catalogue cluster search and create/revise/retire proposals. Source concepts remain unchanged until catalogue governance; no hard deletion of referenced skills.
- Upskilling specialist producing distinct proposed formats, prerequisites, ownership and observable success criteria without invented courses, providers or availability.
- Contextual support across views, keyboard/click/hover help and a step guide. Model-suggested actions are allowlisted and explicitly confirmed.
- Personal session login, code expiry/reuse protection, rate limits, session expiry/revocation and server-side member/role checks. Session token is scoped to this tab's sessionStorage; internal workspaces are not persisted there.
- Three-way recovery for genuine case conflicts; a changed workspace revision caused by another case or worker is retried against the latest revision without overwriting a changed case.

## Runtime inventory

Before this release only the role-mapping specialist was enabled. There are now four specialist functions in one n8n worker: role mapping, trend/emerging skills, upskilling/formats and support. A deterministic workflow orchestrator selects the appropriate prompt and validation contract. Model-generated actions cannot bypass this control plane.

Templates: `n8n/sbo-workspace-api.template.json`, `n8n/sbo-mapping-worker.template.json`, `n8n/sbo-personal-access.template.json`, `n8n/sbo-personal-workspace.template.json`. Prompts and validators: `n8n/sbo-agent.mjs`, `n8n/sbo-specialists.mjs`, `n8n/sbo-auth.mjs`. Build with `npm run workflow:build`; deployment is an explicit operation, not a frontend build side effect.

The trend worker fetches the selected curated sources directly using n8n HTTP Request nodes. It does not claim to be an unrestricted search engine. Unreachable sources produce `partial_sources`; no retrievable sources cannot become a successful empty scan. New capabilities are catalogue candidates, not invented canonical IDs. Proposed target-role changes still require SME/JRD review.

## Verification and remaining boundaries

Local tests cover OTP expiry/reuse/rate limits, session revocation, viewer write rejection, immutable catalogue references, three-way recovery, exact source binding, horizon constraints and upskilling proposals. Existing mapping and governance tests remain active. Type checking, lint and production export/public-bundle scanning are required before publication.

Live integration tests created explicitly labelled technical cases and exercised the actual worker. The final trend test returned four source-bound proposals with partial source coverage after navigation and banner text were excluded. The upskilling test returned four format proposals. The support test returned a contextual answer. These are technical acceptance observations, not SME validation of those findings. Private run references and diagnostics are retained only under `.local`.

Named sign-in is operational; actual business/CoE publishing remains deliberately unavailable until the governed release path is connected. Broader unrestricted search, real course availability, psychometric assessments and automatic scheduling are not inferred from the new UI.

Browser acceptance verified personal code sign-in, session restoration, saving through verified identity, a real HTTP 409 three-way recovery, searchable role selection, readable evidence review, cluster filtering, catalogue proposal editing, trend parameters and contextual guidance. All 31 tests, lint, type checking and the static production export/public-bundle scan passed. The shared-header public API is retired after the personal frontend release; the callable private workspace workflow remains available only to the personal gateway. Maintenance verification can use `SBO_SESSION_TOKEN` with a valid personal session.
