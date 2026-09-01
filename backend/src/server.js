import express from "express";

import healthRouter from "./routes/health.routes.js";
import annualisationRoutes from "./routes/annualisation.routes.js";

const app = express();
const port = 3000;

app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/annualisation", annualisationRoutes);

// Le middleware d'erreur doit être déclaré après les routes
app.use((erreur, req, res, next) => {
  console.error(erreur);

  const statut = erreur.status ?? 500;

  res.status(statut).json({
    erreur: erreur.code ?? "ERREUR_INTERNE",
    message:
      statut === 500
        ? "Une erreur interne est survenue."
        : erreur.message
  });
});

app.listen(port, () => {
  console.log(`API démarrée sur http://localhost:${port}`);
});