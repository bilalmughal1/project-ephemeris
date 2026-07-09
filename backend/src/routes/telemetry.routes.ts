import { Router } from "express";
import { getTelemetryData } from "../controllers/telemetry.controller.js";

const router = Router();

// Define endpoint for general telemetry streaming
router.get("/", getTelemetryData);

export default router;
