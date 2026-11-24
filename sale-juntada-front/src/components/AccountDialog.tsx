import { useEffect, useState, type ReactNode } from "react";
import { AnimatedDialog } from "./AnimatedDialog";
import { useAuth } from "../auth/useAuth";
import {
  gatheringService,
  type GatheringHistoryItem,
} from "../services/gatheringService";

function userDisplayName(email: string | undefined, metadata: Record<string, unknown>) {
  const value = metadata.full_name ?? metadata.name ?? metadata.user_name;
  return typeof value === "string" && value.trim()
    ? value.trim()
    : email?.split("@")[0] ?? "Tu cuenta";
}

export function AccountDialog({
  open,
  onClose,
  onOpenGathering,
  onDuplicateGathering,
  profileEditor,
}: {
  profileEditor?: ReactNode;
  open: boolean;
  onClose(): void;
  onOpenGathering?(gathering: GatheringHistoryItem): void;
  onDuplicateGathering?(gathering: GatheringHistoryItem): void;
}) {
  const {
    configured,
    isLoading,
    initializationError,
    user,
    accessToken,
    signInWithGoogle,
    signOut,
  } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<GatheringHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [deletingGatheringId, setDeletingGatheringId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!open || !accessToken) return;

    let cancelled = false;
    void Promise.resolve()
      .then(() => {
        if (!cancelled) setIsLoadingHistory(true);
        return gatheringService.getMyGatherings(accessToken);
      })
      .then((items) => {
        if (!cancelled) setHistory(items);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "No pudimos recuperar tus juntadas.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, open]);

  const run = async (action: () => Promise<void>) => {
    setIsSubmitting(true);
    setError("");
    try {
      await action();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No pudimos completar el ingreso. Probá nuevamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteGathering = async (gathering: GatheringHistoryItem) => {
    if (!accessToken || deletingGatheringId) return;
    const confirmed = window.confirm(
      `¿Eliminar "${gathering.title}"? Esta acción es permanente y también borra sus participantes, horarios, compras y gastos.`,
    );
    if (!confirmed) return;

    setDeletingGatheringId(gathering.id);
    setError("");
    try {
      await gatheringService.deleteMyGathering(gathering.id, accessToken);
      setHistory((items) => items.filter((item) => item.id !== gathering.id));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No pudimos eliminar la juntada. Probá nuevamente.",
      );
    } finally {
      setDeletingGatheringId(null);
    }
  };

  const deleteAccount = async () => {
    if (!accessToken || !window.confirm("¿Eliminar tu cuenta y todas las juntadas que organizaste, también para tus invitados? En las juntadas de otras personas tus movimientos quedarán como Cuenta eliminada. Esta acción es permanente.")) return;
    await run(async () => {
      await gatheringService.deleteAccount(accessToken);
      Object.keys(localStorage).filter(key => key.startsWith("sale-juntada:")).forEach(key => localStorage.removeItem(key));
      try { await signOut(); } finally { window.location.replace("/"); }
    });
  };

  const metadata = user?.user_metadata ?? {};
  const name = userDisplayName(user?.email, metadata);
  const avatarValue = metadata.avatar_url ?? metadata.picture;
  const avatarUrl = typeof avatarValue === "string" ? avatarValue : null;

  return (
    <AnimatedDialog
      open={open}
      onClose={onClose}
      panelClassName="create-sheet account-sheet"
      label={user ? "Tu cuenta" : "Ingresar a Sale Juntada"}
    >
      <button className="close-button" type="button" onClick={onClose} aria-label="Cerrar">
        ×
      </button>

      {isLoading ? (
        <div className="account-loading" role="status">Recuperando tu sesión…</div>
      ) : user ? (
        <>
          <div className="account-profile">
            <div className="account-avatar" aria-hidden="true">
              {avatarUrl ? <img src={avatarUrl} alt="" /> : name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <span className="eyebrow">Sesión activa</span>
              <h2>{name}</h2>
              <p>{user.email}</p>
            </div>
          </div>
          <div className="account-success" role="status">
            Tu cuenta está lista. Las nuevas juntadas quedan vinculadas a este perfil.
          </div>
          {user.app_metadata?.sale_juntada_admin === true && <a href="/admin/reportes">Gestionar bugs e ideas</a>}
          {profileEditor}
          <section className="account-history" aria-labelledby="account-history-title">
            <div className="account-history-heading">
              <div>
                <span className="eyebrow">Historial</span>
                <h3 id="account-history-title">Mis juntadas</h3>
              </div>
              {history.length > 0 ? <span>{history.length}</span> : null}
            </div>

            {isLoadingHistory ? (
              <div className="account-history-empty" role="status">
                Buscando tus juntadas…
              </div>
            ) : history.length === 0 ? (
              <div className="account-history-empty">
                Todavía no tenés juntadas vinculadas. La próxima que organices
                aparecerá acá.
              </div>
            ) : (
              <div className="account-history-list">
                {history.map((gathering) => {
                  const eventDate = new Date(
                    gathering.finalizedStart ?? gathering.windowStart,
                  );
                  const dateLabel = new Intl.DateTimeFormat("es-AR", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }).format(eventDate);
                  return (
                    <article className="account-history-card" key={gathering.id}>
                      <button
                        className="account-history-main"
                        type="button"
                        onClick={() => onOpenGathering?.(gathering)}
                      >
                        <span>
                          {gathering.participant.isOrganizer
                            ? "Organizaste"
                            : "Participaste"}
                        </span>
                        <strong>{gathering.title}</strong>
                        <small>
                          {gathering.status === "CLOSED" ? "Cerrada · " : ""}{dateLabel} · {gathering.participantCount}{" "}
                          {gathering.participantCount === 1 ? "persona" : "personas"}
                        </small>
                      </button>
                      {gathering.participant.isOrganizer ? (
                        <div className="account-history-actions">
                          {onDuplicateGathering ? <button
                            className="account-duplicate-button"
                            type="button"
                            disabled={deletingGatheringId === gathering.id}
                            onClick={() => onDuplicateGathering?.(gathering)}
                          >
                            Duplicar
                          </button> : null}
                          <button
                            className="account-delete-button"
                            type="button"
                            disabled={deletingGatheringId !== null}
                            onClick={() => void deleteGathering(gathering)}
                          >
                            {deletingGatheringId === gathering.id
                              ? "Eliminando…"
                              : "Eliminar"}
                          </button>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
          <button
            className="account-secondary-button"
            type="button"
            disabled={isSubmitting}
            onClick={() => void run(signOut)}
          >
            Cerrar sesión
          </button>
          <button type="button" className="account-delete-button" disabled={isSubmitting} onClick={() => void deleteAccount()}>Eliminar mi cuenta</button>
          {error && <p role="alert">{error}</p>}
        </>
      ) : (
        <>
          <span className="eyebrow">Tu perfil, en cualquier dispositivo</span>
          <h2>Ingresá a Sale Juntada</h2>
          <p>
            Ingresá con Google para crear juntadas, aceptar invitaciones y confirmar tu asistencia.
          </p>

          {!configured ? (
            <div className="account-warning" role="alert">
              Falta configurar Supabase Auth en este entorno.
            </div>
          ) : (
            <>
              <button
                className="google-auth-button"
                type="button"
                disabled={isSubmitting}
                onClick={() => void run(signInWithGoogle)}
              >
                <span aria-hidden="true">G</span>
                Continuar con Google
              </button>

            </>
          )}

          {error || initializationError ? (
            <small className="form-error" role="alert">
              {error || initializationError}
            </small>
          ) : null}
          <small className="privacy-note">
            Al continuar declarás que tenés 18 años o más. Consultá cómo usamos tus datos en <a href="/privacidad">Privacidad</a> y leé los <a href="/terminos">Términos de uso</a>.
          </small>
        </>
      )}
    </AnimatedDialog>
  );
}
