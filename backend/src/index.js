import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import snowflakeRoutes from "./routes/snowflakeRoutes.js";
import { fetchODataBySalesId, patchODataRecord } from "./services/odataService.js";

dotenv.config();

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: true }));

const limiter = rateLimit({ windowMs: 60_000, max: 60 });
app.use(limiter);

app.get("/api/odata/search", async (req, res) => {
  try {
    const salesId = req.query.salesId || "";
    if (!salesId) return res.status(400).json({ error: "salesId requerido" });
    const data = await fetchODataBySalesId(salesId);
    return res.json(data);
  } catch (err) {
    if (err.response) {
      const { status, data, headers } = err.response;
      return res
        .status(status || 500)
        .json({ status, content_type: headers?.["content-type"], text: typeof data === "string" ? data.slice(0, 1000) : data });
    }
    return res.status(500).json({ error: err.message });
  }
});

app.patch("/api/odata/update", async (req, res) => {
  try {
    const { salesId, changes } = req.body || {};
    if (!salesId || !changes || typeof changes !== "object")
      return res.status(400).json({ error: "salesId y changes requeridos" });

    const resp = await patchODataRecord(salesId, changes);
    return res.status(resp.status || 200).json({ status: resp.status || 200, ok: true });
  } catch (err) {
    if (err.response) {
      const { status, data, headers } = err.response;
      return res
        .status(status || 500)
        .json({ status, content_type: headers?.["content-type"], text: typeof data === "string" ? data.slice(0, 1000) : data });
    }
    return res.status(500).json({ error: err.message });
  }
});

// Rutas de Snowflake
app.use("/api/snowflake", snowflakeRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend escuchando en http://localhost:${PORT}`);
});



