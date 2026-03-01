import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { config } from "./config";
import authRoutes from "./routes/auth";
import analyzeRoutes from "./routes/analyze";
import historyRoutes from "./routes/history";
import billingRoutes from "./routes/billing";
import { globalLimiter } from "./middleware/rateLimit";

const app = express();

app.set("trust proxy", 1);

app.use(helmet());
app.use(globalLimiter);
app.use(express.json({ limit: "64kb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: config.CORS_ORIGIN.split(",").map((o) => o.trim()),
    credentials: true
  })
);

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.use("/v1/auth", authRoutes);
app.use("/v1", analyzeRoutes);
app.use("/v1", historyRoutes);
app.use("/v1", billingRoutes);

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(config.PORT, () => {
  console.log(`API listening on :${config.PORT}`);
});
