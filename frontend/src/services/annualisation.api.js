export async function calculerAnnualisation(requete) {
    const reponse = await fetch("/api/annualisation/quotite", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(requete)
    });

    const donnees = await reponse.json();

    if (!reponse.ok) {
        const erreur = new Error(
            donnees.message ??
            "Une erreur est survenue pendant le calcul."
        );

        erreur.details = donnees.details ?? [];
        erreur.statut = reponse.status;

        throw erreur;
    }

    return donnees;
}