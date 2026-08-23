import express from "express";
import cors from "cors";
import webhookRoutes from "./routes/webhook.routes.js"

import { prisma } from "@recover-ai/database";

const app = express();

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
  : ["http://localhost:3000", "http://127.0.0.1:3000"];

app.use(cors({
  origin(origin, callback) {
    if (!origin || corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Not allowed by CORS"));
  },
}));

app.use("/api/webhooks", express.raw({
  type: "application/json",
  limit: process.env.WEBHOOK_BODY_LIMIT || "1mb",
}));



app.use(express.json());

app.use("/api/webhooks",  webhookRoutes);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "recover-ai-api",
  });
});

app.get("/api/db-test", async (_req, res) => {
  try {
    const merchants = await prisma.merchant.count();

    res.json({
      success: true,
      merchantCount: merchants,
    });
  } catch (error) {
    console.error("Database test failed:", error);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

export default app;
