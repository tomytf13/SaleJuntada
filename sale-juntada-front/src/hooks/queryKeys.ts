export const checklistKey = (gatheringId: string, token: string) =>
  ["checklist", gatheringId, token] as const;
