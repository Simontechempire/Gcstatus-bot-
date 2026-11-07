const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const path = require("path");
const fs = require("fs");
const config = require("./config");
const gcStatus = require("./gcstatus");

const app = express();
app.use(express.json());
app.use(express.static("public"));

let sock = null;
let sockPromise = null;
let isConnecting = false;

async function startBot() {
  if (sockPromise) return sockPromise;
  if (isConnecting) return sockPromise;

  isConnecting = true;
  sockPromise = (async () => {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState("session");

    sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      browser: ["GC STATUS BOT", "Chrome", "1.0.0"],
      syncFullHistory: false,
      markOnlineOnConnect: false,
      connectTimeoutMs: 30000,
      keepAliveIntervalMs: 15000,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (u) => {
      const { connection, lastDisconnect } = u;
      if (connection === "open") {
        console.log("✅ Connected - GC STATUS Ready");
        isConnecting = false;
      }
      if (connection === "close") {
        const code = lastDisconnect?.error?.output?.statusCode;
        console.log("Closed, code:", code);
        sock = null;
        sockPromise = null;
        isConnecting = false;
        // 401 = logged out / bad session - delete session so pairing fit work again
        if (code === DisconnectReason.loggedOut || code === 401) {
          try { fs.rmSync("session", { recursive: true, force: true }); } catch(e){}
          console.log("Session cleared, please pair again");
        } else if (code !== DisconnectReason.connectionClosed) {
          // Auto reconnect after 3 sec, no be immediately
          setTimeout(() => { startBot(); }, 3000);
        }
      }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
      const msg = messages[0];
      if (!msg.message || msg.key.fromMe) return;
      const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
      if (body.trim() !== ".gcstatus") return;
      await gcStatus(sock, msg, config);
    });

    // Wait until socket is ready (max 10 sec)
    await new Promise(r => setTimeout(r, 2000));
    isConnecting = false;
    return sock;
  })();

  return sockPromise;
}

// FIXED PAIR - wait for sock, retry, no long log
app.post("/pair", async (req, res) => {
  try {
    let number = (req.body.number || "").replace(/[^0-9]/g, "");
    if (!number) return res.json({ error: "Enter number" });
    if (number.startsWith("0")) number = "234" + number.slice(1); // fix Nigeria 0

    // If already connected, no need pair
    if (sock?.user) return res.json({ error: "Already connected as " + sock.user.id });

    const s = await startBot();

    // Small wait to make sure socket don open for pairing
    await new Promise(r => setTimeout(r, 1500));

    // Request code with timeout - no hang forever
    const code = await Promise.race([
      s.requestPairingCode(number),
      new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout - try again in 10 sec")), 20000))
    ]);

    console.log("Pairing code generated for", number);
    res.json({ code });
  } catch (e) {
    console.log("Pair error:", e.message);
    // Reset so next try fit work fast
    sock = null;
    sockPromise = null;
    isConnecting = false;
    res.json({ error: "Couldn't link. Wait 10 sec, refresh page and try again. " + e.message });
  }
});

app.get("/status", (req, res) => {
  res.json({ connected: !!sock?.user, user: sock?.user?.id || null });
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public/index.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server on " + PORT));
startBot();
