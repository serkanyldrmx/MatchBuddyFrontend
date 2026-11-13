import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/** Sayfayı (ve açık pencerenin içini) en başa kaydırır */
export function scrollToTop() {
  const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
  document.querySelectorAll('.ant-modal-wrap, .ant-drawer-body').forEach((el) => {
    el.scrollTop = 0;
  });
}

/** Adımlı akışlarda (maç oluştur vb.) adım değişince en başa döner; ilk açılışta dokunmaz */
export function useScrollTopOn(value) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    scrollToTop();
  }, [value]);
}

/** Yeni sayfaya geçince en baştan başla; geri/ileri tuşunda tarayıcının kaldığı yer korunur */
export function RouteScrollTop() {
  const { pathname } = useLocation();
  const type = useNavigationType();
  useEffect(() => {
    if (type !== 'POP') window.scrollTo(0, 0);
  }, [pathname, type]);
  return null;
}
