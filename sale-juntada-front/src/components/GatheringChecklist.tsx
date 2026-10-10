import { useGatheringDraft } from "../hooks/useGatheringDraft";
import { type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  gatheringService,
  type ChecklistAction,
  type Gathering,
  type Participant,
} from "../services/gatheringService";
import { checklistKey } from "../hooks/queryKeys";

const suggestions = [
  "Carbón",
  "Sal",
  "Herramientas para el asado",
  "Diario para limpiar la parrilla",
  "Parlante",
];
type Operation =
  | { action: "add"; label: string }
  | { action: "remove"; itemId: string }
  | { action: ChecklistAction; itemId: string; assignedParticipantId?: string };

export function GatheringChecklist({
  gathering,
  participant,
  token,
  readOnly = false,
}: {
  gathering: Gathering;
  participant: Participant;
  token: string;
  readOnly?: boolean;
}) {
  const [label, setLabel] = useGatheringDraft("checklist-label", "");
  const client = useQueryClient();
  const key = checklistKey(gathering.id, token);
  const query = useQuery({
    queryKey: key,
    queryFn: () => gatheringService.getChecklist(gathering.id, token),
    refetchInterval: 30_000,
  });
  const mutation = useMutation({
    mutationFn: async (operation: Operation) => {
      if (operation.action === "add")
        return gatheringService.addChecklistItem(
          gathering.id,
          participant.id,
          token,
          operation.label,
        );
      if (operation.action === "remove")
        return gatheringService.removeChecklistItem(
          gathering.id,
          participant.id,
          token,
          operation.itemId,
        );
      return gatheringService.updateChecklistItem(
        gathering.id,
        participant.id,
        token,
        operation.itemId,
        operation.action,
        operation.assignedParticipantId,
      );
    },
    onSuccess: (_result, operation) => {
      if (operation.action === "add") setLabel("");
    },
    onSettled: () => client.invalidateQueries({ queryKey: key, exact: true }),
  });
  const items = query.data ?? [];
  const disabled =
    readOnly || mutation.isPending || gathering.status === "CANCELLED";
  const add = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (label.trim().length >= 2)
      mutation.mutate({ action: "add", label: label.trim() });
  };
  return (
    <section
      className="gathering-checklist"
      id="necesidades"
      aria-labelledby="checklist-title"
    >
      <span className="section-kicker">PARA QUE SALGA</span>
      <h2 id="checklist-title">Qué falta resolver</h2>
      <p>Todo lo que necesitamos, quién se encarga y qué ya está listo.</p>
      <p className="checklist-counts" aria-live="polite">
        {items.filter((item) => !item.assignedParticipantId).length} sin
        responsable ·{" "}
        {
          items.filter((item) => item.assignedParticipantId && !item.isReady)
            .length
        }{" "}
        por resolver ·{" "}
        {
          items.filter((item) => item.assignedParticipantId && item.isReady)
            .length
        }{" "}
        resueltas
      </p>
      {!readOnly && gathering.status !== "CANCELLED" ? (
        <>
          <form className="checklist-add" onSubmit={add}>
            <label htmlFor="checklist-label">Agregar una necesidad</label>
            <div>
              <input
                id="checklist-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Ej. carbón, parlante, reservar el lugar…"
                minLength={2}
                maxLength={120}
                required
                disabled={disabled}
              />
              <button
                type="submit"
                className="primary-button"
                disabled={disabled || query.isPending || Boolean(query.error)}
              >
                Agregar
              </button>
            </div>
          </form>
          <div
            className="checklist-suggestions"
            aria-label="Ideas para el asado"
          >
            {suggestions
              .filter(
                (suggestion) =>
                  !items.some(
                    (item) =>
                      item.label.toLocaleLowerCase() ===
                      suggestion.toLocaleLowerCase(),
                  ),
              )
              .map((suggestion) => (
                <button
                  type="button"
                  key={suggestion}
                  disabled={disabled || query.isPending || Boolean(query.error)}
                  onClick={() =>
                    mutation.mutate({ action: "add", label: suggestion })
                  }
                >
                  + {suggestion}
                </button>
              ))}
          </div>
        </>
      ) : null}
      {query.isPending ? (
        <p role="status">Cargando la lista…</p>
      ) : query.error ? (
        <div role="alert">
          <p>No pudimos cargar las necesidades.</p>
          <button type="button" onClick={() => void query.refetch()}>
            Reintentar
          </button>
        </div>
      ) : !items.length ? (
        <p className="checklist-empty">
          Todavía no hay necesidades anotadas. Agregá la primera para que no
          quede nada en el aire.
        </p>
      ) : null}
      {mutation.error ? (
        <p className="form-error" role="alert">
          {mutation.error.message}
        </p>
      ) : null}
      <ul className="checklist-items">
        {items.map((item) => {
          const mine = item.assignedParticipantId === participant.id;
          const canManage = mine || participant.isOrganizer;
          return (
            <li
              key={item.id}
              className={
                item.isReady && item.assignedParticipantId ? "ready" : ""
              }
            >
              <div className="checklist-item-copy">
                <strong>{item.label}</strong>
                <span>
                  {item.assignee
                    ? `${item.assignee.name}${mine ? " (vos)" : ""} · ${item.isReady ? "Listo ✓" : "Pendiente"}`
                    : "Sin responsable"}
                </span>
              </div>
              <div className="checklist-item-actions">
                {!item.assignedParticipantId ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      mutation.mutate({ action: "claim", itemId: item.id })
                    }
                  >
                    Me encargo
                  </button>
                ) : canManage ? (
                  <>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        mutation.mutate({
                          action: item.isReady ? "pending" : "ready",
                          itemId: item.id,
                        })
                      }
                    >
                      {item.isReady ? "Volver a pendiente" : "Ya está listo"}
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        mutation.mutate({ action: "release", itemId: item.id })
                      }
                    >
                      Liberar
                    </button>
                  </>
                ) : null}
                {participant.isOrganizer ? (
                  <>
                    <select
                      aria-label={`Responsable de ${item.label}`}
                      value={item.assignedParticipantId ?? ""}
                      disabled={disabled}
                      onChange={(event) =>
                        mutation.mutate(
                          event.target.value
                            ? {
                                action: "assign",
                                itemId: item.id,
                                assignedParticipantId: event.target.value,
                              }
                            : { action: "release", itemId: item.id },
                        )
                      }
                    >
                      <option value="">Sin responsable</option>
                      {gathering.participants.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label={`Quitar ${item.label}`}
                      disabled={disabled}
                      onClick={() =>
                        mutation.mutate({ action: "remove", itemId: item.id })
                      }
                    >
                      Quitar
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
