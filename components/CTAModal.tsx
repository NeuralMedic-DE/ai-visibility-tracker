"use client";

import { useEffect, useRef } from "react";
import { WaitlistForm } from "./WaitlistForm";

interface CTAModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefilledBrand?: string;
}

export function CTAModal({ isOpen, onClose, prefilledBrand }: CTAModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    // Prevent body scroll while open
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  // Focus trap — move focus into modal when it opens
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, input, a[href], [tabindex]:not([tabindex="-1"])'
      );
      focusable[0]?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cta-modal-title"
    >
      {/* Backdrop */}
      <div
        className="modal-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={dialogRef}
        className="modal-panel relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="mb-5">
          <div className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-200 mb-3">
            Free AI Visibility Report
          </div>
          <h2
            id="cta-modal-title"
            className="text-xl font-bold text-gray-900 leading-snug"
          >
            See how your brand ranks across
            <br />
            ChatGPT, Claude &amp; Perplexity
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            We'll run 25 real AI prompts, score your brand's visibility, and
            show you exactly what to fix. First report is free.
          </p>
        </div>

        {/* Proof points */}
        <ul className="mb-5 space-y-1.5 text-sm text-gray-600">
          {[
            "✓ Scored across 4 AI platforms",
            "✓ Competitor comparison included",
            "✓ Actionable schema & content fixes",
          ].map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        {/* Form */}
        <WaitlistForm
          key={prefilledBrand ?? ""}
          variant="compact"
          defaultBrandInterest={prefilledBrand}
        />
      </div>
    </div>
  );
}
