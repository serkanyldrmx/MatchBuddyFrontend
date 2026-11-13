import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { App } from 'antd';
import { AimOutlined, CompressOutlined, ExpandOutlined, LoadingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import './mapKit.css';

/*
 * Ortak harita yardımcıları (Leaflet / react-leaflet):
 * - venuePinIcon: markalı saha iğnesi (seçili / kampanya / fiyat rozeti varyantları)
 * - UserLocationMarker: "buradasın" nabız atan mavi nokta + doğruluk dairesi
 * - LocateControl: "Konumuma git" düğmesi
 * - FullscreenControl: tam ekran (Fullscreen API, yoksa CSS)
 * - ThemedTileLayer: açık / koyu temaya uyan OSM altlığı (koyu temada CSS ile ters çevrilir)
 * - MbMap: hepsini telefona uygun varsayılanlarla birleştiren MapContainer sarmalayıcısı
 */

/* =================== Ortam =================== */

/** Dokunmatik (fare yok) cihaz: tek parmakla sürükleme sayfa kaydırmayı hapsetmesin */
export const isTouchOnly = () =>
  !!(L.Browser.mobile || (typeof window !== 'undefined' && window.matchMedia?.('(hover: none) and (pointer: coarse)').matches));

export const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const googleDirectionsUrl = (coords) => (coords ? `https://www.google.com/maps/dir/?api=1&destination=${coords[0]},${coords[1]}` : null);
export const appleDirectionsUrl = (coords) => (coords ? `https://maps.apple.com/?daddr=${coords[0]},${coords[1]}` : null);

/* =================== Altlık =================== */

// Not: CARTO'nun ücretsiz altlıkları artık API anahtarı istiyor (karolarda filigran çıkıyor);
// bu yüzden OSM karoları kullanılıyor, koyu tema mapKit.css'teki filtreyle elde ediliyor.
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/**
 * Temaya uyan altlık: <html data-theme> 'dark' iken karolar ters çevrilip koyulaştırılır,
 * 'light' iken hafif soluklaştırılır (genel --mb-map-filter yerine).
 */
export function ThemedTileLayer() {
  const map = useMap();
  useEffect(() => {
    const c = map.getContainer();
    c.classList.add('mb-map--themed');
    return () => c.classList.remove('mb-map--themed');
  }, [map]);
  return <TileLayer url={TILE_URL} maxZoom={19} attribution={TILE_ATTR} />;
}

/* =================== İşaretçiler =================== */

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Damla gövde + içinde top (beşgen + dikişler)
const PIN_SVG =
  '<svg viewBox="0 0 30 39" aria-hidden="true" focusable="false">' +
  '<path class="mb-pin__body" d="M15 1.2C7.4 1.2 1.2 7.2 1.2 14.7c0 9.4 11.4 21.2 12.9 22.7a1.3 1.3 0 0 0 1.8 0c1.5-1.5 12.9-13.3 12.9-22.7C28.8 7.2 22.6 1.2 15 1.2z"/>' +
  '<circle class="mb-pin__hole" cx="15" cy="14.5" r="7.4"/>' +
  '<path class="mb-pin__ball" d="M15 11.3l3.04 2.21-1.16 3.58h-3.76l-1.16-3.58z"/>' +
  '<path class="mb-pin__seam" d="M15 11.3V8.3M18.04 13.51l2.86-.93M16.88 17.09l1.76 2.43M13.12 17.09l-1.76 2.43M11.96 13.51l-2.86-.93"/>' +
  '</svg>';

const pinCache = new Map();

/**
 * Markalı saha iğnesi (L.divIcon).
 * active: seçili (büyük, vurgulu) · hot: kampanya rozeti · badge: iğnenin üstünde kısa etiket (ör. fiyat)
 */
export function venuePinIcon({ active = false, hot = false, badge = null, hotLabel = '' } = {}) {
  const key = `${active ? 1 : 0}|${hot ? 1 : 0}|${badge || ''}|${hotLabel}`;
  const cached = pinCache.get(key);
  if (cached) return cached;
  const w = active ? 42 : 30;
  const h = Math.round((w * 39) / 30);
  const html =
    `<div class="mb-pin${active ? ' is-active' : ''}" style="width:${w}px;height:${h}px">` +
    (badge ? `<span class="mb-pin__badge">${esc(badge)}</span>` : '') +
    (hot ? `<span class="mb-pin__hot" title="${esc(hotLabel)}">%</span>` : '') +
    PIN_SVG +
    '</div>';
  const icon = L.divIcon({ className: 'mb-pin-wrap', html, iconSize: [w, h], iconAnchor: [w / 2, h - 1], popupAnchor: [0, -h + 6] });
  pinCache.set(key, icon);
  return icon;
}

/** Varsayılan (seçili olmayan) saha iğnesi */
export const venuePin = venuePinIcon();

const userIcon = L.divIcon({
  className: 'mb-user-loc',
  html: '<span class="mb-user-loc__pulse"></span><span class="mb-user-loc__dot"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -10],
});

/** "Buradasın": nabız atan mavi nokta; doğruluk biliniyorsa yarı saydam daire */
export function UserLocationMarker({ position, accuracy }) {
  const { t } = useTranslation();
  if (!position) return null;
  const showAcc = Number.isFinite(accuracy) && accuracy > 0 && accuracy <= 5000;
  return (
    <>
      {showAcc && (
        <Circle
          center={position}
          radius={accuracy}
          pathOptions={{ className: 'mb-user-acc', color: '#3b82f6', weight: 1, opacity: 0.5, fillColor: '#3b82f6', fillOpacity: 0.12, interactive: false }}
        />
      )}
      <Marker position={position} icon={userIcon} title={t('common:map.youAreHere')} keyboard={false}>
        <Popup>
          <strong>{t('common:map.youAreHere')}</strong>
          {showAcc && (
            <>
              <br />
              <small>{t('common:map.accuracy', { meters: Math.round(accuracy) })}</small>
            </>
          )}
        </Popup>
      </Marker>
    </>
  );
}

/* =================== Kontroller =================== */

/** Leaflet kontrol kutusu oluşturur; içerik React portal ile çizilir */
function useControlContainer(position) {
  const map = useMap();
  const [el, setEl] = useState(null);
  useEffect(() => {
    const Ctl = L.Control.extend({
      onAdd() {
        const div = L.DomUtil.create('div', 'leaflet-bar mb-map-ctl');
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);
        return div;
      },
    });
    const ctl = new Ctl({ position });
    ctl.addTo(map);
    setEl(ctl.getContainer());
    return () => {
      ctl.remove();
      setEl(null);
    };
  }, [map, position]);
  return el;
}

/** Konum izni ister; { latlng, accuracy } ile çözülür, hata kodu ile reddedilir */
export function requestUserLocation() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject({ code: 'unsupported' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latlng: [p.coords.latitude, p.coords.longitude], accuracy: p.coords.accuracy }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}

/** "Konumuma git": izin ister, konuma uçar, onLocate({ latlng, accuracy }) çağırır */
export function LocateControl({ onLocate, zoom = 15, position = 'topleft' }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const map = useMap();
  const el = useControlContainer(position);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const locate = () => {
    if (busy) return;
    setBusy(true);
    requestUserLocation()
      .then((loc) => {
        if (!alive.current) return;
        onLocate?.(loc);
        const z = Math.max(map.getZoom(), zoom);
        if (reducedMotion()) map.setView(loc.latlng, z);
        else map.flyTo(loc.latlng, z, { duration: 0.8 });
      })
      .catch((err) => {
        if (!alive.current) return;
        const key = err?.code === 'unsupported' ? 'locationUnsupported' : err?.code === 1 ? 'locationDenied' : 'locationUnavailable';
        message.warning(t(`common:map.${key}`));
      })
      .finally(() => alive.current && setBusy(false));
  };

  if (!el) return null;
  const label = busy ? t('common:map.locating') : t('common:map.locateMe');
  return createPortal(
    <button type="button" className="mb-map-btn" onClick={locate} title={label} aria-label={label} aria-busy={busy}>
      {busy ? <LoadingOutlined /> : <AimOutlined />}
    </button>,
    el,
  );
}

/** Tam ekran: Fullscreen API varsa onu, yoksa (iPhone) sabit konumlu CSS katmanını kullanır */
export function FullscreenControl({ position = 'topleft', touchGate = false }) {
  const { t } = useTranslation();
  const map = useMap();
  const el = useControlContainer(position);
  const [on, setOn] = useState(false);
  const cssMode = useRef(false);

  const apply = useCallback(
    (next) => {
      const c = map.getContainer();
      setOn(next);
      // Telefonda tam ekranda tek parmakla sürüklemeye izin ver (sayfa kaydırma sorunu yok)
      if (touchGate) next ? map.dragging.enable() : map.dragging.disable();
      c.classList.toggle('mb-map--fs', next);
      window.setTimeout(() => map.invalidateSize(), 60);
    },
    [map, touchGate],
  );

  useEffect(() => {
    const c = map.getContainer();
    const onChange = () => {
      if (cssMode.current) return;
      apply(document.fullscreenElement === c);
    };
    const onKey = (e) => {
      if (e.key === 'Escape' && cssMode.current) {
        cssMode.current = false;
        document.body.classList.remove('mb-map-fs-lock');
        apply(false);
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('mb-map-fs-lock');
    };
  }, [map, apply]);

  const toggle = () => {
    const c = map.getContainer();
    if (on) {
      if (cssMode.current) {
        cssMode.current = false;
        document.body.classList.remove('mb-map-fs-lock');
        apply(false);
      } else if (document.fullscreenElement) {
        document.exitFullscreen?.();
      }
      return;
    }
    const cssFallback = () => {
      if (cssMode.current || document.fullscreenElement === c) return;
      cssMode.current = true;
      document.body.classList.add('mb-map-fs-lock');
      apply(true);
    };
    if (c.requestFullscreen && document.fullscreenEnabled) {
      cssMode.current = false;
      let settled = false;
      c.requestFullscreen()
        .then(() => {
          settled = true;
        })
        .catch(() => {
          settled = true;
          cssFallback();
        });
      // Bazı gömülü görünümlerde istek hiç sonuçlanmıyor: kısa süre sonra CSS katmanına geç
      window.setTimeout(() => !settled && cssFallback(), 800);
    } else {
      cssFallback();
    }
  };

  if (!el) return null;
  const label = on ? t('common:map.exitFullscreen') : t('common:map.fullscreen');
  return createPortal(
    <button type="button" className="mb-map-btn" onClick={toggle} title={label} aria-label={label} aria-pressed={on}>
      {on ? <CompressOutlined /> : <ExpandOutlined />}
    </button>,
    el,
  );
}

/** Dokunmatikte tek parmakla kaydırınca "iki parmak kullan" ipucu gösterir (sürükleme kapalıyken) */
function TouchHint() {
  const { t } = useTranslation();
  const map = useMap();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const c = map.getContainer();
    let timer;
    let startY = null;
    const onStart = (e) => {
      startY = e.touches.length === 1 ? e.touches[0].clientY : null;
      if (e.touches.length > 1) setShow(false);
    };
    const onMove = (e) => {
      if (startY == null || e.touches.length !== 1 || map.dragging.enabled()) return;
      if (Math.abs(e.touches[0].clientY - startY) < 8) return;
      setShow(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setShow(false), 1400);
    };
    c.addEventListener('touchstart', onStart, { passive: true });
    c.addEventListener('touchmove', onMove, { passive: true });
    return () => {
      window.clearTimeout(timer);
      c.removeEventListener('touchstart', onStart);
      c.removeEventListener('touchmove', onMove);
    };
  }, [map]);
  return createPortal(
    <div className={`mb-map-hint${show ? ' is-on' : ''}`} aria-hidden="true">
      <span>{t('common:map.twoFingerHint')}</span>
    </div>,
    map.getContainer(),
  );
}

/**
 * Uygulamanın standart haritası.
 * - Temaya uygun altlık, "Konumuma git" ve (isteğe bağlı) tam ekran düğmesi, ölçek yok.
 * - Telefonda tek parmak sayfayı kaydırır; harita iki parmakla gezilir (tam ekranda tek parmak serbest).
 * - userLocation verilirse ya da kullanıcı düğmeyle konum bulursa mavi nokta çizilir.
 */
export function MbMap({
  center,
  zoom = 13,
  className,
  children,
  userLocation = null, // { latlng: [lat, lng], accuracy? }
  onLocate,
  locate = true,
  fullscreen = true,
  scrollWheelZoom = true,
  ...rest
}) {
  const [touch] = useState(isTouchOnly);
  const [found, setFound] = useState(null);
  const me = found || userLocation;
  const handleLocate = (loc) => {
    setFound(loc);
    onLocate?.(loc);
  };
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className={`mb-map-kit${className ? ` ${className}` : ''}`}
      scrollWheelZoom={scrollWheelZoom}
      dragging={!touch}
      tap={false}
      {...rest}
    >
      <ThemedTileLayer />
      {locate && <LocateControl onLocate={handleLocate} />}
      {fullscreen && <FullscreenControl touchGate={touch} />}
      {touch && <TouchHint />}
      {me?.latlng && <UserLocationMarker position={me.latlng} accuracy={me.accuracy} />}
      {children}
    </MapContainer>
  );
}
