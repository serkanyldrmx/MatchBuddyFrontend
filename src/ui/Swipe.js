import React, { useEffect, useRef, useState } from 'react';

// Kaydırmayı başlatmaması gereken yerler: form alanları, harita, saha (sürükle-bırak), yatay kayan tablolar
const IGNORE = 'input, textarea, select, .ant-select, .ant-picker, .ant-slider, .leaflet-container, .mb-pitch, [data-no-swipe], .ant-modal, .ant-drawer';

const scrollsSideways = (el, stop) => {
  for (let n = el; n && n !== stop; n = n.parentElement) {
    const s = window.getComputedStyle(n);
    if (/(auto|scroll)/.test(s.overflowX) && n.scrollWidth > n.clientWidth + 2) return true;
  }
  return false;
};

/**
 * Parmakla sağa / sola kaydırmayı yakalar. onSwipe(+1) = sola kaydırma (sonraki), onSwipe(-1) = sağa (önceki).
 * Dikey kaydırmayı engellemez (dinleyiciler passive).
 */
export function useSwipe(onSwipe, enabled = true) {
  const cb = useRef(onSwipe);
  cb.current = onSwipe;
  const [el, setEl] = useState(null);
  useEffect(() => {
    if (!el || !enabled) return undefined;
    let start = null;
    const onStart = (e) => {
      const t = e.touches[0];
      start =
        e.touches.length === 1 && !e.target.closest?.(IGNORE) && !scrollsSideways(e.target, el)
          ? { x: t.clientX, y: t.clientY, at: Date.now() }
          : null;
    };
    const onEnd = (e) => {
      if (!start) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const quick = Date.now() - start.at < 800;
      start = null;
      if (quick && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.8) cb.current(dx < 0 ? 1 : -1);
    };
    const onCancel = () => {
      start = null;
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onCancel);
    };
  }, [el, enabled]);
  return setEl;
}

/** İçindeki ilk sekme grubunu (Tabs ya da Segmented) bir adım ileri / geri alır */
function stepTabs(root, dir) {
  const tabs = root.querySelector('.ant-tabs');
  const seg = root.querySelector('.ant-segmented');
  // Sayfada önce hangisi geliyorsa o
  const useTabs = tabs && (!seg || tabs.compareDocumentPosition(seg) & Node.DOCUMENT_POSITION_FOLLOWING);
  if (useTabs) {
    const list = [...tabs.querySelector('.ant-tabs-nav-list')?.querySelectorAll(':scope > .ant-tabs-tab') || []].filter(
      (n) => !n.classList.contains('ant-tabs-tab-disabled')
    );
    const i = list.findIndex((n) => n.classList.contains('ant-tabs-tab-active'));
    const next = list[i + dir];
    next?.querySelector('.ant-tabs-tab-btn')?.click();
    next?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
    return;
  }
  if (seg) {
    const items = [...seg.querySelectorAll('.ant-segmented-item')].filter((n) => !n.classList.contains('ant-segmented-item-disabled'));
    const i = items.findIndex((n) => n.classList.contains('ant-segmented-item-selected'));
    items[i + dir]?.click();
  }
}

/**
 * Sekmeli sayfalar: telefonda içeriği sağa / sola kaydırınca sonraki / önceki sekmeye geçer
 * (sekmeye dokunmakla aynı). Kendi kutusu yoktur (display: contents), yerleşimi değiştirmez.
 */
export function SwipeTabs({ children, onSwipe }) {
  const ref = useRef(null);
  const set = useSwipe((dir) => (onSwipe ? onSwipe(dir) : ref.current && stepTabs(ref.current, dir)));
  return (
    <div
      className="mb-swipe"
      ref={(n) => {
        ref.current = n;
        set(n);
      }}
    >
      {children}
    </div>
  );
}
