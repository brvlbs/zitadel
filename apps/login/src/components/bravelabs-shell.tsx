"use client";

// BraveLabs ID login shell: one shared layout for every application.
//
// Form column on the left with the BraveLabs lockup and the application the
// sign-in is for; an ink brand panel on the right (desktop only). Colours,
// logo and font come from the organisation branding settings in ZITADEL
// (logo, primary colour for buttons, uploaded font); the brand constants below
// are the BraveLabs ink and magenta used for structure only.
//
// Rendered by DynamicTheme for every login page (single hook point there), so
// the application line stays visible on every step: login name, password,
// passkey, MFA, set-up and verification pages.

import { AppBrandingSettings, AppContext } from "@/lib/app-branding";
import { Children, ReactNode } from "react";
import { Translated } from "./translated";

const INK = "#001222";
const MAGENTA = "#E32686";

export function BraveLabsShell({ branding, children }: { branding?: AppBrandingSettings; children: ReactNode }) {
  const childArray = Children.toArray(children);
  const titleContent = childArray.length > 1 ? childArray[0] : null;
  const formContent = childArray.length > 1 ? childArray.slice(1) : childArray;

  return (
    <div className="relative mx-auto w-full max-w-[1100px] px-4 py-4 md:px-8 [&_:focus-visible]:![outline:2px_solid_#E32686] [&_:focus-visible]:![outline-offset:2px]">
      <div className="grid overflow-hidden bg-white lg:border lg:border-[#D9D9D9] dark:lg:border-white/10 dark:bg-[#0A1E30] lg:min-h-[600px] lg:grid-cols-[minmax(420px,0.84fr)_minmax(480px,1.16fr)]">
        <section className="flex flex-col justify-center px-6 py-10 sm:px-12 lg:px-16 lg:py-14">
          <div className="mx-auto w-full max-w-[440px]">
            <div className="mb-10">
              <span aria-hidden="true" className="mb-3 block h-[3px] w-7" style={{ backgroundColor: MAGENTA }} />
              <Wordmark branding={branding} />
              <AppLine app={branding?.bravelabsApp} />
            </div>

            {titleContent && (
              <div className="mb-7 flex flex-col items-start space-y-2 text-left [&_h1]:text-left [&_h1]:text-3xl [&_h1]:leading-tight [&_h1]:font-semibold [&_h1]:tracking-[-0.025em] [&_h1]:text-[#001222] dark:[&_h1]:text-white [&_p]:text-[#535252] dark:[&_p]:text-gray-300">
                {titleContent}
              </div>
            )}

            <div className="w-full">{formContent}</div>
          </div>
        </section>

        <aside
          className="relative hidden flex-col justify-end p-14 text-white lg:flex xl:p-20"
          style={{ backgroundColor: INK }}
        >
          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: MAGENTA }} />
          <p className="text-[11px] font-bold tracking-[0.12em] text-[#A2DEE1] uppercase">
            <Translated i18nKey="bravelabsIdEyebrow" namespace="common" />
          </p>
          <h2 className="mt-4 max-w-[520px] text-4xl leading-[1.07] font-semibold tracking-[-0.04em] xl:text-5xl">
            <Translated i18nKey="bravelabsIdHeadline" namespace="common" />
          </h2>
          <p className="mt-6 max-w-[460px] text-[15px] leading-[23px] text-[#B9C2CE]">
            <Translated i18nKey="bravelabsIdBody" namespace="common" />
          </p>
        </aside>
      </div>
    </div>
  );
}

// The shared logo from the organisation branding; a text wordmark if none is set.
function Wordmark({ branding }: { branding?: AppBrandingSettings }) {
  const light = branding?.lightTheme?.logoUrl;
  const dark = branding?.darkTheme?.logoUrl || light;
  if (!light && !dark) {
    return <p className="text-[13px] font-bold tracking-[0.14em] text-[#001222] uppercase dark:text-white">BraveLabs</p>;
  }
  return (
    <>
      {light && <img src={light} alt="BraveLabs" className="block h-6 w-auto dark:hidden" />}
      {dark && <img src={dark} alt="BraveLabs" className="hidden h-6 w-auto dark:block" />}
    </>
  );
}

// "Sign in to {application}" (+ optional description) for an allowlisted client,
// "Sign in with BraveLabs ID" otherwise; nothing outside a sign-in request.
function AppLine({ app }: { app?: AppContext }) {
  if (!app) return null;
  return (
    <div className="mt-4 space-y-1" data-testid="app-caption">
      <p className="text-[15px] leading-snug font-semibold text-[#001222] dark:text-white">
        {app.name ? (
          <Translated i18nKey="signInTo" namespace="common" data={{ appName: app.name }} />
        ) : (
          <Translated i18nKey="signInGeneric" namespace="common" />
        )}
      </p>
      {app.name && app.description && (
        <p className="text-[13px] leading-snug text-[#535252] dark:text-gray-300">{app.description}</p>
      )}
    </div>
  );
}
