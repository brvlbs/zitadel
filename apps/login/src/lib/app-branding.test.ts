import { describe, expect, test } from "vitest";
import {
  inviteAppCookieValue,
  invitedApp,
  oidcAuthRequestId,
  parseAppBranding,
  parseAppUrl,
  withAppContext,
} from "./app-branding";

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

describe("parseAppUrl", () => {
  test("accepts absolute https URLs only", () => {
    expect(parseAppUrl("https://leadhub.example.com/")).toBe("https://leadhub.example.com/");
    expect(parseAppUrl("https://leadhub.example.com/app?x=1")).toBe("https://leadhub.example.com/app?x=1");
  });

  test.each([
    ["http", "http://leadhub.example.com/"],
    ["javascript", "javascript:alert(1)"],
    ["data", "data:text/html,<script>alert(1)</script>"],
    ["protocol-relative", "//evil.example/"],
    ["relative", "/dashboard"],
    ["username", "https://user@leadhub.example.com/"],
    ["password", "https://user:pw@leadhub.example.com/"],
    ["too long", `https://leadhub.example.com/${"x".repeat(300)}`],
    ["empty", ""],
    ["not a string", 5],
  ])("rejects %s", (_, value) => {
    expect(parseAppUrl(value)).toBeUndefined();
  });

  test("an invalid url is dropped but the entry kept", () => {
    const apps = parseAppBranding(
      JSON.stringify({
        leadhub: { name: "Lead Hub", url: "https://leadhub.example.com/" },
        insecure: { name: "Insecure", description: "Kept", url: "http://insecure.example/" },
        script: { name: "Script", url: "javascript:alert(1)" },
      }),
    );
    expect(apps.get("leadhub")).toEqual({ name: "Lead Hub", url: "https://leadhub.example.com/" });
    expect(apps.get("insecure")).toEqual({ name: "Insecure", description: "Kept" });
    expect(apps.get("script")).toEqual({ name: "Script" });
  });
});

describe("invitation app", () => {
  const apps = parseAppBranding(
    JSON.stringify({
      "123@leadhub": { name: "Lead Hub", url: "https://leadhub.example.com/" },
      nourl: { name: "No URL" },
    }),
  );
  const params = (query: string) => new URLSearchParams(query);

  test("stores a configured client id from an invitation link on /verify", () => {
    expect(inviteAppCookieValue("/verify", params("userId=1&code=x&invite=true&app=123%40leadhub"), apps)).toBe(
      "123@leadhub",
    );
  });

  test("clears the cookie for an invitation without a usable app", () => {
    expect(inviteAppCookieValue("/verify", params("invite=true"), apps)).toBeNull();
    expect(inviteAppCookieValue("/verify", params("invite=true&app=unknown"), apps)).toBeNull();
    expect(inviteAppCookieValue("/verify", params("invite=true&app=nourl"), apps)).toBeNull();
    expect(inviteAppCookieValue("/verify", params("invite=true&app=https://evil.example"), apps)).toBeNull();
  });

  test("leaves the cookie alone outside an invitation link", () => {
    expect(inviteAppCookieValue("/verify", params("app=123%40leadhub"), apps)).toBeUndefined();
    expect(inviteAppCookieValue("/password/set", params("invite=true&app=123%40leadhub"), apps)).toBeUndefined();
    expect(inviteAppCookieValue("/signedin", params(""), apps)).toBeUndefined();
  });

  test("resolves only configured applications with a url", () => {
    expect(invitedApp("123@leadhub", apps)).toEqual({ name: "Lead Hub", url: "https://leadhub.example.com/" });
    expect(invitedApp("nourl", apps)).toBeUndefined();
    expect(invitedApp("unknown", apps)).toBeUndefined();
    expect(invitedApp(undefined, apps)).toBeUndefined();
  });
});
