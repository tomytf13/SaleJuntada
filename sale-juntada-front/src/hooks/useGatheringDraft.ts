import { createContext, useContext, useEffect, useState } from "react";

// Borradores en memoria, aislados por juntada. Se descartan al salir de ella;
// no guardamos información personal en almacenamiento persistente.
export const GatheringDraftContext = createContext<Map<string, unknown> | null>(null);

export function useGatheringDraft<T>(key: string, initial: T | (() => T)) {
  const drafts = useContext(GatheringDraftContext);
  const state = useState<T>(() => {
    if (drafts?.has(key)) return drafts.get(key) as T;
    return typeof initial === "function" ? (initial as () => T)() : initial;
  });
  const [value] = state;
  useEffect(() => {
    drafts?.set(key, value);
  }, [drafts, key, value]);
  return state;
}
