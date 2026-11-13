import { useEffect } from 'react';

const EDGE = 28; // ekranın sol kenarından bu kadar px içeride başlayan kaydırma
const MIN_DX = 56;

/**
 * Telefonda sol kenardan sağa kaydırınca yan menüyü açar (geri gitmek yerine).
 * Açık bir pencere / çekmece varken (modal, mesajlar) devreye girmez.
 */
export default function useEdgeSwipe(enabled, onOpen) {
  useEffect(() => {
    if (!enabled) return undefined;
    let start = null;
    const onStart = (e) => {
      const t = e.touches[0];
      const blocked = document.querySelector('.ant-modal-wrap, .ant-drawer-open, .ant-image-preview-wrap');
      start = !blocked && e.touches.length === 1 && t.clientX <= EDGE ? { x: t.clientX, y: t.clientY } : null;
    };
    const onMove = (e) => {
      if (!start) return;
      const t = e.touches[0];
      const dx = t.clientX - start.x;
      const dy = Math.abs(t.clientY - start.y);
      if (dy > 40) {
        start = null;
        return;
      }
      if (dx > MIN_DX) {
        start = null;
        onOpen();
      }
    };
    const onEnd = () => {
      start = null;
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };
  }, [enabled, onOpen]);
}
