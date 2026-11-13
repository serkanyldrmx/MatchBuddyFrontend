import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Alert, App, Card, Col, Form, Input, InputNumber, Popconfirm, Row, Switch, Typography, Upload } from 'antd';
import { CameraOutlined, DeleteOutlined, HomeOutlined, PictureOutlined, SaveOutlined, StarFilled, StarOutlined, UploadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { AMENITIES, ownerApi } from '../api/venues';
import { useOwnerVenue } from '../layout/VenueLayout';
import { EmptyState, PageHeader, PageLoader } from '../ui';
import ImageCrop from '../ui/ImageCrop';
import { apiErrorMessage, formErrorMessage, isErrorCode, mediaUrl } from '../utils/format';
import { ACCEPTED_IMAGE_ACCEPT, imageError, preparedImageError, prepareImage } from '../utils/image';
import { usePublicParams } from '../api/parameters';
import { venuePinIcon } from '../ui/map/mapKit';
import { WriteButton, notifyOwnerChanged } from './shared';

const { Text } = Typography;

const markerIcon = venuePinIcon({ active: true });
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
// Sunucu alan hatası (Venue/Update alanı) → form alanı
const FIELD_ALIASES = Object.fromEntries(Object.entries(AMENITY_FIELD).map(([k, field]) => [field, ['amenities', k]]));

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
  const { t } = useTranslation();
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
  const [batch, setBatch] = useState(null); // toplu yükleme ilerlemesi { done, total }
  const rejectedRef = useRef(null); // kırpma öncesi reddedilen dosya
  // Sunucu parametreleri: tesis başına en fazla fotoğraf, yükleme boyutu, en yüksek ücret
  const params = usePublicParams();
  const MAX_PHOTOS = params.get('venue.maxPhotos');
  const maxMb = params.get('media.maxUploadMb');
  const maxPrice = params.get('venue.maxPrice');

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
      message.warning(t('facility:venue.fillRequired'));
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
      message.success(t('facility:venue.saved'));
      notifyOwnerChanged();
    } catch (e) {
      message.error(formErrorMessage(form, e, t('facility:venue.saveFailed'), { aliases: FIELD_ALIASES }));
    } finally {
      setSaving(false);
    }
  };

  // Kırpmadan önce tür/boyut kontrolü; uygun değilse kırpma penceresi açılmaz
  const beforeCrop = (file) => {
    const err = imageError(file);
    if (!err) return true;
    message.error(err);
    rejectedRef.current = file;
    return false;
  };

  // Kırpılmış dosyayı tarayıcıda küçült; dönen dosya customRequest'e gider
  const beforeUpload = async (file) => {
    if (file === rejectedRef.current) {
      rejectedRef.current = null;
      return Upload.LIST_IGNORE;
    }
    const prepared = await prepareImage(file);
    const sizeErr = preparedImageError(prepared);
    if (sizeErr) {
      message.error(sizeErr);
      return Upload.LIST_IGNORE;
    }
    return prepared;
  };

  const upload = async ({ file, onSuccess, onError }) => {
    setUploading(true);
    try {
      const res = await ownerApi.uploadPhoto(venueId, file);
      setPhotos((list) => {
        const real = list.filter((p) => p.photoId != null);
        return [...real, { photoId: res.photoId, url: res.url, isCover: real.length === 0 }];
      });
      message.success(t('facility:venue.photoUploaded'));
      notifyOwnerChanged();
      onSuccess?.(res);
    } catch (e) {
      message.error(apiErrorMessage(e, t('common:image.uploadFailed')));
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
      message.success(t('facility:venue.coverUpdated'));
      notifyOwnerChanged();
    } catch (e) {
      message.error(apiErrorMessage(e, t('facility:venue.coverUpdateFailed')));
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
      message.success(t('facility:venue.photoDeleted'));
      notifyOwnerChanged();
    } catch (e) {
      message.error(apiErrorMessage(e, t('facility:venue.photoDeleteFailed')));
    } finally {
      setPhotoBusy(null);
    }
  };

  const realPhotos = photos.filter((p) => p.photoId != null);

  // Toplu yükleme: antd her dosya için beforeUpload çağırır; listenin son dosyasında hepsini birlikte işle
  const beforeBatch = (file, fileList) => {
    if (fileList[fileList.length - 1]?.uid === file.uid) uploadBatch(fileList);
    return Upload.LIST_IGNORE;
  };

  const uploadBatch = async (files) => {
    const room = MAX_PHOTOS - realPhotos.length;
    if (room <= 0) {
      message.error(t('facility:venue.maxPhotos', { max: MAX_PHOTOS }));
      return;
    }
    const valid = [];
    const failed = [];
    files.forEach((f) => {
      const err = imageError(f);
      if (err) failed.push(`${f.name}: ${err}`);
      else valid.push(f);
    });
    const queue = valid.slice(0, room);
    const skipped = valid.length - queue.length;

    let done = 0;
    let processed = 0;
    setBatch({ done: 0, total: queue.length });
    for (const f of queue) {
      try {
        const prepared = await prepareImage(f);
        const res = await ownerApi.uploadPhoto(venueId, prepared);
        done += 1;
        setPhotos((list) => {
          const real = list.filter((p) => p.photoId != null);
          return [...real, { photoId: res.photoId, url: res.url, isCover: real.length === 0 }];
        });
      } catch (e) {
        failed.push(`${f.name}: ${apiErrorMessage(e, t('facility:venue.uploadFailedShort'))}`);
        // İstek sınırı (429) ya da fotoğraf sınırı aşıldıysa kalanları deneme
        if (isErrorCode(e, 'COMMON_RATE_LIMITED', 'OWNER_PHOTO_LIMIT_REACHED', 'VENUE_PHOTO_LIMIT_EXCEEDED') || e?.response?.status === 429) break;
      }
      processed += 1;
      setBatch({ done: processed, total: queue.length });
    }
    setBatch(null);

    if (done) {
      message.success(t('facility:venue.batchUploaded', { count: done }));
      notifyOwnerChanged();
    }
    if (skipped) message.warning(t('facility:venue.batchSkipped', { count: skipped, max: MAX_PHOTOS }));
    if (failed.length) message.error({ content: failed.slice(0, 4).join(' · ') + (failed.length > 4 ? ` (+${failed.length - 4})` : ''), duration: 6 });
  };

  return (
    <>
      <PageHeader
        eyebrow={venue?.name}
        title={t('facility:venue.title')}
        icon={<HomeOutlined />}
        subtitle={t('facility:venue.subtitle')}
        extra={
          <WriteButton type="primary" icon={<SaveOutlined />} onClick={save} loading={saving} disabled={loading || hidden}>
            {t('common:actions.save')}
          </WriteButton>
        }
      />

      {hidden && !loading && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('facility:venue.loadFailedTitle')}
          description={t('facility:venue.loadFailedDescription')}
        />
      )}

      {loading ? (
        <PageLoader caption={t('facility:venue.loading')} />
      ) : (
        <Form key={venueId} form={form} layout="vertical" requiredMark="optional" disabled={!membershipActive} initialValues={initial || undefined}>
          <Row gutter={[16, 16]}>
            <Col xs={24} xl={14}>
              <Card bordered={false} title={t('facility:venue.general')}>
                <Form.Item
                  name="name"
                  label={t('facility:venue.name')}
                  rules={[{ required: true, whitespace: true, message: t('facility:venue.nameRequired') }]}
                >
                  <Input maxLength={100} />
                </Form.Item>
                <Form.Item name="description" label={t('facility:venue.description')}>
                  <Input.TextArea rows={4} maxLength={1000} showCount placeholder={t('facility:venue.descriptionPlaceholder')} />
                </Form.Item>
                <Form.Item name="phone" label={t('facility:venue.phone')}>
                  <Input maxLength={30} placeholder={t('facility:venue.phonePlaceholder')} />
                </Form.Item>
              </Card>

              <Card bordered={false} title={t('facility:venue.amenities')} style={{ marginTop: 16 }}>
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
                        <Form.Item
                          name="cleatRentalPrice"
                          label={t('facility:venue.cleatRentalPrice')}
                          rules={[{ required: true, message: t('facility:venue.feeRequired') }]}
                        >
                          <InputNumber min={0} max={maxPrice} step={10} addonAfter="₺" style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    )}
                    {cameraOn && (
                      <Col xs={24} sm={12}>
                        <Form.Item
                          name="cameraPrice"
                          label={t('facility:venue.cameraPrice')}
                          rules={[{ required: true, message: t('facility:venue.feeRequired') }]}
                        >
                          <InputNumber min={0} max={maxPrice} step={50} addonAfter="₺" style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    )}
                  </Row>
                )}
              </Card>

              <Card bordered={false} title={t('facility:venue.cancellationPolicy')} style={{ marginTop: 16 }}>
                <Form.Item name="cancellationPolicy" noStyle>
                  <Input.TextArea
                    rows={3}
                    maxLength={500}
                    showCount
                    placeholder={t('facility:venue.cancellationPolicyPlaceholder')}
                  />
                </Form.Item>
              </Card>
            </Col>

            <Col xs={24} xl={10}>
              <Card bordered={false} title={t('facility:venue.addressAndLocation')}>
                <Form.Item
                  name="address"
                  label={t('facility:venue.address')}
                  rules={[{ required: true, whitespace: true, message: t('facility:venue.addressRequired') }]}
                >
                  <Input.TextArea rows={2} maxLength={300} />
                </Form.Item>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item name="city" label={t('facility:venue.city')}>
                      <Input maxLength={60} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="district" label={t('facility:venue.district')}>
                      <Input maxLength={60} />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item
                  name="location"
                  label={t('facility:venue.mapLocation')}
                  extra={t('facility:venue.mapLocationExtra')}
                  rules={[
                    { required: true, message: t('facility:venue.locationRequired') },
                    {
                      validator: (_, v) =>
                        !v || parseLocation(v) ? Promise.resolve() : Promise.reject(new Error(t('facility:venue.locationInvalid'))),
                    },
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
                title={t('facility:venue.photos')}
                style={{ marginTop: 16 }}
                extra={
                  <div className="mb-owner-photo-tools">
                    <Text type="secondary" className="mb-owner-photo-count">
                      {batch
                        ? t('facility:venue.batchProgress', { done: batch.done, total: batch.total })
                        : `${realPhotos.length}/${MAX_PHOTOS}`}
                    </Text>
                    <Upload
                      accept={ACCEPTED_IMAGE_ACCEPT}
                      multiple
                      showUploadList={false}
                      beforeUpload={beforeBatch}
                      disabled={!membershipActive || !!batch || uploading}
                    >
                      <WriteButton
                        icon={<PictureOutlined />}
                        loading={!!batch}
                        size="small"
                        tooltip={t('facility:venue.batchUploadTooltip', { max: MAX_PHOTOS })}
                      >
                        {t('facility:venue.batchUpload')}
                      </WriteButton>
                    </Upload>
                    <ImageCrop variant="venue" beforeCrop={beforeCrop}>
                      <Upload accept={ACCEPTED_IMAGE_ACCEPT} showUploadList={false} beforeUpload={beforeUpload} customRequest={upload} disabled={!membershipActive || !!batch}>
                        <WriteButton
                          icon={<UploadOutlined />}
                          loading={uploading}
                          size="small"
                          tooltip={t('facility:venue.addPhotoTooltip', { maxMb })}
                        >
                          {t('facility:venue.addPhoto')}
                        </WriteButton>
                      </Upload>
                    </ImageCrop>
                  </div>
                }
              >
                {photos.length === 0 ? (
                  <EmptyState description={t('facility:venue.noPhotos')} />
                ) : (
                  <div className="mb-owner-photos">
                    {photos.map((p, i) => (
                      <div key={p.photoId ?? `c-${i}`} className={`mb-owner-photo${p.isCover ? ' is-cover' : ''}`}>
                        <img src={mediaUrl(p.url, 'md')} alt={t('facility:venue.photoAlt')} loading="lazy" decoding="async" />
                        {p.isCover && (
                          <span className="mb-owner-photo__badge">
                            <StarFilled /> {t('facility:venue.cover')}
                          </span>
                        )}
                        {p.photoId != null && (
                          <div className="mb-owner-photo__actions">
                            {!p.isCover && (
                              <WriteButton size="small" icon={<StarOutlined />} onClick={() => setCover(p)} loading={photoBusy === p.photoId}>
                                {t('facility:venue.makeCover')}
                              </WriteButton>
                            )}
                            {realPhotos.length > 1 ? (
                              <Popconfirm
                                title={t('facility:venue.deletePhotoConfirm')}
                                okText={t('common:actions.delete')}
                                cancelText={t('common:actions.cancel')}
                                okButtonProps={{ danger: true }}
                                onConfirm={() => removePhoto(p)}
                              >
                                <WriteButton size="small" danger icon={<DeleteOutlined />} aria-label={t('common:actions.delete')} />
                              </Popconfirm>
                            ) : (
                              <WriteButton
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                disabled
                                tooltip={t('facility:venue.lastPhotoTooltip')}
                                aria-label={t('common:actions.delete')}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 10 }}>
                  <CameraOutlined /> {t('facility:venue.coverHint')}
                </Text>
              </Card>
            </Col>
          </Row>
        </Form>
      )}
    </>
  );
}
