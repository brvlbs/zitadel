import { describe, expect, test } from "vitest";
import { oidcAuthRequestId, parseAppBranding, withAppContext } from "./app-branding";

describe("parseAppBranding", () => {
  test("empty or invalid config yields no applications", () => {
    expect(parseAppBranding(undefined).size).toBe(0);
    expect(parseAppBranding("").size).toBe(0);
    expect(parseAppBranding("not json").size).toBe(0);
    expect(parseAppBranding("[]").size).toBe(0);
  });

  test("keeps valid entries and drops invalid ones", () => {
    const apps = parseAppBranding(
      JSON.stringify({
        os: { name: "BraveLabs OS" },
        leadhub: { name: " Lead Hub ", description: " Leads and campaigns " },
        noName: { description: "x" },
        blankName: { name: "  " },
        longName: { name: "x".repeat(61) },
        longDescription: { name: "X", description: "x".repeat(161) },
        nonStringDescription: { name: "X", description: 5 },
      }),
    );
    expect([...apps.keys()]).toEqual(["os", "leadhub"]);
    expect(apps.get("os")).toEqual({ name: "BraveLabs OS" });
    expect(apps.get("leadhub")).toEqual({ name: "Lead Hub", description: "Leads and campaigns" });
  });

  test("extra fields such as colours or logos are ignored, not applied", () => {
    const apps = parseAppBranding(JSON.stringify({ cc: { name: "Call Center", accent: "#e6007e", logoUrl: "/x.svg" } }));
    expect(apps.get("cc")).toEqual({ name: "Call Center" });
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

describe("withAppContext", () => {
  test("adds the application context without changing or mutating the shared branding", () => {
    const org = { lightTheme: { primaryColor: "#111111", logoUrl: "https://auth.example/light.svg" } } as any;
    const result = withAppContext(org, { name: "Lead Hub" });
    expect(result.bravelabsApp).toEqual({ name: "Lead Hub" });
    expect(result.lightTheme).toBe(org.lightTheme);
    expect(org.bravelabsApp).toBeUndefined();
  });
});
