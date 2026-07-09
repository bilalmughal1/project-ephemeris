import { Router } from "express";
import { getPasses } from "../controllers/passes.controller.js";

const router = Router();

// Filter passes by satellite membership and/or time-range overlap
router.get("/", getPasses);

export default router;
