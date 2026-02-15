"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.extractGroupMetadata = exports.makeGroupsSocket = void 0;

const WAProto_1 = require("../../../WAProto");
const Types_1 = require("../Types");
const Utils_1 = require("../Utils");
const WABinary_1 = require("../WABinary");
const chats_1 = require("./chats");

/** kecil, tapi bikin clean */
const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));
const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const makeGroupsSocket = (config) => {
  const sock = (0, chats_1.makeChatsSocket)(config);
  const { authState, ev, query, upsertMessage } = sock;

  const groupQuery = async (jid, type, content) =>
    query({
      tag: "iq",
      attrs: { type, xmlns: "w:g2", to: jid },
      content,
    });

  const groupMetadata = async (jid) => {
    const result = await groupQuery(jid, "get", [
      { tag: "query", attrs: { request: "interactive" } },
    ]);
    return (0, exports.extractGroupMetadata)(result);
  };

  const groupFetchAllParticipating = async () => {
    const result = await query({
      tag: "iq",
      attrs: { to: "@g.us", xmlns: "w:g2", type: "get" },
      content: [
        {
          tag: "participating",
          attrs: {},
          content: [
            { tag: "participants", attrs: {} },
            { tag: "description", attrs: {} },
          ],
        },
      ],
    });

    const data = {};
    const groupsChild = (0, WABinary_1.getBinaryNodeChild)(result, "groups");
    if (groupsChild) {
      const groups = (0, WABinary_1.getBinaryNodeChildren)(groupsChild, "group");
      for (const groupNode of groups) {
        const meta = (0, exports.extractGroupMetadata)({
          tag: "result",
          attrs: {},
          content: [groupNode],
        });
        data[meta.id] = meta;
      }
    }

    sock.ev.emit("groups.update", Object.values(data));
    return data;
  };

  sock.ws.on("CB:ib,,dirty", async (node) => {
    const dirty = (0, WABinary_1.getBinaryNodeChild)(node, "dirty");
    if (!dirty?.attrs || dirty.attrs.type !== "groups") return;

    await groupFetchAllParticipating();
    await sock.cleanDirtyBits("groups");
  });

  /**
   * POST DI GROUP CHAT BENERAN (bukan status/story).
   * - ini yang kamu minta: "update status group" versi posting ke grup.
   */
  const groupPost = async (jid, content, options = {}) => {
    const isText = typeof content === "string";
    // normal chat sendMessage (TIDAK pakai statusJidList)
    return sock.sendMessage(jid, isText ? { text: content } : content, options);
  };

  /**
   * KICK ALL (lebih aman & rapi)
   * - auto exclude bot sendiri
   * - bisa exclude owner/admin
   * - auto chunk biar aman dari limit request
   */
  const groupKickAll = async (
    jid,
    opts = {
      excludeAdmins: true,
      excludeOwner: true,
      chunkSize: 25,
      delayMs: 0,
    }
  ) => {
    const meta = await groupMetadata(jid);

    const me = authState?.creds?.me?.id;
    const owner = meta?.owner || undefined;

    const participants = meta.participants || [];
    const adminSet = new Set(
      participants.filter((p) => p.admin).map((p) => p.id)
    );

    let targets = participants.map((p) => p.id);

    // exclude self
    if (me) targets = targets.filter((id) => id !== me);

    // exclude owner
    if (opts.excludeOwner && owner) targets = targets.filter((id) => id !== owner);

    // exclude admins
    if (opts.excludeAdmins) targets = targets.filter((id) => !adminSet.has(id));

    targets = uniq(targets);

    if (!targets.length) return [];

    const chunks = chunk(targets, Math.max(1, opts.chunkSize || 25));
    const results = [];

    for (const partChunk of chunks) {
      const res = await sock.groupParticipantsUpdate(jid, partChunk, "remove");
      results.push(...(res || []));

      if (opts.delayMs && opts.delayMs > 0) {
        await new Promise((r) => setTimeout(r, opts.delayMs));
      }
    }

    return results;
  };

  return {
    ...sock,

    groupQuery,
    groupMetadata,
    groupFetchAllParticipating,

    /** ✅ posting ke group chat beneran */
    groupPost,

    /** ✅ kick all yang lebih aman */
    groupKickAll,

    groupCreate: async (subject, participants) => {
      const key = (0, Utils_1.generateMessageIDV2)();
      const result = await groupQuery("@g.us", "set", [
        {
          tag: "create",
          attrs: { subject, key },
          content: participants.map((jid) => ({
            tag: "participant",
            attrs: { jid },
          })),
        },
      ]);
      return (0, exports.extractGroupMetadata)(result);
    },

    groupLeave: async (id) => {
      await groupQuery("@g.us", "set", [
        { tag: "leave", attrs: {}, content: [{ tag: "group", attrs: { id } }] },
      ]);
    },

    groupUpdateSubject: async (jid, subject) => {
      await groupQuery(jid, "set", [
        { tag: "subject", attrs: {}, content: Buffer.from(subject, "utf-8") },
      ]);
    },

    groupUpdateDescription: async (jid, description) => {
      const metadata = await groupMetadata(jid);
      const prev = metadata.descId ?? null;

      await groupQuery(jid, "set", [
        {
          tag: "description",
          attrs: {
            ...(description ? { id: (0, Utils_1.generateMessageIDV2)() } : { delete: "true" }),
            ...(prev ? { prev } : {}),
          },
          content: description
            ? [{ tag: "body", attrs: {}, content: Buffer.from(description, "utf-8") }]
            : undefined,
        },
      ]);
    },

    groupRequestParticipantsList: async (jid) => {
      const result = await groupQuery(jid, "get", [
        { tag: "membership_approval_requests", attrs: {} },
      ]);
      const node = (0, WABinary_1.getBinaryNodeChild)(result, "membership_approval_requests");
      const participants = (0, WABinary_1.getBinaryNodeChildren)(node, "membership_approval_request");
      return participants.map((v) => v.attrs);
    },

    groupRequestParticipantsUpdate: async (jid, participants, action) => {
      const result = await groupQuery(jid, "set", [
        {
          tag: "membership_requests_action",
          attrs: {},
          content: [
            {
              tag: action,
              attrs: {},
              content: participants.map((jid) => ({ tag: "participant", attrs: { jid } })),
            },
          ],
        },
      ]);

      const node = (0, WABinary_1.getBinaryNodeChild)(result, "membership_requests_action");
      const nodeAction = (0, WABinary_1.getBinaryNodeChild)(node, action);
      const participantsAffected = (0, WABinary_1.getBinaryNodeChildren)(nodeAction, "participant");
      return participantsAffected.map((p) => ({ status: p.attrs.error || "200", jid: p.attrs.jid }));
    },

    groupParticipantsUpdate: async (jid, participants, action) => {
      const result = await groupQuery(jid, "set", [
        {
          tag: action,
          attrs: {},
          content: participants.map((jid) => ({ tag: "participant", attrs: { jid } })),
        },
      ]);

      const node = (0, WABinary_1.getBinaryNodeChild)(result, action);
      const participantsAffected = (0, WABinary_1.getBinaryNodeChildren)(node, "participant");
      return participantsAffected.map((p) => ({
        status: p.attrs.error || "200",
        jid: p.attrs.jid,
        content: p,
      }));
    },

    groupInviteCode: async (jid) => {
      const result = await groupQuery(jid, "get", [{ tag: "invite", attrs: {} }]);
      const inviteNode = (0, WABinary_1.getBinaryNodeChild)(result, "invite");
      return inviteNode?.attrs?.code;
    },

    groupRevokeInvite: async (jid) => {
      const result = await groupQuery(jid, "set", [{ tag: "invite", attrs: {} }]);
      const inviteNode = (0, WABinary_1.getBinaryNodeChild)(result, "invite");
      return inviteNode?.attrs?.code;
    },

    groupAcceptInvite: async (code) => {
      const results = await groupQuery("@g.us", "set", [{ tag: "invite", attrs: { code } }]);
      const result = (0, WABinary_1.getBinaryNodeChild)(results, "group");
      return result?.attrs?.jid;
    },

    groupRevokeInviteV4: async (groupJid, invitedJid) => {
      const result = await groupQuery(groupJid, "set", [
        { tag: "revoke", attrs: {}, content: [{ tag: "participant", attrs: { jid: invitedJid } }] },
      ]);
      return !!result;
    },

    groupAcceptInviteV4: ev.createBufferedFunction(async (key, inviteMessage) => {
      key = typeof key === "string" ? { remoteJid: key } : key;

      const results = await groupQuery(inviteMessage.groupJid, "set", [
        {
          tag: "accept",
          attrs: {
            code: inviteMessage.inviteCode,
            expiration: inviteMessage.inviteExpiration.toString(),
            admin: key.remoteJid,
          },
        },
      ]);

      if (key.id) {
        inviteMessage = WAProto_1.proto.Message.GroupInviteMessage.fromObject(inviteMessage);
        inviteMessage.inviteExpiration = 0;
        inviteMessage.inviteCode = "";

        ev.emit("messages.update", [
          { key, update: { message: { groupInviteMessage: inviteMessage } } },
        ]);
      }

      await upsertMessage(
        {
          key: {
            remoteJid: inviteMessage.groupJid,
            id: (0, Utils_1.generateMessageIDV2)(sock.user?.id),
            fromMe: false,
            participant: key.remoteJid,
          },
          messageStubType: Types_1.WAMessageStubType.GROUP_PARTICIPANT_ADD,
          messageStubParameters: [authState.creds.me.id],
          participant: key.remoteJid,
          messageTimestamp: (0, Utils_1.unixTimestampSeconds)(),
        },
        "notify"
      );

      return results.attrs.from;
    }),

    groupGetInviteInfo: async (code) => {
      const results = await groupQuery("@g.us", "get", [{ tag: "invite", attrs: { code } }]);
      return (0, exports.extractGroupMetadata)(results);
    },

    groupToggleEphemeral: async (jid, ephemeralExpiration) => {
      const content = ephemeralExpiration
        ? { tag: "ephemeral", attrs: { expiration: ephemeralExpiration.toString() } }
        : { tag: "not_ephemeral", attrs: {} };
      await groupQuery(jid, "set", [content]);
    },

    groupSettingUpdate: async (jid, setting) => {
      await groupQuery(jid, "set", [{ tag: setting, attrs: {} }]);
    },

    groupMemberAddMode: async (jid, mode) => {
      await groupQuery(jid, "set", [{ tag: "member_add_mode", attrs: {}, content: mode }]);
    },

    groupJoinApprovalMode: async (jid, mode) => {
      await groupQuery(jid, "set", [
        {
          tag: "membership_approval_mode",
          attrs: {},
          content: [{ tag: "group_join", attrs: { state: mode } }],
        },
      ]);
    },
  };
};

exports.makeGroupsSocket = makeGroupsSocket;

const extractGroupMetadata = (result) => {
  const group = (0, WABinary_1.getBinaryNodeChild)(result, "group");
  const descChild = (0, WABinary_1.getBinaryNodeChild)(group, "description");

  let desc, descId, descOwner, descOwnerLid, descTime;

  if (descChild) {
    desc = (0, WABinary_1.getBinaryNodeChildString)(descChild, "body");
    descOwner = (0, WABinary_1.jidNormalizedUser)(descChild.attrs.participant_pn || descChild.attrs.participant);
    if (group.attrs.addressing_mode === "lid") {
      descOwnerLid = (0, WABinary_1.jidNormalizedUser)(descChild.attrs.participant);
    }
    descId = descChild.attrs.id;
    descTime = descChild.attrs.t ? +descChild.attrs.t : undefined;
  }

  const groupSize = group.attrs.size ? Number(group.attrs.size) : undefined;
  const groupId = group.attrs.id.includes("@") ? group.attrs.id : (0, WABinary_1.jidEncode)(group.attrs.id, "g.us");
  const eph = (0, WABinary_1.getBinaryNodeChild)(group, "ephemeral")?.attrs?.expiration;
  const memberAddMode = (0, WABinary_1.getBinaryNodeChildString)(group, "member_add_mode") === "all_member_add";

  return {
    id: groupId,
    addressingMode: group.attrs.addressing_mode,
    subject: group.attrs.subject,
    subjectOwner: (0, WABinary_1.jidNormalizedUser)(group.attrs.s_o_pn || group.attrs.s_o),
    ...(group.attrs.addressing_mode === "lid" ? { subjectOwnerLid: (0, WABinary_1.jidNormalizedUser)(group.attrs.s_o) } : {}),
    subjectTime: group.attrs.s_t ? +group.attrs.s_t : undefined,
    size: groupSize || (0, WABinary_1.getBinaryNodeChildren)(group, "participant").length,
    creation: group.attrs.creation ? +group.attrs.creation : undefined,
    owner: (0, WABinary_1.jidNormalizedUser)(group.attrs.creator_pn || group.attrs.creator),
    ...(group.attrs.addressing_mode === "lid" ? { ownerLid: (0, WABinary_1.jidNormalizedUser)(group.attrs.creator) } : {}),
    desc,
    descId,
    descOwner,
    descOwnerLid,
    descTime,
    linkedParent: (0, WABinary_1.getBinaryNodeChild)(group, "linked_parent")?.attrs?.jid || undefined,
    restrict: !!(0, WABinary_1.getBinaryNodeChild)(group, "locked"),
    announce: !!(0, WABinary_1.getBinaryNodeChild)(group, "announcement"),
    isCommunity: !!(0, WABinary_1.getBinaryNodeChild)(group, "parent"),
    isCommunityAnnounce: !!(0, WABinary_1.getBinaryNodeChild)(group, "default_sub_group"),
    joinApprovalMode: !!(0, WABinary_1.getBinaryNodeChild)(group, "membership_approval_mode"),
    memberAddMode,
    participants: (0, WABinary_1.getBinaryNodeChildren)(group, "participant").map(({ attrs }) => ({
      id: attrs.jid,
      jid: attrs.phone_number || attrs.jid,
      lid: attrs.lid || attrs.jid,
      admin: attrs.type || null,
    })),
    ephemeralDuration: eph ? +eph : undefined,
  };
};

exports.extractGroupMetadata = extractGroupMetadata;