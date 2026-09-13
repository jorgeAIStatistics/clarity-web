# Source-backed study intake

The first step is a single input and `Analyze my study`. `StudyIntake` calls
`POST /api/research/definition`, displays source provenance and an editable draft,
and requires researcher confirmation before advancing. Dataset/table inputs are
shown only after confirmation and do not overwrite the Study Definition.

The engine resolves known cached references, then explicit PMID/DOI/title lookups
through PubMed with a Europe PMC fallback. Available PMC methods supplement the
abstract. Known reference snapshots are dated and attributed in the UI. Exact
known titles and complete known abstracts can resolve locally; use `Title:` for
an uncached article-title lookup. Unpublished free-text descriptions are not sent
to external search services. No model API calls are made by this release.

Field-level passages distinguish source abstracts, full-text methods and user
text. Explicit user-labeled fields override source drafts with a conflict record.
Subsequent edits are labeled researcher-provided. Primary-outcome selection and
reference groups require confirmation; source mentions alone do not establish a
prespecified primary endpoint. Missing fields stay empty and quantitative gates
remain unchanged. Extraction is conservative and pattern-based, not a general
full-text understanding guarantee. Low-recognition drafts expose retry, identifier
lookup and manual editing instead of reporting success.

Regression coverage: IL-18 PMID 41976322 through identifier, DOI, exact title and
abstract; source passages; sparse inputs; outages; patient-input guards; reference
identifier isolation; dynamic labels; stale-definition clearing. Parse-failure logs
contain field count and resolution status only, never the user's research text.
