import { Router } from "express";

const router = Router();

router.get("/", (request, response) => {
  response.status(200).json({
    statut: "OK",
    service: "controle-paie-agents"
  });
});

export default router;