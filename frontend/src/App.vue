<script setup>
import { ref } from "vue";

const titre = ref("Contrôle de paie agent");
</script>

<template>
  <main class="app-shell">
    <header class="app-header">
      <p class="app-kicker">Outil de vérification</p>
      <h1>{{ titre }}</h1>
      <p class="app-subtitle">
        Vérifiez simplement l’annualisation et la quotité de travail d’un agent.
      </p>
    </header>

    <section class="app-card" aria-labelledby="annualisation-title">
      <div class="app-card__header">
        <span class="app-card__icon" aria-hidden="true">÷</span>
        <div>
          <h2 id="annualisation-title">Annualisation</h2>
          <p>Calculez les jours travaillés, les heures annuelles et la quotité.</p>
        </div>
      </div>

      <button class="primary-button" type="button">
        Commencer un contrôle
      </button>
    </section>
  </main>
</template>
