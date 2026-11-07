import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { API_BASE_URL, getToken, refreshSession } from './config';

/**
 * Anlık mesajlaşma bağlantısı (SignalR, MatchBuddy/docs/realtime-api.md).
 * Sunucu yalnızca "değişti" sinyali yollar; ekranlar veriyi her zamanki REST çağrılarıyla yeniler.
 *  - "message"      { kind: 'user' | 'group', senderId, recipientId?, groupId? }
 *  - "matchComment" { matchId }   (joinMatch ile abone olunan maçlar için)
 * Bağlantı kurulamazsa ekranlar yavaş yoklamaya (polling) devam eder; uygulama bozulmaz.
 */

let connection = null;
let starting = null;
const handlers = { message: new Set(), matchComment: new Set() };
const joinedMatches = new Map(); // matchId -> abone sayısı

const build = () => {
  const conn = new HubConnectionBuilder()
    .withUrl(`${API_BASE_URL}/hubs/chat`, {
      // Süresi dolmuş token'la bağlanmaya çalışmadan önce yenilemeyi dene
      accessTokenFactory: async () => {
        const token = getToken();
        if (!token) return '';
        try {
          const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
          if (payload.exp && payload.exp * 1000 < Date.now() + 30000) return await refreshSession();
        } catch {
          // çözümlenemeyen token: olduğu gibi gönder
        }
        return token;
      },
    })
    .withAutomaticReconnect([0, 2000, 5000, 15000, 30000])
    .configureLogging(LogLevel.None)
    .build();

  Object.keys(handlers).forEach((event) => {
    conn.on(event, (payload) => handlers[event].forEach((h) => {
      try { h(payload); } catch { /* dinleyici hatası bağlantıyı etkilemesin */ }
    }));
  });
  // Yeniden bağlanınca maç aboneliklerini tazele
  conn.onreconnected(() => {
    joinedMatches.forEach((_, matchId) => conn.invoke('JoinMatch', matchId).catch(() => {}));
  });
  return conn;
};

/** Giriş yapılmışsa bağlantıyı başlatır (birden çok çağrı tek bağlantı kullanır). */
export const startRealtime = () => {
  if (!getToken()) return Promise.resolve(null);
  if (!connection) connection = build();
  if (connection.state === HubConnectionState.Connected) return Promise.resolve(connection);
  if (!starting) {
    starting = connection.start()
      .then(() => {
        joinedMatches.forEach((_, matchId) => connection.invoke('JoinMatch', matchId).catch(() => {}));
        return connection;
      })
      .catch(() => null)
      .finally(() => { starting = null; });
  }
  return starting;
};

export const stopRealtime = () => {
  const conn = connection;
  connection = null;
  joinedMatches.clear();
  if (conn) conn.stop().catch(() => {});
};

window.addEventListener('mb:logout', stopRealtime);

/** Sinyal dinleyicisi ekler; dönen fonksiyon aboneliği kaldırır. */
export const onRealtime = (event, handler) => {
  handlers[event]?.add(handler);
  startRealtime();
  return () => handlers[event]?.delete(handler);
};

/** Maç sohbetine (soyunma odası) abone ol; dönen fonksiyon aboneliği bırakır. */
export const joinMatchChannel = (matchId) => {
  const id = Number(matchId);
  joinedMatches.set(id, (joinedMatches.get(id) || 0) + 1);
  startRealtime().then((conn) => conn?.invoke('JoinMatch', id).catch(() => {}));
  return () => {
    const left = (joinedMatches.get(id) || 1) - 1;
    if (left > 0) {
      joinedMatches.set(id, left);
      return;
    }
    joinedMatches.delete(id);
    if (connection?.state === HubConnectionState.Connected) connection.invoke('LeaveMatch', id).catch(() => {});
  };
};
