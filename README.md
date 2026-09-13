# Clarity — Health Evidence Platform

React + Vite frontend for interventions, biomarkers, diagnostics, screening,
and selected precision-medicine contexts. The homepage is an independent,
domain-oriented entry point; the intervention catalog lives at `/research`.

## Run locally

Start the API in `clarity-engine`:

```sh
python3 -m flask --app app run --host 127.0.0.1 --port 8000
```

Then in `clarity-web`:

```sh
npm install
npm run dev
```

Vite proxies `/api` to the local engine. It uses real cached compound profiles;
it does not fabricate missing research. `VITE_API_BASE_URL` overrides the API
origin; production builds default to the existing Render API. Configuration is
centralized in `src/platform/api.js`.

## Profile framework

`src/platform/` contains the homepage, common profile brief, source-layer adapter,
comparison view, and platform methodology. Peptides are one intervention category;
there are no supplier purchase links on evidence profiles.

Profiles expose evidence maturity, generation and monitoring status, five evidence
layers, outcome-specific findings, uncertainty, and a searchable source list.
Protocols, syntheses, and unknown population records are kept distinct from
completed human trials. Source excerpts can be truncated and are labeled as such.
Compound profiles lead with an outcome analysis workbench. Core analysis and molecular context are visible sections, not a collapsed legacy report.

`/explore/compare` compares any two available catalog entities or cached compounds.
Each keeps its own assessment framework. General domain links are discovery links,
not evidence of clinical relationships. Existing curated entity links remain.

The local profile classifier identifies protocols in cached records; the engine
now excludes them from future primary-evidence grading. Cached grades have not
been silently recomputed. Affected profiles explicitly flag the need for refresh.

## Deploy it as a public site

    npm run build          # outputs static files to dist/

Then deploy dist/ as a Static Site on Render (New > Static Site), or drag it
into Vercel / Netlify. Set the publish directory to `dist` and the build
command to `npm run build`.

## Health evidence expansion (beta)

New routes: `/explore`, `/biomarkers`, `/diagnostics`, `/screening`, `/tests`,
`/conditions`, `/precision-medicine`, and `/explore/visualizations`. Profile URLs
append the entity ID, for example `/biomarkers/apob`. The homepage links to each domain; existing compound URLs remain `/compound/:slug`.

The new section is lazy-loaded and styled within `.ev`. It includes a searchable
18-profile catalog, type-specific evidence pages, local diagnostic and screening
calculators, source-linked oncology relationships, and nine scientific figure
renderers. Teaching data is explicitly labeled and separated from sourced figures.
New editorial content is English; existing English/Spanish compound pages remain
available. Filters cover the populated conditions, rather than claiming coverage
for clinical areas that do not yet have records.

`src/evidence/catalog.json` is a bundled, versioned export from the separate engine
repository. No live API or secret is required for the new pages. See
`../clarity-engine/evidence/README.md` for schema, review, export, and API details.
The production frontend continues to use `VITE_API_BASE_URL` for existing compound
research. Export again whenever the engine catalog changes.

Verification:

```sh
npm run build
node --test src/evidence/*.test.js src/platform/*.test.js
```

Deployment: build and publish `dist/`. Netlify's `_redirects` and Vercel's rewrite
configuration are included for direct SPA links. On Render Static Sites, configure
a rewrite from `/*` to `/index.html` with action **Rewrite**. The engine has its own
deployment and initializes living-research storage separately. These changes have not been
published to clarityevidence.com.

Scientific publication requires completed source-backed appraisals. The initial
profiles are reference summaries with explicitly unassessed dimensions; the
calculators are not published test estimates or individualized recommendations.

## Study interpretation and complete inventory

The engine adds `analysis` to compound API responses. `OutcomeAnalysis.jsx` uses
reported study-level estimates, native measures and units, source passages,
interval interpretation, missingness, and a study contribution matrix. It does
not reuse the old unreviewed explanatory/appraisal prose. Confidence and credible
intervals stay distinct; derived intervals and unsupported numerical extractions
are withheld with their reasons. Ratios use log axes. Mobile estimates use a
separate readable layout.

The complete stored inventory is available at `/explore`; `/research` opens the
same library filtered to interventions. Search, domain, category, and review
filters are shareable in the URL. Entries link to the existing compound and entity
routes. The homepage remains independent of the library.

`GET /api/library` supplies the live catalog with a five-minute server cache.
`public/library.json` is a dated fallback inventory, not a substitute for current
profile data. Regenerate it from clarity-engine after changing cached profiles:

```sh
python3 -m evidence.library --output ../clarity-web/public/library.json
```

The current inventory has 161 profiles (143 interventions and 18 other profiles).
All 161 API entry points were checked locally. This is complete coverage of stored
Clarity content, not exhaustive medical coverage. Twenty stored profiles need
appraisal refresh for protocol records; their dates/grades were not rewritten.
The analysis workbench requires deployment of the updated engine API alongside
the frontend. No new paid extraction or production deployment was performed.

### Production deep links

Build with `npm ci && npm run build`; publish `dist`. The Render static service
requires a dashboard rewrite **/* → /index.html (Rewrite)**. `_redirects` alone
is not consumed by Render. The rewrite is now configured on clarity-evidence;
`render.yaml`, `netlify.toml`, and `vercel.json` document equivalent deployments.
Verify direct GET requests to /explore, /learn, /methodology and individual
profiles after deployment, not only client-side clicks from the homepage.

### Researcher foundation

/explore/matcher accepts research text and calls POST /api/evidence/match.
This phase uses aliases, biomedical concept expansion and lexical retrieval.
It makes no paid model calls and does not persist queries. Supporting versus
contradicting interpretation is an explicit review step. The response schema
reserves agreement assessments and preserves source passages and offsets.
See clarity-engine/evidence/RESEARCHER.md for private-workspace, upload and
semantic-retrieval extension boundaries.
