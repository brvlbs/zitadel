"use client";

// BraveLabs: explain a gateway rate limit on sign-in submissions.
//
// The edge gateway answers login POSTs over its per-client budget with 429 and
// an HTML body. Next.js turns that into a generic Error for the server action,
// so every form shows its own catch-all message ("An internal error occurred",
// "Could not verify password" even for the right password). Instead of
// changing each form, this watches the responses once, at the shell: a 429 to
// a POST shows this notice (with the Retry-After seconds when the gateway sends
// them), the next non-429 POST clears it. The forms' own errors are unchanged.

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Alert } from "./alert";

// undefined: no notice; null: limited, wait unknown; number: seconds to wait.
type Limited = number | null | undefined;

export function retryAfterSeconds(header: string | null): number | null {
  const seconds = Number(header);
  return header && Number.isInteger(seconds) && seconds > 0 ? seconds : null;
}

export function RateLimitNotice() {
  const t = useTranslations("common");
  const [limited, setLimited] = useState<Limited>(undefined);

  useEffect(() => {
    const original = window.fetch;
    const watched: typeof window.fetch = async (input, init) => {
      const response = await original(input, init);
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (method === "POST") {
        setLimited(response.status === 429 ? retryAfterSeconds(response.headers.get("retry-after")) : undefined);
      }
      return response;
    };
    window.fetch = watched;
    return () => {
      if (window.fetch === watched) window.fetch = original;
    };
  }, []);

  if (limited === undefined) return null;
  return (
    <div className="mb-4" role="alert" data-testid="rate-limit-notice">
      <Alert>{limited === null ? t("rateLimited") : t("rateLimitedSeconds", { seconds: limited })}</Alert>
    </div>
  );
}
