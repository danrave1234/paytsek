import type { NextConfig } from 'next';

const config: NextConfig = {
  // The repository-level AGENTS.md is the single source of truth. Avoid
  // generating nested instruction files every time an agent starts Next dev.
  agentRules: false,
  reactStrictMode: true,
  poweredByHeader: false,
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
      ],
    },
  ],
};

export default config;
