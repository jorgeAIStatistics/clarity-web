# Intervention evidence reports

`AnalyticalProfile` replaces the intervention-only ProfileBrief rendering. Other entity profiles retain their existing template. One selected outcome coordinates the hero, filters, context cards, source intervals, composition, matrix and audit. Explicit outcome choices live in the URL; population/design/baseline/layer filters reset when the outcome changes.

`reportModel` merges source-constrained findings in `public/intervention-enrichment.json` with the Vitamin D gold set in `public/profile-report-context.json`. It keeps exact endpoints separate from cached topic appraisals. The context file is a targeted, automated appraisal, not a completed systematic review. Every finding retains an abstract passage, offsets, source identity and original reported measure. Context fields retain their source passages. Additions require the same provenance checks and human review before upgrading review status.

Legacy numerical candidates are retained in Audit but excluded from the report's quantitative panels until endpoint, intervention contrast and interval semantics are verified. This matters because the Vitamin D audit found mortality assigned to repletion, exercise contrasts assigned to vitamin D, quartiles labeled as confidence intervals, and within-arm changes labeled as between-group differences. No grading algorithm is changed here.

Each interval panel has its own labeled native scale and source link. Ratio axes are logarithmic. No cross-source pooling, inference of successful translation, total participant summation across reviews, statistical weight or formal risk-of-bias score is computed. Review estimates are explicitly identified as published pooled estimates. Unknown search and completion stages stay unknown.

Validation: `node --test src/profile/reportModel.test.js` checks endpoint separation, calcium and baseline context, RR versus OR, crossing intervals, retained quote spans, invalid estimates, filtering and sorting. Run the complete JS tests and production build before release. Browser QA covers outcome changes/reload, filters/reset, matrix source focus, mobile layout and outcome handoff to the research workspace.
