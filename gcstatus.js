async function gcStatus(sock, msg, config) {
  const from = msg.key.remoteJid;
  if (from.endsWith("@g.us")) {
    return sock.sendMessage(from, { text: "❌ Use for DM only" });
  }

  const ctx = msg.message?.extendedTextMessage?.contextInfo || msg.message?.imageMessage?.contextInfo || msg.message?.videoMessage?.contextInfo || msg.message?.audioMessage?.contextInfo;
  const quoted = ctx?.quotedMessage;
  if (!quoted) {
    return sock.sendMessage(from, { text: "❌ Reply to text / image / video with .gcstatus" });
  }

  const allGroups = await sock.groupFetchAllParticipating();
  const groupJids = Object.keys(allGroups);
  await sock.sendMessage(from, { text: `⏳ Posting to GROUP STATUS for ${groupJids.length} groups...\nNo be normal status, no be group chat.` });

  let groupStatusContent = null;
  const quotedKey = { remoteJid: from, id: ctx.stanzaId, participant: ctx.participant, fromMe: false };

  if (quoted.imageMessage) {
    const buf = await sock.downloadMediaMessage({ key: quotedKey, message: quoted });
    groupStatusContent = { image: buf, caption: quoted.imageMessage.caption || "" };
  } else if (quoted.videoMessage) {
    const buf = await sock.downloadMediaMessage({ key: quotedKey, message: quoted });
    groupStatusContent = { video: buf, caption: quoted.videoMessage.caption || "" };
  } else if (quoted.conversation) {
    groupStatusContent = { text: quoted.conversation };
  } else if (quoted.extendedTextMessage) {
    groupStatusContent = { text: quoted.extendedTextMessage.text };
  } else if (quoted.groupInviteMessage) {
    const g = quoted.groupInviteMessage;
    const link = g.inviteCode ? `https://chat.whatsapp.com/${g.inviteCode}` : "";
    groupStatusContent = { text: `${g.groupName || ""}\n${g.caption || ""}\n\n${link}`.trim() };
  } else {
    return sock.sendMessage(from, { text: "❌ This type no fit Group Status" });
  }

  let success = 0, failed = 0;
  for (const gid of groupJids) {
    try {
      // REAL GROUP STATUS - NOT status@broadcast, NOT group chat
      await sock.sendMessage(gid, {
        groupStatusMessage: groupStatusContent
      });
      success++;
      console.log(`✅ Group Status posted to ${allGroups[gid]?.subject || gid}`);
      await new Promise(r => setTimeout(r, 1500)); // small delay make WhatsApp no block
    } catch (e) {
      failed++;
      console.log(`❌ Failed ${gid}:`, e.message);
    }
  }

  await sock.sendMessage(from, { text: `Done ✅\nGroup Status posted: ${success}\nFailed: ${failed}\n\nGo check any group > Tap group name > Tap STATUS - e go dey there, only that group members go see am.` });
}
module.exports = gcStatus;
