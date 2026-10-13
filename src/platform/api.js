// Local development uses Vite's API proxy; deployments may override the origin.
// `import.meta.env` only exists under Vite, so the optional chain keeps this module importable
// from a plain `node --test` run that pulls it in transitively.
const ENV=(typeof import.meta!=='undefined'&&import.meta.env)||{};
export const API_BASE=(ENV.VITE_API_BASE_URL ?? (ENV.DEV?'':'https://clarity-engine-api.onrender.com')).replace(/\/$/,'');
