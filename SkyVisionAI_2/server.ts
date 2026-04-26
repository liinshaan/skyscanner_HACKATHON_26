import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Skyscanner Proxy
  // Note: This is an example of how to handle private keys on the backend
  app.post("/api/skyscanner/*", async (req, res) => {
    const subPath = req.params[0];
    const apiKey = process.env.SKYSCANNER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "SKYSCANNER_API_KEY not configured on server" });
    }

    try {
      const url = `https://partners.api.skyscanner.net/${subPath}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;
      
      const response = await fetch(url, {
        method: req.method,
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
      });

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      console.error("Skyscanner Proxy Error:", error);
      res.status(500).json({ error: "Failed to fetch from Skyscanner" });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        host: '0.0.0.0',
        port: 3000
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
