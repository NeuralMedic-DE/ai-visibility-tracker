"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export interface NavLinkItem {
  href: string;
  label: string;
  /** Use <a> for same-page hash anchors; default uses Next.js <Link> */
  isAnchor?: boolean;
}

interface NavProps {
  links: NavLinkItem[];
  cta: {
    label: string;
    href: string;
    isAnchor?: boolean;
  };
  className?: string;
}

/** Shared desktop + mobile navigation. Handles hamburger state. */
export function Nav({ links, cta, className }: NavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Shared link class for desktop nav items
  const desktopLinkClass =
    "text-sm font-medium text-gray-600 hover:text-gray-900 hover:underline underline-offset-4 decoration-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 rounded px-1 py-1";

  // CTA button — slightly taller than nav links, min-h-[44px] for mobile accessibility
  const ctaClass =
    "inline-flex items-center justify-center min-h-[44px] rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2";

  function CtaElement({ extraClass }: { extraClass?: string }) {
    const combinedClass = cn(ctaClass, extraClass);
    if (cta.isAnchor) {
      return (
        <a href={cta.href} className={combinedClass}>
          {cta.label}
        </a>
      );
    }
    return (
      <Link href={cta.href} className={combinedClass}>
        {cta.label}
      </Link>
    );
  }

  return (
    <nav
      className={cn(
        "border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-50",
        className
      )}
      aria-label="Main navigation"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="text-xl font-bold text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 rounded px-1"
          >
            NeuralReach
          </Link>

          {/* ── Desktop links (hidden on mobile) ── */}
          <div className="hidden sm:flex items-center gap-6">
            {links.map((link) =>
              link.isAnchor ? (
                <a key={link.href} href={link.href} className={desktopLinkClass}>
                  {link.label}
                </a>
              ) : (
                <Link key={link.href} href={link.href} className={desktopLinkClass}>
                  {link.label}
                </Link>
              )
            )}

            {/* Visual separator before CTA */}
            <div className="h-5 w-px bg-gray-200" aria-hidden="true" />

            <CtaElement />
          </div>

          {/* ── Mobile: CTA + hamburger button ── */}
          <div className="flex sm:hidden items-center gap-3">
            <CtaElement />

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="inline-flex items-center justify-center h-11 w-11 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-400 transition-colors"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-menu"
              aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            >
              {mobileOpen ? (
                /* X icon */
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-6 w-6"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              ) : (
                /* Hamburger icon */
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-6 w-6"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile dropdown menu ── */}
      {mobileOpen && (
        <div
          id="mobile-nav-menu"
          className="sm:hidden border-t border-gray-100 bg-white"
        >
          <ul className="mx-4 my-2 flex flex-col divide-y divide-gray-50">
            {links.map((link) => (
              <li key={link.href}>
                {link.isAnchor ? (
                  <a
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center min-h-[48px] py-3 text-sm font-medium text-gray-700 hover:text-brand-700 focus:outline-none focus:text-brand-700 transition-colors"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center min-h-[48px] py-3 text-sm font-medium text-gray-700 hover:text-brand-700 focus:outline-none focus:text-brand-700 transition-colors"
                  >
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}
