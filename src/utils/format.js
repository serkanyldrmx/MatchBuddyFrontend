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

/** Sunucu hata gövdesi (standart: { success:false, code, message, errors, traceId }) ya da null */
const errorBodyOf = (error) => {
  const data = error?.response?.data;
  return data && typeof data === 'object' ? data : null;
};

/** Standart hata gövdesindeki makine okunur kod (ör. "VENUE_SLOT_TAKEN"); yoksa null */
export const errorCode = (error) => {
  const body = errorBodyOf(error);
  const code = body?.code || body?.Code;
  return typeof code === 'string' ? code : null;
};

/** Hata kodu verilen kodlardan biri mi? isErrorCode(e, 'VENUE_SLOT_TAKEN', 'MATCH_TIME_CONFLICT') */
export const isErrorCode = (error, ...codes) => {
  const code = errorCode(error);
  return Boolean(code) && codes.includes(code);
};

/** İsteğin izleme kimliği (traceId gövdede, X-Trace-Id başlıkta) */
export const errorTraceId = (error) => {
  const body = errorBodyOf(error);
  const headers = error?.response?.headers;
  const fromHeader = headers && (typeof headers.get === 'function' ? headers.get('x-trace-id') : headers['x-trace-id']);
  return body?.traceId || body?.TraceId || fromHeader || null;
};

/**
 * Alan bazlı hatalar: { "<alan>": ["mesaj", …] } → { alan: [mesaj…] } (boş değilse), yoksa null.
 * Eski gövdelerdeki tek `field` özelliği de { [field]: [message] } olarak döner.
 */
export const fieldErrorsOf = (error) => {
  const body = errorBodyOf(error);
  if (!body) return null;
  const raw = body.errors || body.Errors;
  const out = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    Object.entries(raw).forEach(([k, v]) => {
      const list = (Array.isArray(v) ? v : [v]).filter((x) => typeof x === 'string' && x.trim());
      if (list.length) out[k] = list;
    });
  } else if (typeof body.field === 'string' && body.message) {
    out[body.field] = [body.message];
  }
  return Object.keys(out).length ? out : null;
};

const currentLang = () => (i18n.resolvedLanguage || i18n.language || 'tr').split('-')[0];

/** errors namespace'indeki ham metin (yer tutucular çözülmeden) */
const errorTemplate = (code) =>
  i18n.getResource(currentLang(), 'errors', code) ?? i18n.getResource('tr', 'errors', code) ?? null;

/**
 * API hata mesajını kullanıcıya gösterilebilir (çevrilmiş) metne çevirir.
 * Sunucu sözleşmesi (MatcBuddy/docs/platform-api.md §1): { success: false, code, message, errors, traceId }
 *  - code varsa: errors:<code> çevirisi. Çeviri yer tutucu içeriyorsa ({{0}} …) sunucu mesajı tercih edilir
 *    (değerleri sunucu doldurur ve Accept-Language ile aynı dilde gelir). Çeviri yoksa sunucu mesajı, o da yoksa fallback.
 *  - code yoksa: sunucu mesajı; o da yoksa ağ / zaman aşımı / HTTP durumuna göre genel metin ya da fallback
 *  - COMMON_INTERNAL_ERROR (ve diğer 5xx) için traceId mesajın sonuna eklenir: kullanıcı bildirebilsin.
 * fallback verilmezse errors:generic.unknown kullanılır.
 */
export const apiErrorMessage = (error, fallback) => {
  const fb = fallback ?? i18n.t('errors:generic.unknown');
  const data = error?.response?.data;
  const serverMessage = serverMessageOf(data);
  const code = errorCode(error);
  const withTrace = (text) => {
    const status = error?.response?.status;
    if (code !== 'COMMON_INTERNAL_ERROR' && !(status >= 500 && !code)) return text;
    const traceId = errorTraceId(error);
    return traceId ? `${text} (${i18n.t('errors:traceSuffix', { traceId })})` : text;
  };
  if (code) {
    const template = errorTemplate(code);
    if (template == null) return withTrace(serverMessage || fb);
    if (serverMessage && /\{\{/.test(template)) return withTrace(serverMessage);
    return withTrace(i18n.t(`errors:${code}`, { defaultValue: serverMessage || fb }));
  }
  if (serverMessage) return withTrace(serverMessage);

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
  if (status >= 500) return withTrace(fb);
  return fb;
};

const namePathKey = (name) => (Array.isArray(name) ? name : [name]).join('.').toLowerCase();

/**
 * Sunucunun `errors` sözlüğünü antd Form alanlarına uygular (alan adları büyük/küçük harf duyarsız).
 *  - "owner.userName" gibi noktalı anahtarlar önce tam yol, sonra son parça ("userName") ile eşleştirilir.
 *  - options.aliases: { "<sunucu alanı>": NamePath } — farklı adlandırılmış alanlar için (anahtarlar duyarsız).
 *  - "body" ve eşleşmeyen anahtarların mesajları `unmatched` olarak döner (genel mesajla birlikte gösterilebilir).
 * @returns {{ applied: Array, unmatched: string[] }}
 */
export const applyFieldErrors = (form, error, { aliases = {}, scroll = true } = {}) => {
  const result = { applied: [], unmatched: [] };
  const fieldErrors = fieldErrorsOf(error);
  if (!fieldErrors) return result;
  const registered = new Map();
  if (form && typeof form.getFieldsError === 'function') {
    form.getFieldsError().forEach(({ name }) => {
      if (name && name.length) registered.set(namePathKey(name), name);
    });
  }
  const aliasMap = new Map(Object.entries(aliases).map(([k, v]) => [k.toLowerCase(), v]));
  const resolve = (key) => {
    const lower = key.toLowerCase();
    if (aliasMap.has(lower)) return aliasMap.get(lower);
    if (registered.has(lower)) return registered.get(lower);
    const last = lower.split('.').pop();
    if (aliasMap.has(last)) return aliasMap.get(last);
    if (registered.has(last)) return registered.get(last);
    return null;
  };
  const fields = [];
  Object.entries(fieldErrors).forEach(([key, messages]) => {
    const name = form ? resolve(key) : null;
    if (name != null) {
      fields.push({ name, errors: messages });
      result.applied.push(name);
    } else {
      result.unmatched.push(...messages);
    }
  });
  if (fields.length) {
    form.setFields(fields);
    if (scroll && typeof form.scrollToField === 'function') {
      try {
        form.scrollToField(fields[0].name, { block: 'center', behavior: 'smooth' });
      } catch {
        /* alan DOM'da değilse (ör. başka adımda) kaydırma yapılmaz */
      }
    }
  }
  return result;
};

/**
 * Form gönderimi hatası için tek adımlık yardımcı: alan hatalarını forma uygular ve gösterilecek mesajı döndürür.
 * Eşleşmeyen alan mesajları genel mesajın arkasına eklenir.
 *   catch (e) { message.error(formErrorMessage(form, e, fallbackText)); }
 */
export const formErrorMessage = (form, error, fallback, options) => {
  const { unmatched } = applyFieldErrors(form, error, options);
  const base = apiErrorMessage(error, fallback);
  const extra = unmatched.filter((m) => m !== base);
  return extra.length ? `${base} ${extra.join(' ')}` : base;
};
