import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  gatheringService,
  type Gathering,
  type Participant,
  type RsvpStatus,
} from "../services/gatheringService";
import { gatheringKey } from "./useGathering";

export function summarizeAttendance(participants: Participant[]) {
  return participants.reduce(
    (summary, participant) => {
      if (participant.rsvpStatus === "GOING") {
        summary.going += 1;
        summary.goingHeadcount += 1 + (participant.plusOnes ?? 0);
      } else if (participant.rsvpStatus === "MAYBE") summary.maybe += 1;
      else if (participant.rsvpStatus === "NOT_GOING") summary.notGoing += 1;
      else summary.pending += 1;
      return summary;
    },
    { going: 0, maybe: 0, notGoing: 0, pending: 0, goingHeadcount: 0 },
  );
}

export function useRsvp(
  slug: string,
  gatheringId: string | undefined,
  session: { participantId: string; responseToken: string } | null,
) {
  const client = useQueryClient();
  const key = gatheringKey(slug, session?.responseToken);
  return useMutation({
    mutationFn: (input: { status: RsvpStatus; plusOnes: number }) => {
      if (!session || !gatheringId)
        throw new Error("Sumate primero a la juntada.");
      return gatheringService.setRsvp(
        gatheringId,
        session.participantId,
        session.responseToken,
        input,
      );
    },
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: key, exact: true });
      const previous = client
        .getQueryData<Gathering>(key)
        ?.participants.find((p) => p.id === session?.participantId);
      client.setQueryData<Gathering>(key, (current) => {
        if (!current) return current;
        const participants = current.participants.map((p) =>
          p.id === session?.participantId
            ? {
                ...p,
                rsvpStatus: input.status,
                plusOnes: input.status === "GOING" ? input.plusOnes : 0,
              }
            : p,
        );
        return {
          ...current,
          participants,
          rsvpSummary: summarizeAttendance(participants),
        };
      });
      return { previous };
    },
    onError: (_error, _input, context) => {
      // Revertimos sólo mi respuesta; conservamos cambios del resto en vivo.
      client.setQueryData<Gathering>(key, (current) => {
        if (!current || !context?.previous) return current;
        const previous = context.previous;
        const participants = current.participants.map((p) =>
          p.id === previous.id
            ? {
                ...p,
                rsvpStatus: previous.rsvpStatus,
                plusOnes: previous.plusOnes,
                rsvpAt: previous.rsvpAt,
              }
            : p,
        );
        return {
          ...current,
          participants,
          rsvpSummary: summarizeAttendance(participants),
        };
      });
    },
    onSettled: () => client.invalidateQueries({ queryKey: key, exact: true }),
  });
}
