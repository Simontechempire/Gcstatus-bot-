async function gcStatus(sock, msg, config) {
  const from = msg.key.remoteJid;

  // Must be DM only
  if (from.endsWith("@g.us")) {
    return sock.sendMessage(from, { text: "❌ Use this cmd in DM only, reply to a message." });
  }

  // Must reply to a message
  const ctx = msg.message?.extendedTextMessage?.contextInfo || msg.message?.imageMessage?.contextInfo || msg.message?.videoMessage?.contextInfo || msg.message?.audioMessage?.contextInfo;
  const quoted = ctx?.quotedMessage;
  if (!quoted) {
    return sock.sendMessage(from, { text: "❌ Reply to any text / image / video / voice note / link" });
  }

  // Get ALL groups I'm a member of
  const allGroups = await sock.groupFetchAllParticipating();
  const groupIds = Object.keys(allGroups);
  const total = groupIds.length;

  await sock.sendMessage(from, { text: `⏳\nPosting to ${total} group\nWait be patient...` });

  // Get quoted content EXACTLY as e be
  let content = {};
  let mediaBuffer = null;

  // FIX ONLY: Use quoted message key, not .gcstatus message key
  const quotedKey = { remoteJid: from, id: ctx.stanzaId, participant: ctx.participant, fromMe: ctx.participant ? false : true };

  if (quoted.imageMessage) {
    mediaBuffer = await sock.downloadMediaMessage({ key: quotedKey, message: quoted });
    content = { image: mediaBuffer, caption: quoted.imageMessage.caption || "" };
  } else if (quoted.videoMessage) {
    mediaBuffer = await sock.downloadMediaMessage({ key: quotedKey, message: quoted });
    content = { video: mediaBuffer, caption: quoted.videoMessage.caption || "" };
  } else if (quoted.audioMessage) {
    mediaBuffer = await sock.downloadMediaMessage({ key: quotedKey, message: quoted });
    content = { audio: mediaBuffer, mimetype: "audio/mp4", ptt: true };
  } else if (quoted.stickerMessage) {
    mediaBuffer = await sock.downloadMediaMessage({ key: quotedKey, message: quoted });
    content = { sticker: mediaBuffer };
  } else if (quoted.documentMessage) {
    mediaBuffer = await sock.downloadMediaMessage({ key: quotedKey, message: quoted });
    content = { document: mediaBuffer, fileName: quoted.documentMessage.fileName || "file", mimetype: quoted.documentMessage.mimetype };
  } else if (quoted.conversation) {
    content = { text: quoted.conversation };
  } else if (quoted.extendedTextMessage) {
    content = { text: quoted.extendedTextMessage.text };
  } else {
    return sock.sendMessage(from, { text: "❌ This type no fit post" });
  }

  // FIX SPAM: Post to status@broadcast ONLY 1 TIME, not 1 time per group
  // status@broadcast is already your own status, looping am na duplicate
  await sock.sendMessage("status@broadcast", content);

  await sock.sendMessage(from, { text: "Order Complete ✅" });
}

module.exports = gcStatus;
