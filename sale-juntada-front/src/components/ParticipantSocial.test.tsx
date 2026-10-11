import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { AttendanceSummary } from "./AttendanceSummary";
import { ParticipantInstagramEditor } from "./ParticipantInstagramEditor";
import type { Gathering, Participant } from "../services/gatheringService";
const mocks = vi.hoisted(() => ({ birthday: vi.fn(), instagram: vi.fn() }));
vi.mock("../services/gatheringService", () => ({ gatheringService: { updateBirthday: mocks.birthday, updateInstagram: mocks.instagram } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const participant = { id: "p", name: "Sofi", isOrganizer: true, availabilities: [], instagramUsername: "sofi.test", isBirthdayPerson: true } as unknown as Participant;
const gathering = { id: "g", slug: "cumple", status: "OPEN", participants: [participant, { ...participant, id: "other", name: "Luca", isOrganizer: false }] } as Gathering;
it("shows several birthday people and group Instagram links", () => {
  render(<MemoryRouter><AttendanceSummary gathering={gathering} viewerId="other" token="token" /></MemoryRouter>);
  expect(screen.getAllByText("¡Festejamos su cumple!")).toHaveLength(2);
  expect(screen.getAllByRole("link", { name: "@sofi.test" })[0]).toHaveAttribute("href", "https://www.instagram.com/sofi.test/");
  expect(screen.queryByRole("button", { name: /como cumpleañero/ })).not.toBeInTheDocument();
});
it("lets the organizer unmark a birthday person after the server confirms", async () => {
  mocks.birthday.mockResolvedValue({ id: "other", isBirthdayPerson: false });
  const updated = vi.fn();
  render(<MemoryRouter><AttendanceSummary gathering={gathering} viewerId="p" token="token" onBirthdayUpdated={updated} /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Desmarcar a Luca como cumpleañero" }));
  await waitFor(() => expect(updated).toHaveBeenCalledWith("other", false));
  expect(mocks.birthday).toHaveBeenCalledWith("g", "p", "token", "other", false);
});
it("preserves the birthday marker if saving fails", async () => {
  mocks.birthday.mockRejectedValue(new Error("Sin conexión"));
  const updated = vi.fn();
  render(<MemoryRouter><AttendanceSummary gathering={gathering} viewerId="p" token="token" onBirthdayUpdated={updated} /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Desmarcar a Luca como cumpleañero" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Sin conexión");
  expect(updated).not.toHaveBeenCalled();
});
it("lets a guest remove their Instagram", async () => {
  mocks.instagram.mockResolvedValue({ id: "p", instagramUsername: null });
  const saved = vi.fn();
  render(<ParticipantInstagramEditor gatheringId="g" participant={participant} token="token" onSaved={saved} />);
  fireEvent.change(screen.getByLabelText("Usuario de Instagram (opcional)"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar Instagram" }));
  await waitFor(() => expect(saved).toHaveBeenCalledWith(null));
  expect(mocks.instagram).toHaveBeenCalledWith("g", "p", "token", "");
});
