import { SparkIcon } from "../components/SparkIcon";

/** Esqueleto con la forma de la página, para no mostrar pantalla en blanco mientras carga la juntada o el chunk de la ruta. */
export function GatheringSkeleton() {
  return (
    <main className="app-root" aria-busy="true">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Sale Juntada, inicio">
          <span className="brand-mark">
            <SparkIcon />
          </span>
          <span>Sale Juntada</span>
        </a>
      </header>
      <div className="gathering-skeleton" role="status" aria-label="Abriendo la juntada…">
        <div className="skeleton-block tall" />
        <div className="skeleton-block" style={{ width: "60%" }} />
        <div className="skeleton-block" style={{ width: "40%" }} />
      </div>
    </main>
  );
}
