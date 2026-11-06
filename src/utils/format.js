import dayjs from 'dayjs';
import { API_BASE_URL } from '../api/config';
import i18n from '../i18n';

// dayjs yerel ayarı ve relativeTime eklentisi src/i18n/index.js içinde dile göre ayarlanır.

// Tarih/saat biçimleri tek yerden yönetilir (biçim kalıpları common:formats.* altında, dile göre değişebilir)
export const formatDate = (value) => (value ? dayjs(value).format(i18n.t('common:formats.date')) : '-');
export const formatTime = (value) => (value ? dayjs(value).format(i18n.t('common:formats.time')) : '-');
export const formatDateTime = (value) => (value ? dayjs(value).format(i18n.t('common:formats.dateTime')) : '-');
export const fromNow = (value) => (value ? dayjs(value).fromNow() : '');
export const isPast = (value) => (value ? dayjs(value).isBefore(dayjs()) : false);

// Medya deposunun genel adresi (örn. R2 özel alan adı). Tanımlıysa /media/... yolları doğrudan oradan okunur.
const MEDIA_BASE_URL = (process.env.REACT_APP_MEDIA_BASE_URL || '').replace(/\/+$/, '');

// Profil resmi gibi sunucudaki dosyaların tam adresi
export const fileUrl = (path) => {
  if (!path) return undefined;
  if (path.startsWith('http') || path.startsWith('blob:') || path.startsWith('data:')) return path;
  if (MEDIA_BASE_URL && path.startsWith('/media/')) return `${MEDIA_BASE_URL}/${path.slice('/media/'.length)}`;
  return `${API_BASE_URL}${path}`;
};

const MEDIA_SIZES = ['sm', 'md', 'lg'];

/**
 * Medya hattından gelen URL'nin istenen boyunu verir (sm | md | lg) ve tam adrese çevirir.
 * Sadece `/media/.../md.webp` biçimindeki adreslerde boy değişir; eski /uploads/... adresleri olduğu gibi kalır.
 */
export const mediaUrl = (url, size = 'md') => {
  if (!url) return undefined;
  let path = url;
  if (MEDIA_SIZES.includes(size) && size !== 'md') {
    path = url.replace(/(\/media\/[^?#]*\/)md\.webp(?=$|[?#])/, `$1${size}.webp`);
  }
  return fileUrl(path);
};

export const fullName = (p) => [p?.playerName, p?.playerSurname].filter(Boolean).join(' ') || p?.userName || i18n.t('common:unknownPerson');

export const initials = (p) => {
  const a = (p?.playerName || p?.userName || '?').charAt(0);
  const b = (p?.playerSurname || '').charAt(0);
  return `${a}${b}`.toUpperCase();
};

// Oturumdaki kullanıcı
export const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user'));
  } catch {
    return null;
  }
};

// Sunucu hata gövdesinden kullanıcıya gösterilebilir ham mesaj (varsa)
const serverMessageOf = (data) => {
  if (typeof data === 'string') return data.length < 200 ? data : null;
  return data?.message || data?.Message || null;
};

/**
 * API hata mesajını kullanıcıya gösterilebilir (çevrilmiş) metne çevirir.
 * Sunucu sözleşmesi: { success: false, code: "MATCH_FULL", message, errors, traceId }
 *  - code varsa: errors namespace'indeki <code> anahtarı; çeviri yoksa sunucu mesajı, o da yoksa fallback
 *  - code yoksa: sunucu mesajı; o da yoksa ağ / zaman aşımı / HTTP durumuna göre genel metin ya da fallback
 * fallback verilmezse errors:generic.unknown kullanılır.
 */
export const apiErrorMessage = (error, fallback) => {
  const fb = fallback ?? i18n.t('errors:generic.unknown');
  const data = error?.response?.data;
  const serverMessage = serverMessageOf(data);
  const code = data && typeof data === 'object' ? data.code || data.Code : null;
  if (code && typeof code === 'string') {
    return i18n.t(`errors:${code}`, { defaultValue: serverMessage || fb });
  }
  if (serverMessage) return serverMessage;

  if (!error?.response) {
    // Yanıt hiç gelmedi: zaman aşımı veya ağ hatası (axios / fetch)
    if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') return i18n.t('errors:generic.timeout');
    if (error?.code === 'ERR_NETWORK' || error?.message === 'Network Error' || error?.message === 'Failed to fetch') {
      return i18n.t('errors:generic.network');
    }
    return fb;
  }

  const status = error.response.status;
  if (status === 403) return i18n.t('errors:generic.forbidden');
  if (status === 429) return i18n.t('errors:generic.rateLimited');
  return fb;
};
