import { api } from './config';

// Mesajlaşma — sözleşme: MatchBuddy/docs/external-venues-api.md ("Mesajlaşma") ve social-api.md
const data = (r) => r.data;

/** Mesaj metni üst sınırı (sunucu: MESSAGE_TOO_LONG) */
export const MESSAGE_MAX_LENGTH = 1000;

export const messagesApi = {
  /** Birebir konuşma (eskiden yeniye sıralı döner) */
  conversation: (me, otherId) =>
    api.post('/api/Message/GetMessageById', { sendPlayerId: me, recipientPlayerId: otherId }).then((r) => r.data || []),
  send: (recipientPlayerId, text, mediaId, replyToMessageId) =>
    api
      .post('/api/Message/MessageSave', {
        recipientPlayerId,
        matchMessage: text,
        sendingDate: new Date().toISOString(),
        status: 1,
        ...(mediaId ? { mediaId } : {}),
        ...(replyToMessageId ? { replyToMessageId } : {}),
      })
      .then(data),
  /** Tepki: emoji null ya da aynı emoji = kaldır. Birebir: { messageId }, grup: { groupMessageId } */
  react: (ids, emoji) => api.post('/api/Message/React', { ...ids, emoji }).then(data),
  /** Kendi mesajını sil. Birebir: { messageId }, grup: { groupMessageId } */
  remove: (ids) => api.post('/api/Message/Delete', ids).then(data),
  /** O kişiden gelen okunmamışları okundu yap */
  markRead: (playerId) => api.post('/api/Message/MarkRead', { playerId }).then(data),
  /** { direct, groups, total } */
  unread: () => api.get('/api/Message/Unread').then(data),
};

export const groupsApi = {
  /** [{ groupId, groupName, createdByPlayerId, memberCount, members, lastMessage, unreadCount }] */
  mine: () => api.get('/api/Groups/MyGroups').then((r) => r.data || []),
  conversation: (groupId) => api.post('/api/GroupsMessage/GetGroupMessageById', { groupId }).then((r) => r.data || []),
  send: (groupId, text, mediaId, replyToGroupMessageId) =>
    api
      .post('/api/GroupsMessage/SaveGroupMessage', {
        groupId,
        matchMessage: text,
        sendingDate: new Date().toISOString(),
        status: 0,
        ...(mediaId ? { mediaId } : {}),
        ...(replyToGroupMessageId ? { replyToGroupMessageId } : {}),
      })
      .then(data),
  markRead: (groupId) => api.post('/api/Groups/MarkRead', { groupId }).then(data),
  create: (groupName, playerList) => api.post('/api/Groups/SaveGroup', { groupName, playerList }).then(data),
  rename: (groupId, groupName) => api.post('/api/Groups/UpdateGroup', { groupId, groupName, playerList: [] }).then(data),
  addMembers: (groupId, playerList) => api.post('/api/Groups/AddMembers', { groupId, playerList }).then(data),
  removeMember: (groupId, playerId) => api.post('/api/Groups/RemoveMember', { groupId, playerId }).then(data),
  leave: (groupId) => api.post('/api/Groups/Leave', { groupId }).then(data),
};
