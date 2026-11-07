import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import {
  Alert,
  App,
  AutoComplete,
  Button,
  Card,
  Col,
  Form,
  Grid,
  Input,
  Modal,
  Progress,
  Row,
  Segmented,
  Space,
  Typography,
} from 'antd';
import {
  BorderOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  GlobalOutlined,
  ImportOutlined,
  PhoneOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Trans, useTranslation } from 'react-i18next';
import { adminVenuesApi } from '../api/venues';
import { useThemeMode } from '../theme/ThemeContext';
import { EmptyState, PageHeader } from '../ui';
import { apiErrorMessage } from '../utils/format';
import './OsmCandidates.css';

const { Text } = Typography;
const DEFAULT_CENTER = [39.9334, 32.8597];
const EXPECTED_SECONDS = 25;
const MIN_AREA_ZOOM = 10;

/** Harita sınırlarını ve yakınlaştırma düzeyini dışarı bildirir */
function BoundsTracker({ onChange }) {
  const map = useMapEvents({
    moveend: () => onChange(map.getBounds(), map.getZoom()),
  });
  useEffect(() => {
    onChange(map.getBounds(), map.getZoom());
  }, [map, onChange]);
  return null;
}

/** Sonuçlar gelince haritayı hepsini kapsayacak şekilde ayarlar */
function FitResults({ items, token }) {
  const map = useMap();
  useEffect(() => {
    if (!token || !items.length) return;
    const bounds = L.latLngBounds(items.map((c) => [c.lat, c.lon]));
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    // sadece yeni aramada çalışsın
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, token]);
  return null;
}

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lon], Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [map, target]);
  return null;
}

const websiteHref = (w) => (/^https?:\/\//i.test(w) ? w : `https://${w}`);

/** Admin: OpenStreetMap'ten aday halı saha bulma ve içe aktarma */
export default function OsmCandidates() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const isPhone = Grid.useBreakpoint().md === false;
  const { palette } = useThemeMode();
  const [importForm] = Form.useForm();
  const [provinces, setProvinces] = useState([]);
  const [city, setCity] = useState('');
  const [bounds, setBounds] = useState(null);
  const [zoom, setZoom] = useState(6);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null); // { message, retryable }
  const [results, setResults] = useState(null);
  const [lastQuery, setLastQuery] = useState(null);
  const [fitToken, setFitToken] = useState(0);
  const [filter, setFilter] = useState('new');
  const [selectedId, setSelectedId] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);
  const [importing, setImporting] = useState(null); // aday
  const [saving, setSaving] = useState(false);
  const listRef = useRef(null);
  const mapCardRef = useRef(null);

  useEffect(() => {
    axios
      .get('https://api.turkiyeapi.dev/v1/provinces')
      .then((r) => setProvinces((r.data?.data || []).map((p) => p.name)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!loading) return undefined;
    setElapsed(0);
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [loading]);

  const onBounds = useCallback((b, z) => {
    setBounds(b);
    setZoom(z);
  }, []);

  const run = async (params, label) => {
    setLoading(true);
    setError(null);
    setSelectedId(null);
    setLastQuery({ params, label });
    try {
      const list = await adminVenuesApi.osmCandidates(params);
      const items = (Array.isArray(list) ? list : []).filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon));
      setResults(items);
      setFitToken((n) => n + 1);
      if (items.length && items.every((c) => c.alreadyExists)) setFilter('all');
    } catch (e) {
      const status = e?.response?.status;
      if (status === 502 || status === 504 || e?.code === 'ECONNABORTED') {
        setError({
          message: t('adminVenues:osm.overpassTimeout'),
          retryable: true,
        });
      } else {
        setError({ message: apiErrorMessage(e, t('adminVenues:osm.loadFailed')), retryable: true });
      }
    } finally {
      setLoading(false);
    }
  };

  const searchCity = () => {
    const c = city.trim();
    if (!c) {
      message.warning(t('adminVenues:osm.enterCity'));
      return;
    }
    run({ city: c }, t('adminVenues:osm.inCity', { city: c }));
  };

  const searchArea = () => {
    if (!bounds) return;
    if (zoom < MIN_AREA_ZOOM) {
      message.warning(t('adminVenues:osm.areaTooLarge'));
      return;
    }
    run(
      {
        south: bounds.getSouth().toFixed(6),
        west: bounds.getWest().toFixed(6),
        north: bounds.getNorth().toFixed(6),
        east: bounds.getEast().toFixed(6),
      },
      t('adminVenues:osm.inArea')
    );
  };

  const retry = () => lastQuery && run(lastQuery.params, lastQuery.label);

  const counts = useMemo(() => {
    const all = results || [];
    return { all: all.length, new: all.filter((c) => !c.alreadyExists).length, existing: all.filter((c) => c.alreadyExists).length };
  }, [results]);

  const visible = useMemo(() => {
    const all = results || [];
    if (filter === 'new') return all.filter((c) => !c.alreadyExists);
    if (filter === 'existing') return all.filter((c) => c.alreadyExists);
    return all;
  }, [results, filter]);

  const select = (c, fly) => {
    setSelectedId(c.osmId);
    if (fly) {
      setFlyTarget({ lat: c.lat, lon: c.lon, t: Date.now() });
      // Telefonda harita listenin altında kalır; seçilen sahayı görmek için haritaya kaydır
      if (isPhone) mapCardRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else {
      const el = listRef.current?.querySelector(`[data-osm="${c.osmId}"]`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };

  const openImport = (c) => {
    setImporting(c);
    importForm.setFieldsValue({
      name: c.name || '',
      address: c.address || '',
      city: lastQuery?.params?.city || '',
      district: '',
      phone: c.phone || '',
    });
  };

  const doImport = async () => {
    const v = await importForm.validateFields();
    setSaving(true);
    try {
      const res = await adminVenuesApi.importCandidate({
        osmId: importing.osmId,
        name: v.name.trim(),
        lat: importing.lat,
        lon: importing.lon,
        address: v.address?.trim() || '',
        city: v.city?.trim() || '',
        district: v.district?.trim() || '',
        phone: v.phone?.trim() || '',
      });
      if (res && res.success === false) throw Object.assign(new Error(res.message), { response: { data: res } });
      setResults((list) =>
        (list || []).map((c) => (c.osmId === importing.osmId ? { ...c, alreadyExists: true, imported: true, name: v.name.trim() } : c))
      );
      message.success(t('adminVenues:osm.importSuccess'));
      setImporting(null);
    } catch (e) {
      message.error(apiErrorMessage(e, t('adminVenues:osm.importFailed')));
    } finally {
      setSaving(false);
    }
  };

  // Leaflet işaret renkleri SVG niteliğidir (CSS değişkeni çalışmaz): aktif temanın somut renkleri
  const markerColor = (c) => {
    if (c.osmId === selectedId) return palette.gold;
    return c.alreadyExists ? palette.textSecondary : palette.primary;
  };

  return (
    <>
      <PageHeader
        title={t('adminVenues:osm.title')}
        subtitle={t('adminVenues:osm.subtitle')}
        icon={<GlobalOutlined />}
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={t('adminVenues:osm.attribution')}
        description={t('adminVenues:osm.disclaimer')}
      />

      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Space wrap size={12} className="mb-osm-toolbar" style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space.Compact className="mb-osm-city" style={{ minWidth: 280 }}>
            <AutoComplete
              value={city}
              onChange={setCity}
              options={provinces
                .filter((p) => !city || p.toLocaleLowerCase('tr').includes(city.toLocaleLowerCase('tr')))
                .map((p) => ({ value: p }))}
              style={{ width: 240 }}
              disabled={loading}
            >
              <Input placeholder={t('adminVenues:osm.cityPlaceholder')} prefix={<EnvironmentOutlined />} onPressEnter={searchCity} allowClear />
            </AutoComplete>
            <Button type="primary" icon={<SearchOutlined />} onClick={searchCity} loading={loading && Boolean(lastQuery?.params?.city)}>
              {t('adminVenues:osm.searchCity')}
            </Button>
          </Space.Compact>
          <Space wrap className="mb-osm-area">
            <Text type="secondary" style={{ fontSize: 12 }}>
              {zoom < MIN_AREA_ZOOM ? t('adminVenues:osm.zoomInForArea') : t('adminVenues:osm.visibleAreaSearched')}
            </Text>
            <Button icon={<BorderOutlined />} onClick={searchArea} disabled={!bounds} loading={loading && !lastQuery?.params?.city}>
              {t('adminVenues:osm.searchArea')}
            </Button>
          </Space>
        </Space>
      </Card>

      {error && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('adminVenues:osm.searchFailedTitle')}
          description={error.message}
          action={
            error.retryable && (
              <Button size="small" icon={<ReloadOutlined />} onClick={retry} disabled={loading}>
                {t('common:actions.retry')}
              </Button>
            )
          }
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card
            bordered={false}
            styles={{ body: { padding: 0 } }}
            title={
              results ? t('adminVenues:osm.foundTitle', { label: lastQuery?.label || '', count: counts.all }) : t('adminVenues:osm.results')
            }
          >
            {results && !loading && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--mb-border)' }}>
                <Segmented
                  block
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { label: t('adminVenues:osm.filter.new', { count: counts.new }), value: 'new' },
                    { label: t('adminVenues:osm.filter.existing', { count: counts.existing }), value: 'existing' },
                    { label: t('adminVenues:osm.filter.all', { count: counts.all }), value: 'all' },
                  ]}
                />
              </div>
            )}
            <div className="mb-osm-list" ref={listRef}>
              {loading ? (
                <div className="mb-osm-loading">
                  <Progress
                    type="circle"
                    size={72}
                    percent={Math.min(Math.round((elapsed / EXPECTED_SECONDS) * 100), 99)}
                    format={() => t('adminVenues:osm.seconds', { count: elapsed })}
                    strokeColor={palette.primary}
                  />
                  <div style={{ marginTop: 12 }}>
                    <Text>{t('adminVenues:osm.querying')}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('adminVenues:osm.mayTake', { seconds: EXPECTED_SECONDS })}
                      {elapsed > EXPECTED_SECONDS ? t('adminVenues:osm.almostDone') : ''}
                    </Text>
                  </div>
                </div>
              ) : !results ? (
                <EmptyState description={t('adminVenues:osm.emptyInitial')} />
              ) : visible.length === 0 ? (
                <EmptyState description={filter === 'new' ? t('adminVenues:osm.noNewCandidates') : t('adminVenues:osm.noResults')} />
              ) : (
                visible.map((c) => (
                  <div
                    key={c.osmId}
                    data-osm={c.osmId}
                    className={`mb-osm-item${c.osmId === selectedId ? ' is-active' : ''}`}
                    onClick={() => select(c, true)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && select(c, true)}
                  >
                    <div className="mb-osm-item__head">
                      <Space direction="vertical" size={4}>
                        <span className={`mb-osm-item__title${c.name ? '' : ' is-unnamed'}`}>{c.name || t('adminVenues:osm.unnamed')}</span>
                        {c.alreadyExists && (
                          <span className={`mb-chip ${c.imported ? 'is-approved' : 'is-done'}`}>
                            {c.imported ? t('adminVenues:osm.imported') : t('adminVenues:osm.alreadyExists')}
                          </span>
                        )}
                      </Space>
                      {!c.alreadyExists && (
                        <Button
                          size="small"
                          type="primary"
                          icon={<ImportOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            openImport(c);
                          }}
                        >
                          {t('adminVenues:osm.import')}
                        </Button>
                      )}
                    </div>
                    <div className="mb-osm-item__meta">
                      {c.address && (
                        <span>
                          <EnvironmentOutlined /> {c.address}
                        </span>
                      )}
                      {c.phone && (
                        <span>
                          <PhoneOutlined /> {c.phone}
                        </span>
                      )}
                      {c.website && (
                        <span>
                          <GlobalOutlined />{' '}
                          <a href={websiteHref(c.website)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                            {c.website}
                          </a>
                        </span>
                      )}
                      {c.openingHours && (
                        <span>
                          <ClockCircleOutlined /> {c.openingHours}
                        </span>
                      )}
                      {!c.address && !c.phone && !c.website && (
                        <span>
                          {c.lat.toFixed(5)}, {c.lon.toFixed(5)}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card bordered={false} styles={{ body: { padding: 8 } }} ref={mapCardRef}>
            <MapContainer center={DEFAULT_CENTER} zoom={6} className="mb-osm-map">
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <BoundsTracker onChange={onBounds} />
              <FitResults items={results || []} token={fitToken} />
              <FlyTo target={flyTarget} />
              {visible.map((c) => (
                <CircleMarker
                  key={c.osmId}
                  center={[c.lat, c.lon]}
                  radius={c.osmId === selectedId ? 10 : 7}
                  pathOptions={{ color: markerColor(c), fillColor: markerColor(c), fillOpacity: 0.7, weight: 2 }}
                  eventHandlers={{ click: () => select(c, false) }}
                >
                  <Popup>
                    <strong>{c.name || t('adminVenues:osm.unnamed')}</strong>
                    {c.address && (
                      <>
                        <br />
                        {c.address}
                      </>
                    )}
                    {c.alreadyExists && (
                      <>
                        <br />
                        <em>{t('adminVenues:osm.alreadyExists')}</em>
                      </>
                    )}
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </Card>
        </Col>
      </Row>

      <Modal
        open={Boolean(importing)}
        title={t('adminVenues:osm.importModal.title')}
        okText={t('adminVenues:osm.import')}
        cancelText={t('common:actions.cancel')}
        confirmLoading={saving}
        onOk={doImport}
        onCancel={() => setImporting(null)}
        destroyOnClose
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('adminVenues:osm.importModal.warning')}
          description={
            <Trans i18nKey="adminVenues:osm.importModal.assignHint" components={{ link: <Link to="/adminPanel/businesses" /> }} />
          }
        />
        <Form form={importForm} layout="vertical" requiredMark="optional" preserve={false}>
          <Form.Item
            name="name"
            label={t('adminVenues:osm.importModal.name')}
            rules={[{ required: true, whitespace: true, message: t('adminVenues:osm.importModal.nameRequired') }]}
          >
            <Input maxLength={100} placeholder={t('adminVenues:osm.importModal.namePlaceholder')} />
          </Form.Item>
          <Form.Item name="address" label={t('adminVenues:osm.importModal.address')}>
            <Input.TextArea rows={2} maxLength={250} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="city" label={t('adminVenues:osm.importModal.city')}>
                <AutoComplete options={provinces.map((p) => ({ value: p }))} filterOption={(input, o) => o.value.toLocaleLowerCase('tr').includes(input.toLocaleLowerCase('tr'))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="district" label={t('adminVenues:osm.importModal.district')}>
                <Input maxLength={60} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="phone" label={t('adminVenues:osm.importModal.phone')}>
            <Input maxLength={30} />
          </Form.Item>
          {importing && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('adminVenues:osm.importModal.location', {
                lat: importing.lat.toFixed(6),
                lon: importing.lon.toFixed(6),
                osmId: importing.osmId,
              })}
            </Text>
          )}
        </Form>
      </Modal>
    </>
  );
}
