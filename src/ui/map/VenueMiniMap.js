import React, { useEffect, useMemo, useState } from 'react';
import { Marker, useMap } from 'react-leaflet';
import { Button } from 'antd';
import { CompassOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { appleDirectionsUrl, googleDirectionsUrl, isIOS, MbMap, requestUserLocation, venuePinIcon } from './mapKit';

/** "lat, lng" metni ya da [lat, lng] dizisi → [lat, lng] | null */
const toCoords = (loc) => {
  if (!loc) return null;
  const parts = (Array.isArray(loc) ? loc : String(loc).split(',')).map((x) => parseFloat(String(x).trim()));
  return parts.length === 2 && parts.every((n) => Number.isFinite(n)) ? parts : null;
};

/** Kullanıcı yakındaysa (≈30 km) saha ile birlikte görünecek şekilde çerçevele */
function FitWithUser({ venue, user }) {
  const map = useMap();
  useEffect(() => {
    if (!user) return;
    if (map.distance(venue, user) > 30000) return;
    map.fitBounds([venue, user], { padding: [36, 36], maxZoom: 15 });
  }, [map, venue, user]);
  return null;
}

/**
 * Maç detayı "Saha bilgisi" sekmesindeki küçük harita.
 * Koordinat yoksa hiçbir şey çizmez. Konum izni daha önce verildiyse kullanıcının noktası da görünür
 * (izin istemi açılmaz; kullanıcı isterse "Konumuma git" düğmesine basar).
 */
export default function VenueMiniMap({ location, name, height = 220 }) {
  const { t } = useTranslation();
  const coords = useMemo(() => toCoords(location), [location]);
  const [me, setMe] = useState(null);
  const key = coords ? coords.join(',') : '';

  useEffect(() => {
    if (!coords || !navigator.permissions?.query) return undefined;
    let alive = true;
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (alive && status.state === 'granted') return requestUserLocation().then((loc) => alive && setMe(loc));
        return null;
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!coords) return null;
  return (
    <div className="mb-minimap">
      <MbMap
        key={key}
        center={coords}
        zoom={15}
        className="mb-minimap__map"
        style={{ height }}
        scrollWheelZoom={false}
        fullscreen={false}
        userLocation={me}
      >
        <Marker position={coords} icon={venuePinIcon({ active: true })} title={name || t('common:map.venueLocation')} keyboard={false} />
        {me?.latlng && <FitWithUser venue={coords} user={me.latlng} />}
      </MbMap>
      <div className="mb-minimap__actions">
        <Button type="primary" icon={<CompassOutlined />} href={googleDirectionsUrl(coords)} target="_blank" rel="noopener noreferrer">
          {t('common:map.directionsGoogle')}
        </Button>
        {isIOS() && (
          <Button href={appleDirectionsUrl(coords)} target="_blank" rel="noopener noreferrer">
            {t('common:map.appleMaps')}
          </Button>
        )}
      </div>
    </div>
  );
}
