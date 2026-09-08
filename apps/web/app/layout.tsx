import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/site-header';
import { latest } from '@/lib/releases';
import './globals.css';

const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-plex-sans', display: 'swap' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'PayRecord — check every GCash, GoTyme and Maya QR payment', template: '%s · PayRecord' },
  description: 'Record GCash, GoTyme and Maya QR payments, and check each one against the incoming-payment notification on your own Android phone. Built for Philippine sellers.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://payrecord.ph'),
  openGraph: { title: 'PayRecord', description: 'Trust the payment, not the screenshot.', type: 'website' },
};

export const viewport: Viewport = { themeColor: '#ffffff', width: 'device-width', initialScale: 1 };

const footerLinks = [
  {
    heading: 'Product',
    links: [
      { href: '/download', label: 'Downloads' },
      { href: '/updates', label: 'Release notes' },
      { href: 'https://github.com/danrave1234/pay_record/releases', label: 'GitHub releases', external: true },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy policy' },
      { href: '/terms', label: 'Terms of use' },
      { href: '/support', label: 'Account deletion' },
    ],
  },
  {
    heading: 'Help',
    links: [
      { href: '/support', label: 'Support & FAQ' },
      { href: 'mailto:support@payrecord.ph', label: 'support@payrecord.ph', external: true },
    ],
  },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  const rel = latest();
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="flex min-h-dvh flex-col font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>

        <SiteHeader version={rel.version} />

        <main id="main" className="flex-1">
          {children}
        </main>

        <footer className="mt-28 border-t border-line bg-bg-2">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-2.5">
                <span aria-hidden className="grid size-9 place-items-center rounded-xl bg-brand text-lg font-semibold leading-none text-white">
                  ₱
                </span>
                <p className="h-section text-xl">PayRecord</p>
              </div>
              <p className="mt-4 max-w-sm text-sm leading-6 text-ink-2">
                Recordkeeping for sellers who get paid by QR through GCash, GoTyme and Maya. We never touch the money.
              </p>
              <p className="mt-4 max-w-sm font-mono text-[11px] leading-5 text-ink-3">
                Not affiliated with, endorsed by, or verified by GCash, GoTyme, Maya, or any bank.
              </p>
            </div>

            {footerLinks.map((group) => (
              <div key={group.heading}>
                <p className="eyebrow mb-4">{group.heading}</p>
                <ul className="space-y-2.5 text-sm">
                  {group.links.map((l) => (
                    <li key={l.label}>
                      {'external' in l && l.external ? (
                        <a className="ul" href={l.href} rel="noreferrer">
                          {l.label}
                        </a>
                      ) : (
                        <Link className="ul" href={l.href}>
                          {l.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-line">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3 sm:px-6">
              <span>© {new Date().getFullYear()} PayRecord · Manila</span>
              <span className="data">
                v{rel.version} · {rel.date}
              </span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
