import express from "express";
import { calculerQuotiteAnnualisee } from "../controllers/annualisation.controller.js";

const router = express.Router();

router.post("/quotite", calculerQuotiteAnnualisee);

export default router;