'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const nav = [
  { href: '/pricing', label: 'Beta' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/updates', label: 'Updates' },
  { href: '/download', label: 'Download' },
  { href: '/support', label: 'Support' },
];

/**
 * Sticky masthead. Gains a rule and a translucent ground once the page
 * scrolls, so it separates from the content instead of floating type.
 */
export function SiteHeader({ version }: { version: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the drawer whenever the route changes.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-200 ${
        stuck ? 'border-line bg-bg/90 backdrop-blur-xl' : 'border-transparent bg-bg-2/80'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-center" aria-label="PayTsek home">
          <Image
            src="/brand/paytsek-wordmark.png"
            alt="PayTsek"
            width={152}
            height={51}
            priority
            className="h-auto w-[122px] transition-transform duration-200 group-hover:scale-[1.02] sm:w-[138px]"
          />
        </Link>

        <nav aria-label="Main" className="flex items-center gap-1">
          <ul className="hidden items-center sm:flex">
            {nav.map((n) => {
              const active = pathname === n.href;
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center rounded-lg px-3 py-2 text-[14px] font-medium transition-colors hover:text-brand ${
                      active ? 'text-brand' : 'text-ink-2'
                    }`}
                  >
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Below sm the drawer carries Download, so the pill would be a
              second route to the same place in a very tight bar. */}
          <Link
            href="/download"
            className="ml-3 hidden min-h-10 items-center gap-2 whitespace-nowrap rounded-xl bg-ink px-4 py-2 text-[13px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-brand sm:inline-flex"
          >
            Get the app
            <span className="data text-[11px] text-white/55">v{version}</span>
          </Link>

          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="grid size-10 place-items-center rounded-xl border border-line sm:hidden"
          >
            <span aria-hidden className="relative block h-[13px] w-4">
              <span className={`absolute inset-x-0 top-0 h-0.5 rounded bg-ink transition-transform ${open ? 'translate-y-[6px] rotate-45' : ''}`} />
              <span className={`absolute inset-x-0 top-[6px] h-0.5 rounded bg-ink transition-opacity ${open ? 'opacity-0' : ''}`} />
              <span className={`absolute inset-x-0 bottom-0 h-0.5 rounded bg-ink transition-transform ${open ? '-translate-y-[6px] -rotate-45' : ''}`} />
            </span>
          </button>
        </nav>
      </div>

      {open ? (
        <div className="border-t border-line bg-bg/95 backdrop-blur-md sm:hidden">
          <ul className="mx-auto max-w-6xl px-4 py-2">
            {nav.map((n) => (
              <li key={n.href} className="border-b border-line-2 last:border-b-0">
                <Link href={n.href} className="flex items-center py-3.5 text-[15px] font-medium">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </header>
  );
}
