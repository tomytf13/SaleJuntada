import { AccountDialog } from "../components/AccountDialog";
import { PwaStatus } from "../components/PwaStatus";
import { useAuth } from "../auth/useAuth";
import { useNavigate } from "react-router-dom";
import { storeParticipantSession } from "../utils/gatheringHelpers";
import {
  ArrowRight,
  CalendarDays,
  CheckCheck,
  Plus,
  LogIn,
  UserRound,
  ShoppingBasket,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { m } from "framer-motion";
import { SparkIcon } from "../components/SparkIcon";
import { CreateGatheringDialog } from "../components/CreateGatheringDialog";
import { standardTransition } from "../motion/config";

const steps = [
  {
    number: "01",
    icon: Plus,
    title: "Creás y compartís",
    detail: "Armás la juntada y mandás un solo link al grupo.",
  },
  {
    number: "02",
    icon: Users,
    title: "Se organizan",
    detail: "Cada uno ingresa con su cuenta y confirma si va.",
  },
  {
    number: "03",
    icon: CheckCheck,
    title: "Queda todo claro",
    detail: "Quién va, cuándo y dónde, sin perderse entre mensajes.",
  },
];

/**
 * Landing real de Sale Juntada. Reemplaza la demo interactiva que vivía en
 * `App.tsx` — sin juntada ficticia, sin disponibilidad falsa. El CTA abre el
 * mismo formulario de creación que ya existía; el contrato en dos pasos
 * (`startsAt`) llega en P1.6.
 */
export default function LandingPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  return (
    <main className="app-root landing-page">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Sale Juntada, inicio">
          <span className="brand-mark">
            <SparkIcon />
          </span>
          <span>Sale Juntada</span>
        </a>
        <button className="landing-account-button" type="button" onClick={() => setShowAccount(true)}>
          {user ? <UserRound size={18} aria-hidden="true" /> : <LogIn size={18} aria-hidden="true" />}
          {isLoading ? "Tu cuenta" : user ? "Mi cuenta" : "Ingresar"}
        </button>
      </header>

      <section className="hero landing-hero">
        <m.div
          className="hero-copy"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={standardTransition}
        >
          <span className="eyebrow">
            <SparkIcon /> Coordinar sin vueltas
          </span>
          <h1>
            De "¿sale algo?"
            <br />
            <em>a "quedó todo pago".</em>
          </h1>
          <p>
            Organizá la juntada donde ya la estás organizando: el grupo. Sin
            perderte entre mensajes.
          </p>
          <div className="hero-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => setShowCreate(true)}
            >
              Crear una juntada <ArrowRight size={18} aria-hidden="true" />
            </button>
            <button className="landing-login-link" type="button" onClick={() => setShowAccount(true)}>
              {user ? "Ver mis juntadas" : "Ya tengo cuenta · Ingresar"}
            </button>
          </div>
        </m.div>
        <aside
          className="landing-plan"
          aria-label="Todo lo que podés organizar"
        >
          <div className="plan-topline">
            <span className="section-kicker">
              MENOS MENSAJES. MÁS ENCUENTROS.
            </span>
            <Sparkles size={20} aria-hidden="true" />
          </div>
          <h2>
            Un buen plan.
            <br />
            <em>Todo en su lugar.</em>
          </h2>
          <div className="plan-features">
            {[
              {
                icon: Users,
                title: "La gente",
                detail: "Invitaciones y asistencia",
                tone: "invitados",
              },
              {
                icon: CalendarDays,
                title: "El encuentro",
                detail: "Fecha y lugar",
                tone: "fecha",
              },
              {
                icon: ShoppingBasket,
                title: "La mesa",
                detail: "Qué lleva cada uno",
                tone: "compra",
              },
              {
                icon: Wallet,
                title: "Las cuentas",
                detail: "Gastos y transferencias",
                tone: "cuentas",
              },
            ].map(({ icon: Icon, title, detail, tone }) => (
              <div className="plan-feature" data-service={tone} key={title}>
                <span className="service-icon">
                  <Icon size={21} aria-hidden="true" />
                </span>
                <div>
                  <strong>{title}</strong>
                  <span>{detail}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="plan-footnote">
            <CheckCheck size={17} aria-hidden="true" />
            Un solo lugar para organizarse entre todos.
          </p>
        </aside>
      </section>

      <m.section
        className="steps-section"
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.18 }}
        transition={standardTransition}
      >
        <span className="section-kicker">ASÍ DE SIMPLE</span>
        <h2>Del "vemos" al "nos vemos".</h2>
        <div className="steps-grid">
          {steps.map(({ number, icon: Icon, title, detail }) => (
            <article key={number}>
              <span>{number}</span>
              <div className="step-icon">
                <Icon size={25} aria-hidden="true" />
              </div>
              <h3>{title}</h3>
              <p>{detail}</p>
            </article>
          ))}
        </div>
      </m.section>

      <footer id="more">
        <a className="brand" href="/">
          <span className="brand-mark">
            <SparkIcon />
          </span>
          <span>Sale Juntada</span>
        </a>
        <p>Hecho para que los planes salgan.</p>
        <span>Argentina · 2026</span>
      </footer>

      <AccountDialog
        open={showAccount}
        onClose={() => setShowAccount(false)}
        onOpenGathering={item => {
          storeParticipantSession(item.slug, item.participant.id, item.participant.responseToken);
          setShowAccount(false);
          navigate(`/j/${item.slug}`);
        }}
      />
      <PwaStatus />
      <CreateGatheringDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />
    </main>
  );
}
