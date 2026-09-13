# Research context workspace — first analytical release

This release implements the first nine prioritized foundations using the existing
retained Clarity index. It preserves the site's identity and scientific grading.

## Boundaries

- Browser-local projects, explicit save/reopen/delete, maximum ten saved projects.
  No account security, cloud project storage or server-side research document storage.
- Text and existing aggregate CSV/TSV concept mapping. Raw files are not retained.
  PDF, XLSX, patient-level datasets and automatic raw-data models remain deferred.
- Study definitions require researcher confirmation. Drafting recognizes explicitly
  labeled fields and a few literal population phrases; it is not a general manuscript
  parser. Unknown variables remain unknown.
- Up to 48 relevant candidate publications per search from the retained library.
  Matching then exposes eleven explicit dimensions per study–outcome record. Exact
  means the same normalized wording, not validated equivalence or an 87% probability.
- Human directness requires six exact context fields. Adjacent human, animal, cell,
  synthesis/reference and unclassified evidence remain separate. Missing data cannot
  imply absence of literature. Candidate retrieval is not an exhaustive search.
- The matrix and characteristic heatmap expose context differences. Source inspector
  retains quotes, source identifiers and original versus user-mapped fields.
- A non-pooled interval plot is enabled only for reported finite supported estimates,
  matching confirmed contexts, independent cohort identities, one evidence layer and
  explicit researcher applicability confirmation/rationale. Ratio axes are logarithmic.
  Missing dose/instrument/context can still be scientifically relevant: the researcher
  must assess them. No automated pooling, I², tau², funnel tests or risk-of-bias grade.
- The user-result overlay remains separate; interval overlap and null-side comparisons
  are descriptive, not tests of difference, equivalence or replication.
- Human/animal/cell matrix shows source-specific estimates without asserting concordance.
  Interpretation exposes context differences and missing dimensions; it does not claim
  novelty, causality or a biological explanation for disagreement.
- Audit JSON retains definition, result set, decisions, reasons, mappings, original
  numerical values, user result, notes, engine version and event trail. CSV exports
  neutralize formula-like cells; SVG exports preserve a vector plot and native intervals.

## Scientific design references

[Cochrane chapter 9](https://training.cochrane.org/handbook/current/chapter-09)
requires examining study characteristics before grouping studies for synthesis.
[Chapter 6](https://training.cochrane.org/handbook/current/chapter-06) discusses effect
measures and unit-of-analysis issues. [Chapter 10](https://training.cochrane.org/handbook/current/chapter-10)
describes meta-analysis assumptions. This implementation deliberately provides no
pooled estimator until the required appraisal and synthesis-plan workflow exists.

## Verification

Run `node --test src/research/*.test.js src/platform/*.test.js src/evidence/*.test.js`
and `npm run build`. Tests cover unknown fields, missing timepoints, invalid intervals,
model-inferred values, overlapping cohorts, cross-species comparisons, original-value
preservation and user overlay interpretation. Browser checks exercise confirmation,
retrieval, dimension inspection, inclusion, gates, save/reopen and responsive tables.
