import { useState } from "react";
import { useGatheringDraft } from "../hooks/useGatheringDraft";
import { gatheringService, type DietaryPreference, type MealArrangement, type Participant } from "../services/gatheringService";

const dietaryOptions: Array<{
  value: DietaryPreference;
  label: string;
  icon: string;
}> = [
  { value: "CELIAC", label: "Sin gluten / celiaquía", icon: "🌾" },
  { value: "VEGAN", label: "Vegano", icon: "🌱" },
  { value: "VEGETARIAN", label: "Vegetariano", icon: "🥬" },
];

const dietaryLabels = new Map(
  dietaryOptions.map((option) => [option.value, option.label]),
);

export function DietaryPlanner({ gatheringId, participantId, participantToken, participants, currentParticipant, readOnly = false, onDietaryUpdated, onNotice }: {
  gatheringId: string;
  participantId: string;
  participantToken: string;
  participants: Participant[];
  currentParticipant: Participant;
  readOnly?: boolean;
  onDietaryUpdated(participant: Participant): void;
  onNotice(message: string): void;
}) {
  const [dietaryPreferences, setDietaryPreferences] = useGatheringDraft<DietaryPreference[]>("dietary-preferences", currentParticipant.dietaryPreferences ?? []);
  const [mealArrangement, setMealArrangement] = useGatheringDraft<MealArrangement | null>("dietary-arrangement", currentParticipant.mealArrangement ?? null);
  const [isDietarySaving, setIsDietarySaving] = useState(false);
  const toggleDietaryPreference = (preference: DietaryPreference) => {
    setDietaryPreferences((current) =>
      current.includes(preference)
        ? current.filter((candidate) => candidate !== preference)
        : [...current, preference],
    );
  };

  const saveDietaryProfile = async () => {
    if (readOnly) return;
    if (!gatheringId || !participantId || !participantToken) {
      onNotice("Entrá a la juntada para guardar tus necesidades de comida.");
      return;
    }
    if (dietaryPreferences.length > 0 && !mealArrangement) {
      onNotice("Elegí si te ocupás vos o si el grupo debe conseguir un menú.");
      return;
    }
    setIsDietarySaving(true);
    try {
      const participant = await gatheringService.updateDietaryProfile(
        gatheringId,
        participantId,
        participantToken,
        { dietaryPreferences, mealArrangement },
      );
      onDietaryUpdated?.(participant);
      onNotice(
        dietaryPreferences.length > 0
          ? "Tu necesidad alimentaria quedó visible para el grupo."
          : "Quitamos tus necesidades alimentarias.",
      );
    } catch {
      onNotice("No pudimos guardar tu necesidad alimentaria.");
    } finally {
      setIsDietarySaving(false);
    }
  };

  return (
<section className="dietary-planner" aria-labelledby="dietary-title">
          <div className="dietary-heading">
            <div>
              <span className="section-kicker">
                QUE NADIE SE QUEDE SIN COMER
              </span>
              <h3 id="dietary-title">Necesidades alimentarias</h3>
              <p>
                Marcá lo que necesitás y avisá si te ocupás vos o si el grupo
                debe conseguir una opción.
              </p>
            </div>
            <span>
              Visible sólo para participantes de esta juntada.
            </span>
          </div>

          <div className="dietary-layout">
            <fieldset className="dietary-form" disabled={readOnly || isDietarySaving}>
              <div
                className="dietary-options"
                aria-label="Preferencias alimentarias"
              >
                {dietaryOptions.map((option) => (
                  <label
                    key={option.value}
                    className={
                      dietaryPreferences.includes(option.value)
                        ? "selected"
                        : ""
                    }
                  >
                    <input
                      type="checkbox"
                      checked={dietaryPreferences.includes(option.value)}
                      onChange={() => toggleDietaryPreference(option.value)}
                    />
                    <span aria-hidden="true">{option.icon}</span>
                    <strong>{option.label}</strong>
                  </label>
                ))}
              </div>

              {dietaryPreferences.length > 0 ? (
                <div
                  className="meal-arrangement"
                  role="radiogroup"
                  aria-label="Cómo resolver tu comida"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={mealArrangement === "SELF_MANAGED"}
                    className={
                      mealArrangement === "SELF_MANAGED" ? "selected" : ""
                    }
                    onClick={() => setMealArrangement("SELF_MANAGED")}
                  >
                    <strong>Me ocupo yo</strong>
                    <small>Llevo o gestiono mi propia comida.</small>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={mealArrangement === "GROUP_MENU"}
                    className={
                      mealArrangement === "GROUP_MENU" ? "selected" : ""
                    }
                    onClick={() => setMealArrangement("GROUP_MENU")}
                  >
                    <strong>Necesito ayuda del grupo</strong>
                    <small>Hay que sumar una opción apta al menú.</small>
                  </button>
                </div>
              ) : null}

              <button
                type="button"
                className="save-dietary-button"
                disabled={isDietarySaving}
                onClick={saveDietaryProfile}
              >
                {isDietarySaving
                  ? "Guardando…"
                  : currentParticipant
                    ? "Guardar mi elección"
                    : "Entrá para completar esto"}
              </button>
            </fieldset>

            <div className="dietary-summary">
              <strong>Menús a tener en cuenta</strong>
              {participants.some(
                (participant) =>
                  (participant.dietaryPreferences?.length ?? 0) > 0,
              ) ? (
                <ul>
                  {participants
                    .filter(
                      (participant) =>
                        (participant.dietaryPreferences?.length ?? 0) > 0,
                    )
                    .map((participant) => (
                      <li key={participant.id}>
                        <span>{participant.name}</span>
                        <b>
                          {participant.dietaryPreferences
                            ?.map((preference) => dietaryLabels.get(preference))
                            .join(" · ")}
                        </b>
                        <small>
                          {participant.mealArrangement === "SELF_MANAGED"
                            ? "Se ocupa de su comida"
                            : "El grupo busca una opción"}
                        </small>
                      </li>
                    ))}
                </ul>
              ) : (
                <p>Todavía nadie indicó una necesidad especial.</p>
              )}
            </div>
          </div>
        </section>
  );
}
