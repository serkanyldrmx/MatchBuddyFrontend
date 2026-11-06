// Tarayıcı tarafında resim hazırlığı (yükleme öncesi küçültme) — sözleşme: MatchBuddy/docs/media-api.md §5
// Sunucu her resmi yine doğrular, döndürür, WebP'ye çevirir; burada amaç mobil veride hızlı yüklemedir.

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ACCEPTED_IMAGE_ACCEPT = ACCEPTED_IMAGE_TYPES.join(',');
export const MAX_IMAGE_MB = 10;
export const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;

/** Dosya kabul edilebilir değilse Türkçe hata metni, uygunsa null */
export const imageError = (file) => {
  if (!file || !ACCEPTED_IMAGE_TYPES.includes(file.type)) return 'Sadece JPG, PNG veya WebP yükleyebilirsiniz.';
  if (file.size > MAX_IMAGE_BYTES) return `Fotoğraf en fazla ${MAX_IMAGE_MB} MB olabilir.`;
  return null;
};

// Bu boyuttan küçük ve kenarı maxSide'ı aşmayan JPEG'ler olduğu gibi gönderilir
const SMALL_BYTES = 1.5 * 1024 * 1024;

const loadImage = async (file) => {
  // createImageBitmap EXIF yönünü uygular (from-image); yoksa <img> ile yükle (modern tarayıcılar yine uygular)
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* <img> ile devam */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
};

const jpegName = (name) => {
  const base = (name || 'foto').replace(/\.[^./\\]+$/, '') || 'foto';
  return `${base}.jpg`;
};

/**
 * Resmi uzun kenarı en fazla maxSide olacak şekilde küçültüp JPEG'e çevirir.
 * Zaten küçükse ya da herhangi bir adım başarısız olursa orijinal dosyayı döndürür.
 * @returns {Promise<File|Blob>}
 */
export async function prepareImage(file, { maxSide = 2560, quality = 0.9 } = {}) {
  if (!file || !ACCEPTED_IMAGE_TYPES.includes(file.type)) return file;
  let source;
  try {
    source = await loadImage(file);
    const w = source.width || source.naturalWidth;
    const h = source.height || source.naturalHeight;
    if (!w || !h) return file;

    const scale = Math.min(1, maxSide / Math.max(w, h));
    // Küçük JPEG: yeniden kodlamaya gerek yok
    if (scale === 1 && file.type === 'image/jpeg' && file.size <= SMALL_BYTES) return file;

    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    // Şeffaf PNG/WebP için beyaz zemin (JPEG'de saydamlık yok)
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cw, ch);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, cw, ch);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    canvas.width = 0;
    canvas.height = 0;
    if (!blob) return file;
    // Küçültme yoksa ve sonuç daha büyükse orijinal kalsın
    if (scale === 1 && blob.size >= file.size) return file;

    const name = jpegName(file.name);
    try {
      const out = new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
      if (file.uid) out.uid = file.uid; // antd Upload listesi için
      return out;
    } catch {
      // File yapıcısı olmayan eski tarayıcılar
      blob.name = name;
      return blob;
    }
  } catch {
    return file;
  } finally {
    if (source && typeof source.close === 'function') source.close();
  }
}
