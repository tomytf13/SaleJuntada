import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("Sale Juntada no pudo renderizar la pantalla", error, info);
    }
  }

  private reload = () => window.location.reload();

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="app-error" role="alert" aria-labelledby="app-error-title">
        <div>
          <span aria-hidden="true"><AlertTriangle size={28} /></span>
          <p className="section-kicker">ALGO SE DESACOMODÓ</p>
          <h1 id="app-error-title">La juntada sigue guardada.</h1>
          <p>
            No pudimos mostrar esta pantalla. Recargá para volver a sincronizar
            los datos del grupo.
          </p>
          <button type="button" onClick={this.reload}>
            <RotateCcw size={17} aria-hidden="true" /> Recargar la app
          </button>
        </div>
      </main>
    );
  }
}
