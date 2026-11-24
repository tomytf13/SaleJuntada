import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { reportService, type ReportStatus } from "../services/gatheringService";

const statuses = {
  NEW: "Nuevo",
  IN_PROGRESS: "En revisión",
  RESOLVED: "Resuelto",
} as const;
const options = Object.entries(statuses).map(([id, name]) => (
  <option key={id} value={id}>
    {name}
  </option>
));

function Inbox({ token, userId }: { token: string; userId: string }) {
  const client = useQueryClient();
  const [status, setStatus] = useState<ReportStatus>("NEW");
  const prefix = ["app-reports", userId];
  const query = useInfiniteQuery({
    queryKey: [...prefix, status],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => reportService.list(status, token, pageParam),
    getNextPageParam: (page) => page.next ?? undefined,
    retry: false,
    gcTime: 0,
  });
  const update = useMutation({
    mutationFn: ({ id, next }: { id: string; next: ReportStatus }) =>
      reportService.update(id, next, token),
    onSuccess: () => client.invalidateQueries({ queryKey: prefix }),
  });
  return (
    <>
      <label>
        Mostrar por estado{" "}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ReportStatus)}
        >
          {options}
        </select>
      </label>
      {update.isError && (
        <p role="alert">No pudimos cambiar el estado. Probá otra vez.</p>
      )}
      {query.isPending ? (
        <p role="status">Cargando reportes…</p>
      ) : query.isError ? (
        <p role="alert">
          No pudimos cargar la bandeja.{" "}
          <button onClick={() => void query.refetch()}>Reintentar</button>
        </p>
      ) : (
        <>
          {!query.data.pages[0].items.length && (
            <p>No hay reportes en este estado.</p>
          )}
          {query.data.pages
            .flatMap((page) => page.items)
            .map((item) => (
              <article className="report-item" key={item.id}>
                <header>
                  <strong>{item.kind === "BUG" ? "Problema" : "Mejora"}</strong>{" "}
                  ·{" "}
                  <time dateTime={item.createdAt}>
                    {new Date(item.createdAt).toLocaleDateString("es-AR")}
                  </time>
                </header>
                <p>{item.description}</p>
                <label>
                  Estado{" "}
                  <select
                    value={item.status}
                    disabled={update.isPending}
                    onChange={(e) =>
                      update.mutate({
                        id: item.id,
                        next: e.target.value as ReportStatus,
                      })
                    }
                  >
                    {options}
                  </select>
                </label>
              </article>
            ))}
          {query.hasNextPage && (
            <button
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              Ver más reportes
            </button>
          )}
        </>
      )}
    </>
  );
}
export default function ReportsPage() {
  const { user, accessToken, isLoading, signInWithGoogle } = useAuth();
  const [error, setError] = useState("");
  return (
    <main className="legal-document">
      <Link to="/">← Sale Juntada</Link>
      <h1>Bandeja de bugs e ideas</h1>
      {isLoading ? (
        <p>Cargando cuenta…</p>
      ) : !user || !accessToken ? (
        <button
          onClick={() =>
            void signInWithGoogle().catch(() =>
              setError("No pudimos iniciar sesión."),
            )
          }
        >
          Ingresar con Google
        </button>
      ) : user.app_metadata?.sale_juntada_admin === true ? (
        <Inbox key={user.id} token={accessToken} userId={user.id} />
      ) : (
        <p>Esta bandeja es privada para el equipo de Sale Juntada.</p>
      )}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
