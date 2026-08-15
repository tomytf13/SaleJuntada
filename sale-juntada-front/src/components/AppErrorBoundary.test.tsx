import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "./AppErrorBoundary";

afterEach(cleanup);

function BrokenScreen(): never {
  throw new Error("render failed");
}

describe("AppErrorBoundary", () => {
  it("ofrece una recuperación clara si falla una pantalla", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <AppErrorBoundary>
        <BrokenScreen />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "La juntada sigue guardada",
    );
    expect(screen.getByRole("button", { name: /Recargar la app/i })).toBeTruthy();
    consoleError.mockRestore();
  });
});
