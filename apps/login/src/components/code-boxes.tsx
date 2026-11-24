"use client";

// BraveLabs: six-box display for fixed six-digit numeric codes (TOTP).
//
// ONE real <input> (label, autofill, paste, backspace, numeric keyboard and
// screen readers all work as for any text field) laid transparently over six
// decorative boxes that mirror its value. Drop-in for react-hook-form's
// register(): pass the register props straight through.

import { ChangeEvent, FocusEvent, forwardRef, useId, useState } from "react";

export const CODE_LENGTH = 6;

// Digits only, at most six: "123 456", "123-456" and pasted codes collapse.
export function normalizeCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, CODE_LENGTH);
}

export function isCompleteCode(value: string): boolean {
  return new RegExp(`^\\d{${CODE_LENGTH}}$`).test(value);
}

type Props = {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  defaultValue?: string;
  autoFocus?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => unknown;
  onBlur: (event: FocusEvent<HTMLInputElement>) => unknown;
  "data-testid"?: string;
};

export const CodeBoxes = forwardRef<HTMLInputElement, Props>(
  ({ label, name, hint, error, defaultValue, autoFocus, onChange, onBlur, ...rest }, ref) => {
    const [value, setValue] = useState(normalizeCode(defaultValue ?? ""));
    const [focused, setFocused] = useState(false);
    const id = useId();
    const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
    const active = Math.min(value.length, CODE_LENGTH - 1);

    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-[#001222] dark:text-white">
          {label}
        </label>
        <div className="relative w-fit">
          <div aria-hidden="true" className="flex gap-2">
            {Array.from({ length: CODE_LENGTH }, (_, i) => (
              <span
                key={i}
                data-testid="code-box"
                className={[
                  "flex h-12 w-12 items-center justify-center border bg-white text-2xl font-semibold text-[#001222] tabular-nums sm:h-14 sm:w-[52px] dark:bg-transparent dark:text-white",
                  error
                    ? "border-2 border-[#B42318]"
                    : focused && i === active
                      ? "border-2 border-[#E32686]"
                      : "border-[#7D8A9C]",
                ].join(" ")}
              >
                {value[i] ?? ""}
              </span>
            ))}
          </div>
          <input
            {...rest}
            id={id}
            ref={ref}
            name={name}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH + 4}
            autoFocus={autoFocus}
            defaultValue={value}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            suppressHydrationWarning
            // Covers the boxes so a click or tap anywhere focuses it; text and
            // caret are invisible, the boxes show the digits.
            className="absolute inset-0 h-full w-full cursor-text border-0 bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E32686]"
            onChange={(event) => {
              const next = normalizeCode(event.target.value);
              if (event.target.value !== next) event.target.value = next;
              setValue(next);
              onChange(event);
            }}
            onFocus={() => setFocused(true)}
            onBlur={(event) => {
              setFocused(false);
              onBlur(event);
            }}
          />
        </div>
        {hint && (
          <p id={`${id}-hint`} className="text-sm text-[#535252] dark:text-gray-300">
            {hint}
          </p>
        )}
        {error && (
          <p id={`${id}-error`} role="alert" className="text-sm font-semibold text-[#B42318]">
            {error}
          </p>
        )}
      </div>
    );
  },
);
CodeBoxes.displayName = "CodeBoxes";
