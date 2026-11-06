import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import relativeTime from 'dayjs/plugin/relativeTime';
import { API_BASE_URL } from '../api/config';

dayjs.extend(relativeTime);
dayjs.locale('tr');

// Tarih/saat biçimleri tek yerden yönetilir
export const formatDate = (value) => (value ? dayjs(value).format('DD MMMM YYYY') : '-');
export const formatTime = (value) => (value ? dayjs(value).format('HH:mm') : '-');
export const formatDateTime = (value) => (value ? dayjs(value).format('DD MMM YYYY, HH:mm') : '-');
export const fromNow = (value) => (value ? dayjs(value).fromNow() : '');
export const isPast = (value) => (value ? dayjs(value).isBefore(dayjs()) : false);

// Profil resmi gibi sunucudaki dosyaların tam adresi
export const fileUrl = (path) => {
  if (!path) return undefined;
  return path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
};

export const fullName = (p) => [p?.playerName, p?.playerSurname].filter(Boolean).join(' ') || p?.userName || 'Bilinmeyen';

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

// API hata mesajını kullanıcıya gösterilebilir metne çevirir
export const apiErrorMessage = (error, fallback = 'Bir hata oluştu. Lütfen tekrar deneyin.') => {
  const data = error?.response?.data;
  if (typeof data === 'string' && data.length < 200) return data;
  if (data?.message) return data.message;
  if (data?.Message) return data.Message;
  if (error?.response?.status === 403) return 'Bu işlem için yetkiniz yok.';
  return fallback;
};
