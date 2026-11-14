import { api } from './config';

// E-posta merkezi — sözleşme: MatcBuddy/docs/email-api.md
// area: 'Admin' (yönetim paneli) | 'Owner' (işletme paneli)
export const emailApi = {
  starters: (area) => api.get(`/api/Email/${area}/Starters`).then((r) => r.data || []),
  templates: (area) => api.get(`/api/Email/${area}/Templates`).then((r) => r.data || []),
  saveTemplate: (area, body) => api.post(`/api/Email/${area}/Templates`, body).then((r) => r.data),
  deleteTemplate: (area, id) => api.post(`/api/Email/${area}/Templates/Delete`, null, { params: { id } }).then((r) => r.data),
  campaigns: (area) => api.get(`/api/Email/${area}/Campaigns`).then((r) => r.data || []),
  saveCampaign: (area, body) => api.post(`/api/Email/${area}/Campaigns`, body).then((r) => r.data),
  cancelCampaign: (area, id) => api.post(`/api/Email/${area}/Campaigns/Cancel`, null, { params: { id } }).then((r) => r.data),
  audienceCount: (area, audience) => api.get(`/api/Email/${area}/AudienceCount`, { params: { audience } }).then((r) => r.data || 0),
  preview: (area, body) => api.post(`/api/Email/${area}/Preview`, body).then((r) => r.data),
  sendTest: (area, body) => api.post(`/api/Email/${area}/SendTest`, body).then((r) => r.data),
  // Oyuncu: maç hatırlatma e-postası
  matchReminders: (matchId) => api.get('/api/Email/MatchReminders', { params: { matchId } }).then((r) => r.data),
  setMatchReminders: (matchId, minutes) => api.post('/api/Email/MatchReminders', { matchId, minutes }).then((r) => r.data),
};

// Sunucu: EmailAudience
export const AUDIENCE = { CONSENTED: 0, OWNERS: 1, ALL_SERVICE: 2, VENUE_CUSTOMERS: 3 };
// Sunucu: EmailCampaignStatus
export const CAMPAIGN_STATUS = { SCHEDULED: 0, SENDING: 1, DONE: 2, CANCELLED: 3 };
// Şablonda kullanılabilen alanlar (MatcBuddy.Business.Email.EmailLayout.Fields)
export const EMAIL_FIELDS = ['ad', 'soyad', 'kullanici', 'site', 'tesis', 'mac', 'tarih', 'saat', 'saha', 'adres', 'kalan', 'link'];
// Metin biçimleri (sunucu: EmailLayout) — düğmeyle imlecin olduğu yere eklenir
export const EMAIL_FORMATS = [
  { key: 'heading', snippet: '# Başlık', line: true },
  { key: 'sub', snippet: '## Ara başlık', line: true },
  { key: 'bullet', snippet: '- Madde', line: true },
  { key: 'callout', snippet: '> Öne çıkan bilgi', line: true },
  { key: 'info', snippet: '| Etiket: değer', line: true },
  { key: 'bold', snippet: '**kalın yazı**', line: false },
  { key: 'rule', snippet: '---', line: true },
];
