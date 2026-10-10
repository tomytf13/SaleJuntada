import { Link } from "react-router-dom";
import { SparkIcon } from "../components/SparkIcon";

/**
 * Slug sintácticamente válido pero inexistente (404 de la API). Distinto de
 * `NotFoundPage`, que cubre una ruta de la app que no existe.
 */
export function NotFoundGathering() {
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
          <SparkIcon /> No encontrada
        </span>
        <h1>Esta juntada no existe o el link ya no es válido.</h1>
        <Link className="primary-button" to="/">
          Crear una juntada <span aria-hidden="true">→</span>
        </Link>
      </section>
    </main>
  );
}
