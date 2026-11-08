async function gcStatus(sock, msg, config) {
  const from = msg.key.remoteJid;
  if (from.endsWith("@g.us")) {
    return sock.sendMessage(from, { text: "❌ Use this for DM only.\nReply to a message for DM with .gcstatus" });
  }

  const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
  const ctx = msg.message?.extendedTextMessage?.contextInfo || msg.message?.imageMessage?.contextInfo || msg.message?.videoMessage?.contextInfo || msg.message?.audioMessage?.contextInfo;
  const quoted = ctx?.quotedMessage;

  if (!quoted && !body.replace(/\.gcstatus/gi, "").trim()) {
    return sock.sendMessage(from, { text: "❌ Reply to any text / image / video / voice note / link with .gcstatus" });
  }

  await sock.sendMessage(from, { text: "⏳ Preparing your Group Status content...\nI no go post am, I go give you am ready to post yourself." });

  let content = null;
  let type = "text";
  const quotedKey = quoted ? { remoteJid: from, id: ctx.stanzaId, participant: ctx.participant, fromMe: false } : null;

  try {
    if (quoted?.imageMessage) {
      const buf = await sock.downloadMediaMessage({ key: quotedKey, message: quoted });
      content = { image: buf, caption: quoted.imageMessage.caption || "" };
      type = "image";
    } else if (quoted?.videoMessage) {
      const buf = await sock.downloadMediaMessage({ key: quotedKey, message: quoted });
      content = { video: buf, caption: quoted.videoMessage.caption || "" };
      type = "video";
    } else if (quoted?.audioMessage) {
      const buf = await sock.downloadMediaMessage({ key: quotedKey, message: quoted });
      content = { audio: buf, mimetype: "audio/mp4", ptt: true };
      type = "audio";
    } else if (quoted?.stickerMessage) {
      const buf = await sock.downloadMediaMessage({ key: quotedKey, message: quoted });
      content = { sticker: buf };
      type = "sticker";
    } else if (quoted?.groupInviteMessage) {
      const g = quoted.groupInviteMessage;
      const link = g.inviteCode ? `https://chat.whatsapp.com/${g.inviteCode}` : "";
      content = { text: `${g.groupName || "Group"}\n${g.caption || ""}\n\n${link}`.trim() };
      type = "group-link";
    } else if (quoted?.conversation) {
      content = { text: quoted.conversation };
      type = "text";
    } else if (quoted?.extendedTextMessage) {
      content = { text: quoted.extendedTextMessage.text };
      type = "text";
    } else if (body.replace(/\.gcstatus/gi, "").trim()) {
      content = { text: body.replace(/\.gcstatus/gi, "").trim() };
      type = "text";
    } else {
      return sock.sendMessage(from, { text: "❌ This type I no fit prepare. Send am as plain text / image / video." });
    }

    // 1. Send the clean content back to you - READY TO POST
    await sock.sendMessage(from, content);

    // 2. Send the instruction
    const instruction = `✅ READY FOR GROUP STATUS\n\nType: ${type.toUpperCase()}\n\nHOW TO POST AM NOW:\n1. Long-press the ${type} above > Save / Download am\n2. Open the group you want - e.g. Fun friends\n3. Tap group name for top\n4. Tap STATUS button (the one you circle)\n5. Post am there\n6. Repeat for next group\n\nNote: Group Status na per-group. You must post am 1 by 1 for each group. Bot no fit press that button yet because WhatsApp never give Baileys access to am.\n\nYou want me to list your groups make you tick which ones you don post to?`;

    await sock.sendMessage(from, { text: instruction });
    console.log("✅ Group Status helper prepared:", type);

  } catch (e) {
    console.log("❌ Helper failed:", e.message);
    await sock.sendMessage(from, { text: `❌ Failed to prepare:\n${e.message}` });
  }
}
module.exports = gcStatus;
