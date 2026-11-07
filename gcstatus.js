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
    return sock.sendMessage(from, { text: "❌ Reply to any text / image / video / voice note / link with .gcstatus" });
  }

  // Get ALL groups I'm a member of
  const allGroups = await sock.groupFetchAllParticipating();
  const groupIds = Object.keys(allGroups);
  const total = groupIds.length;

  await sock.sendMessage(from, { text: `⏳\nPosting to ${total} group\nWait be patient...` });

  // Get quoted content EXACTLY as e be
  let content = {};
  let mediaBuffer = null;

  if (quoted.imageMessage) {
    mediaBuffer = await sock.downloadMediaMessage({ key: msg.key, message: quoted });
    content = { image: mediaBuffer, caption: quoted.imageMessage.caption || "" };
  } else if (quoted.videoMessage) {
    mediaBuffer = await sock.downloadMediaMessage({ key: msg.key, message: quoted });
    content = { video: mediaBuffer, caption: quoted.videoMessage.caption || "" };
  } else if (quoted.audioMessage || quoted.voiceMessage) {
    mediaBuffer = await sock.downloadMediaMessage({ key: msg.key, message: quoted });
    content = { audio: mediaBuffer, mimetype: "audio/mp4", ptt: true };
  } else if (quoted.stickerMessage) {
    mediaBuffer = await sock.downloadMediaMessage({ key: msg.key, message: quoted });
    content = { sticker: mediaBuffer };
  } else if (quoted.documentMessage) {
    mediaBuffer = await sock.downloadMediaMessage({ key: msg.key, message: quoted });
    content = { document: mediaBuffer, fileName: quoted.documentMessage.fileName || "file", mimetype: quoted.documentMessage.mimetype };
  } else if (quoted.conversation) {
    content = { text: quoted.conversation };
  } else if (quoted.extendedTextMessage) {
    content = { text: quoted.extendedTextMessage.text };
  } else {
    return sock.sendMessage(from, { text: "❌ This type no fit post" });
  }

  // Post to Group Status for each group - NOT group DM
  // We use status@broadcast - na Group Status, no be group chat
  for (let i = 0; i < total; i++) {
    const group = allGroups[groupIds[i]];
    // Add group name as caption for text/image/video so e know which group
    let finalContent = { ...content };
    if (finalContent.caption !== undefined && group.subject) {
      finalContent.caption = finalContent.caption ? finalContent.caption : "";
    }

    await sock.sendMessage("status@broadcast", finalContent);
    // Delay to avoid ban
    await new Promise(r => setTimeout(r, config.STATUS_DELAY));
  }

  await sock.sendMessage(from, { text: "Order Complete ✅" });
}

module.exports = gcStatus;
