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
//   {"<clientId>": {"name": "Lead Hub", "description": "Leads and campaigns",
//                   "url": "https://leadhub.example.com/"}}
// Invalid entries are dropped. A sign-in for an unknown client, or one that
// cannot be resolved, shows the generic "Sign in with BraveLabs ID".
//
// Invitations: an invitation link may carry `app=<clientId>` next to
// `invite=true` on /verify. The proxy then sets a short-lived cookie holding
// that client id (only if it is configured), and the signed-in page at the end
// of the setup offers "Continue to <name>" linking to the configured `url`.
// The query value is only a lookup key: the link target always comes from this
// config, and `url` must be an absolute https URL without credentials (an
// invalid url is dropped, the name and description are kept).

import type { BrandingSettings } from "@zitadel/proto/zitadel/settings/v2/branding_settings_pb";

export const APP_BRANDING_REQUEST_HEADER = "x-bravelabs-request-id";

export type AppContext = {
  // Absent for an unknown application: the generic message is shown.
  name?: string;
  description?: string;
  // Where "Continue to <name>" leads after an invitation setup (absolute https).
  url?: string;
};

// `bravelabsApp` is set only while serving a sign-in request (a requestId is
// present); pages outside a sign-in (logout, device, direct visits) show nothing.
export type AppBrandingSettings = BrandingSettings & { bravelabsApp?: AppContext };

const MAX_NAME = 60;
const MAX_DESCRIPTION = 160;
const MAX_URL = 300;

export function parseAppUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > MAX_URL) return undefined;
  let url: URL;
  try {
    url = new URL(value); // relative URLs throw
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" || url.username || url.password) return undefined;
  return url.href;
}

function parseEntry(clientId: string, value: unknown): AppContext | undefined {
  if (!value || typeof value !== "object") return undefined;
  const entry = value as Record<string, unknown>;
  const name = typeof entry.name === "string" ? entry.name.trim() : "";
  if (!name || name.length > MAX_NAME) return undefined;
  const app: AppContext = { name };
  if (entry.description !== undefined) {
    const description = typeof entry.description === "string" ? entry.description.trim() : "";
    if (!description || description.length > MAX_DESCRIPTION) return undefined;
    app.description = description;
  }
  if (entry.url !== undefined) {
    const url = parseAppUrl(entry.url);
    if (url) {
      app.url = url;
    } else {
      console.error(`BRAVELABS_APP_BRANDING url for client ${clientId} is not an absolute https URL and is ignored`);
    }
  }
  return app;
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
    const app = parseEntry(clientId, value);
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

let configured: Map<string, AppContext> | undefined;

// The parsed BRAVELABS_APP_BRANDING, read once per process.
export function configuredApps(): Map<string, AppContext> {
  return (configured ??= parseAppBranding(process.env.BRAVELABS_APP_BRANDING));
}

// Invitation setup without an auth request: which application to continue to.
export const INVITE_APP_COOKIE = "bravelabs_invite_app";
export const INVITE_APP_MAX_AGE = 60 * 60; // seconds

// For a request to the login (path without base path): the client id to store
// in the invitation cookie, null to clear a stale one, undefined to leave it.
export function inviteAppCookieValue(
  pathname: string,
  params: URLSearchParams,
  apps: Map<string, AppContext>,
): string | null | undefined {
  if (pathname !== "/verify" || params.get("invite") !== "true") return undefined;
  const clientId = params.get("app");
  return clientId && apps.get(clientId)?.url ? clientId : null;
}

// The application an invitation cookie points to, only when it has a url.
export function invitedApp(
  clientId: string | undefined,
  apps: Map<string, AppContext>,
): { name: string; url: string } | undefined {
  const app = clientId ? apps.get(clientId) : undefined;
  return app?.name && app.url ? { name: app.name, url: app.url } : undefined;
}
