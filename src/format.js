// Dates en français (reprises de l'application Flutter de l'équipe).

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

export const two = (n) => String(n).padStart(2, "0");
// getDay() renvoie 0 pour dimanche ; la semaine française commence le lundi.
export const frLongDate = (d) => `${JOURS[(d.getDay() + 6) % 7]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
export const frShortDate = (d) => `${d.getDate()} ${MOIS[d.getMonth()]}`;
export const hhmm = (d) => `${two(d.getHours())}:${two(d.getMinutes())}`;
// Clé de jour locale (pas UTC) : une séance de 23h compte pour le bon jour.
export const dayKey = (d) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
