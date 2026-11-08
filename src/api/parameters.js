import { useEffect, useSyncExternalStore } from 'react';
import { api } from './config';

/**
 * Sistem parametreleri — sözleşme: MatchBuddy/docs/platform-api.md §4
 *  - Herkese açık değerler: GET /api/Parameters/Public (anonim, 5 dk HTTP önbelleği) → düz, tipli nesne.
 *  - Yönetici: GET/PUT /api/Admin/Parameters, GET /api/Admin/Parameters/{key}/History
 *
 * Herkese açık değerler uygulama boyunca bir kez çekilir ve modül düzeyinde önbelleklenir.
 * İstek başarısız olursa (ya da yanıt gelene kadar) aşağıdaki varsayılanlar kullanılır; sunucu her zaman yeniden doğrular.
 */

/** Sunucu kataloğundaki varsayılanlar (ParameterCatalog.cs) — yedek değerler */
export const PUBLIC_PARAM_DEFAULTS = Object.freeze({
  'media.maxUploadMb': 10,
  'media.maxMegapixels': 40,
  'venue.maxPhotos': 20,
  'venue.maxPrice': 100000,
  'venue.allowedDurations': [60, 90, 120],
  'venue.slotStepMinutes': 30,
  'venue.playersPerSideMin': 5,
  'venue.playersPerSideMax': 11,
  'venue.extraPlayersAllowed': 4,
  'venue.bookingMinPlayersPerSide': 4,
  'booking.defaultMinNoticeHours': 0,
  'booking.defaultFreeCancellationHours': 24,
  'booking.defaultMaxAdvanceDays': 90,
  'match.maxScore': 50,
  'match.maxPlayerStat': 30,
  'match.ratingMax': 5,
  'tournament.minTeams': 4,
  'tournament.maxTeams': 16,
  'security.passwordMinLength': 6,
  'auth.codeTtlMinutes': 15,
  'auth.codeResendCooldownSeconds': 60,
  'auth.passwordRequireLetterAndDigit': false,
  'legal.termsVersion': '2026-11-06',
  'reliability.newPlayerMatchCount': 3,
  'reliability.levelGood': 90,
  'reliability.levelMedium': 70,
  'reliability.lateCancelHours': 24,
  'reliability.lateCancelPenalty': 5,
  'reliability.veryLateCancelHours': 3,
  'reliability.veryLateCancelPenalty': 10,
  'reliability.noShowPenalty': 20,
  'reliability.noShowMarkWindowHours': 48,
});

/**
 * Herkese açık olmayan ama ekranda gereken katalog varsayılanları. Public uç noktası bunları döndürmez;
 * yönetici değiştirirse istemci eski değeri gösterebilir — sunucu her zaman doğrular.
 */
export const PRIVATE_PARAM_DEFAULTS = Object.freeze({
  'venue.createOwnerMaxPhotos': 10,
});

const sanitize = (key, value) => {
  const fallback = PUBLIC_PARAM_DEFAULTS[key];
  if (Array.isArray(fallback)) {
    const list = Array.isArray(value) ? value.map(Number).filter((n) => Number.isFinite(n) && n > 0) : [];
    return list.length ? list : fallback;
  }
  if (typeof fallback === 'number') {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return value ?? fallback;
};

let state = { values: PUBLIC_PARAM_DEFAULTS, loaded: false, failed: false };
let inflight = null;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

const apply = (data) => {
  const values = { ...PUBLIC_PARAM_DEFAULTS };
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    Object.entries(data).forEach(([k, v]) => {
      values[k] = k in PUBLIC_PARAM_DEFAULTS ? sanitize(k, v) : v;
    });
  }
  state = { values: Object.freeze(values), loaded: true, failed: false };
  emit();
};

/**
 * Herkese açık parametreleri bir kez yükler (eşzamanlı çağrılar aynı isteği paylaşır).
 * force: true ile yeniden çeker (ör. yönetici bir değeri değiştirdikten sonra).
 */
export function loadPublicParams({ force = false } = {}) {
  if (state.loaded && !force) return Promise.resolve(state.values);
  if (inflight && !force) return inflight;
  inflight = api
    // force: tarayıcının HTTP önbelleğini (max-age=300) atlamak için sorgu parametresi eklenir
    .get('/api/Parameters/Public', force ? { params: { _: Date.now() } } : undefined)
    .then((r) => {
      apply(r.data);
      return state.values;
    })
    .catch(() => {
      // Varsayılanlarla devam; bir sonraki usePublicParams çağrısı yeniden denemesin diye loaded işaretlenir
      state = { ...state, loaded: true, failed: true };
      emit();
      return state.values;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Senkron okuma (yüklenmediyse varsayılan döner). Render dışı kodlar (doğrulama yardımcıları) için. */
export const getParam = (key) => {
  const v = state.values[key];
  if (v !== undefined) return v;
  return PUBLIC_PARAM_DEFAULTS[key] ?? PRIVATE_PARAM_DEFAULTS[key];
};

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => state;

/**
 * Herkese açık parametreler (önbellekli). İlk kullanımda yükleme başlatılır.
 *   const params = usePublicParams();  params.get('venue.maxPhotos')
 * Dönen nesne: { values, loaded, failed, get(key) }
 */
export function usePublicParams() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    if (!s.loaded) loadPublicParams();
  }, [s.loaded]);
  return {
    values: s.values,
    loaded: s.loaded,
    failed: s.failed,
    get: (key) => (s.values[key] !== undefined ? s.values[key] : PUBLIC_PARAM_DEFAULTS[key] ?? PRIVATE_PARAM_DEFAULTS[key]),
  };
}

/** Tek parametre: const maxPhotos = usePublicParam('venue.maxPhotos') */
export const usePublicParam = (key) => usePublicParams().get(key);

/** Rezervasyon kişi sayısı aralığı: 2 × bookingMinPlayersPerSide … 2 × playersPerSide + extraPlayersAllowed */
export const bookingUserCountRange = (playersPerSide, get = getParam) => {
  const min = 2 * Number(get('venue.bookingMinPlayersPerSide'));
  const max = 2 * Number(playersPerSide || get('venue.playersPerSideMin')) + Number(get('venue.extraPlayersAllowed'));
  return { min, max: Math.max(min, max) };
};

/* ---------- Yönetici uç noktaları ---------- */

/** dataType: "int" | "decimal" | "bool" | "string" | "json" — değerler (value/min/max/default) her zaman metin */
export const PARAM_TYPES = { INT: 'int', DECIMAL: 'decimal', BOOL: 'bool', STRING: 'string', JSON: 'json' };

const data = (r) => r.data;

export const adminParametersApi = {
  /** [{ group, parameters: [ParameterDto] }] */
  list: () => api.get('/api/Admin/Parameters').then(data),
  /** { success, message, parameter } */
  update: (key, value) => api.put(`/api/Admin/Parameters/${encodeURIComponent(key)}`, { value: String(value) }).then(data),
  /** [{ id, key, oldValue, newValue, changedByPlayerId, changedByUserName, changedAt }] (yeniden eskiye) */
  history: (key, take = 50) => api.get(`/api/Admin/Parameters/${encodeURIComponent(key)}/History`, { params: { take } }).then(data),
};
