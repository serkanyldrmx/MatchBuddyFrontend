import { api } from './config';
import i18n from '../i18n';

// Medya yükleme — sözleşme: MatcBuddy/docs/media-api.md §4

/**
 * Mesaj resmi yükler (Pending medya). Dönüş: { success, mediaId, url, thumbUrl, largeUrl, width, height }
 * onProgress: 0–100 arası yükleme yüzdesi
 */
export const uploadMedia = async (file, kind = 'message', onProgress) => {
  const fd = new FormData();
  fd.append('file', file, file.name || 'foto.jpg');
  fd.append('kind', kind);
  const res = await api.post('/api/Media/Upload', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    },
  });
  const data = res.data;
  if (!data || data.success === false || !data.mediaId) {
    throw Object.assign(new Error(data?.message || i18n.t('common:image.uploadFailed')), { response: { data: data || {} } });
  }
  onProgress?.(100);
  return data;
};
