// Local development uses Vite's API proxy; deployments may override the origin.
export const API_BASE=(import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV?'':'https://clarity-engine-api.onrender.com')).replace(/\/$/,'');
