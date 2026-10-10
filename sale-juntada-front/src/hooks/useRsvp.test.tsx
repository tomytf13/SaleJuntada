import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import type { Gathering } from "../services/gatheringService";
import { gatheringService } from "../services/gatheringService";
import { gatheringKey } from "./useGathering";
import { useRsvp } from "./useRsvp";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("revierte una respuesta fallida sin perder la respuesta recibida de otro invitado", async () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const key = gatheringKey("asado", "my-token");
  const gathering: Gathering = {
    id: "gathering",
    slug: "asado",
    title: "Asado",
    status: "CONFIRMED",
    windowStart: "2026-10-03",
    windowEnd: "2026-10-04",
    durationMinutes: 180,
    participants: [
      {
        id: "me",
        name: "Sofi",
        isOrganizer: false,
        rsvpStatus: null,
        plusOnes: 0,
      },
      {
        id: "friend",
        name: "Tomy",
        isOrganizer: true,
        rsvpStatus: null,
        plusOnes: 0,
      },
    ],
  };
  client.setQueryData(key, gathering);
  let rejectSave!: (reason: Error) => void;
  vi.spyOn(gatheringService, "setRsvp").mockImplementation(
    () =>
      new Promise((_resolve, reject) => {
        rejectSave = reject;
      }),
  );
  const { result } = renderHook(
    () =>
      useRsvp("asado", "gathering", {
        participantId: "me",
        responseToken: "my-token",
      }),
    {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
  act(() => result.current.mutate({ status: "GOING", plusOnes: 1 }));
  await waitFor(() =>
    expect(
      client.getQueryData<Gathering>(key)?.rsvpSummary?.goingHeadcount,
    ).toBe(2),
  );
  client.setQueryData<Gathering>(key, (current) => ({
    ...current!,
    participants: current!.participants.map((p) =>
      p.id === "friend" ? { ...p, rsvpStatus: "GOING", plusOnes: 2 } : p,
    ),
  }));
  act(() => rejectSave(new Error("Sin conexión")));
  await waitFor(() => expect(result.current.isError).toBe(true));
  const current = client.getQueryData<Gathering>(key)!;
  expect(current.participants[0].rsvpStatus).toBeNull();
  expect(current.participants[1].rsvpStatus).toBe("GOING");
  expect(current.rsvpSummary?.goingHeadcount).toBe(3);
  expect(client.getQueryData(gatheringKey("asado"))).toBeUndefined();
  client.clear();
});
