import { api } from './config';

/**
 * Maç önerisi ve takım dengeleme — artık ayrı Python servisleri yok, API içinde çalışır (MatchBuddy/docs/ai-api.md).
 *  matchRecommendations(): [{ matchId, score, reason, args }]  — reason → home:ai.reasons.<reason>
 *  balanceTeams({ matchId?, playerIds?, apply? }): { team1, team2, power1, power2 }
 */
export const aiApi = {
  matchRecommendations: () => api.get('/api/Ai/MatchRecommendations').then((r) => r.data || []),
  balanceTeams: (body) => api.post('/api/Ai/BalanceTeams', body).then((r) => r.data),
};
