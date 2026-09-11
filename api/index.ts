// Vercel discovers functions in /api. The Nest handler is compiled by the API
// project so decorator metadata is never transpiled a second time.
export { default } from '../apps/api/dist/serverless';
