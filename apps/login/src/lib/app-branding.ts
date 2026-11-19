// BraveLabs: per-application login presentation.
//
// One ZITADEL organisation serves every BraveLabs application, so the
// organisation's branding settings cannot differ per application. This module
// overlays a small, allowlisted presentation (name, accent colour, logo) on
// top of those settings, selected by the OIDC client id of the auth request
// the login is serving. The client id is read from ZITADEL by the login's own
// service credentials (see getBrandingSettings in lib/server/zitadel.ts), never
// from the browser, and only an exact allowlist match changes anything.
//
// Config: BRAVELABS_APP_BRANDING, a runtime JSON object keyed by client id:
//   {"<clientId>": {"name": "Lead Hub", "accent": "#e6007e",
//                   "accentDark": "#ff4fa8", "logoUrl": "/assets/leadhub.svg"}}
// Invalid entries are dropped; unknown clients keep the organisation branding.

import type { BrandingSettings } from "@zitadel/proto/zitadel/settings/v2/branding_settings_pb";

export const APP_BRANDING_REQUEST_HEADER = "x-bravelabs-request-id";

export type AppPresentation = {
  name: string;
  accent?: string;
  accentDark?: string;
  logoUrl?: string;
  logoUrlDark?: string;
};

export type AppBrandingSettings = BrandingSettings & { appName?: string };

const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

// Root-relative only: the login's CSP allows images from its own origin and
// the ZITADEL origin, and a root-relative path cannot point anywhere else.
function isSafeLogoPath(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\");
}

function parseEntry(value: unknown): AppPresentation | undefined {
  if (!value || typeof value !== "object") return undefined;
  const entry = value as Record<string, unknown>;
  if (typeof entry.name !== "string" || !entry.name.trim() || entry.name.length > 60) return undefined;

  const presentation: AppPresentation = { name: entry.name.trim() };
  for (const key of ["accent", "accentDark"] as const) {
    if (entry[key] === undefined) continue;
    if (typeof entry[key] !== "string" || !HEX_COLOUR.test(entry[key] as string)) return undefined;
    presentation[key] = entry[key] as string;
  }
  for (const key of ["logoUrl", "logoUrlDark"] as const) {
    if (entry[key] === undefined) continue;
    if (!isSafeLogoPath(entry[key])) return undefined;
    presentation[key] = entry[key] as string;
  }
  return presentation;
}

export function parseAppBranding(raw: string | undefined): Map<string, AppPresentation> {
  const apps = new Map<string, AppPresentation>();
  if (!raw) return apps;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("BRAVELABS_APP_BRANDING is not valid JSON; using organisation branding only");
    return apps;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return apps;
  for (const [clientId, value] of Object.entries(parsed)) {
    const presentation = parseEntry(value);
    if (presentation) {
      apps.set(clientId, presentation);
    } else {
      console.error(`BRAVELABS_APP_BRANDING entry for client ${clientId} is invalid and ignored`);
    }
  }
  return apps;
}

// Only OIDC auth requests are resolved; SAML and device requests keep the
// organisation branding (no BraveLabs application uses them).
export function oidcAuthRequestId(requestId: string | null | undefined): string | undefined {
  if (!requestId?.startsWith("oidc_")) return undefined;
  const id = requestId.slice("oidc_".length);
  return id ? id : undefined;
}

export function applyAppBranding(branding: BrandingSettings, app: AppPresentation): AppBrandingSettings {
  const darkAccent = app.accentDark ?? app.accent;
  const darkLogo = app.logoUrlDark ?? app.logoUrl;
  return {
    ...branding,
    appName: app.name,
    lightTheme: branding.lightTheme && {
      ...branding.lightTheme,
      ...(app.accent ? { primaryColor: app.accent } : {}),
      ...(app.logoUrl ? { logoUrl: app.logoUrl } : {}),
    },
    darkTheme: branding.darkTheme && {
      ...branding.darkTheme,
      ...(darkAccent ? { primaryColor: darkAccent } : {}),
      ...(darkLogo ? { logoUrl: darkLogo } : {}),
    },
  };
}
