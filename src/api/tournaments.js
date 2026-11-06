import { api } from './config';

// Turnuva uç noktaları — sözleşme: MatchBuddy/docs/tournaments-api.md

export const TOURNAMENT_FORMAT = { LEAGUE: 1, KNOCKOUT: 2 };
export const TOURNAMENT_STATUS = { REGISTRATION: 0, ONGOING: 1, FINISHED: 2 };
export const FIXTURE_STATUS = { SCHEDULED: 0, PLAYED: 1, BYE: 2 };

const data = (r) => r.data;

export const tournamentsApi = {
  list: (status) => api.get('/api/Tournaments/List', { params: { status } }).then(data),
  detail: (tournamentId) => api.get('/api/Tournaments/Detail', { params: { tournamentId } }).then(data),
  create: (payload) => api.post('/api/Tournaments/Create', payload).then(data),
  registerTeam: (tournamentId, teamId) => api.post('/api/Tournaments/RegisterTeam', { tournamentId, teamId }).then(data),
  withdrawTeam: (tournamentId, teamId) => api.post('/api/Tournaments/WithdrawTeam', { tournamentId, teamId }).then(data),
  start: (tournamentId) => api.post('/api/Tournaments/Start', { tournamentId }).then(data),
  submitResult: (payload) => api.post('/api/Tournaments/SubmitResult', payload).then(data),
  updateFixtureDate: (fixtureId, matchDate) => api.post('/api/Tournaments/UpdateFixtureDate', { fixtureId, matchDate }).then(data),
  remove: (tournamentId) => api.post('/api/Tournaments/Delete', { tournamentId }).then(data),
};
