import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const CFG = {
  CLIENT_ID: process.env.CLIENT_ID,
  CLIENT_SECRET: process.env.CLIENT_SECRET,
  TOKEN_URL: process.env.TOKEN_URL,
  SCOPE_URL: process.env.SCOPE_URL,
  BASE_URL: (process.env.BASE_URL || "").replace(/\/$/, ""),
  ENTITY_NAME: process.env.ENTITY_NAME || "PdSalesVSCostProcesseds",
  FILTER_FIELD: process.env.FILTER_FIELD || "SalesId",
  DATAAREAID: process.env.DATAAREAID || "",
};

const tokenCache = { token: null, expiry: 0 };

export function escapeOData(value) {
  return String(value ?? "").replace(/'/g, "''");
}

export function entityEndpoint() {
  const base = CFG.BASE_URL || "";
  if (!base) return CFG.ENTITY_NAME;
  const hasData = /\/data$/i.test(base);
  const root = hasData ? base : `${base}/data`;
  return `${root}/${CFG.ENTITY_NAME}`;
}

async function obtenerToken() {
  const now = Date.now() / 1000;
  if (tokenCache.token && tokenCache.expiry > now + 60) return tokenCache.token;

  const data = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CFG.CLIENT_ID,
    client_secret: CFG.CLIENT_SECRET,
    scope: CFG.SCOPE_URL,
  });

  const resp = await axios.post(CFG.TOKEN_URL, data.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const accessToken = resp.data?.access_token;
  tokenCache.token = accessToken;
  tokenCache.expiry = now + 3600;
  return accessToken;
}

export async function fetchODataBySalesId(salesId) {
  if (!salesId) throw new Error("salesId requerido");
  const token = await obtenerToken();
  const valor = escapeOData(salesId);
  const filtro = `$filter=${CFG.FILTER_FIELD} eq '${valor}'`;
  const url = `${entityEndpoint()}?${filtro}`;

  const resp = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      Prefer: "odata.maxpagesize=5000",
    },
    timeout: 30_000,
  });

  const ct = resp.headers["content-type"] || "";
  if (!ct.includes("application/json")) {
    throw new Error(`Respuesta inesperada de OData: ${ct}`);
  }

  return resp.data;
}

export async function patchODataRecord(salesId, changes) {
  if (!salesId) throw new Error("salesId requerido");
  if (!changes || typeof changes !== "object") throw new Error("changes inválido");

  const token = await obtenerToken();
  const v = escapeOData(salesId);
  const keyParts = [`${CFG.FILTER_FIELD}='${v}'`];
  if (CFG.DATAAREAID) keyParts.push(`dataAreaId='${escapeOData(CFG.DATAAREAID)}'`);
  const keyPath = `${entityEndpoint()}(${keyParts.join(",")})`;

  const resp = await axios.patch(keyPath, changes, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "If-Match": "*",
    },
    timeout: 30_000,
  });
  return resp;
}

export default CFG;
