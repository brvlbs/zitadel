import { describe, expect, test } from "vitest";
import { applyAppBranding, oidcAuthRequestId, parseAppBranding } from "./app-branding";

describe("parseAppBranding", () => {
  test("empty or invalid config yields no overrides", () => {
    expect(parseAppBranding(undefined).size).toBe(0);
    expect(parseAppBranding("").size).toBe(0);
    expect(parseAppBranding("not json").size).toBe(0);
    expect(parseAppBranding("[]").size).toBe(0);
  });

  test("keeps valid entries and drops invalid ones", () => {
    const apps = parseAppBranding(
      JSON.stringify({
        os: { name: "BraveLabs OS" },
        leadhub: { name: " Lead Hub ", accent: "#E6007E", logoUrl: "/assets/leadhub.svg" },
        badColour: { name: "X", accent: "red" },
        offOrigin: { name: "X", logoUrl: "https://evil.example/logo.svg" },
        protocolRelative: { name: "X", logoUrl: "//evil.example/logo.svg" },
        noName: { accent: "#000000" },
        longName: { name: "x".repeat(61) },
      }),
    );
    expect([...apps.keys()]).toEqual(["os", "leadhub"]);
    expect(apps.get("leadhub")).toEqual({ name: "Lead Hub", accent: "#E6007E", logoUrl: "/assets/leadhub.svg" });
  });
});

describe("oidcAuthRequestId", () => {
  test("only resolves oidc request ids", () => {
    expect(oidcAuthRequestId("oidc_123")).toBe("123");
    expect(oidcAuthRequestId("oidc_")).toBeUndefined();
    expect(oidcAuthRequestId("saml_123")).toBeUndefined();
    expect(oidcAuthRequestId("device_123")).toBeUndefined();
    expect(oidcAuthRequestId("123")).toBeUndefined();
    expect(oidcAuthRequestId(null)).toBeUndefined();
  });
});

describe("applyAppBranding", () => {
  const org = {
    lightTheme: { primaryColor: "#111111", logoUrl: "https://auth.example/light.svg" },
    darkTheme: { primaryColor: "#222222", logoUrl: "https://auth.example/dark.svg" },
  } as any;

  test("name only keeps organisation colours and logos", () => {
    const result = applyAppBranding(org, { name: "BraveLabs OS" });
    expect(result.appName).toBe("BraveLabs OS");
    expect(result.lightTheme).toEqual(org.lightTheme);
    expect(result.darkTheme).toEqual(org.darkTheme);
  });

  test("accent and logo override both themes without mutating the cached settings", () => {
    const result = applyAppBranding(org, { name: "Lead Hub", accent: "#e6007e", logoUrl: "/leadhub.svg" });
    expect(result.lightTheme?.primaryColor).toBe("#e6007e");
    expect(result.darkTheme?.primaryColor).toBe("#e6007e");
    expect(result.lightTheme?.logoUrl).toBe("/leadhub.svg");
    expect(result.darkTheme?.logoUrl).toBe("/leadhub.svg");
    expect(org.lightTheme.primaryColor).toBe("#111111");
  });

  test("dark variants win in the dark theme", () => {
    const result = applyAppBranding(org, {
      name: "Lead Hub",
      accent: "#e6007e",
      accentDark: "#ff4fa8",
      logoUrl: "/l.svg",
      logoUrlDark: "/d.svg",
    });
    expect(result.lightTheme?.primaryColor).toBe("#e6007e");
    expect(result.darkTheme?.primaryColor).toBe("#ff4fa8");
    expect(result.darkTheme?.logoUrl).toBe("/d.svg");
  });
});
