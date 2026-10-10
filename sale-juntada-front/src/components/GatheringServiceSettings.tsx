import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  gatheringService,
  type ExpenseSettlement,
  type Gathering,
  type GatheringServiceKey,
  type Participant,
} from "../services/gatheringService";
import { gatheringKey } from "../hooks/useGathering";
import {
  gatheringModules,
  isGatheringServiceEnabled,
  optionalGatheringServices,
} from "../utils/gatheringModules";

export function GatheringServiceSettings({
  gathering,
  participant,
  token,
  settlement,
}: {
  gathering: Gathering;
  participant: Participant;
  token: string;
  settlement: ExpenseSettlement | null;
}) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({
      service,
      enabled,
    }: {
      service: GatheringServiceKey;
      enabled: boolean;
    }) =>
      gatheringService.setGatheringService(
        gathering.id,
        participant.id,
        token,
        service,
        enabled,
      ),
    onSettled: () =>
      client.invalidateQueries({
        queryKey: gatheringKey(gathering.slug, token),
        exact: true,
      }),
  });
  const accountsCanClose =
    settlement &&
    settlement.transfers.length === 0 &&
    (!settlement.expenses.length || settlement.allReady);
  return (
    <section
      className="service-settings"
      aria-labelledby="service-settings-title"
    >
      <span className="section-kicker">ORGANIZÁS VOS</span>
      <h2 id="service-settings-title">Elegí los servicios de la juntada</h2>
      <p>
        Los cambios se guardan para todo el grupo. Al desactivar un servicio, su
        historial queda disponible en modo lectura.
      </p>
      <div className="service-settings-list">
        {gatheringModules.map(({ path, title, detail, icon: Icon }) => {
          const optional = optionalGatheringServices.includes(
            path as GatheringServiceKey,
          );
          const enabled = isGatheringServiceEnabled(gathering, path);
          const pending =
            mutation.isPending && mutation.variables?.service === path;
          const accountsBlocked =
            path === "cuentas" && enabled && !accountsCanClose;
          const helper = accountsBlocked
            ? settlement
              ? "Para desactivarlo, primero cierren los gastos y resuelvan las transferencias."
              : "Consultando si quedan cuentas por resolver…"
            : optional
              ? enabled
                ? detail
                : "Desactivado · historial disponible"
              : "Siempre disponible";
          return (
            <div
              className={`service-settings-row ${enabled ? "" : "archived"}`}
              data-service={path}
              key={path}
            >
              <span className="service-icon">
                <Icon size={21} aria-hidden="true" />
              </span>
              <div className="service-settings-copy">
                <Link to={`/j/${gathering.slug}/${path}`}>{title} ↗</Link>
                <p id={`service-help-${path}`}>{helper}</p>
              </div>
              {optional ? (
                <label className="service-switch">
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label={title}
                    aria-describedby={`service-help-${path}`}
                    checked={pending ? mutation.variables!.enabled : enabled}
                    disabled={
                      mutation.isPending ||
                      gathering.status === "CANCELLED" ||
                      Boolean(accountsBlocked)
                    }
                    onChange={(event) =>
                      mutation.mutate({
                        service: path as GatheringServiceKey,
                        enabled: event.target.checked,
                      })
                    }
                  />
                  <span aria-hidden="true">
                    {pending ? "Guardando…" : enabled ? "Activo" : "Inactivo"}
                  </span>
                </label>
              ) : (
                <span className="service-fixed">Base</span>
              )}
            </div>
          );
        })}
      </div>
      {mutation.error ? (
        <p className="form-error" role="alert">
          {mutation.error.message}
        </p>
      ) : null}
      {mutation.isSuccess && !mutation.isPending ? (
        <p role="status">Servicios actualizados para todo el grupo.</p>
      ) : null}
    </section>
  );
}
