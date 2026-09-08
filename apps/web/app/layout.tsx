import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'PayRecord — keep every GCash/GoTyme payment on record', template: '%s · PayRecord' },
  description: 'Scan a payment proof, keep an organized record, and match it with incoming-payment evidence from your own Android phone. Built for Philippine sellers.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://payrecord.ph'),
  openGraph: { title: 'PayRecord', description: 'Scan a payment proof, keep an organized record, and match it with incoming-payment evidence.', type: 'website' },
};

export const viewport: Viewport = { themeColor: '#0b5fff', width: 'device-width', initialScale: 1 };

const nav = [
  { href: '/', label: 'Home' },
  { href: '/updates', label: 'Updates' },
  { href: '/download', label: 'Download' },
  { href: '/support', label: 'Support' },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh flex flex-col">
        <header className="sticky top-0 z-20 border-b border-line/70 bg-white/85 backdrop-blur dark:bg-[#0b1220]/85 dark:border-slate-800">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="inline-block size-7 rounded-lg bg-brand" aria-hidden />
              PayRecord
            </Link>
            <nav aria-label="Main" className="flex items-center gap-1 text-sm">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-lg px-3 py-2 hover:bg-brand-soft/60 dark:hover:bg-slate-800">
                  {n.label}
                </Link>
              ))}
              <Link href="/download" className="ml-2 rounded-lg bg-brand px-3 py-2 font-medium text-white hover:bg-brand-dark">
                Get the app
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line/70 dark:border-slate-800">
          <div className="mx-auto grid max-w-5xl gap-6 px-4 py-10 text-sm text-muted dark:text-slate-400 sm:grid-cols-3">
            <div>
              <p className="font-semibold text-ink dark:text-slate-100">PayRecord</p>
              <p className="mt-2">Recordkeeping for sellers who get paid through GCash and GoTyme. Not affiliated with, endorsed by, or verified by GCash, GoTyme, or any bank.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Link href="/privacy">Privacy policy</Link>
              <Link href="/terms">Terms of use</Link>
              <Link href="/support">Support & account deletion</Link>
            </div>
            <div className="flex flex-col gap-2">
              <Link href="/updates">Release updates</Link>
              <Link href="/download">Downloads</Link>
              <a href="https://github.com" rel="noreferrer">Source & status</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
