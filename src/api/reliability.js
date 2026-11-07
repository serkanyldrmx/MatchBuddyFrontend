import { api } from './config';
import { getParam } from './parameters';

/** Güvenilirlik puanı — sözleşme: MatchBuddy/docs/reliability-api.md */
export const EXCUSE_REASONS = ['emergency', 'health', 'bereavement', 'work', 'transport', 'other'];

export const reliabilityApi = {
  /** { hoursLeft, kind: none|late|veryLate, penalty, currentScore, isGoing } */
  leavePreview: (matchId) => api.get('/api/Reliability/LeavePreview', { params: { matchId } }).then((r) => r.data),
  markNoShows: (matchId, playerIds) => api.post('/api/Reliability/MarkNoShows', { matchId, playerIds }).then((r) => r.data),
  acceptExcuse: (matchId, playerId) => api.post('/api/Reliability/AcceptExcuse', { matchId, playerId }).then((r) => r.data),
  /** { score, level, completedMatches, attended, lateCancels, noShows, history? } */
  player: (playerId) => api.get('/api/Reliability/Player', { params: { playerId } }).then((r) => r.data),
};

/** Sunucu seviye göndermediyse puandan hesaplar (parametreler: reliability.levelGood / levelMedium) */
export const levelOf = (score, completed = Infinity) => {
  if (completed < Number(getParam('reliability.newPlayerMatchCount') ?? 3)) return 'new';
  if (score >= Number(getParam('reliability.levelGood') ?? 90)) return 'good';
  if (score >= Number(getParam('reliability.levelMedium') ?? 70)) return 'medium';
  return 'risky';
};
