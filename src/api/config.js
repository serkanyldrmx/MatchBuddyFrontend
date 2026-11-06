import axios from 'axios';

// API adresleri ortam değişkenlerinden okunur (bkz. .env.example)
// Boş değer ("") = aynı origin: /api ve /media istekleri barındırma tarafından API'ye yönlendirilir (ör. Vercel rewrites)
export const API_BASE_URL = process.env.REACT_APP_API_URL ?? 'http://localhost:5033';
// Maç sıralama AI servisi (ai_match_sorter.py)
export const AI_BASE_URL = process.env.REACT_APP_AI_URL || 'http://localhost:5001';
// Takım oluşturma AI servisi (GetAPIPlayers.py)
export const TEAM_AI_BASE_URL = process.env.REACT_APP_TEAM_AI_URL || 'http://localhost:5000';

// Giriş sırasında alınan JWT token'ı
export const getToken = () => localStorage.getItem('token');

// Authorization başlığı (token yoksa boş nesne)
export const authHeaders = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Oturumu kapat: token ve kullanıcı bilgilerini temizle
export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

const isLoginRequest = (url) => (url || '').includes('/api/Players/PlayerLogin');

// Oturum süresi doldu / token geçersiz: çıkış yap ve giriş sayfasına yönlendir
const handleUnauthorized = () => {
  logout();
  if (window.location.pathname !== '/') {
    window.location.href = '/';
  }
};

// Ortak axios örneği
export const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401 && !isLoginRequest(error.config && error.config.url)) {
      handleUnauthorized();
    }
    return Promise.reject(error);
  }
);

// fetch sarmalayıcısı: base URL ve Bearer token ekler, 401'de çıkış yapar
export const apiFetch = async (path, options = {}) => {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const headers = { ...(options.headers || {}), ...authHeaders() };
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401 && !isLoginRequest(url)) {
    handleUnauthorized();
  }
  return response;
};

// AI servislerine istek: aynı Bearer token gönderilir
export const aiFetch = async (baseUrl, path, options = {}) => {
  const headers = { ...(options.headers || {}), ...authHeaders() };
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  if (response.status === 401) {
    handleUnauthorized();
  }
  return response;
};
