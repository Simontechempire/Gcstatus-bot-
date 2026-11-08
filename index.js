const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const path = require("path");
const config = require("./config");
const gcStatus = require("./gcstatus");

const app = express();
app.use(express.json());
app.use(express.static("public"));
let sock;
let isStarting = false;

async function startBot() {
  if (sock) return sock;
  if (isStarting) {
    while (isStarting) await new Promise(r => setTimeout(r, 500));
    return sock;
  }
  isStarting = true;
  const { state, saveCreds } = await useMultiFileAuthState("session");
  sock = makeWASocket({ auth: state, logger: pino({ level: "silent" }), printQRInTerminal: false });
  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", (u) => {
    if (u.connection === "open") console.log("✅ Connected - GC STATUS Ready");
    if (u.connection === "close") {
      const re = u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      sock = null;
      isStarting = false;
      if (re) startBot();
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;
    const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    const text = body.toLowerCase().trim();

    // FIX SPAM LOOP: Ignore bot's own replies
    if (body.startsWith("❌") || body.startsWith("⏳") || body.startsWith("Pong") || body.startsWith("Order Complete") || body.startsWith("✅")) return;

    if (text === ".ping") {
      await sock.sendMessage(msg.key.remoteJid, { text: "Pong! ✅ GC STATUS BOT is alive" });
      return;
    }
    if (!text.includes(".gcstatus")) return;
    await gcStatus(sock, msg, config);
  });
  isStarting = false;
  return sock;
}

app.post("/pair", async (req, res) => {
  try {
    if (!sock) await startBot();
    await new Promise(r => setTimeout(r, 2000));
    const number = req.body.number.replace(/[^0-9]/g, "");
    const code = await sock.requestPairingCode(number);
    res.json({ code });
  } catch (e) { res.json({ error: e.message }); }
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public/index.html")));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server on " + PORT));
startBot();
