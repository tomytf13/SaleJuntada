import { useState } from "react";
import { m } from "framer-motion";
import { SparkIcon } from "../components/SparkIcon";
import { CreateGatheringDialog } from "../components/CreateGatheringDialog";
import { standardTransition } from "../motion/config";

const steps = [
  {
    number: "01",
    icon: "＋",
    title: "Creás y compartís",
    detail: "Armás la juntada y mandás un solo link al grupo.",
  },
  {
    number: "02",
    icon: "✓",
    title: "Se organizan",
    detail: "Cada uno dice si va, sin registros ni descargas.",
  },
  {
    number: "03",
    icon: "✦",
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

  return (
    <main className="app-root landing-page">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Sale Juntada, inicio">
          <span className="brand-mark">
            <SparkIcon />
          </span>
          <span>Sale Juntada</span>
        </a>
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
              Crear una juntada <span aria-hidden="true">→</span>
            </button>
          </div>
        </m.div>
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
          {steps.map((step) => (
            <article key={step.number}>
              <span>{step.number}</span>
              <div className="step-icon">{step.icon}</div>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
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

      <CreateGatheringDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </main>
  );
}
