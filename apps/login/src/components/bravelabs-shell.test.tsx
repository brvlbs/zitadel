import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { BraveLabsShell } from "./bravelabs-shell";

vi.mock("next-intl", () => ({
  useTranslations:
    (namespace?: string) =>
    (key: string, data?: Record<string, string>) =>
      `${namespace ? `${namespace}.` : ""}${key}${data?.appName ? `:${data.appName}` : ""}`,
}));

const page = [<h1 key="t">Password</h1>, <form key="f" aria-label="form" />];

describe("BraveLabsShell", () => {
  afterEach(cleanup);

  test("names an allowlisted application with its description", () => {
    render(
      <BraveLabsShell branding={{ bravelabsApp: { name: "Lead Hub", description: "Leads and campaigns" } } as any}>
        {page}
      </BraveLabsShell>,
    );
    expect(screen.getByTestId("app-caption").textContent).toContain("common.signInTo:Lead Hub");
    expect(screen.getByText("Leads and campaigns")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Password" })).toBeTruthy();
    expect(screen.getByRole("form", { name: "form" })).toBeTruthy();
  });

  test("falls back to the generic BraveLabs ID line for an unknown application", () => {
    render(<BraveLabsShell branding={{ bravelabsApp: {} } as any}>{page}</BraveLabsShell>);
    expect(screen.getByTestId("app-caption").textContent).toBe("common.signInGeneric");
  });

  test("shows no application line outside a sign-in request", () => {
    render(<BraveLabsShell branding={{} as any}>{page}</BraveLabsShell>);
    expect(screen.queryByTestId("app-caption")).toBeNull();
  });

  test("uses the shared organisation logo, or a text wordmark when none is set", () => {
    render(
      <BraveLabsShell branding={{ lightTheme: { logoUrl: "https://auth.example/logo.svg" } } as any}>
        {page}
      </BraveLabsShell>,
    );
    expect(screen.getAllByAltText("BraveLabs")[0].getAttribute("src")).toBe("https://auth.example/logo.svg");
    cleanup();
    render(<BraveLabsShell>{page}</BraveLabsShell>);
    expect(screen.getByText("BraveLabs")).toBeTruthy();
  });
});
