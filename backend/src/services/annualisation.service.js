import { DateTime } from "luxon";
import { recupererPeriodeScolaire } from "./calendrier-scolaire.service.js";
import { recupererJoursFeries } from "./jours-feries.service.js";
import {
    PARAMETRES_REMUNERATION
} from "../config/parametres-remuneration.js";

const ZONE_HORAIRE_FRANCE = "Europe/Paris";

const JOURS_SEMAINE = {
    LUNDI: 1,
    MARDI: 2,
    MERCREDI: 3,
    JEUDI: 4,
    VENDREDI: 5,
    SAMEDI: 6,
    DIMANCHE: 7
};

const LIBELLES_JOURS_SEMAINE = {
    1: "LUNDI",
    2: "MARDI",
    3: "MERCREDI",
    4: "JEUDI",
    5: "VENDREDI",
    6: "SAMEDI",
    7: "DIMANCHE"
};

function obtenirJourSemaine(date) {
    return LIBELLES_JOURS_SEMAINE[date.weekday];
}
function convertirDateUtcEnDateLocale(dateUtc) {
    const dateLocale = DateTime.fromISO(dateUtc, { setZone: true })
        .setZone(ZONE_HORAIRE_FRANCE)
        .startOf("day");

    if (!dateLocale.isValid) {
        const erreur = new Error(
            `Date invalide retournee par l'API scolaire : ${dateUtc}`
        );
        erreur.code = "DATE_CALENDRIER_SCOLAIRE_INVALIDE";
        erreur.status = 502;
        throw erreur;
    }

    return dateLocale;
}

function convertirDateIsoEnDateLocale(dateIso) {
    const dateLocale = DateTime.fromISO(dateIso, {
        zone: ZONE_HORAIRE_FRANCE
    }).startOf("day");

    if (!dateLocale.isValid) {
        const erreur = new Error(`Date ISO invalide : ${dateIso}`);
        erreur.code = "DATE_ISO_INVALIDE";
        erreur.status = 500;
        throw erreur;
    }

    return dateLocale;
}

function arrondir(nombre, nombreDecimales = 2) {
    const facteur = 10 ** nombreDecimales;
    return Math.round((nombre + Number.EPSILON) * facteur) / facteur;
}

function formaterNombre(nombre, nombreDecimales = 2) {
    return nombre.toLocaleString("fr-FR", {
        minimumFractionDigits: nombreDecimales,
        maximumFractionDigits: nombreDecimales
    });
}

function estDebutVacancesEte(evenement) {
    return evenement.description === "Debut des Vacances d'Ete" ||
        evenement.description === "Début des Vacances d'Été";
}

function estPontScolaire(evenement) {
    return String(evenement.description ?? "")
        .toLocaleLowerCase("fr-FR")
        .includes("pont");
}
function genererJoursOuvresBruts(
    dateDebutScolarite,
    dateFinScolarite
) {
    const joursOuvresBruts = [];

    let dateCourante = dateDebutScolarite;

    while (dateCourante <= dateFinScolarite) {
        const estJourOuvreBrut =
            dateCourante.weekday >= JOURS_SEMAINE.LUNDI &&
            dateCourante.weekday <= JOURS_SEMAINE.VENDREDI;

        if (estJourOuvreBrut) {
            joursOuvresBruts.push(dateCourante);
        }

        dateCourante = dateCourante.plus({
            days: 1
        });
    }

    return joursOuvresBruts;
}

function genererJoursOuvres(
    dateDebutScolarite,
    dateFinScolarite,
    joursTravailles
) {
    const numerosJoursTravailles = new Set(
        joursTravailles.map((jour) => JOURS_SEMAINE[jour])
    );

    const joursOuvres = [];
    let dateCourante = dateDebutScolarite;

    while (dateCourante <= dateFinScolarite) {
        if (numerosJoursTravailles.has(dateCourante.weekday)) {
            joursOuvres.push(dateCourante);
        }

        dateCourante = dateCourante.plus({ days: 1 });
    }

    return joursOuvres;
}

function construireExclusionsScolaires(evenementsScolaires) {
    const exclusionsParDate = new Map();

    for (const evenement of evenementsScolaires) {
        if (estDebutVacancesEte(evenement)) {
            continue;
        }

        const dateDebut = convertirDateUtcEnDateLocale(
            evenement.dateDebutUtc
        );
        const dateFin = convertirDateUtcEnDateLocale(
            evenement.dateFinUtc
        );

        if (estPontScolaire(evenement)) {
            const dateIso = dateDebut.toISODate();
            exclusionsParDate.set(dateIso, {
                date: dateIso,
                jourSemaine: obtenirJourSemaine(dateDebut),
                libelle: evenement.description,
                motif: "Pont scolaire"
            });
            continue;
        }

        let dateCourante = dateDebut;

        while (dateCourante < dateFin) {
            const dateIso = dateCourante.toISODate();
            exclusionsParDate.set(dateIso, {
                date: dateIso,
                jourSemaine: obtenirJourSemaine(dateCourante),
                libelle: evenement.description,
                motif: "Vacances scolaires"
            });

            dateCourante = dateCourante.plus({ days: 1 });
        }
    }

    return exclusionsParDate;
}

function ajouterJoursFeriesAuxExclusions(
    exclusionsParDate,
    joursFeries,
    dateDebutScolarite,
    dateFinScolarite
) {
    for (const jourFerie of joursFeries) {
        const dateJourFerie = convertirDateIsoEnDateLocale(jourFerie.date);

        if (
            dateJourFerie < dateDebutScolarite ||
            dateJourFerie > dateFinScolarite
        ) {
            continue;
        }

        if (exclusionsParDate.has(jourFerie.date)) {
            continue;
        }

        exclusionsParDate.set(jourFerie.date, {
            date: jourFerie.date,
            jourSemaine: obtenirJourSemaine(dateJourFerie),
            libelle: jourFerie.libelle,
            motif: "Jour ferie"
        });
    }
}

export async function calculerAnnualisation(parametres) {
    const {
        anneeScolaire,
        academie,
        zoneJoursFeries,
        joursTravailles,
        heuresTravailParJour,
        indiceMajore
    } = parametres;

    const {
        baseTempsCompletAnnuelle,
        valeurAnnuelleReferenceIm100,
        dateEffetValeurIm100
    } = PARAMETRES_REMUNERATION;

    const [periodeScolaire, joursFeries] = await Promise.all([
        recupererPeriodeScolaire(anneeScolaire, academie),
        recupererJoursFeries(anneeScolaire, zoneJoursFeries)
    ]);

    const dateDebutScolarite = convertirDateIsoEnDateLocale(
        periodeScolaire.dateDebutScolarite
    );
    const dateFinScolarite = convertirDateIsoEnDateLocale(
        periodeScolaire.dateFinScolarite
    );
    const joursOuvresBruts = genererJoursOuvresBruts(
        dateDebutScolarite,
        dateFinScolarite
    );
    const joursOuvres = genererJoursOuvres(
        dateDebutScolarite,
        dateFinScolarite,
        joursTravailles
    );

    const exclusionsParDate = construireExclusionsScolaires(
        periodeScolaire.evenementsScolaires
    );

    ajouterJoursFeriesAuxExclusions(
        exclusionsParDate,
        joursFeries,
        dateDebutScolarite,
        dateFinScolarite
    );

    const joursExclus = joursOuvres
        .filter((date) => exclusionsParDate.has(date.toISODate()))
        .map((date) => exclusionsParDate.get(date.toISODate()))
        .sort((jourA, jourB) => jourA.date.localeCompare(jourB.date));

    const datesExclues = new Set(joursExclus.map((jour) => jour.date));

    const joursClasse = joursOuvres.filter(
        (date) => !datesExclues.has(date.toISODate())
    );

    const nombreJoursOuvresBruts =
        joursOuvresBruts.length;

    const nombreJoursTravaillesPrevus =
        joursOuvres.length;


    const nombreJoursExclus =
        joursExclus.length;

    const nombreJoursTravaillesClasse =
        joursClasse.length;

    if (
        nombreJoursTravaillesPrevus - nombreJoursExclus !==
        nombreJoursTravaillesClasse
    ) {
        const erreur = new Error(
            "Le décompte des jours travaillés prévus, exclus et travaillés en période de classe est incohérent."
        );

        erreur.code = "DECOMPTE_JOURS_INCOHERENT";
        erreur.status = 500;

        throw erreur;
    }

    const heuresAnnuellesPoste = arrondir(
        nombreJoursTravaillesClasse *
        heuresTravailParJour,
        2
    );

    const quotiteNonArrondie =
        (heuresAnnuellesPoste / baseTempsCompletAnnuelle) * 35;

    const quotite = arrondir(
        quotiteNonArrondie,
        2
    );

    /*
     * Calcul du traitement indiciaire brut mensuel à temps complet.
     *
     * Formule officielle :
     * indice majoré x valeur annuelle de l'IM 100 / 1200
     */
    const traitementBrutMensuelTempsCompletNonArrondi =
        (
            indiceMajore *
            valeurAnnuelleReferenceIm100
        ) / 1200;

    const traitementBrutMensuelTempsComplet =
        arrondir(
            traitementBrutMensuelTempsCompletNonArrondi,
            2
        );

    /*
     * Application de la quotité au traitement brut mensuel.
     *
     * La quotité non arrondie est utilisée pour éviter
     * un écart lié à un arrondi intermédiaire.
     */
    const traitementBrutMensuelPosteNonArrondi =
        traitementBrutMensuelTempsCompletNonArrondi *
        (quotiteNonArrondie / 35);

    const traitementBrutMensuelPoste =
        arrondir(
            traitementBrutMensuelPosteNonArrondi,
            2
        );

    return {
        anneeScolaire,
        academie,
        zoneScolaire:
            periodeScolaire.zoneScolaire,
        zoneJoursFeries,

        calendrier: {
            calendrier: {
                dateDebutScolarite:
                    periodeScolaire.dateDebutScolarite,

                dateFinScolarite:
                    periodeScolaire.dateFinScolarite,

                dateDebutVacancesEte:
                    periodeScolaire.dateDebutVacancesEte,

                joursTravaillesSemaine:
                    joursTravailles,

                nombreJoursOuvresBruts,
                nombreJoursTravaillesPrevus,
                nombreJoursExclus,
                nombreJoursTravaillesClasse,

                joursExclus
            },

        },

        calculHeures: {
            heuresTravailParJour,

            formule:
                "Nombre de jours travaillés en période de classe x Heures de travail par jour",

            calcul:
                `${nombreJoursTravaillesClasse} x ${formaterNombre(
                    heuresTravailParJour,
                    1
                )}`,

            heuresAnnuellesPoste
        },

        calculQuotite: {
            baseTempsCompletAnnuelle,

            formule:
                "(Heures annuelles du poste / Base temps complet annuelle) x 35",

            calcul:
                `(${formaterNombre(
                    heuresAnnuellesPoste,
                    2
                )} / ${formaterNombre(
                    baseTempsCompletAnnuelle,
                    0
                )}) x 35`,

            quotite
        },

        calculTraitementBrut: {
            indiceMajore,
            valeurAnnuelleReferenceIm100,
            dateEffetValeurIm100,

            formuleTempsComplet:
                "(Indice majoré x Valeur annuelle de référence de l'IM 100) / 1200",

            calculTempsComplet:
                `(${indiceMajore} x ` +
                `${formaterNombre(
                    valeurAnnuelleReferenceIm100,
                    2
                )}) / 1200`,

            traitementBrutMensuelTempsComplet,

            formuleApplicationQuotite:
                "Traitement brut mensuel à temps complet x (Quotité / 35)",

            calculApplicationQuotite:
                `${formaterNombre(
                    traitementBrutMensuelTempsCompletNonArrondi,
                    2
                )} x (` +
                `${formaterNombre(
                    quotiteNonArrondie,
                    4
                )} / 35)`,

            traitementBrutMensuelPoste
        }
    };
}