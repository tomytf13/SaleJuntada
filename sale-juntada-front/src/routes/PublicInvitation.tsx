import { ArrowRight, LogIn, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useGathering } from "../hooks/useGathering";
import { GatheringHero } from "../components/GatheringHero";
import { AccountDialog } from "../components/AccountDialog";
import { PwaStatus } from "../components/PwaStatus";
import { SparkIcon } from "../components/SparkIcon";
import { ApiError } from "../services/gatheringService";
import { NotFoundGathering } from "./NotFoundGathering";
import { GatheringSkeleton } from "./GatheringSkeleton";

export function PublicInvitation() {
  const { slug = "" } = useParams();
  const { gathering, isPending, error, refetch } = useGathering(slug);
  const [loginOpen, setLoginOpen] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  if (isPending) return <GatheringSkeleton />;
  if (error instanceof ApiError && error.status === 404)
    return <NotFoundGathering />;
  if (!gathering)
    return (
      <main className="join-gathering">
        <h1>No pudimos abrir esta juntada.</h1>
        <button onClick={() => void refetch()}>Reintentar</button>
      </main>
    );
  const share = async () => {
    try {
      const url = `${window.location.origin}/j/${slug}`;
      if (navigator.share)
        await navigator.share({ title: gathering.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setShareMessage("Invitación copiada");
      }
    } catch {
      setShareMessage("Podés copiar el enlace desde la barra del navegador.");
    }
  };
  return (
    <main className="app-root gathering-app">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="Sale Juntada, inicio">
          <span className="brand-mark">
            <SparkIcon />
          </span>
          Sale Juntada
        </Link>
        <button className="text-link" onClick={() => setLoginOpen(true)}>
          Ingresar
        </button>
      </header>
      <GatheringHero
        gathering={{ ...gathering, isParticipant: false, participants: [] }}
        onShare={() => void share()}
      />
      <section className="join-gathering invitation-entry">
        <span className="invitation-entry-icon" aria-hidden="true">
          <LogIn size={24} />
        </span>
        <div className="invitation-entry-copy">
          <span className="section-kicker">EL PLAN EMPIEZA ACÁ</span>
          <h2>Ingresá para sumarte</h2>
          <p>
            Necesitás una cuenta para aceptar la invitación, confirmar tu
            asistencia y participar de la juntada.
          </p>
          <button className="primary-button" onClick={() => setLoginOpen(true)}>
            Ingresar para aceptar la invitación
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          <p className="invitation-trust">
            <ShieldCheck size={15} aria-hidden="true" />
            Tu respuesta queda vinculada a tu cuenta.
          </p>
          {shareMessage ? <p role="status">{shareMessage}</p> : null}
        </div>
      </section>
      <AccountDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
      <PwaStatus />
    </main>
  );
}
