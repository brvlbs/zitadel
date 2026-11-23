// BraveLabs: name the application a sign-in is for.
//
// One shared BraveLabs ID login serves every BraveLabs application. The login
// pages say which application the user is signing into ("Sign in to Lead Hub",
// plus an optional short description), on every step of the flow.
//
// The application is selected only by the OIDC client id of the auth request,
// which the login reads from ZITADEL with its own service credentials (see
// getBrandingSettings in lib/server/zitadel.ts). ZITADEL's AuthRequest carries
// no application name (only device requests do), hence a small allowlist.
// Nothing from the URL is ever displayed.
//
// Config: BRAVELABS_APP_BRANDING, a runtime JSON object keyed by client id:
//   {"<clientId>": {"name": "Lead Hub", "description": "Leads and campaigns"}}
// Invalid entries are dropped. A sign-in for an unknown client, or one that
// cannot be resolved, shows the generic "Sign in with BraveLabs ID".

import type { BrandingSettings } from "@zitadel/proto/zitadel/settings/v2/branding_settings_pb";

export const APP_BRANDING_REQUEST_HEADER = "x-bravelabs-request-id";

export type AppContext = {
  // Absent for an unknown application: the generic message is shown.
  name?: string;
  description?: string;
};

// `bravelabsApp` is set only while serving a sign-in request (a requestId is
// present); pages outside a sign-in (logout, device, direct visits) show nothing.
export type AppBrandingSettings = BrandingSettings & { bravelabsApp?: AppContext };

const MAX_NAME = 60;
const MAX_DESCRIPTION = 160;

function parseEntry(value: unknown): AppContext | undefined {
  if (!value || typeof value !== "object") return undefined;
  const entry = value as Record<string, unknown>;
  const name = typeof entry.name === "string" ? entry.name.trim() : "";
  if (!name || name.length > MAX_NAME) return undefined;
  if (entry.description === undefined) return { name };
  const description = typeof entry.description === "string" ? entry.description.trim() : "";
  if (!description || description.length > MAX_DESCRIPTION) return undefined;
  return { name, description };
}

export function parseAppBranding(raw: string | undefined): Map<string, AppContext> {
  const apps = new Map<string, AppContext>();
  if (!raw) return apps;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("BRAVELABS_APP_BRANDING is not valid JSON; showing the generic sign-in message");
    return apps;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return apps;
  for (const [clientId, value] of Object.entries(parsed)) {
    const app = parseEntry(value);
    if (app) {
      apps.set(clientId, app);
    } else {
      console.error(`BRAVELABS_APP_BRANDING entry for client ${clientId} is invalid and ignored`);
    }
  }
  return apps;
}

// Only OIDC auth requests are resolved; SAML and device requests get the
// generic message (no BraveLabs application uses them).
export function oidcAuthRequestId(requestId: string | null | undefined): string | undefined {
  if (!requestId?.startsWith("oidc_")) return undefined;
  const id = requestId.slice("oidc_".length);
  return id ? id : undefined;
}

export function withAppContext(branding: BrandingSettings, app: AppContext): AppBrandingSettings {
  return { ...branding, bravelabsApp: app };
}
