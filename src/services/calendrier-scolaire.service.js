import axios from "axios";
import { DateTime } from "luxon";

const URL_CALENDRIER_SCOLAIRE =
  "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records";

const ZONE_HORAIRE_FRANCE = "Europe/Paris";

function creerErreur(message, code, status) {
  const erreur = new Error(message);
  erreur.code = code;
  erreur.status = status;

  return erreur;
}

function obtenirAnneeScolairePrecedente(anneeScolaire) {
  const [anneeDebut, anneeFin] = anneeScolaire
    .split("-")
    .map(Number);

  if (
    !Number.isInteger(anneeDebut) ||
    !Number.isInteger(anneeFin) ||
    anneeFin !== anneeDebut + 1
  ) {
    throw creerErreur(
      `L'année scolaire "${anneeScolaire}" est invalide.`,
      "ANNEE_SCOLAIRE_INVALIDE",
      400
    );
  }

  return `${anneeDebut - 1}-${anneeDebut}`;
}

function convertirDateUtcEnDateLocale(dateUtc) {
  const dateLocale = DateTime
    .fromISO(dateUtc, { setZone: true })
    .setZone(ZONE_HORAIRE_FRANCE)
    .startOf("day");

  if (!dateLocale.isValid) {
    throw creerErreur(
      `Date invalide retournée par l'API scolaire : ${dateUtc}`,
      "DATE_CALENDRIER_SCOLAIRE_INVALIDE",
      502
    );
  }

  return dateLocale;
}

function normaliserTexte(texte) {
  return String(texte ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function convertirResultatApi(resultat) {
  return {
    description: resultat.description,
    population: resultat.population,
    dateDebutUtc: resultat.start_date,
    dateFinUtc: resultat.end_date,
    academie: resultat.location,
    zoneScolaire: resultat.zones,
    anneeScolaire: resultat.annee_scolaire
  };
}

async function appelerApiCalendrierScolaire({
  conditions,
  limite = 100
}) {
  const conditionRecherche = conditions.join(" AND ");

  try {
    const reponse = await axios.get(
      URL_CALENDRIER_SCOLAIRE,
      {
        params: {
          where: conditionRecherche,
          limit: limite,
          order_by: "start_date"
        },
        timeout: 10000
      }
    );

    return reponse.data.results ?? [];
  } catch (erreur) {
    if (erreur.response) {
      throw creerErreur(
        `L'API du calendrier scolaire a répondu avec le statut ${erreur.response.status}.`,
        "ERREUR_API_CALENDRIER_SCOLAIRE",
        502
      );
    }

    if (erreur.code === "ECONNABORTED") {
      throw creerErreur(
        "Le délai d'appel de l'API du calendrier scolaire a été dépassé.",
        "DELAI_API_CALENDRIER_DEPASSE",
        504
      );
    }

    throw erreur;
  }
}

async function recupererEvenementsAnneeDemandee(
  anneeScolaire,
  academie
) {
  const resultats = await appelerApiCalendrierScolaire({
    conditions: [
      `annee_scolaire="${anneeScolaire}"`,
      `location="${academie}"`
    ],
    limite: 100
  });

  if (resultats.length === 0) {
    throw creerErreur(
      `Aucun événement scolaire trouvé pour l'académie ${academie} et l'année ${anneeScolaire}.`,
      "CALENDRIER_SCOLAIRE_INTROUVABLE",
      404
    );
  }

  return resultats.map(convertirResultatApi);
}

async function recupererVacancesEteElevesPrecedentes(
  anneeScolairePrecedente,
  academie
) {
  const resultats = await appelerApiCalendrierScolaire({
    conditions: [
      `annee_scolaire="${anneeScolairePrecedente}"`,
      `location="${academie}"`,
      `description="Vacances d'Été"`,
      `population="Élèves"`
    ],
    limite: 10
  });

  if (resultats.length === 0) {
    throw creerErreur(
      `Les vacances d'été des élèves pour l'année ${anneeScolairePrecedente} sont introuvables pour l'académie ${academie}.`,
      "VACANCES_ETE_PRECEDENTES_INTROUVABLES",
      404
    );
  }

  if (resultats.length > 1) {
    throw creerErreur(
      `Plusieurs périodes de vacances d'été des élèves ont été trouvées pour l'année ${anneeScolairePrecedente} et l'académie ${academie}.`,
      "VACANCES_ETE_PRECEDENTES_AMBIGUES",
      502
    );
  }

  return convertirResultatApi(resultats[0]);
}

function rechercherVacancesEteCourantes(
  evenementsScolaires
) {
  const vacancesEteEleves =
    evenementsScolaires.find((evenement) => {
      const description = normaliserTexte(
        evenement.description
      );

      const population = normaliserTexte(
        evenement.population
      );

      return (
        description === "vacances d ete" &&
        population === "eleves"
      );
    });

  if (vacancesEteEleves) {
    return vacancesEteEleves;
  }

  const debutVacancesEte =
    evenementsScolaires.find((evenement) => {
      const description = normaliserTexte(
        evenement.description
      );

      return (
        description ===
        "debut des vacances d ete"
      );
    });

  if (debutVacancesEte) {
    return debutVacancesEte;
  }

  throw creerErreur(
    "Les vacances d'été des élèves sont introuvables dans le calendrier scolaire demandé.",
    "VACANCES_ETE_COURANTES_INTROUVABLES",
    502
  );
}

function verifierAcademie(
  evenementsScolaires,
  academie
) {
  const academiesRetournees = new Set(
    evenementsScolaires.map(
      (evenement) => evenement.academie
    )
  );

  if (
    academiesRetournees.size !== 1 ||
    !academiesRetournees.has(academie)
  ) {
    throw creerErreur(
      `Les événements retournés ne correspondent pas tous à l'académie ${academie}.`,
      "ACADEMIE_CALENDRIER_INCOHERENTE",
      502
    );
  }
}

export async function recupererPeriodeScolaire(
  anneeScolaire,
  academie
) {
  const anneeScolairePrecedente =
    obtenirAnneeScolairePrecedente(
      anneeScolaire
    );

  const [
    evenementsScolaires,
    vacancesEtePrecedentes
  ] = await Promise.all([
    recupererEvenementsAnneeDemandee(
      anneeScolaire,
      academie
    ),

    recupererVacancesEteElevesPrecedentes(
      anneeScolairePrecedente,
      academie
    )
  ]);

  verifierAcademie(
    evenementsScolaires,
    academie
  );

  const vacancesEteCourantes =
    rechercherVacancesEteCourantes(
      evenementsScolaires
    );

  const dateDebutScolarite =
    convertirDateUtcEnDateLocale(
      vacancesEtePrecedentes.dateFinUtc
    );

  const dateDebutVacancesEte =
    convertirDateUtcEnDateLocale(
      vacancesEteCourantes.dateDebutUtc
    );

  const dateFinScolarite =
    dateDebutVacancesEte.minus({
      days: 1
    });

  if (dateFinScolarite < dateDebutScolarite) {
    throw creerErreur(
      "La période scolaire calculée est incohérente : la date de fin précède la date de rentrée.",
      "PERIODE_SCOLAIRE_INVALIDE",
      502
    );
  }

  return {
    anneeScolaire,
    anneeScolairePrecedente,
    academie,

    zoneScolaire:
      vacancesEteCourantes.zoneScolaire ??
      evenementsScolaires[0]?.zoneScolaire ??
      null,

    dateDebutScolarite:
      dateDebutScolarite.toISODate(),

    dateFinScolarite:
      dateFinScolarite.toISODate(),

    dateDebutVacancesEte:
      dateDebutVacancesEte.toISODate(),

    sourceDateDebutScolarite: {
      anneeScolaire:
        anneeScolairePrecedente,

      description:
        vacancesEtePrecedentes.description,

      population:
        vacancesEtePrecedentes.population,

      dateFinUtc:
        vacancesEtePrecedentes.dateFinUtc
    },

    sourceDateFinScolarite: {
      anneeScolaire,

      description:
        vacancesEteCourantes.description,

      population:
        vacancesEteCourantes.population,

      dateDebutUtc:
        vacancesEteCourantes.dateDebutUtc
    },

    evenementsScolaires
  };
}