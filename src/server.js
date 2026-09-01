import express from "express";
import healthRouter from "./routes/health.routes.js";


const app = express();
const port = 3000;

app.use(express.json());
app.use("/api/health", healthRouter);
app.listen(port, () => {
  console.log(`API démarrée sur http://localhost:${port}`);
});