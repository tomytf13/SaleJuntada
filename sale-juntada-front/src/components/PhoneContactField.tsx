import { useState } from "react";
import { phoneCountries } from "../utils/phone";

export function PhoneContactField({ disabled }: { disabled: boolean }) {
  const [country, setCountry] = useState("AR");

  return (
    <fieldset className="phone-contact" disabled={disabled}>
      <legend>Teléfono de contacto (opcional)</legend>
      <div className="phone-contact-fields">
        <div>
          <label htmlFor="participant-phone-country">País</label>
          <select
            id="participant-phone-country"
            name="participantPhoneCountry"
            autoComplete="tel-country-code"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
          >
            {phoneCountries.map((item) => (
              <option key={item.country} value={item.country}>
                {item.flag} {item.name} ({item.prefix})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="participant-phone">Número de teléfono</label>
          <input
            id="participant-phone"
            name="participantPhone"
            type="tel"
            autoComplete="tel-national"
            placeholder={country === "AR" ? "9 381 123 4567" : "Código de área y número"}
            maxLength={32}
            aria-describedby="participant-phone-help participant-phone-privacy"
          />
        </div>
      </div>
      <p id="participant-phone-help" className="phone-contact-help">
        {country === "AR"
          ? "Para celulares argentinos: 9 + código de área + número, sin 0 ni 15."
          : "Ingresá el código de área y tu número, sin repetir el prefijo del país."}
      </p>
      <p id="participant-phone-privacy" className="phone-contact-help">
        Lo guardamos como contacto para futuras funciones de WhatsApp. No se
        muestra a otros invitados ni se verifica por SMS.
      </p>
    </fieldset>
  );
}
