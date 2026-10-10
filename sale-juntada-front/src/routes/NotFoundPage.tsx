import { Link } from "react-router-dom";
import { SparkIcon } from "../components/SparkIcon";

/** Ruta desconocida dentro de la app (no confundir con "juntada inexistente", que vive en `GatheringPage`). */
export default function NotFoundPage() {
  return (
    <main className="app-root not-found-page">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Sale Juntada, inicio">
          <span className="brand-mark">
            <SparkIcon />
          </span>
          <span>Sale Juntada</span>
        </a>
      </header>
      <section className="status-page">
        <span className="eyebrow">
          <SparkIcon /> 404
        </span>
        <h1>No encontramos esta página.</h1>
        <p>Puede que el link esté mal escrito o ya no exista.</p>
        <Link className="primary-button" to="/">
          Volver al inicio <span aria-hidden="true">→</span>
        </Link>
      </section>
    </main>
  );
}
