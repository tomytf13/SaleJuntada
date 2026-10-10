import {
  getCountries,
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumberFromString,
} from "libphonenumber-js/min";

const countryNames = new Intl.DisplayNames(["es"], { type: "region" });

export const phoneCountries = getCountries()
  .map((country) => ({
    country,
    name: countryNames.of(country) ?? country,
    prefix: `+${getCountryCallingCode(country)}`,
    flag: String.fromCodePoint(...[...country].map((letter) => 127397 + letter.charCodeAt(0))),
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "es"));

export function normalizeContactPhone(input: string, country: string): string | undefined {
  const value = input.trim();
  if (!value) return undefined;
  if (!isSupportedCountry(country)) throw new Error("Elegí el país de tu teléfono.");
  const phone = parsePhoneNumberFromString(value, { defaultCountry: country, extract: false });
  if (!phone || phone.ext || !phone.isPossible()) {
    throw new Error("Revisá el número de teléfono e incluí el código de área.");
  }
  if (phone.countryCallingCode !== getCountryCallingCode(country)) {
    throw new Error("El prefijo del número no coincide con el país elegido.");
  }
  return phone.number;
}
