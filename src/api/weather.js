import { useEffect, useState } from 'react';
import { api } from './config';

// Maç saati hava durumu — sözleşme: MatchBuddy/docs/engagement-api.md §2
// Ekrandaki maç kartları aynı anda ister; istekler 60 ms içinde tek çağrıda toplanır, sonuç 15 dk önbellekte kalır.

const TTL_MS = 15 * 60 * 1000;
/** Sunucunun tahmin ufku (gün) */
export const WEATHER_HORIZON_DAYS = 15;

const cache = new Map(); // matchId -> { data, at }
const listeners = new Map(); // matchId -> Set<fn>
let queue = new Set();
let timer = null;

const notify = (id, data) => listeners.get(id)?.forEach((fn) => fn(data));

const flush = () => {
  timer = null;
  const ids = [...queue];
  queue = new Set();
  for (let i = 0; i < ids.length; i += 60) {
    const chunk = ids.slice(i, i + 60);
    api
      .get('/api/Weather/Matches', { params: { ids: chunk.join(',') } })
      .then((r) => {
        const byId = new Map((r.data || []).map((w) => [w.matchId, w]));
        chunk.forEach((id) => {
          const data = byId.get(id) || { matchId: id, available: false };
          cache.set(id, { data, at: Date.now() });
          notify(id, data);
        });
      })
      .catch(() => chunk.forEach((id) => notify(id, { matchId: id, available: false })));
  }
};

const request = (id) => {
  queue.add(id);
  if (!timer) timer = setTimeout(flush, 60);
};

/** Maçın hava durumu (enabled false ise istek yapılmaz). Dönen: null (yükleniyor / yok) ya da MatchWeatherDto. */
export function useMatchWeather(matchId, enabled = true) {
  const id = Number(matchId);
  const [data, setData] = useState(() => cache.get(id)?.data || null);
  useEffect(() => {
    if (!enabled || !id) return undefined;
    const set = listeners.get(id) || new Set();
    set.add(setData);
    listeners.set(id, set);
    const hit = cache.get(id);
    if (hit && Date.now() - hit.at < TTL_MS) setData(hit.data);
    else request(id);
    return () => set.delete(setData);
  }, [id, enabled]);
  return enabled ? data : null;
}

/** WMO hava kodu → simge + metin anahtarı (locales/tr/weather.json) */
export function weatherKind(code, hour) {
  const night = hour != null && (hour < 6 || hour >= 19);
  if (code == null) return { icon: '🌡️', key: 'unknown' };
  if (code === 0) return { icon: night ? '🌙' : '☀️', key: 'clear' };
  if (code === 1 || code === 2) return { icon: night ? '☁️' : '⛅', key: 'partly' };
  if (code === 3) return { icon: '☁️', key: 'cloudy' };
  if (code === 45 || code === 48) return { icon: '🌫️', key: 'fog' };
  if (code >= 51 && code <= 57) return { icon: '🌦️', key: 'drizzle' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { icon: '🌧️', key: 'rain' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: '🌨️', key: 'snow' };
  if (code >= 95) return { icon: '⛈️', key: 'storm' };
  return { icon: '🌡️', key: 'unknown' };
}

/** Maç için anlamlı mı: geçmemiş, iptal değil, ufuk içinde */
export const weatherRelevant = (matchDate, closed) => {
  if (!matchDate || closed) return false;
  const ms = new Date(matchDate).getTime() - Date.now();
  return ms > -2 * 3600 * 1000 && ms < WEATHER_HORIZON_DAYS * 24 * 3600 * 1000;
};
