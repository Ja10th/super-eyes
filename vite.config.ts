import path from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import crypto from "crypto";
import fs from "fs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function ttsDevPlugin(): Plugin {
  return {
    name: "vite-plugin-tts-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/tts")) {
          return next();
        }

        try {
          const url = new URL(req.url, "http://localhost");
          const text = url.searchParams.get("text")?.trim();
          if (!text) {
            res.statusCode = 400;
            res.end("Missing text parameter");
            return;
          }

          const hash = crypto.createHash("md5").update(text.toLowerCase()).digest("hex");
          const cacheDir = path.resolve(__dirname, "public/audio/cache");
          if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
          }
          const cacheFile = path.join(cacheDir, `${hash}.mp3`);

          if (fs.existsSync(cacheFile) && fs.statSync(cacheFile).size > 1000) {
            const data = fs.readFileSync(cacheFile);
            res.setHeader("Content-Type", "audio/mpeg");
            res.setHeader("Cache-Control", "public, max-age=86400");
            res.end(data);
            return;
          }

          const scriptPath = path.resolve(__dirname, "scripts/tts_generator.py");
          execFile("python3", [scriptPath, text, cacheFile], (err) => {
            if (err) {
              console.error("TTS generation error:", err);
              res.statusCode = 500;
              res.end("TTS generation error");
              return;
            }

            if (fs.existsSync(cacheFile)) {
              const data = fs.readFileSync(cacheFile);
              res.setHeader("Content-Type", "audio/mpeg");
              res.setHeader("Cache-Control", "public, max-age=86400");
              res.end(data);
            } else {
              res.statusCode = 500;
              res.end("File generation failed");
            }
          });
        } catch (e) {
          console.error("Middleware error:", e);
          res.statusCode = 500;
          res.end("Internal Server Error");
        }
      });
    },
  };
}

function youtubeDevPlugin(): Plugin {
  return {
    name: "vite-plugin-youtube-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith("/oauth/callback")) {
          const url = new URL(req.url, "http://localhost:5173");
          const code = url.searchParams.get("code");
          const error = url.searchParams.get("error");
          const clientId = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;

          if (error) {
            res.statusCode = 302;
            res.setHeader("Location", `/?error=${encodeURIComponent(error)}`);
            res.end();
            return;
          }

          if (!code || !clientId) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: "Missing OAuth code or client id" }));
            return;
          }

          const verifier = url.searchParams.get("state") || "";
          res.statusCode = 302;
          res.setHeader(
            "Location",
            `/?code=${encodeURIComponent(code)}&state=${encodeURIComponent(verifier)}`
          );
          res.end();
          return;
        }

        if (req.url?.startsWith("/api/google/exchange") && req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
          });
          req.on("end", async () => {
            try {
              const payload = JSON.parse(body || "{}");
              const code = payload.code;
              const codeVerifier = payload.codeVerifier;
              const redirectUri = payload.redirectUri || "http://localhost:5173/oauth/callback";
              const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
              const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

              if (!clientId || !clientSecret || !code || !codeVerifier) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: false, error: "Google OAuth env missing or code verifier missing" }));
                return;
              }

              const params = new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: "authorization_code",
                code_verifier: codeVerifier,
              });

              const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: params.toString(),
              });

              const tokens = await tokenRes.json();
              if (!tokenRes.ok) {
                throw new Error(tokens.error_description || tokens.error || "token exchange failed");
              }

              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: true, tokens }));
            } catch (err) {
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: false, error: String(err) }));
            }
          });
          return;
        }

        if (req.url?.startsWith("/api/youtube/verify")) {
          try {
            const url = new URL(req.url, "http://localhost");
            const query = url.searchParams.get("query")?.trim() || "";
            const apiKey = url.searchParams.get("apiKey")?.trim() || "";

            if (!query) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: false, error: "Query parameter required" }));
              return;
            }

            const scriptPath = path.resolve(__dirname, "scripts/verify_youtube.py");
            execFile("python3", [scriptPath, query, apiKey], (err, stdout) => {
              res.setHeader("Content-Type", "application/json");
              if (err) {
                res.statusCode = 200;
                res.end(JSON.stringify({ success: false, error: String(err) }));
                return;
              }
              res.statusCode = 200;
              res.end(stdout.trim());
            });
          } catch (e) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }

        if (req.url?.startsWith("/api/webhook/test") && req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
          });
          req.on("end", async () => {
            try {
              const data = JSON.parse(body || "{}");
              const webhookUrl = data.webhookUrl;
              if (!webhookUrl || !webhookUrl.startsWith("http")) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: false, error: "Valid HTTP(S) Webhook URL required" }));
                return;
              }

              const testPayload = {
                event: "youtube.test.ping",
                channel: data.channelName || "Test Channel",
                timestamp: new Date().toISOString(),
                status: "active",
              };

              const webhookResp = await fetch(webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(testPayload),
              });

              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  success: webhookResp.ok,
                  status: webhookResp.status,
                  statusText: webhookResp.statusText,
                  message: webhookResp.ok
                    ? `Webhook responded with HTTP ${webhookResp.status} OK!`
                    : `Webhook responded with HTTP ${webhookResp.status}`,
                })
              );
            } catch (err) {
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: false, error: String(err) }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile(), ttsDevPlugin(), youtubeDevPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
