import { api } from './config';

// Maç katılımı / sonuç / MVP / puanlama uç noktaları
// Sözleşme: MatchBuddy/docs/match-participation-api.md

export const PARTICIPANT_STATUS = { GOING: 1, WAITLIST: 2, DECLINED: 3 };
export const SIDE = { HOME: 1, AWAY: 2 };

export const matchesApi = {
  /** Haftalık tekrarı durdur (kurucu / işletme) */
  stopRepeat: (matchId) => api.post('/api/Match/StopRepeat', { matchId }).then((r) => r.data),
  // Harici (anlaşmasız) saha — sözleşme: MatchBuddy/docs/external-venues-api.md
  createExternal: (payload) => api.post('/api/Match/SaveExternalMatch', payload).then((r) => r.data),
  updateExternal: (payload) => api.post('/api/Match/UpdateExternalMatch', payload).then((r) => r.data),
  myExternalVenues: () => api.get('/api/Match/MyExternalVenues').then((r) => r.data || []),
  /** Davet linki — docs/engagement-api.md §3: { code, url, text } */
  shareLink: (matchId) => api.post('/api/Match/ShareLink', { matchId }).then((r) => r.data),
  feed: () => api.get('/api/Match/GetMatchFeed').then((r) => r.data || []),
  detail: (matchId) => api.get(`/api/Match/GetMatchDetail?matchId=${matchId}`).then((r) => r.data),
  join: (matchId) => api.post('/api/Match/Join', { matchId }).then((r) => r.data),
  /** reasonCode: emergency|health|bereavement|work|transport|other (isteğe bağlı) → { message, penalty, newScore } */
  leave: (matchId, reasonCode, note) => api.post('/api/Match/Leave', { matchId, reasonCode: reasonCode || undefined, note }).then((r) => r.data),
  confirm: (matchId) => api.post('/api/Match/Confirm', { matchId }).then((r) => r.data),
  setSide: (matchId, playerId, side) => api.post('/api/Match/SetSide', { matchId, playerId, side }).then((r) => r.data),
  submitResult: (payload) => api.post('/api/Match/SubmitResult', payload).then((r) => r.data),
  voteMvp: (matchId, votedPlayerId) => api.post('/api/Match/VoteMvp', { matchId, votedPlayerId }).then((r) => r.data),
  ratePlayers: (matchId, ratings) => api.post('/api/Match/RatePlayers', { matchId, ratings }).then((r) => r.data),
  toggleLike: (matchId) => api.post('/api/Match/ToggleLike', { matchId }).then((r) => r.data),
  remove: (matchId) => api.post('/api/Match/DeleteMatch', { matchId }).then((r) => r.data),
  // Misafir oyuncular (uygulamayı kullanmayan kişiler) — sadece maçı yöneten
  addGuest: (matchId, side, name, note) => api.post('/api/Match/AddGuest', { matchId, side, name, note }).then((r) => r.data),
  updateGuest: (guestId, side, name, note) => api.post('/api/Match/UpdateGuest', { guestId, side, name, note }).then((r) => r.data),
  removeGuest: (guestId) => api.post('/api/Match/RemoveGuest', { guestId }).then((r) => r.data),
};

export const playersApi = {
  stats: (playerId) => api.get(`/api/Players/GetPlayerStats?playerId=${playerId}`).then((r) => r.data),
  leaderboard: (top = 20) => api.get(`/api/Players/GetLeaderboard?top=${top}`).then((r) => r.data || []),
};
