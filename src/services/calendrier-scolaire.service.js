import axios from "axios";
import { DateTime } from "luxon";

const URL_CALENDRIER_SCOLAIRE =
  "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records";

const ZONE_HORAIRE_FRANCE = "Europe/Paris";

function convertirDateUtcEnDateLocale(dateUtc) {
  const dateLocale = DateTime
    .fromISO(dateUtc, { setZone: true })
    .setZone(ZONE_HORAIRE_FRANCE)
    .startOf("day");

  if (!dateLocale.isValid) {
    const erreur = new Error(
      `Date invalide retournée par l'API scolaire : ${dateUtc}`
    );

    erreur.code = "DATE_CALENDRIER_SCOLAIRE_INVALIDE";
    erreur.status = 502;

    throw erreur;
  }

  return dateLocale;
}

function obtenirAnneeScolairePrecedente(anneeScolaire) {
  const [anneeDebut] = anneeScolaire
    .split("-")
    .map(Number);

  return `${anneeDebut - 1}-${anneeDebut}`;
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

/**
 * Appel principal.
 *
 * Récupère tous les événements de l'année scolaire demandée :
 * Toussaint, Noël, hiver, printemps, pont et début des vacances d'été.
 */
async function recupererEvenementsAnneeScolaire(
  anneeScolaire,
  academie
) {
  const conditionRecherche = [
    `annee_scolaire="${anneeScolaire}"`,
    `location="${academie}"`
  ].join(" AND ");

  const reponse = await axios.get(
    URL_CALENDRIER_SCOLAIRE,
    {
      params: {
        where: conditionRecherche,
        limit: 100,
        order_by: "start_date"
      },
      timeout: 10000
    }
  );

  const resultats = reponse.data.results ?? [];

  if (resultats.length === 0) {
    const erreur = new Error(
      `Aucun calendrier scolaire trouvé pour l'académie ${academie} et l'année ${anneeScolaire}.`
    );

    erreur.code = "CALENDRIER_SCOLAIRE_INTROUVABLE";
    erreur.status = 404;

    throw erreur;
  }

  return resultats.map(convertirResultatApi);
}

/**
 * Appel complémentaire.
 *
 * Récupère uniquement les vacances d'été de l'année scolaire précédente.
 * La date de fin correspond à la rentrée des élèves.
 */
async function recupererVacancesEtePrecedentes(
  anneeScolairePrecedente,
  academie
) {
  const conditionRecherche = [
    `annee_scolaire="${anneeScolairePrecedente}"`,
    `location="${academie}"`,
    `description="Vacances d'Été"`,
    `population="Élèves"`
  ].join(" AND ");

  const reponse = await axios.get(
    URL_CALENDRIER_SCOLAIRE,
    {
      params: {
        where: conditionRecherche,
        limit: 10,
        order_by: "start_date"
      },
      timeout: 10000
    }
  );

  const resultats = reponse.data.results ?? [];

  if (resultats.length === 0) {
    const erreur = new Error(
      `Les vacances d'été ${anneeScolairePrecedente} sont introuvables pour l'académie ${academie}.`
    );

    erreur.code = "VACANCES_ETE_PRECEDENTES_INTROUVABLES";
    erreur.status = 404;

    throw erreur;
  }

  return convertirResultatApi(resultats[0]);
}

function rechercherDebutVacancesEte(
  evenementsScolaires
) {
  const evenement = evenementsScolaires.find(
    (element) =>
      element.description ===
      "Début des Vacances d'Été"
  );

  if (!evenement) {
    const erreur = new Error(
      "L'événement « Début des Vacances d'Été » est introuvable."
    );

    erreur.code = "DEBUT_VACANCES_ETE_INTROUVABLE";
    erreur.status = 502;

    throw erreur;
  }

  return evenement;
}

/**
 * Retourne tous les événements scolaires ainsi que les bornes
 * officielles de la période de scolarité.
 */
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
    /*
     * Appel 1 :
     * tous les événements de l'année demandée.
     */
    recupererEvenementsAnneeScolaire(
      anneeScolaire,
      academie
    ),

    /*
     * Appel 2 :
     * uniquement les vacances d'été de l'année précédente.
     */
    recupererVacancesEtePrecedentes(
      anneeScolairePrecedente,
      academie
    )
  ]);

  /*
   * La fin des vacances d'été précédentes correspond
   * à la rentrée des élèves.
   */
  const dateDebutScolarite =
    convertirDateUtcEnDateLocale(
      vacancesEtePrecedentes.dateFinUtc
    );

  const evenementDebutVacancesEte =
    rechercherDebutVacancesEte(
      evenementsScolaires
    );

  const dateDebutVacancesEte =
    convertirDateUtcEnDateLocale(
      evenementDebutVacancesEte.dateDebutUtc
    );

  /*
   * Les vacances commencent après les cours.
   * La veille de leur date locale de début est donc
   * le dernier jour de classe.
   */
  const dateFinScolarite =
    dateDebutVacancesEte.minus({ days: 1 });

  if (dateFinScolarite < dateDebutScolarite) {
    const erreur = new Error(
      "La période scolaire calculée est incohérente."
    );

    erreur.code = "PERIODE_SCOLAIRE_INVALIDE";
    erreur.status = 502;

    throw erreur;
  }

  return {
    anneeScolaire,
    academie,

    zoneScolaire:
      evenementsScolaires[0]
        ?.zoneScolaire ?? null,

    dateDebutScolarite:
      dateDebutScolarite.toISODate(),

    dateFinScolarite:
      dateFinScolarite.toISODate(),

    dateDebutVacancesEte:
      dateDebutVacancesEte.toISODate(),

    vacancesEtePrecedentes,

    /*
     * Cette liste contient toujours les 6 événements
     * de l'année scolaire demandée.
     */
    evenementsScolaires
  };
}