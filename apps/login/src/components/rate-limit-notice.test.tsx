import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { RateLimitNotice, retryAfterSeconds } from "./rate-limit-notice";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, data?: { seconds?: number }) => `${key}${data?.seconds ? `:${data.seconds}` : ""}`,
}));

const reply = (status: number, headers: Record<string, string> = {}) =>
  vi.fn(async () => new Response("<html>429</html>", { status, headers: { "content-type": "text/html", ...headers } }));

describe("RateLimitNotice", () => {
  const realFetch = window.fetch;
  beforeEach(() => {
    window.fetch = reply(200);
  });
  afterEach(() => {
    cleanup();
    window.fetch = realFetch;
  });

  async function post(fetchImpl: ReturnType<typeof reply>, method = "POST") {
    // The notice wraps whatever fetch was installed at mount; swap the inner one by remounting.
    window.fetch = fetchImpl;
    const view = render(<RateLimitNotice />);
    const response = await act(() => window.fetch("/ui/v2/login/password", { method }));
    return { view, response };
  }

  test("shows the wait from Retry-After on a 429 POST and passes the response through", async () => {
    const { response } = await post(reply(429, { "retry-after": "10" }));
    expect(response.status).toBe(429);
    expect(screen.getByTestId("rate-limit-notice").textContent).toContain("rateLimitedSeconds:10");
  });

  test("shows the generic text when the gateway sends no Retry-After", async () => {
    await post(reply(429));
    expect(screen.getByTestId("rate-limit-notice").textContent).toContain("rateLimited");
    expect(screen.getByTestId("rate-limit-notice").textContent).not.toContain(":");
  });

  test("ignores a 429 to a GET and stays hidden on success", async () => {
    await post(reply(429), "GET");
    expect(screen.queryByTestId("rate-limit-notice")).toBeNull();
  });

  test("clears after the next POST that is not refused", async () => {
    const inner = reply(429);
    await post(inner);
    inner.mockImplementation(async () => new Response("ok", { status: 200 }));
    await act(() => window.fetch("/ui/v2/login/password", { method: "POST" }));
    expect(screen.queryByTestId("rate-limit-notice")).toBeNull();
  });

  test("restores the original fetch on unmount", async () => {
    const inner = reply(200);
    const { view } = await post(inner);
    view.unmount();
    expect(window.fetch).toBe(inner);
  });

  test("parses only positive integer seconds", () => {
    expect(retryAfterSeconds("10")).toBe(10);
    expect(retryAfterSeconds(null)).toBeNull();
    expect(retryAfterSeconds("0")).toBeNull();
    expect(retryAfterSeconds("Wed, 21 Oct 2015 07:28:00 GMT")).toBeNull();
  });
});
