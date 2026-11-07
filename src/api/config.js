import axios from 'axios';
import i18n, { DEFAULT_LANG } from '../i18n';

// API adresleri ortam değişkenlerinden okunur (bkz. .env.example)
// Boş değer ("") = aynı origin: /api ve /media istekleri barındırma tarafından API'ye yönlendirilir (ör. Vercel rewrites)
export const API_BASE_URL = process.env.REACT_APP_API_URL ?? 'http://localhost:5033';

/**
 * Oturum modeli (MatchBuddy/docs/auth-api.md):
 *  - Kısa ömürlü access token (JWT) localStorage'da ("token"); her istekte Authorization başlığına eklenir.
 *  - Refresh token HttpOnly çerezde (mb_rt) — JS göremez. 401 gelince /api/Auth/Refresh ile sessizce yenilenir,
 *    istek bir kez tekrarlanır. Yenileme de başarısızsa oturum kapanır.
 */
export const getToken = () => localStorage.getItem('token');

// Authorization başlığı (token yoksa boş nesne)
export const authHeaders = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * İstek dili (Accept-Language): uygulamanın o anki i18n dili (PlayerSettings.language ile eşitlenir).
 * Sunucu mesajları (hata/başarı) bu dilde döner — bkz. MatchBuddy/docs/platform-api.md §2.
 */
export const requestLanguage = () => (i18n.resolvedLanguage || i18n.language || DEFAULT_LANG).split('-')[0];

/** Giriş yanıtını ({ token, player, … }) saklar. */
export const saveSession = (data) => {
  if (!data || !data.token) return;
  localStorage.setItem('token', data.token);
  if (data.player) localStorage.setItem('user', JSON.stringify(data.player));
};

const clearSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

// Oturumu kapat: sunucudaki refresh token iptal edilir (çerez), yerel bilgiler temizlenir
export const logout = () => {
  fetch(`${API_BASE_URL}/api/Auth/Logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
  clearSession();
};

// Bu isteklerde 401 "oturum bitti" değil, iş hatasıdır (yanlış şifre vb.) — yenileme denenmez
const NO_REFRESH_PATHS = ['/api/Players/PlayerLogin', '/api/Auth/Login', '/api/Auth/Refresh', '/api/Auth/Logout',
  '/api/Auth/Google', '/api/Auth/Facebook', '/api/Auth/ResetPassword', '/api/Auth/ForgotPassword'];
const skipsRefresh = (url) => NO_REFRESH_PATHS.some((p) => (url || '').includes(p));

// Oturum süresi doldu / token geçersiz: çıkış yap ve giriş sayfasına yönlendir
const handleUnauthorized = () => {
  clearSession();
  if (window.location.pathname !== '/') {
    window.location.href = '/';
  }
};

let refreshPromise = null;

/** Refresh çereziyle yeni access token alır. Aynı anda gelen 401'ler tek bir yenilemeyi bekler. */
export const refreshSession = () => {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/api/Auth/Refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Accept-Language': requestLanguage() },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('refresh failed');
        const data = await res.json();
        saveSession(data);
        return data.token;
      })
      .finally(() => {
        setTimeout(() => { refreshPromise = null; }, 0);
      });
  }
  return refreshPromise;
};

// Ortak axios örneği (withCredentials: refresh çerezi Auth uç noktalarına gitsin)
export const api = axios.create({ baseURL: API_BASE_URL, withCredentials: true });

api.interceptors.request.use((config) => {
  config.headers = config.headers || {};
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (typeof config.headers.set === 'function') config.headers.set('Accept-Language', requestLanguage());
  else config.headers['Accept-Language'] = requestLanguage();
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config || {};
    if (error.response && error.response.status === 401 && !skipsRefresh(config.url)) {
      if (!config._retried && getToken()) {
        config._retried = true;
        try {
          await refreshSession();
          return api(config);
        } catch {
          // yenileme başarısız → çıkış
        }
      }
      handleUnauthorized();
    }
    return Promise.reject(error);
  }
);

// fetch sarmalayıcısı: base URL ve Bearer token ekler; 401'de bir kez oturumu yeniler, olmazsa çıkış yapar
export const apiFetch = async (path, options = {}) => {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const send = () => fetch(url, {
    credentials: 'include',
    ...options,
    headers: { 'Accept-Language': requestLanguage(), ...(options.headers || {}), ...authHeaders() },
  });
  let response = await send();
  if (response.status === 401 && !skipsRefresh(url)) {
    if (getToken()) {
      try {
        await refreshSession();
        response = await send();
        if (response.status !== 401) return response;
      } catch {
        // yenileme başarısız → çıkış
      }
    }
    handleUnauthorized();
  }
  return response;
};
