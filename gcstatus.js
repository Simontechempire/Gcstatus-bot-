async function gcStatus(sock, msg, config) {
  const from = msg.key.remoteJid;
  if (from.endsWith("@g.us")) {
    return sock.sendMessage(from, { text: "❌ Use this cmd in DM only, reply to a message." });
  }

  const ctx = msg.message?.extendedTextMessage?.contextInfo || msg.message?.imageMessage?.contextInfo || msg.message?.videoMessage?.contextInfo || msg.message?.audioMessage?.contextInfo;
  const quoted = ctx?.quotedMessage;
  if (!quoted) {
    return sock.sendMessage(from, { text: "❌ Reply to any text / image / video / voice note / link" });
  }

  // We still count groups, but we NO go loop am - status na 1 post only
  const allGroups = await sock.groupFetchAllParticipating();
  const total = Object.keys(allGroups).length;

  await sock.sendMessage(from, { text: `⏳\nPosting to STATUS...\nYou dey for ${total} groups, but status na 1 post` });

  let content = {};
  const quotedKey = { remoteJid: from, id: ctx.stanzaId, participant: ctx.participant, fromMe: ctx.participant ? false : true };

  if (quoted.imageMessage) {
    const buf = await sock.downloadMediaMessage({ key: quotedKey, message: quoted });
    content = { image: buf, caption: quoted.imageMessage.caption || "" };
  } else if (quoted.videoMessage) {
    const buf = await sock.downloadMediaMessage({ key: quotedKey, message: quoted });
    content = { video: buf, caption: quoted.videoMessage.caption || "" };
  } else if (quoted.audioMessage) {
    const buf = await sock.downloadMediaMessage({ key: quotedKey, message: quoted });
    content = { audio: buf, mimetype: "audio/mp4", ptt: true };
  } else if (quoted.stickerMessage) {
    const buf = await sock.downloadMediaMessage({ key: quotedKey, message: quoted });
    content = { sticker: buf };
  } else if (quoted.documentMessage) {
    const buf = await sock.downloadMediaMessage({ key: quotedKey, message: quoted });
    content = { document: buf, fileName: quoted.documentMessage.fileName || "file", mimetype: quoted.documentMessage.mimetype };
  } else if (quoted.conversation) {
    content = { text: quoted.conversation };
  } else if (quoted.extendedTextMessage) {
    content = { text: quoted.extendedTextMessage.text };
  } else {
    return sock.sendMessage(from, { text: "❌ This type no fit post" });
  }

  // REAL STATUS POST - 1 TIME ONLY
  await sock.sendMessage("status@broadcast", content);
  console.log("✅ Posted to status@broadcast");

  await sock.sendMessage(from, { text: "Order Complete ✅\nCheck your STATUS tab now" });
}
module.exports = gcStatus;
