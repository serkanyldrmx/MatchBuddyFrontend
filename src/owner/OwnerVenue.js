import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Alert, App, Card, Col, Form, Input, InputNumber, Popconfirm, Row, Skeleton, Switch, Typography, Upload } from 'antd';
import { CameraOutlined, DeleteOutlined, HomeOutlined, SaveOutlined, StarFilled, StarOutlined, UploadOutlined } from '@ant-design/icons';
import { AMENITIES, ownerApi } from '../api/venues';
import { useOwnerVenue } from '../layout/VenueLayout';
import { EmptyState, PageHeader } from '../ui';
import { apiErrorMessage, fileUrl } from '../utils/format';
import LocationIcon from '../images/Location-fotor-bg-remover-2025030545851.png';
import { WriteButton, notifyOwnerChanged } from './shared';

const { Text } = Typography;

const markerIcon = new L.Icon({ iconUrl: LocationIcon, iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34] });
const DEFAULT_CENTER = [39.0, 35.0];

// Detail.amenities anahtarı → Venue/Update alanı
const AMENITY_FIELD = {
  camera: 'hasCamera',
  cleatRental: 'cleatRental',
  shower: 'hasShower',
  lockerRoom: 'hasLockerRoom',
  parking: 'hasParking',
  cafe: 'hasCafe',
  shuttle: 'hasShuttle',
  bibs: 'providesBibs',
  ball: 'providesBall',
};

const parseLocation = (s) => {
  if (!s) return null;
  const [lat, lon] = String(s).split(',').map((x) => Number(x.trim()));
  return Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null;
};
const formatLocation = (p) => (p ? `${p[0].toFixed(6)}, ${p[1].toFixed(6)}` : '');

function ClickPicker({ onPick, disabled }) {
  useMapEvents({
    click(e) {
      if (!disabled) onPick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

function Recenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, Math.max(map.getZoom(), 15));
    // yalnızca ilk konum yüklendiğinde
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.[0], center?.[1]]);
  return null;
}

/** Tesis bilgileri, olanaklar ve fotoğraflar */
export default function OwnerVenue() {
  const { message } = App.useApp();
  const { venueId, venue, membershipActive } = useOwnerVenue();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [initialCenter, setInitialCenter] = useState(null);
  const [initial, setInitial] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(null);

  const location = Form.useWatch('location', form);
  const cleatOn = Form.useWatch(['amenities', 'cleatRental'], form);
  const cameraOn = Form.useWatch(['amenities', 'camera'], form);
  const position = useMemo(() => parseLocation(location), [location]);

  useEffect(() => {
    if (!venueId) return;
    let alive = true;
    setLoading(true);
    // İşletmenin kendi tesisi: oyunculara görünür olmasa da tüm bilgiler döner
    ownerApi
      .venue(venueId)
      .then((d) => {
        if (!alive) return;
        setHidden(false);
        const am = d.amenities || {};
        setInitial({
          name: d.name,
          description: d.description,
          phone: d.phone,
          address: d.address,
          city: d.city,
          district: d.district,
          location: d.location,
          cancellationPolicy: d.cancellationPolicy,
          amenities: Object.fromEntries(AMENITIES.map((a) => [a.key, Boolean(am[a.key])])),
          cleatRentalPrice: d.prices?.cleatRentalPrice ?? null,
          cameraPrice: d.prices?.cameraPrice ?? null,
        });
        setPhotos(d.photos || []);
        setInitialCenter(parseLocation(d.location));
      })
      .catch(() => {
        if (!alive) return;
        // Tesis henüz görünür değilse herkese açık detay dönmez
        setHidden(true);
        setInitial({ name: venue?.name, amenities: Object.fromEntries(AMENITIES.map((a) => [a.key, false])) });
        setPhotos(venue?.coverPhotoUrl ? [{ photoId: null, url: venue.coverPhotoUrl, isCover: true }] : []);
        setInitialCenter(null);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId]);

  // Tesis değişince formu yeni başlangıç değerlerine sıfırla (aynı form örneği yeniden bağlanıyor)
  useEffect(() => {
    if (!loading) form.resetFields();
  }, [loading, initial, form]);

  const save = async () => {
    let v;
    try {
      v = await form.validateFields();
    } catch {
      message.warning('Lütfen zorunlu alanları doldurun.');
      return;
    }
    const am = v.amenities || {};
    const payload = {
      stadiumId: venueId,
      name: v.name?.trim(),
      description: v.description || null,
      phone: v.phone || null,
      address: v.address?.trim(),
      city: v.city || null,
      district: v.district || null,
      location: v.location,
      cancellationPolicy: v.cancellationPolicy || null,
      cleatRentalPrice: am.cleatRental ? v.cleatRentalPrice ?? null : null,
      cameraPrice: am.camera ? v.cameraPrice ?? null : null,
    };
    Object.entries(AMENITY_FIELD).forEach(([k, field]) => {
      payload[field] = Boolean(am[k]);
    });
    setSaving(true);
    try {
      await ownerApi.updateVenue(payload);
      message.success('Tesis bilgileriniz kaydedildi.');
      notifyOwnerChanged();
    } catch (e) {
      message.error(apiErrorMessage(e, 'Bilgiler kaydedilemedi.'));
    } finally {
      setSaving(false);
    }
  };

  const beforeUpload = (file) => {
    const okType = ['image/jpeg', 'image/png'].includes(file.type);
    if (!okType) {
      message.error('Sadece JPG veya PNG yükleyebilirsiniz.');
      return Upload.LIST_IGNORE;
    }
    if (file.size > 5 * 1024 * 1024) {
      message.error('Fotoğraf en fazla 5 MB olabilir.');
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const upload = async ({ file, onSuccess, onError }) => {
    setUploading(true);
    try {
      const res = await ownerApi.uploadPhoto(venueId, file);
      setPhotos((list) => {
        const real = list.filter((p) => p.photoId != null);
        return [...real, { photoId: res.photoId, url: res.url, isCover: real.length === 0 }];
      });
      message.success('Fotoğraf yüklendi.');
      notifyOwnerChanged();
      onSuccess?.(res);
    } catch (e) {
      message.error(apiErrorMessage(e, 'Fotoğraf yüklenemedi.'));
      onError?.(e);
    } finally {
      setUploading(false);
    }
  };

  const setCover = async (p) => {
    setPhotoBusy(p.photoId);
    try {
      await ownerApi.setCover(p.photoId);
      setPhotos((list) => list.map((x) => ({ ...x, isCover: x.photoId === p.photoId })));
      message.success('Kapak fotoğrafı güncellendi.');
      notifyOwnerChanged();
    } catch (e) {
      message.error(apiErrorMessage(e, 'Kapak güncellenemedi.'));
    } finally {
      setPhotoBusy(null);
    }
  };

  const removePhoto = async (p) => {
    setPhotoBusy(p.photoId);
    try {
      await ownerApi.deletePhoto(p.photoId);
      setPhotos((list) => {
        const rest = list.filter((x) => x.photoId !== p.photoId);
        if (p.isCover && rest.length && !rest.some((x) => x.isCover)) rest[0] = { ...rest[0], isCover: true };
        return rest;
      });
      message.success('Fotoğraf silindi.');
      notifyOwnerChanged();
    } catch (e) {
      message.error(apiErrorMessage(e, 'Fotoğraf silinemedi.'));
    } finally {
      setPhotoBusy(null);
    }
  };

  const realPhotos = photos.filter((p) => p.photoId != null);

  return (
    <>
      <PageHeader
        eyebrow={venue?.name}
        title="Tesis Bilgileri"
        icon={<HomeOutlined />}
        subtitle="Oyuncuların tesis sayfanızda göreceği bilgiler."
        extra={
          <WriteButton type="primary" icon={<SaveOutlined />} onClick={save} loading={saving} disabled={loading || hidden}>
            Kaydet
          </WriteButton>
        }
      />

      {hidden && !loading && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Tesis bilgileri yüklenemedi"
          description="Kayıtlı bilgilerinizin üzerine yazılmaması için kaydetme kapatıldı. Lütfen sayfayı yenileyin; sorun sürerse Match Buddy ile iletişime geçin."
        />
      )}

      {loading ? (
        <Card bordered={false}>
          <Skeleton active paragraph={{ rows: 12 }} />
        </Card>
      ) : (
        <Form key={venueId} form={form} layout="vertical" requiredMark="optional" disabled={!membershipActive} initialValues={initial || undefined}>
          <Row gutter={[16, 16]}>
            <Col xs={24} xl={14}>
              <Card bordered={false} title="Genel">
                <Form.Item name="name" label="Tesis adı" rules={[{ required: true, whitespace: true, message: 'Tesis adı gerekli.' }]}>
                  <Input maxLength={100} />
                </Form.Item>
                <Form.Item name="description" label="Açıklama">
                  <Input.TextArea rows={4} maxLength={1000} showCount placeholder="Tesisinizi oyunculara kısaca tanıtın." />
                </Form.Item>
                <Form.Item name="phone" label="Telefon">
                  <Input maxLength={30} placeholder="0 (5xx) xxx xx xx" />
                </Form.Item>
              </Card>

              <Card bordered={false} title="Olanaklar" style={{ marginTop: 16 }}>
                <div className="mb-owner-amenities">
                  {AMENITIES.map((a) => (
                    <div key={a.key} className="mb-owner-amenity">
                      <span>{a.label}</span>
                      <Form.Item name={['amenities', a.key]} valuePropName="checked" noStyle>
                        <Switch size="small" />
                      </Form.Item>
                    </div>
                  ))}
                </div>
                {(cleatOn || cameraOn) && (
                  <Row gutter={16} style={{ marginTop: 16 }}>
                    {cleatOn && (
                      <Col xs={24} sm={12}>
                        <Form.Item name="cleatRentalPrice" label="Krampon kiralama ücreti (çift)" rules={[{ required: true, message: 'Ücret girin.' }]}>
                          <InputNumber min={0} step={10} addonAfter="₺" style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    )}
                    {cameraOn && (
                      <Col xs={24} sm={12}>
                        <Form.Item name="cameraPrice" label="Maç kaydı ücreti" rules={[{ required: true, message: 'Ücret girin.' }]}>
                          <InputNumber min={0} step={50} addonAfter="₺" style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    )}
                  </Row>
                )}
              </Card>

              <Card bordered={false} title="İptal politikası" style={{ marginTop: 16 }}>
                <Form.Item name="cancellationPolicy" noStyle>
                  <Input.TextArea
                    rows={3}
                    maxLength={500}
                    showCount
                    placeholder="Örn. Maç saatinden 24 saat öncesine kadar ücretsiz iptal edilebilir."
                  />
                </Form.Item>
              </Card>
            </Col>

            <Col xs={24} xl={10}>
              <Card bordered={false} title="Adres ve konum">
                <Form.Item name="address" label="Açık adres" rules={[{ required: true, whitespace: true, message: 'Adres gerekli.' }]}>
                  <Input.TextArea rows={2} maxLength={300} />
                </Form.Item>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item name="city" label="İl">
                      <Input maxLength={60} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="district" label="İlçe">
                      <Input maxLength={60} />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item
                  name="location"
                  label="Harita konumu"
                  extra="Haritada tesisinizin girişine tıklayarak konumu işaretleyin."
                  rules={[
                    { required: true, message: 'Lütfen haritadan konum seçin.' },
                    { validator: (_, v) => (!v || parseLocation(v) ? Promise.resolve() : Promise.reject(new Error('Konum "enlem, boylam" biçiminde olmalı.'))) },
                  ]}
                >
                  <Input placeholder="41.000000, 29.000000" />
                </Form.Item>
                <MapContainer center={initialCenter || DEFAULT_CENTER} zoom={initialCenter ? 15 : 6} className="mb-owner-map">
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  <Recenter center={initialCenter} />
                  <ClickPicker
                    disabled={!membershipActive}
                    onPick={(p) => {
                      form.setFieldsValue({ location: formatLocation(p) });
                      form.validateFields(['location']).catch(() => {});
                    }}
                  />
                  {position && <Marker position={position} icon={markerIcon} />}
                </MapContainer>
              </Card>

              <Card
                bordered={false}
                title="Fotoğraflar"
                style={{ marginTop: 16 }}
                extra={
                  <Upload accept="image/jpeg,image/png" showUploadList={false} beforeUpload={beforeUpload} customRequest={upload} disabled={!membershipActive}>
                    <WriteButton icon={<UploadOutlined />} loading={uploading} size="small" tooltip="JPG veya PNG, en fazla 5 MB">
                      Fotoğraf ekle
                    </WriteButton>
                  </Upload>
                }
              >
                {photos.length === 0 ? (
                  <EmptyState description="Henüz fotoğraf yok. Tesisinizin görünmesi için en az bir fotoğraf ekleyin." />
                ) : (
                  <div className="mb-owner-photos">
                    {photos.map((p, i) => (
                      <div key={p.photoId ?? `c-${i}`} className={`mb-owner-photo${p.isCover ? ' is-cover' : ''}`}>
                        <img src={fileUrl(p.url)} alt="Tesis fotoğrafı" loading="lazy" />
                        {p.isCover && (
                          <span className="mb-owner-photo__badge">
                            <StarFilled /> Kapak
                          </span>
                        )}
                        {p.photoId != null && (
                          <div className="mb-owner-photo__actions">
                            {!p.isCover && (
                              <WriteButton size="small" icon={<StarOutlined />} onClick={() => setCover(p)} loading={photoBusy === p.photoId}>
                                Kapak yap
                              </WriteButton>
                            )}
                            {realPhotos.length > 1 ? (
                              <Popconfirm title="Fotoğraf silinsin mi?" okText="Sil" cancelText="Vazgeç" okButtonProps={{ danger: true }} onConfirm={() => removePhoto(p)}>
                                <WriteButton size="small" danger icon={<DeleteOutlined />} aria-label="Sil" />
                              </Popconfirm>
                            ) : (
                              <WriteButton size="small" danger icon={<DeleteOutlined />} disabled tooltip="Son fotoğraf silinemez; önce yeni bir fotoğraf ekleyin." aria-label="Sil" />
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 10 }}>
                  <CameraOutlined /> İlk yüklenen fotoğraf otomatik olarak kapak olur. Kapak, listede ve tesis sayfasında en önde gösterilir.
                </Text>
              </Card>
            </Col>
          </Row>
        </Form>
      )}
    </>
  );
}
