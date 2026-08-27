import { forwardRef, type InputHTMLAttributes } from 'react';

// appearance-none + a hand-drawn checkmark overlay, not a resized native
// checkbox — the dark theme's `color-scheme: dark` (styles.css) makes
// Chromium render native checkboxes with its own plain OS dark widget,
// which looks like an ugly blank box at any size larger than the tiny
// default. Fully custom styling sidesteps that entirely and looks
// identical in both themes.
export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Checkbox(
  { className = '', ...props },
  ref,
) {
  return (
    <span className="relative inline-flex h-[18px] w-[18px] flex-none">
      <input
        ref={ref}
        type="checkbox"
        className={`peer h-[18px] w-[18px] cursor-pointer appearance-none rounded-[5px] border-2 border-border bg-surface-card transition-colors checked:border-brand-600 checked:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      />
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="white"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-[18px] w-[18px] scale-75 opacity-0 peer-checked:opacity-100"
      >
        <path d="M3 8.5l3 3 7-7" />
      </svg>
    </span>
  );
});
