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
import { adminVenuesApi } from '../api/venues';
import { colors } from '../theme/theme';
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
  const { message } = App.useApp();
  const isPhone = Grid.useBreakpoint().md === false;
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
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
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
      setFitToken((t) => t + 1);
      if (items.length && items.every((c) => c.alreadyExists)) setFilter('all');
    } catch (e) {
      const status = e?.response?.status;
      if (status === 502 || status === 504 || e?.code === 'ECONNABORTED') {
        setError({
          message:
            'OpenStreetMap (Overpass) servisi şu anda yanıt vermedi ya da sorgu zaman aşımına uğradı. Birkaç saniye sonra tekrar deneyin veya daha küçük bir alan seçin.',
          retryable: true,
        });
      } else {
        setError({ message: apiErrorMessage(e, 'Aday tesisler alınamadı.'), retryable: true });
      }
    } finally {
      setLoading(false);
    }
  };

  const searchCity = () => {
    const c = city.trim();
    if (!c) {
      message.warning('Bir şehir yazın veya seçin.');
      return;
    }
    run({ city: c }, `${c} şehrinde`);
  };

  const searchArea = () => {
    if (!bounds) return;
    if (zoom < MIN_AREA_ZOOM) {
      message.warning('Alan çok büyük. Lütfen haritayı biraz yakınlaştırın (ilçe ölçeği).');
      return;
    }
    run(
      {
        south: bounds.getSouth().toFixed(6),
        west: bounds.getWest().toFixed(6),
        north: bounds.getNorth().toFixed(6),
        east: bounds.getEast().toFixed(6),
      },
      'Haritadaki alanda'
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
      message.success('Tesis içe aktarıldı. Bir işletme atanana kadar oyunculara görünmez.');
      setImporting(null);
    } catch (e) {
      message.error(apiErrorMessage(e, 'Tesis içe aktarılamadı.'));
    } finally {
      setSaving(false);
    }
  };

  const markerColor = (c) => {
    if (c.osmId === selectedId) return colors.gold;
    return c.alreadyExists ? colors.textSecondary : colors.primary;
  };

  return (
    <>
      <PageHeader
        title="Aday Tesis Bul"
        subtitle="OpenStreetMap'teki halı sahaları bulun, satış adayı olarak içe aktarın"
        icon={<GlobalOutlined />}
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Veriler © OpenStreetMap katkıcılarına aittir."
        description="Kayıtların kalitesi değişkendir: isim, adres veya telefon eksik ya da eski olabilir. Bu listeyi doğrudan yayın için değil, satış ekibi için aday (lead) listesi olarak kullanın. İçe aktarılan tesisler, bir işletme atanıp fotoğraf ve saha eklenene kadar oyunculara görünmez."
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
              <Input placeholder="Şehir (örn. İzmir)" prefix={<EnvironmentOutlined />} onPressEnter={searchCity} allowClear />
            </AutoComplete>
            <Button type="primary" icon={<SearchOutlined />} onClick={searchCity} loading={loading && Boolean(lastQuery?.params?.city)}>
              Şehirde ara
            </Button>
          </Space.Compact>
          <Space wrap className="mb-osm-area">
            <Text type="secondary" style={{ fontSize: 12 }}>
              {zoom < MIN_AREA_ZOOM ? 'Alan araması için haritayı yakınlaştırın' : 'Haritadaki görünür alan aranır'}
            </Text>
            <Button icon={<BorderOutlined />} onClick={searchArea} disabled={!bounds} loading={loading && !lastQuery?.params?.city}>
              Haritadaki alanı ara
            </Button>
          </Space>
        </Space>
      </Card>

      {error && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Arama tamamlanamadı"
          description={error.message}
          action={
            error.retryable && (
              <Button size="small" icon={<ReloadOutlined />} onClick={retry} disabled={loading}>
                Tekrar dene
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
            title={results ? `${lastQuery?.label || ''} ${counts.all} saha bulundu` : 'Sonuçlar'}
          >
            {results && !loading && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--mb-border)' }}>
                <Segmented
                  block
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { label: `Yeni (${counts.new})`, value: 'new' },
                    { label: `Sistemde (${counts.existing})`, value: 'existing' },
                    { label: `Tümü (${counts.all})`, value: 'all' },
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
                    format={() => `${elapsed} sn`}
                    strokeColor={colors.primary}
                  />
                  <div style={{ marginTop: 12 }}>
                    <Text>OpenStreetMap sorgulanıyor…</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Bu işlem {EXPECTED_SECONDS} saniyeye kadar sürebilir.
                      {elapsed > EXPECTED_SECONDS ? ' Neredeyse bitti, lütfen bekleyin.' : ''}
                    </Text>
                  </div>
                </div>
              ) : !results ? (
                <EmptyState description="Bir şehir arayın veya haritada bir alan seçip “Haritadaki alanı ara”ya tıklayın" />
              ) : visible.length === 0 ? (
                <EmptyState description={filter === 'new' ? 'Sistemde olmayan aday bulunamadı' : 'Sonuç yok'} />
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
                        <span className={`mb-osm-item__title${c.name ? '' : ' is-unnamed'}`}>{c.name || 'İsimsiz saha'}</span>
                        {c.alreadyExists && (
                          <span className={`mb-chip ${c.imported ? 'is-approved' : 'is-done'}`}>
                            {c.imported ? 'İçe aktarıldı' : 'Zaten sistemde'}
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
                          İçe aktar
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
                    <strong>{c.name || 'İsimsiz saha'}</strong>
                    {c.address && (
                      <>
                        <br />
                        {c.address}
                      </>
                    )}
                    {c.alreadyExists && (
                      <>
                        <br />
                        <em>Zaten sistemde</em>
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
        title="Aday tesisi içe aktar"
        okText="İçe aktar"
        cancelText="Vazgeç"
        confirmLoading={saving}
        onOk={doImport}
        onCancel={() => setImporting(null)}
        destroyOnClose
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="İçe aktarılan tesis, bir işletme atanana kadar oyunculara görünmez."
          description={
            <>
              Tesisi bir işletmeye bağlamak için <Link to="/adminPanel/businesses">İşletmeler</Link> ekranındaki “Tesis bağla”
              işlemini kullanın.
            </>
          }
        />
        <Form form={importForm} layout="vertical" requiredMark="optional" preserve={false}>
          <Form.Item name="name" label="Tesis adı" rules={[{ required: true, whitespace: true, message: 'Tesis adını girin' }]}>
            <Input maxLength={100} placeholder="Örn. Yıldız Halı Saha" />
          </Form.Item>
          <Form.Item name="address" label="Adres">
            <Input.TextArea rows={2} maxLength={250} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="city" label="İl">
                <AutoComplete options={provinces.map((p) => ({ value: p }))} filterOption={(input, o) => o.value.toLocaleLowerCase('tr').includes(input.toLocaleLowerCase('tr'))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="district" label="İlçe">
                <Input maxLength={60} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="phone" label="Telefon">
            <Input maxLength={30} />
          </Form.Item>
          {importing && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Konum: {importing.lat.toFixed(6)}, {importing.lon.toFixed(6)} · OSM #{importing.osmId}
            </Text>
          )}
        </Form>
      </Modal>
    </>
  );
}
