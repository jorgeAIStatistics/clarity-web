// Scientific figures require explicit provenance. Synthetic examples are confined
// to the teaching workbench and are never passed off as biomarker evidence.
export const FIGURE_TYPES = {
  risk_curve: 'Risk curve', distribution: 'Population distribution',
  longitudinal: 'Measurements over time', correlation: 'Correlation matrix',
  roc: 'ROC curve', calibration: 'Calibration plot', kaplan_meier: 'Kaplan–Meier curve',
  forest: 'Forest plot', response_matrix: 'Treatment-response matrix',
};
export function validateFigure(figure) {
  if (!figure || !FIGURE_TYPES[figure.type] || !figure.title || !figure.caption) throw new Error('Figure metadata is required.');
  if (!figure.illustrative && !/^https:\/\//.test(figure.source_url || '')) throw new Error('An evidence figure needs a source URL.');
  if (!Array.isArray(figure.rows) || figure.rows.length < 1 || figure.rows.length > 1000) throw new Error('Expected 1–1,000 figure rows.');
  for (const row of figure.rows) {
    for (const value of Object.values(row)) {
      if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Non-finite figure value.');
    }
    if (figure.type === 'forest') {
      if (!['hr','rr','or','mean_diff','smd','risk_diff'].includes(figure.measure)) throw new Error('Explicit effect measure required.');
      if (['hr','rr','or'].includes(figure.measure) && row.lower<=0) throw new Error('Ratio intervals must be positive.');
      if (![row.lower,row.estimate,row.upper].every(x=>typeof x==='number') || row.lower>row.estimate || row.estimate>row.upper) throw new Error('Invalid effect interval.');
    } else if (figure.type === 'correlation') {
      if (typeof row.value !== 'number' || Math.abs(row.value)>1) throw new Error('Invalid correlation.');
    } else if (figure.type === 'response_matrix') {
      if (typeof row.value!=='number' || row.value<0 || row.value>1) throw new Error('Response proportions must lie between 0 and 1.');
    } else {
      if (typeof row.x !== 'number' || typeof row.y !== 'number') throw new Error('Numeric coordinates required.');
      if (['roc','calibration'].includes(figure.type) && (row.x<0||row.x>1||row.y<0||row.y>1)) throw new Error('Probabilities must lie between 0 and 1.');
      if (figure.type==='kaplan_meier' && (row.x<0||row.y<0||row.y>1)) throw new Error('Invalid survival coordinate.');
      if (figure.type==='risk_curve' && (row.y<0||row.y>1)) throw new Error('Risk must be a probability.');
      if (figure.type==='distribution' && row.y<0) throw new Error('Negative frequency.');
    }
  }
  if (['roc','kaplan_meier'].includes(figure.type)) {
    for(let i=1;i<figure.rows.length;i++) {
      const a=figure.rows[i-1],b=figure.rows[i];
      if(b.x<a.x || (figure.type==='roc'?b.y<a.y:b.y>a.y)) throw new Error('Invalid curve ordering.');
    }
  }
  return figure;
}
export function rocArea(rows) {
  validateFigure({type:'roc',title:'ROC',caption:'Coordinates',illustrative:true,rows});
  if (rows[0].x!==0 || rows[0].y!==0 || rows.at(-1).x!==1 || rows.at(-1).y!==1) return null;
  return rows.slice(1).reduce((sum,p,i)=>sum+(p.x-rows[i].x)*(p.y+rows[i].y)/2,0);
}
const example = (type,title,caption,x_label,y_label,rows) => ({type,title,caption,x_label,y_label,rows,illustrative:true,...(type==='forest'?{measure:'hr'}:{})});
export const EXAMPLE_FIGURES = [
  example('risk_curve','Association across a measurement range','Synthetic curve. The shape illustrates an association and cannot establish causality.','Measurement (arbitrary units)','Outcome probability', [{x:1,y:.04},{x:2,y:.06},{x:3,y:.09},{x:4,y:.15},{x:5,y:.24}]),
  example('distribution','A reference population has a distribution','Synthetic frequency bins. A common value is not necessarily an optimal value or a treatment target.','Measurement bin (arbitrary units)','People in bin',[{x:1,y:10},{x:2,y:35},{x:3,y:80},{x:4,y:120},{x:5,y:80},{x:6,y:35},{x:7,y:10}]),
  example('longitudinal','Change over repeated measurements','Synthetic series. Collection conditions and within-person variability matter; a trend alone does not explain its cause.','Visit','Measurement (arbitrary units)',[{x:1,y:8},{x:2,y:7},{x:3,y:7.5},{x:4,y:6.5},{x:5,y:6.2}]),
  example('correlation','Related measurements are not interchangeable','Synthetic correlations, not ApoB/LDL-C estimates. Correlation does not imply causation.','Marker','Marker',[
    {row:'Marker A',column:'Marker A',value:1},{row:'Marker A',column:'Marker B',value:.8},{row:'Marker A',column:'Marker C',value:.2},
    {row:'Marker B',column:'Marker A',value:.8},{row:'Marker B',column:'Marker B',value:1},{row:'Marker B',column:'Marker C',value:.1},
    {row:'Marker C',column:'Marker A',value:.2},{row:'Marker C',column:'Marker B',value:.1},{row:'Marker C',column:'Marker C',value:1}]),
  example('roc','Accuracy changes with the threshold','Synthetic threshold coordinates. AUC summarizes discrimination across thresholds, not screening benefit.','False-positive rate','Sensitivity',[{x:0,y:0},{x:.05,y:.45},{x:.1,y:.65},{x:.2,y:.8},{x:.4,y:.9},{x:1,y:1}]),
  example('calibration','Do predicted risks match observed outcomes?','Synthetic grouped risks. Perfect calibration lies on the diagonal. Real estimates require group sizes and uncertainty.','Predicted probability','Observed frequency',[{x:.1,y:.05},{x:.3,y:.2},{x:.5,y:.4},{x:.7,y:.65},{x:.9,y:.8}]),
  example('kaplan_meier','Survival probability over follow-up','Synthetic step function for teaching only. Evidence curves require observed event/censoring data or faithfully extracted published coordinates, with numbers at risk.','Follow-up (arbitrary time units)','Survival probability',[{x:0,y:1},{x:1,y:.9},{x:2,y:.9},{x:3,y:.75},{x:4,y:.6},{x:5,y:.6}]),
  example('forest','Effects and their uncertainty','Synthetic subgroup estimates with illustrative intervals. Overlapping intervals do not substitute for a formal interaction test.','Hazard ratio','Subgroup',[{label:'Subgroup A',estimate:.8,lower:.6,upper:1.05},{label:'Subgroup B',estimate:.65,lower:.4,upper:1.1},{label:'Subgroup C',estimate:1.1,lower:.85,upper:1.4}]),
  example('response_matrix','Biomarker × therapy × response','Synthetic response proportions. Comparisons require the same disease setting, treatment line, outcome definition, and follow-up.','Therapy','Biomarker',[{row:'Biomarker A',column:'Therapy A',value:.6},{row:'Biomarker A',column:'Therapy B',value:.2},{row:'Biomarker B',column:'Therapy A',value:.15},{row:'Biomarker B',column:'Therapy B',value:.5}]),
];
