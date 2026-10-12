import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Link, MemoryRouter } from "react-router-dom";
import App from "./App";

vi.mock("./routes/LandingPage", () => ({ default: () => <p>Inicio</p> }));
vi.mock("./routes/GatheringPage", () => ({ default: () => <p>Invitación</p> }));
vi.mock("./routes/NotFoundPage", () => ({ default: () => <p>No encontrada</p> }));

afterEach(() => {
  cleanup();
  document.querySelector('meta[name="robots"]')?.remove();
  document.querySelector('link[rel="canonical"]')?.remove();
});

it("keeps invitations and missing pages out of search and restores home metadata on navigation", async () => {
  render(<MemoryRouter><nav><Link to="/">Home</Link><Link to="/j/privada/invitados">Private</Link><Link to="/no-existe">Missing</Link></nav><App /></MemoryRouter>);
  const robots = () => document.querySelector('meta[name="robots"]')?.getAttribute("content");
  const canonical = () => document.querySelector('link[rel="canonical"]')?.getAttribute("href");
  await waitFor(() => expect(robots()).toBe("index, follow"));
  expect(canonical()).toBe("https://salejuntada.com.ar/");
  for (const name of ["Private", "Missing"]) {
    fireEvent.click(screen.getByRole("link", { name }));
    await waitFor(() => expect(robots()).toBe("noindex, nofollow"));
    expect(canonical()).toBeUndefined();
  }
  fireEvent.click(screen.getByRole("link", { name: "Home" }));
  await waitFor(() => expect(robots()).toBe("index, follow"));
  expect(canonical()).toBe("https://salejuntada.com.ar/");
});
