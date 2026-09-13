// Canonical URLs shared by navigation and direct-entry routing.
export function canonicalPath(value) {
 let path=value||'/';
 try {path=decodeURIComponent(path);} catch {return '/not-found';}
 path=path.replace(/\/+$/,'')||'/';
 const exact={'/interventions':'/research','/diagnostics-screening':'/tests','/learn/basics':'/learn','/connect':'/explore/matcher','/researcher':'/explore/matcher'};
 if(exact[path])return exact[path];
 return path.replace(/^\/biomarker(?=\/|$)/,'/biomarkers').replace(/^\/condition(?=\/|$)/,'/conditions').replace(/^\/intervention\//,'/compound/');
}
export const CORE_ROUTES=['/','/explore','/research','/biomarkers','/tests','/precision-medicine','/conditions','/explore/compare','/explore/matcher','/methodology','/learn'];
