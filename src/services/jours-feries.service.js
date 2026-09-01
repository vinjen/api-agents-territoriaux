import axios from "axios";

const URL_JOURS_FERIES =
  "https://calendrier.api.gouv.fr/jours-feries";

export async function recupererJoursFeries(
  anneeScolaire,
  zoneJoursFeries
) {
  const [anneeDebut, anneeFin] = anneeScolaire
    .split("-")
    .map(Number);

  const [reponseAnneeDebut, reponseAnneeFin] =
    await Promise.all([
      axios.get(
        `${URL_JOURS_FERIES}/${zoneJoursFeries}/${anneeDebut}.json`,
        {
          timeout: 10000
        }
      ),
      axios.get(
        `${URL_JOURS_FERIES}/${zoneJoursFeries}/${anneeFin}.json`,
        {
          timeout: 10000
        }
      )
    ]);

  const joursFeries = {
    ...reponseAnneeDebut.data,
    ...reponseAnneeFin.data
  };

  return Object.entries(joursFeries)
    .map(([date, libelle]) => ({
      date,
      libelle
    }))
    .sort((jourA, jourB) =>
      jourA.date.localeCompare(jourB.date)
    );
}