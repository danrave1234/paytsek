import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/site-header';
import { latest } from '@/lib/releases';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'PayTsek — QR payment records for Philippine sellers', template: '%s · PayTsek' },
  description: 'Record GCash, GoTyme, Maya and MariBank QR payments, then check them against incoming-payment notifications on your Android phone.',
  applicationName: 'PayTsek',
  keywords: ['QR payment records', 'GCash payment tracker', 'Maya payment tracker', 'GoTyme payment records', 'Philippines seller payments'],
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.paytsek.online'),
  alternates: { canonical: '/' },
  icons: { icon: '/brand/paytsek-icon.png', apple: '/brand/paytsek-icon.png' },
  openGraph: {
    title: 'PayTsek',
    description: 'Trust the payment, not the screenshot.',
    type: 'website',
    locale: 'en_PH',
    images: [{ url: '/brand/paytsek-social.png', width: 1254, height: 1254, alt: 'PayTsek' }],
  },
  twitter: { card: 'summary_large_image', title: 'PayTsek', description: 'Trust the payment, not the screenshot.', images: ['/brand/paytsek-social.png'] },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: '#f7f8fb', width: 'device-width', initialScale: 1 };

const footerLinks = [
  {
    heading: 'Product',
    links: [
      { href: '/download', label: 'Downloads' },
      { href: '/updates', label: 'Release notes' },
      { href: 'https://github.com/danrave1234/paytsek/releases', label: 'GitHub releases', external: true },
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
      { href: 'mailto:support@paytsek.online', label: 'support@paytsek.online', external: true },
    ],
  },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  const rel = latest();
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
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

        <footer className="mt-24 border-t border-line bg-bg-2">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
            <div>
              <Image src="/brand/paytsek-wordmark.png" alt="PayTsek" width={152} height={51} className="h-auto w-[152px]" />
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
              <span>© {new Date().getFullYear()} PayTsek · Manila</span>
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
