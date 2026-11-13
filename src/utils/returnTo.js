// Oturum kapalıyken açılan sayfa (bildirim, paylaşılan maç linki…): girişten sonra oraya dönülür.
const KEY = 'mb:returnTo';
const BLOCKED = ['/', '/login', '/register', '/forgot-password'];

/** Yalnızca uygulama içi yollar kabul edilir (açık yönlendirme olmasın) */
const isSafe = (path) => typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && !BLOCKED.includes(path.split('?')[0]);

export function rememberReturnTo(path) {
  if (!isSafe(path)) return;
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    /* gizli sekme vb.: yok say */
  }
}

/** Kayıtlı yolu döndürür ve siler (yoksa null) */
export function takeReturnTo() {
  try {
    const path = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return isSafe(path) ? path : null;
  } catch {
    return null;
  }
}
