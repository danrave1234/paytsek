// Vercel's function discovery is rooted at /api. Keep this thin bridge so the
// API project can build from the monorepo root and still load the Nest server.
export { default } from '../apps/api/api/index';
