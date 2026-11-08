import { api } from './config';
import i18n from '../i18n';

// Sosyal paket uç noktaları — sözleşme: MatchBuddy/docs/social-api.md

export const MESSAGE_PERMISSION = { EVERYONE: 0, MUTUALS: 1, MUTUALS_AND_TEAMMATES: 2 };
export const PROFILE_VISIBILITY = { EVERYONE: 0, FOLLOWERS: 1, ONLY_ME: 2 };
const REPORT_REASON_KEYS = {
  spam: 'spam',
  hakaret: 'harassment',
  'sahte-hesap': 'fakeAccount',
  'maca-gelmeme': 'noShow',
  diger: 'other',
};
/** { value, label } — value sunucuya gider, label erişildiği anda çevrilir */
export const REPORT_REASONS = Object.entries(REPORT_REASON_KEYS).map(([value, key]) => ({
  value,
  get label() {
    return i18n.t(`social:reportReasons.${key}`);
  },
}));
export const ACTIVITY = {
  MATCH_CREATED: 1,
  JOINED_MATCH: 2,
  SCORED: 3,
  MVP_WON: 4,
  TEAM_CREATED: 5,
  FOLLOWED: 6,
  TOURNAMENT_WON: 7,
};

// Takip / sosyal olaylarından sonra üst bar ve listeler tazelensin
export const SOCIAL_CHANGED = 'mb:social-changed';
export const INVITES_CHANGED = 'mb:invites-changed';
export const emit = (name) => window.dispatchEvent(new Event(name));

const data = (r) => r.data;

export const socialApi = {
  follow: (playerId) => api.post('/api/Social/Follow', { playerId }).then(data),
  unfollow: (playerId) => api.post('/api/Social/Unfollow', { playerId }).then(data),
  followers: (playerId) => api.get('/api/Social/Followers', { params: { playerId } }).then(data),
  following: (playerId) => api.get('/api/Social/Following', { params: { playerId } }).then(data),
  discover: (q = '', take = 30) => api.get('/api/Social/Discover', { params: { q, take } }).then(data),
  suggestions: (take = 10) => api.get('/api/Social/Suggestions', { params: { take } }).then(data),
  profile: (playerId) => api.get('/api/Social/Profile', { params: { playerId } }).then(data),
  block: (playerId) => api.post('/api/Social/Block', { playerId }).then(data),
  unblock: (playerId) => api.post('/api/Social/Unblock', { playerId }).then(data),
  blocked: () => api.get('/api/Social/Blocked').then(data),
  report: (playerId, reason, details) => api.post('/api/Social/Report', { playerId, reason, details }).then(data),
  getSettings: () => api.get('/api/Social/Settings').then(data),
  saveSettings: (settings) => api.post('/api/Social/Settings', settings).then(data),
  deleteAccount: (password) => api.post('/api/Social/DeleteAccount', { password }).then(data),
  messageContacts: () => api.get('/api/Social/MessageContacts').then(data),
  feed: (before, take = 30) => api.get('/api/Social/Feed', { params: { before, take } }).then(data),
};

export const invitesApi = {
  inviteToMatch: (matchId, playerIds) => api.post('/api/Invites/InviteToMatch', { matchId, playerIds }).then(data),
  inviteToTeam: (teamId, playerIds) => api.post('/api/Invites/InviteToTeam', { teamId, playerIds }).then(data),
  my: () => api.get('/api/Invites/My').then(data),
  pendingCount: () => api.get('/api/Invites/PendingCount').then((r) => r.data?.count || 0),
  respond: (kind, inviteId, accept) => api.post('/api/Invites/Respond', { kind, inviteId, accept }).then(data),
};

export const calendarApi = {
  my: (from, to) => api.get('/api/Match/MyCalendar', { params: { from, to } }).then(data),
};

export const adminSocialApi = {
  reports: (status) => api.get('/api/Admin/Reports', { params: { status } }).then(data),
  resolve: (reportId) => api.post('/api/Admin/ResolveReport', { reportId }).then(data),
};
