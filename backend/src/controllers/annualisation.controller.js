import {
  calculerAnnualisation
} from "../services/annualisation.service.js";

const JOURS_VALIDES = [
  "LUNDI",
  "MARDI",
  "MERCREDI",
  "JEUDI",
  "VENDREDI",
  "SAMEDI",
  "DIMANCHE"
];

export async function calculerQuotiteAnnualisee(
  req,
  res,
  next
) {
  try {
    const {
      anneeScolaire,
      academie,
      zoneJoursFeries,
      joursTravailles,
      heuresTravailParJour,
      indiceMajore
    } = req.body;

    const erreurs = [];

    if (!/^\d{4}-\d{4}$/.test(anneeScolaire ?? "")) {
      erreurs.push(
        "L'année scolaire doit respecter le format AAAA-AAAA."
      );
    }

    if (!academie || typeof academie !== "string") {
      erreurs.push(
        "L'académie est obligatoire."
      );
    }

    if (
      !zoneJoursFeries ||
      typeof zoneJoursFeries !== "string"
    ) {
      erreurs.push(
        "La zone des jours fériés est obligatoire."
      );
    }

    if (
      !Array.isArray(joursTravailles) ||
      joursTravailles.length === 0
    ) {
      erreurs.push(
        "Au moins un jour travaillé doit être renseigné."
      );
    } else {
      const joursInvalides = joursTravailles.filter(
        (jour) => !JOURS_VALIDES.includes(jour)
      );

      if (joursInvalides.length > 0) {
        erreurs.push(
          `Jours travaillés invalides : ${joursInvalides.join(", ")}.`
        );
      }

      if (
        new Set(joursTravailles).size !==
        joursTravailles.length
      ) {
        erreurs.push(
          "Les jours travaillés ne doivent pas être dupliqués."
        );
      }
    }

    if (
      typeof heuresTravailParJour !== "number" ||
      !Number.isFinite(heuresTravailParJour) ||
      heuresTravailParJour <= 0
    ) {
      erreurs.push(
        "Le nombre d'heures de travail par jour doit être supérieur à zéro."
      );
    }

    if (
      typeof indiceMajore !== "number" ||
      !Number.isInteger(indiceMajore) ||
      indiceMajore <= 0
    ) {
      erreurs.push(
        "L'indice majoré doit être un nombre entier supérieur à zéro."
      );
    }

    if (erreurs.length > 0) {
      return res.status(400).json({
        erreur: "REQUETE_INVALIDE",
        message:
          "Certains paramètres sont incorrects.",
        details: erreurs
      });
    }

    const [anneeDebut, anneeFin] =
      anneeScolaire
        .split("-")
        .map(Number);

    if (anneeFin !== anneeDebut + 1) {
      return res.status(400).json({
        erreur: "ANNEE_SCOLAIRE_INVALIDE",
        message:
          "La seconde année doit être immédiatement postérieure à la première."
      });
    }

    const resultat =
      await calculerAnnualisation({
        anneeScolaire,
        academie,
        zoneJoursFeries,
        joursTravailles,
        heuresTravailParJour,
        indiceMajore
      });

    return res.status(200).json(resultat);
  } catch (erreur) {
    return next(erreur);
  }
}