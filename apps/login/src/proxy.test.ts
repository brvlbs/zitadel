import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const BASE_PATH = "/ui/v2/login";

function request(path: string, cookie?: string) {
  return new NextRequest(`https://login.example${BASE_PATH}${path}`, {
    headers: cookie ? { cookie } : {},
    nextConfig: { basePath: BASE_PATH },
  });
}

describe("BraveLabs invitation app cookie", () => {
  let setInviteAppCookie: typeof import("./proxy").setInviteAppCookie;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", BASE_PATH);
    vi.stubEnv(
      "BRAVELABS_APP_BRANDING",
      JSON.stringify({ "123@leadhub": { name: "Lead Hub", url: "https://leadhub.example.com/" } }),
    );
    ({ setInviteAppCookie } = await import("./proxy"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("sets a short-lived, scoped, HttpOnly cookie for a configured app on an invitation link", () => {
    const response = NextResponse.next();
    setInviteAppCookie(request("/verify?userId=1&code=x&invite=true&app=123%40leadhub"), response);
    const cookie = response.cookies.get("bravelabs_invite_app");
    expect(cookie?.value).toBe("123@leadhub");
    expect(cookie).toMatchObject({ path: BASE_PATH, maxAge: 3600, httpOnly: true, secure: true, sameSite: "lax" });
  });

  test("never stores an unknown app", () => {
    const response = NextResponse.next();
    setInviteAppCookie(request("/verify?invite=true&app=unknown"), response);
    expect(response.cookies.get("bravelabs_invite_app")).toBeUndefined();
  });

  test("clears a previous invitation's app on a new invitation without one", () => {
    const response = NextResponse.next();
    setInviteAppCookie(request("/verify?invite=true", "bravelabs_invite_app=123@leadhub"), response);
    expect(response.cookies.get("bravelabs_invite_app")).toMatchObject({ value: "", maxAge: 0 });
  });

  test("later setup steps leave the cookie untouched", () => {
    for (const path of ["/authenticator/set?loginName=a", "/password/set?invite=true", "/mfa/set", "/signedin"]) {
      const response = NextResponse.next();
      setInviteAppCookie(request(path, "bravelabs_invite_app=123@leadhub"), response);
      expect(response.headers.get("set-cookie")).toBeNull();
    }
  });
});
