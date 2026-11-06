import { api } from './config';

// Anlaşmalı tesisler / işletme / rezervasyon — sözleşme: MatchBuddy/docs/venues-api.md

export const SURFACE = { 1: 'Suni çim', 2: 'Doğal çim', 3: 'Parke', 4: 'Diğer' };
export const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
export const DAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
/** DaysMask: bit 0 = Pazartesi … bit 6 = Pazar */
export const maskToDays = (mask) => DAYS_SHORT.filter((_, i) => mask & (1 << i));
export const daysToMask = (indexes) => indexes.reduce((m, i) => m | (1 << i), 0);
/** dayjs().day(): 0 = Pazar → sözleşme indeksine (0 = Pazartesi) çevir */
export const contractDayIndex = (d) => (d.day() + 6) % 7;

export const AMENITIES = [
  { key: 'camera', label: 'Maç kaydı (kamera)' },
  { key: 'cleatRental', label: 'Krampon kiralama' },
  { key: 'shower', label: 'Duş' },
  { key: 'lockerRoom', label: 'Soyunma odası' },
  { key: 'parking', label: 'Otopark' },
  { key: 'cafe', label: 'Kafeterya' },
  { key: 'shuttle', label: 'Servis' },
  { key: 'bibs', label: 'Yelek' },
  { key: 'ball', label: 'Top' },
];

export const formatPrice = (v) =>
  v == null ? '-' : `${Number(v).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺`;

const data = (r) => r.data;

/* ---------- Oyuncu ---------- */
export const venuesApi = {
  list: (params) => api.get('/api/Venues/List', { params }).then(data),
  detail: (stadiumId) => api.get('/api/Venues/Detail', { params: { stadiumId } }).then(data),
  availability: (stadiumId, date) => api.get('/api/Venues/Availability', { params: { stadiumId, date } }).then(data),
  quote: (payload) => api.post('/api/Venues/Quote', payload).then(data),
  review: (matchId, rating, comment) => api.post('/api/Venues/Review', { matchId, rating, comment }).then(data),
  createMatch: (payload) => api.post('/api/Match/SaveMatch', payload).then(data),
  claimOpponent: (matchId, teamId) => api.post('/api/Match/ClaimOpponent', { matchId, teamId }).then(data),
};

/* ---------- İşletme ---------- */
export const ownerApi = {
  myVenues: () => api.get('/api/Owner/MyVenues').then(data),
  venue: (stadiumId) => api.get('/api/Owner/Venue', { params: { stadiumId } }).then(data),
  dashboard: (stadiumId) => api.get('/api/Owner/Dashboard', { params: { stadiumId } }).then(data),
  reservations: (params) => api.get('/api/Owner/Reservations', { params }).then(data),
  respond: (matchId, approve, reason) => api.post('/api/Owner/RespondReservation', { matchId, approve, reason }).then(data),
  calendar: (stadiumId, from, to) => api.get('/api/Owner/Calendar', { params: { stadiumId, from, to } }).then(data),
  updateVenue: (payload) => api.post('/api/Owner/Venue/Update', payload).then(data),
  uploadPhoto: (stadiumId, file) => {
    const fd = new FormData();
    fd.append('stadiumId', stadiumId);
    fd.append('file', file);
    return api.post('/api/Owner/Photos/Upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(data);
  },
  deletePhoto: (photoId) => api.post('/api/Owner/Photos/Delete', { photoId }).then(data),
  setCover: (photoId) => api.post('/api/Owner/Photos/SetCover', { photoId }).then(data),
  pitches: (stadiumId) => api.get('/api/Owner/Pitches', { params: { stadiumId } }).then(data),
  savePitch: (payload) => api.post('/api/Owner/Pitches/Save', payload).then(data),
  deletePitch: (pitchId) => api.post('/api/Owner/Pitches/Delete', { pitchId }).then(data),
  openingHours: (stadiumId) => api.get('/api/Owner/OpeningHours', { params: { stadiumId } }).then(data),
  saveOpeningHours: (stadiumId, days) => api.post('/api/Owner/OpeningHours', { stadiumId, days }).then(data),
  priceRules: (stadiumId) => api.get('/api/Owner/PriceRules', { params: { stadiumId } }).then(data),
  savePriceRule: (payload) => api.post('/api/Owner/PriceRules/Save', payload).then(data),
  deletePriceRule: (priceRuleId) => api.post('/api/Owner/PriceRules/Delete', { priceRuleId }).then(data),
  campaigns: (stadiumId) => api.get('/api/Owner/Campaigns', { params: { stadiumId } }).then(data),
  saveCampaign: (payload) => api.post('/api/Owner/Campaigns/Save', payload).then(data),
  deleteCampaign: (campaignId) => api.post('/api/Owner/Campaigns/Delete', { campaignId }).then(data),
  blocks: (stadiumId, from, to) => api.get('/api/Owner/Blocks', { params: { stadiumId, from, to } }).then(data),
  saveBlock: (payload) => api.post('/api/Owner/Blocks/Save', payload).then(data),
  deleteBlock: (slotBlockId) => api.post('/api/Owner/Blocks/Delete', { slotBlockId }).then(data),
  reviews: (stadiumId) => api.get('/api/Owner/Reviews', { params: { stadiumId } }).then(data),
  reply: (reviewId, reply) => api.post('/api/Owner/Reviews/Reply', { reviewId, reply }).then(data),
};

/* ---------- Admin ---------- */
export const adminVenuesApi = {
  owners: () => api.get('/api/Admin/Owners').then(data),
  ownerDetail: (ownerId) => api.get('/api/Admin/OwnerDetail', { params: { ownerId } }).then(data),
  resetOwnerPassword: (ownerId) => api.post('/api/Admin/ResetOwnerPassword', { ownerId }).then(data),
  createOwner: (model, photos) => {
    const fd = new FormData();
    fd.append('model', JSON.stringify(model));
    photos.forEach((f) => fd.append('photos', f));
    return api.post('/api/Admin/CreateOwner', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(data);
  },
  updateMembership: (ownerId, membershipUntil, suspended) =>
    api.post('/api/Admin/UpdateMembership', { ownerId, membershipUntil, suspended }).then(data),
  assignVenue: (stadiumId, ownerId) => api.post('/api/Admin/AssignVenue', { stadiumId, ownerId }).then(data),
  setListed: (stadiumId, isListed) => api.post('/api/Admin/SetListed', { stadiumId, isListed }).then(data),
  osmCandidates: (params) => api.get('/api/Admin/OsmCandidates', { params, timeout: 60000 }).then(data),
  importCandidate: (payload) => api.post('/api/Admin/ImportCandidate', payload).then(data),
};
