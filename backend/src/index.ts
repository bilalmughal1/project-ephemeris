import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initDatabase } from "./database/db.js";
import passesRouter from "./routes/passes.routes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// System Health/Check Route
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// Mount modular API routing entry points
app.use("/api/passes", passesRouter);

const startServer = async () => {
  await initDatabase();

  app.listen(PORT, () => {
    console.log(
      `[Server] Telemetry service running on http://localhost:${PORT}`,
    );
    console.log(
      `[Server] API Endpoint live at http://localhost:${PORT}/api/passes`,
    );
  });
};

startServer().catch((err) => {
  console.error(
    "[Server] Critical failure bootstrapping Express application layer:",
    err,
  );
});
