import { act, cleanup, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import en from "../../locales/en.json";
import nl from "../../locales/nl.json";
import { RateLimitNotice, retryAfterSeconds } from "./rate-limit-notice";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, data?: { seconds?: number }) => `${key}${data?.seconds ? `:${data.seconds}` : ""}`,
}));

const reply = (status: number, headers: Record<string, string> = {}) =>
  vi.fn(async () => new Response("<html>429</html>", { status, headers: { "content-type": "text/html", ...headers } }));

const notice = () => screen.queryByTestId("rate-limit-notice");

describe("RateLimitNotice", () => {
  const realFetch = window.fetch;
  beforeEach(() => {
    window.fetch = reply(200);
  });
  afterEach(() => {
    cleanup();
    window.fetch = realFetch;
  });

  // Installs fetchImpl as the fetch the notice wraps at mount, then sends one request through the wrapper.
  async function post(fetchImpl: ReturnType<typeof reply>, method = "POST") {
    window.fetch = fetchImpl;
    const view = render(<RateLimitNotice />);
    const response = await act(() => window.fetch("/ui/v2/login/password", { method }));
    return { view, response };
  }

  test("shows the wait from Retry-After on a 429 POST and passes the response through", async () => {
    const { response } = await post(reply(429, { "retry-after": "10" }));
    expect(response.status).toBe(429);
    expect(notice()?.textContent).toContain("rateLimitedSeconds:10");
  });

  test("shows the generic text when the gateway sends no Retry-After", async () => {
    await post(reply(429));
    expect(notice()?.textContent).toContain("rateLimited");
    expect(notice()?.textContent).not.toContain(":");
  });

  test("ignores a 429 to a GET and stays hidden on success", async () => {
    await post(reply(429), "GET");
    expect(notice()).toBeNull();
  });

  test("reads the method from a Request object", async () => {
    window.fetch = reply(429, { "retry-after": "7" });
    render(<RateLimitNotice />);
    await act(() => window.fetch(new Request("http://localhost/ui/v2/login/password", { method: "POST" })));
    expect(notice()?.textContent).toContain("rateLimitedSeconds:7");
  });

  test("clears after the next POST that is not refused", async () => {
    const inner = reply(429);
    await post(inner);
    inner.mockImplementation(async () => new Response("ok", { status: 200 }));
    await act(() => window.fetch("/ui/v2/login/password", { method: "POST" }));
    expect(notice()).toBeNull();
  });

  test("restores the original fetch on unmount", async () => {
    const inner = reply(200);
    const { view } = await post(inner);
    view.unmount();
    expect(window.fetch).toBe(inner);
  });

  test("leaves a later wrapper in place on unmount", async () => {
    const { view } = await post(reply(200));
    const later = vi.fn();
    window.fetch = later;
    view.unmount();
    expect(window.fetch).toBe(later);
  });

  test("wraps once under StrictMode's double mount and unwinds cleanly", async () => {
    const inner = reply(429, { "retry-after": "5" });
    window.fetch = inner;
    const view = render(
      <StrictMode>
        <RateLimitNotice />
      </StrictMode>,
    );
    await act(() => window.fetch("/ui/v2/login/password", { method: "POST" }));
    expect(inner).toHaveBeenCalledTimes(1);
    expect(notice()?.textContent).toContain("rateLimitedSeconds:5");
    view.unmount();
    expect(window.fetch).toBe(inner);
  });

  test("accepts only whole seconds 1..3600", () => {
    expect(retryAfterSeconds("10")).toBe(10);
    expect(retryAfterSeconds(" 10 ")).toBe(10);
    expect(retryAfterSeconds("3600")).toBe(3600);
    for (const odd of [
      null,
      "",
      "0",
      "3601",
      "9999",
      "12345",
      "1e3",
      "0x10",
      "1.5",
      "-5",
      "Wed, 21 Oct 2015 07:28:00 GMT",
    ]) {
      expect(retryAfterSeconds(odd)).toBeNull();
    }
  });

  test("both strings exist in en and nl", () => {
    for (const messages of [en, nl] as { common: Record<string, string> }[]) {
      expect(messages.common.rateLimited).toBeTruthy();
      expect(messages.common.rateLimitedSeconds).toContain("{seconds}");
    }
  });
});
