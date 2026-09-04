<script setup>
import { computed, nextTick, ref } from "vue";
import { calculerAnnualisation } from "./services/annualisation.api.js";

const anneesScolaires = ["2026-2027", "2025-2026", "2024-2025"];
const academies = ["Nancy-Metz"];
const zonesJoursFeries = [
  { valeur: "metropole", libelle: "Métropole" },
  { valeur: "alsace-moselle", libelle: "Alsace-Moselle" }
];

const joursDisponibles = [
  { valeur: "LUNDI", libelle: "Lun" },
  { valeur: "MARDI", libelle: "Mar" },
  { valeur: "MERCREDI", libelle: "Mer" },
  { valeur: "JEUDI", libelle: "Jeu" },
  { valeur: "VENDREDI", libelle: "Ven" },
  { valeur: "SAMEDI", libelle: "Sam" }
];

const formulaire = ref({
  anneeScolaire: "2026-2027",
  academie: "Nancy-Metz",
  zoneJoursFeries: "metropole",
  joursTravailles: ["LUNDI", "MARDI", "JEUDI", "VENDREDI"],
  heures: 8,
  minutes: 30,
  indiceMajore: 369
});

const resultat = ref(null);
const chargement = ref(false);
const messageErreur = ref("");
const detailsErreur = ref([]);
const sectionResultat = ref(null);
const tooltipOuvert = ref(null);

const heuresTravailParJour = computed(() => {
  return Number(formulaire.value.heures) + Number(formulaire.value.minutes) / 60;
});

const dureeFormatee = computed(() => {
  const heures = Number(formulaire.value.heures) || 0;
  const minutes = Number(formulaire.value.minutes) || 0;
  return `${heures} h ${String(minutes).padStart(2, "0")}`;
});

const pourcentageTempsComplet = computed(() => {
  const quotite = resultat.value?.calculQuotite?.quotite;
  return typeof quotite === "number" ? ((quotite / 35) * 100).toFixed(2) : "0,00";
});

function basculerTooltip(identifiant) {
  tooltipOuvert.value =
    tooltipOuvert.value === identifiant
      ? null
      : identifiant;
}

function basculerJour(jour) {
  const jours = formulaire.value.joursTravailles;
  const index = jours.indexOf(jour);

  if (index >= 0) {
    jours.splice(index, 1);
    return;
  }

  jours.push(jour);
}

function estJourSelectionne(jour) {
  return formulaire.value.joursTravailles.includes(jour);
}

function formaterDate(dateIso) {
  if (!dateIso) {
    return "-";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(`${dateIso}T12:00:00`));
}

function formaterMontant(montant) {
  if (typeof montant !== "number") {
    return "-";
  }

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR"
  }).format(montant);
}

function formaterNombre(nombre, decimales = 2) {
  if (typeof nombre !== "number") {
    return "-";
  }

  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales
  }).format(nombre);
}

async function preparerCalcul() {
  chargement.value = true;
  resultat.value = null;
  messageErreur.value = "";
  detailsErreur.value = [];

  const requete = {
    anneeScolaire: formulaire.value.anneeScolaire,
    academie: formulaire.value.academie,
    zoneJoursFeries: formulaire.value.zoneJoursFeries,
    joursTravailles: [...formulaire.value.joursTravailles],
    heuresTravailParJour: heuresTravailParJour.value,
    indiceMajore: Number(formulaire.value.indiceMajore)
  };

  try {
    resultat.value = await calculerAnnualisation(requete);
    await nextTick();
    sectionResultat.value?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (erreur) {
    messageErreur.value =
      erreur.message ?? "Une erreur est survenue pendant le calcul.";
    detailsErreur.value = erreur.details ?? [];
  } finally {
    chargement.value = false;
  }
}
</script>

<template>
  <main class="app-shell">
    <header class="app-header">
      <p class="app-kicker">Outil de vérification</p>
      <h1>Contrôle de paie agent</h1>
      <p class="app-subtitle">
        Calculez l’annualisation et la quotité de travail à partir du calendrier réel.
      </p>
    </header>

    <form class="app-card" @submit.prevent="preparerCalcul">
      <div class="app-card__header">
        <span class="app-card__icon" aria-hidden="true">÷</span>
        <div>
          <h2>Annualisation</h2>
          <p>Renseignez les conditions de travail de l’agent.</p>
        </div>
      </div>

      <div class="form-grid">
        <label class="form-field">
          <span class="form-label">Année scolaire</span>
          <select v-model="formulaire.anneeScolaire">
            <option v-for="annee in anneesScolaires" :key="annee" :value="annee">
              {{ annee }}
            </option>
          </select>
        </label>

        <label class="form-field">
          <span class="form-label">Académie</span>
          <select v-model="formulaire.academie">
            <option v-for="academie in academies" :key="academie" :value="academie">
              {{ academie }}
            </option>
          </select>
        </label>

        <label class="form-field">
          <span class="form-label">Zone des jours fériés</span>
          <select v-model="formulaire.zoneJoursFeries">
            <option v-for="zone in zonesJoursFeries" :key="zone.valeur" :value="zone.valeur">
              {{ zone.libelle }}
            </option>
          </select>
        </label>

        <fieldset class="form-field form-field--full">
          <legend class="form-label">Jours travaillés</legend>
          <div class="day-selector">
            <button
              v-for="jour in joursDisponibles"
              :key="jour.valeur"
              class="day-button"
              :class="{ 'day-button--selected': estJourSelectionne(jour.valeur) }"
              type="button"
              :aria-pressed="estJourSelectionne(jour.valeur)"
              @click="basculerJour(jour.valeur)"
            >
              {{ jour.libelle }}
            </button>
          </div>
        </fieldset>

        <fieldset class="form-field form-field--full">
          <legend class="form-label">Temps de travail par jour</legend>
          <div class="duration-grid">
            <label class="compact-field">
              <span>Heures</span>
              <input v-model.number="formulaire.heures" type="number" min="0" max="23" />
            </label>

            <label class="compact-field">
              <span>Minutes</span>
              <select v-model.number="formulaire.minutes">
                <option :value="0">00</option>
                <option :value="15">15</option>
                <option :value="30">30</option>
                <option :value="45">45</option>
              </select>
            </label>

            <div class="duration-summary" aria-live="polite">
              <span>Durée retenue</span>
              <strong>{{ dureeFormatee }}</strong>
            </div>
          </div>
        </fieldset>

        <label class="form-field">
          <span class="form-label">Indice majoré</span>
          <input
            v-model.number="formulaire.indiceMajore"
            type="number"
            min="1"
            inputmode="numeric"
          />
        </label>
      </div>

      <button
        class="primary-button"
        type="submit"
        :disabled="chargement || formulaire.joursTravailles.length === 0"
      >
        {{ chargement ? "Calcul en cours..." : "Calculer la quotité" }}
      </button>
    </form>

    <section
      v-if="messageErreur"
      class="feedback-card feedback-card--error"
      role="alert"
    >
      <h2>Calcul impossible</h2>
      <p>{{ messageErreur }}</p>
      <ul v-if="detailsErreur.length > 0">
        <li v-for="detail in detailsErreur" :key="detail">{{ detail }}</li>
      </ul>
    </section>

    <section
      v-if="resultat"
      ref="sectionResultat"
      class="result-card"
      aria-labelledby="resultat-title"
    >
      <div class="result-card__header">
        <div>
          <p class="result-card__kicker">Quotité calculée</p>
          <h2 id="resultat-title">{{ formaterNombre(resultat.calculQuotite.quotite) }} / 35e</h2>
        </div>
        <span class="result-card__badge">{{ pourcentageTempsComplet }} %</span>
      </div>

      <div class="result-section">
        <h3>Période scolaire</h3>
        <dl class="result-list">
          <div>
            <dt>Début</dt>
            <dd>{{ formaterDate(resultat.calendrier.dateDebutScolarite) }}</dd>
          </div>
          <div>
            <dt>Fin</dt>
            <dd>{{ formaterDate(resultat.calendrier.dateFinScolarite) }}</dd>
          </div>
        </dl>
      </div>

      <div class="result-section">
        <h3>Décompte des jours</h3>
        <div class="metric-grid">
  <article class="metric-card">
    <strong>
      {{ resultat.calendrier.nombreJoursOuvresBruts }}
    </strong>

    <div class="metric-label">
      <span>Jours ouvrés de la période</span>

      <button
      :class="{ 'info-tooltip--open': tooltipOuvert === 'joursOuvres' }"
      :aria-expanded="tooltipOuvert === 'joursOuvres'"
      @click.stop="basculerTooltip('joursOuvres')"
        class="info-tooltip"
        type="button"
        aria-label="Explication des jours ouvrés de la période"
        data-tooltip="Tous les jours du lundi au vendredi compris entre la rentrée et la fin des classes, avant toute exclusion."
      >
        i
      </button>
    </div>
  </article>

  <article class="metric-card">
    <strong>
      {{ resultat.calendrier.nombreJoursTravaillesPrevus }}
    </strong>

    <div class="metric-label">
      <span>Jours prévus selon le planning</span>

      <button
        :class="{ 'info-tooltip--open': tooltipOuvert === 'joursOuvres' }"
:aria-expanded="tooltipOuvert === 'joursOuvres'"
@click.stop="basculerTooltip('joursOuvres')"
        class="info-tooltip"
        type="button"
        aria-label="Explication des jours prévus selon le planning"
        data-tooltip="Jours correspondant au planning hebdomadaire renseigné, avant le retrait des vacances, jours fériés et ponts."
      >
        i
      </button>
    </div>
  </article>

  <article class="metric-card">
    <strong>
      {{ resultat.calendrier.nombreJoursExclus }}
    </strong>

    <div class="metric-label">
      <span>Jours du planning exclus</span>

      <button
      :class="{ 'info-tooltip--open': tooltipOuvert === 'joursOuvres' }"
:aria-expanded="tooltipOuvert === 'joursOuvres'"
@click.stop="basculerTooltip('joursOuvres')"
        class="info-tooltip"
        type="button"
        aria-label="Explication des jours du planning exclus"
        data-tooltip="Vacances scolaires, jours fériés et ponts tombant uniquement sur un jour normalement prévu au planning."
      >
        i
      </button>
    </div>
  </article>

  <article class="metric-card metric-card--primary">
    <strong>
      {{ resultat.calendrier.nombreJoursTravaillesClasse }}
    </strong>

    <div class="metric-label">
      <span>Jours de classe travaillés</span>

      <button
      :class="{ 'info-tooltip--open': tooltipOuvert === 'joursOuvres' }"
:aria-expanded="tooltipOuvert === 'joursOuvres'"
@click.stop="basculerTooltip('joursOuvres')"
        class="info-tooltip info-tooltip--light"
        type="button"
        aria-label="Explication des jours de classe travaillés"
        data-tooltip="Résultat final : jours prévus selon le planning moins les jours exclus."
      >
        i
      </button>
    </div>
  </article>
</div>
      </div>

      <div class="result-section">
        <h3>Calcul des heures</h3>
        <p class="calculation">{{ resultat.calculHeures.calcul }}</p>
        <strong class="calculation-result">
          {{ formaterNombre(resultat.calculHeures.heuresAnnuellesPoste) }} heures annuelles
        </strong>
      </div>

      <div class="result-section">
        <h3>Traitement indiciaire brut</h3>
        <dl class="result-list">
          <div>
            <dt>Indice majoré</dt>
            <dd>{{ resultat.calculTraitementBrut.indiceMajore }}</dd>
          </div>
          <div>
            <dt>Brut mensuel à temps complet</dt>
            <dd>{{ formaterMontant(resultat.calculTraitementBrut.traitementBrutMensuelTempsComplet) }}</dd>
          </div>
          <div class="result-list__highlight">
            <dt>Brut mensuel annualisé</dt>
            <dd>{{ formaterMontant(resultat.calculTraitementBrut.traitementBrutMensuelPoste) }}</dd>
          </div>
        </dl>
      </div>

      <details
        v-if="resultat.calendrier.joursExclus?.length > 0"
        class="excluded-days"
      >
        <summary>
          Voir les {{ resultat.calendrier.nombreJoursExclus }} jours exclus
        </summary>
        <ul>
          <li v-for="jour in resultat.calendrier.joursExclus" :key="jour.date">
            <div>
              <strong>{{ jour.jourSemaine }} {{ formaterDate(jour.date) }}</strong>
              <span>{{ jour.libelle }}</span>
            </div>
            <small>{{ jour.motif }}</small>
          </li>
        </ul>
      </details>
    </section>
  </main>
</template>
