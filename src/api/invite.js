import { api } from './config';

// Maç davet linki — sözleşme: MatchBuddy/docs/engagement-api.md §3

/** Giriş / kayıttan sonra dönülecek davet kodu (useLoginFlow okur) */
export const PENDING_INVITE_KEY = 'mb.pendingInvite';

export const invitesApi = {
  /** Herkese açık maç özeti (giriş gerekmez) */
  publicMatch: (code) => api.get(`/api/Public/Match/${encodeURIComponent(code)}`).then((r) => r.data),
  /** Davet koduyla kadroya katıl → { matchId, status, message } */
  joinByCode: (code) => api.post('/api/Match/JoinByCode', { code }).then((r) => r.data),
};
