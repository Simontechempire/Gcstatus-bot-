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

  const allGroups = await sock.groupFetchAllParticipating();
  const groupIds = Object.keys(allGroups);
  const total = groupIds.length;

  await sock.sendMessage(from, { text: `⏳\nPosting to ${total} groups for real...\nWait be patient...` });

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

  // REAL POST: Send to EACH group JID, not status@broadcast
  let success = 0;
  for (const gid of groupIds) {
    try {
      await sock.sendMessage(gid, content);
      success++;
      await new Promise(r => setTimeout(r, config.STATUS_DELAY || 2000));
    } catch (e) {
      console.log("Failed for group " + gid + " : " + e.message);
    }
  }

  await sock.sendMessage(from, { text: `Order Complete ✅\nPosted to ${success}/${total} groups` });
}
module.exports = gcStatus;
