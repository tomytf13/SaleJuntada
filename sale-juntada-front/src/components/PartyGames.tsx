import { useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { Dices, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import {
  quickTransition,
  springTransition,
  standardTransition,
} from "../motion/config";

type GameMode = "icebreaker" | "challenge" | "toast";

const gameModes: Array<{
  id: GameMode;
  title: string;
  subtitle: string;
  icon: string;
  adultOnly?: boolean;
}> = [
  {
    id: "icebreaker",
    title: "Rompehielo",
    subtitle: "Preguntas para arrancar",
    icon: "💬",
  },
  {
    id: "challenge",
    title: "Prendas",
    subtitle: "Desafíos cortos y salteables",
    icon: "🎭",
  },
  {
    id: "toast",
    title: "Brindis +18",
    subtitle: "Sin presión ni velocidad",
    icon: "🥂",
    adultOnly: true,
  },
];

const prompts: Record<GameMode, string[]> = {
  icebreaker: [
    "¿Cuál fue la salida más improvisada que terminó siendo un planazo?",
    "Si esta juntada tuviera una canción oficial, ¿cuál sería?",
    "Contá una anécdota con alguien del grupo que todavía te haga reír.",
    "¿Qué comida podrías repetir durante una semana sin cansarte?",
    "Elegí: viaje espontáneo, cena larga o noche de juegos. ¿Por qué?",
    "¿Qué talento inútil te gustaría dominar instantáneamente?",
  ],
  challenge: [
    "Imitá durante 20 segundos a alguien famoso. El grupo tiene que adivinar.",
    "Inventá un lema para esta juntada y defendelo como si fuera una campaña.",
    "Contá una historia real y una inventada. El grupo adivina cuál es cuál.",
    "Elegí a otra persona y armen un saludo secreto en 30 segundos.",
    "Describí una película sin decir nombres propios. El grupo tiene tres intentos.",
    "Hacé una pose grupal. Si todos aceptan, saquen una foto para el recuerdo.",
  ],
  toast: [
    "Brinden por algo bueno que le haya pasado a alguien del grupo esta semana.",
    "La última persona en llegar propone el motivo del próximo brindis.",
    "Elegí a alguien y cuenten cómo se conocieron. Después brindan con la bebida que prefieran.",
    "Cada persona dice una palabra para describir la noche y todos brindan.",
    "Quien tenga el cumpleaños más cercano dedica un brindis. Puede ser con bebida sin alcohol.",
    "Brindis por el próximo plan: cada uno propone uno y el grupo elige su favorito.",
  ],
};

function nextPrompt(mode: GameMode, current: string | null) {
  const deck = prompts[mode];
  const alternatives = deck.filter((prompt) => prompt !== current);
  return (
    alternatives[Math.floor(Math.random() * alternatives.length)] ?? deck[0]
  );
}

export function PartyGames() {
  const [mode, setMode] = useState<GameMode>("icebreaker");
  const [prompt, setPrompt] = useState<string | null>(null);
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const selectedMode =
    gameModes.find((candidate) => candidate.id === mode) ?? gameModes[0];

  const chooseMode = (nextMode: GameMode) => {
    setMode(nextMode);
    setPrompt(null);
  };

  const draw = () => {
    if (selectedMode.adultOnly && !adultConfirmed) return;
    setPrompt((current) => nextPrompt(mode, current));
  };

  return (
    <m.section
      className="party-games"
      id="juegos"
      aria-labelledby="party-games-title"
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={standardTransition}
    >
      <div className="party-games-heading">
        <div>
          <span className="section-kicker">
            <Sparkles size={14} /> PARA ROMPER EL HIELO
          </span>
          <h2 id="party-games-title">Una ronda rápida.</h2>
          <p>
            Elegí un mazo y pasen el teléfono. Cualquier desafío se puede
            saltar, sin explicaciones.
          </p>
        </div>
        <span className="party-games-badge">
          <Dices size={17} /> Sin instalar nada
        </span>
      </div>

      <div
        className="game-mode-grid"
        role="tablist"
        aria-label="Tipo de minijuego"
      >
        {gameModes.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            role="tab"
            aria-selected={mode === candidate.id}
            className={mode === candidate.id ? "selected" : ""}
            onClick={() => chooseMode(candidate.id)}
          >
            <span aria-hidden="true">{candidate.icon}</span>
            <strong>{candidate.title}</strong>
            <small>{candidate.subtitle}</small>
          </button>
        ))}
      </div>

      {selectedMode.adultOnly ? (
        <label className="game-adult-confirmation">
          <input
            type="checkbox"
            checked={adultConfirmed}
            onChange={(event) => setAdultConfirmed(event.target.checked)}
          />
          <span>
            <ShieldCheck size={17} />
          </span>
          <span>
            <strong>
              Confirmo que esta ronda es sólo para mayores de 18 años.
            </strong>
            <small>
              No hay castigos por no beber, cantidades ni desafíos de velocidad.
              Siempre se puede elegir una bebida sin alcohol.
            </small>
          </span>
        </label>
      ) : null}

      <div className={`game-card ${mode}`}>
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={`${mode}-${prompt ?? "empty"}`}
            initial={{ opacity: 0, rotateX: -12, y: 12 }}
            animate={{ opacity: 1, rotateX: 0, y: 0 }}
            exit={{ opacity: 0, rotateX: 12, y: -12 }}
            transition={springTransition}
          >
            <span>
              {selectedMode.icon} {selectedMode.title}
            </span>
            <p>{prompt ?? "Tocá el botón para sacar la primera tarjeta."}</p>
          </m.div>
        </AnimatePresence>
        <m.button
          type="button"
          disabled={Boolean(selectedMode.adultOnly && !adultConfirmed)}
          onClick={draw}
          whileTap={{ scale: 0.97 }}
          transition={quickTransition}
        >
          <RefreshCw size={17} /> {prompt ? "Otra tarjeta" : "Sacar tarjeta"}
        </m.button>
      </div>

      <p className="game-safety-note">
        Sale Juntada propone conversaciones y brindis; no mide consumo ni premia
        beber más.
      </p>
    </m.section>
  );
}
