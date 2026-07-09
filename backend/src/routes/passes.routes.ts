import { Router } from "express";
import { getPasses, searchPasses } from "../controllers/passes.controller.js";

const router = Router();

// Filter passes by satellite membership and/or time-range overlap
router.get("/", getPasses);

// Point-radius-date spatial intersection
router.get("/search", searchPasses);

export default router;
