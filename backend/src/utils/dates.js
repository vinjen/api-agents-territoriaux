import { DateTime } from "luxon";

const ZONE_HORAIRE_FRANCE = "Europe/Paris";

const NUMEROS_JOURS = {
  LUNDI: 1,
  MARDI: 2,
  MERCREDI: 3,
  JEUDI: 4,
  VENDREDI: 5,
  SAMEDI: 6,
  DIMANCHE: 7
};

export function convertirDateUtcEnDateLocale(dateUtc) {
  return DateTime
    .fromISO(dateUtc, { setZone: true })
    .setZone(ZONE_HORAIRE_FRANCE)
    .startOf("day");
}

export function convertirDateIsoEnDateLocale(dateIso) {
  return DateTime.fromISO(dateIso, {
    zone: ZONE_HORAIRE_FRANCE
  }).startOf("day");
}

export function obtenirNumerosJoursTravailles(joursTravailles) {
  return new Set(
    joursTravailles.map((jour) => NUMEROS_JOURS[jour])
  );
}

export function genererDatesEntre(dateDebut, dateFin) {
  const dates = [];

  let dateCourante = dateDebut.startOf("day");
  const derniereDate = dateFin.startOf("day");

  while (dateCourante <= derniereDate) {
    dates.push(dateCourante);
    dateCourante = dateCourante.plus({ days: 1 });
  }

  return dates;
}

export function arrondir(nombre, nombreDecimales = 2) {
  const facteur = 10 ** nombreDecimales;

  return Math.round((nombre + Number.EPSILON) * facteur) / facteur;
}

export function formaterNombreFrancais(nombre, nombreDecimales = 2) {
  return nombre.toLocaleString("fr-FR", {
    minimumFractionDigits: nombreDecimales,
    maximumFractionDigits: nombreDecimales
  });
}