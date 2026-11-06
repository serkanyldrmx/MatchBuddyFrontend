import { useCallback, useEffect, useMemo, useState } from 'react';
import { App } from 'antd';
import { api } from '../api/config';
import { matchesApi } from '../api/matches';
import { apiErrorMessage } from '../utils/format';

/**
 * Eski maç listesi (GetMatchList) ile maç akışını (GetMatchFeed) birleştirir.
 * Akış; tesis/saha (venue), tutar, kurucu ve takım bilgilerini taşır, eski liste ise userCount vb. alanları.
 */
function mergeMatches(legacy, feed) {
  const byId = new Map();
  feed.forEach((f) => byId.set(f.matchId, f));
  const merged = legacy.map((m) => {
    const f = byId.get(m.matchId);
    byId.delete(m.matchId);
    if (!f) return m;
    return { ...m, ...f, userCount: m.userCount ?? f.capacity, likes: m.likes ?? f.likes };
  });
  byId.forEach((f) => merged.push({ ...f, userCount: f.capacity }));
  return merged;
}

/** Maç ve halı saha listelerini birlikte yükler; stadiumId → ad eşlemesi sağlar */
export default function useAdminData() {
  const { message } = App.useApp();
  const [matches, setMatches] = useState([]);
  const [stadiums, setStadiums] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, f, s] = await Promise.all([
        api.get('/api/Match/GetMatchList'),
        matchesApi.feed().catch(() => []),
        api.get('/api/Stadium/GetStadiumList').catch(() => ({ data: [] })),
      ]);
      setMatches(mergeMatches(Array.isArray(m.data) ? m.data : [], Array.isArray(f) ? f : []));
      setStadiums(Array.isArray(s.data) ? s.data : []);
    } catch (e) {
      message.error(apiErrorMessage(e, 'Maç listesi alınamadı.'));
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    load();
  }, [load]);

  const stadiumNames = useMemo(() => {
    const map = {};
    stadiums.forEach((s) => {
      map[s.stadiumId] = s.stadiumName;
    });
    return map;
  }, [stadiums]);

  return { matches, setMatches, stadiums, stadiumNames, loading, reload: load };
}

/** Maçın tesis kimliği (yeni modelde venue.stadiumId) */
export const matchStadiumId = (m) => m?.venue?.stadiumId ?? m?.stadiumId;

/** "Tesis · Saha" metni */
export function venueLabel(m, stadiumNames = {}) {
  const name = m?.venue?.name || m?.stadiumName || stadiumNames[matchStadiumId(m)];
  if (!name) return null;
  return m?.venue?.pitchName ? `${name} · ${m.venue.pitchName}` : name;
}
