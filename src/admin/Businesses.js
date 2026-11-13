import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import dayjs from 'dayjs';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Form,
  Grid,
  Input,
  Modal,
  Popconfirm,
  Result,
  Row,
  Select,
  Space,
  Statistic,
  Steps,
  Switch,
  Table,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import {
  AimOutlined,
  CalendarOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  InboxOutlined,
  LinkOutlined,
  PauseCircleOutlined,
  PictureOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShopOutlined,
  StarOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { api } from '../api/config';
import { adminVenuesApi } from '../api/venues';
import i18n from '../i18n';
import { colors } from '../theme/theme';
import { EmptyState, PageHeader } from '../ui';
import { apiErrorMessage, applyFieldErrors, errorCode, fieldErrorsOf, formErrorMessage, formatDate } from '../utils/format';
import { ACCEPTED_IMAGE_ACCEPT, ACCEPTED_IMAGE_TYPES, prepareImage } from '../utils/image';
import { usePublicParams } from '../api/parameters';
import { venuePinIcon } from '../ui/map/mapKit';
import './AdminResponsive.css';
import './Businesses.css';
import OwnerDetailModal from './OwnerDetailModal';
import { useScrollTopOn } from '../utils/scrollTop';

const { Text } = Typography;
const DEFAULT_CENTER = [39.9334, 32.8597]; // Ankara

const pinIcon = venuePinIcon({ active: true });

/* ---------------- Yardımcılar ---------------- */

/** Güçlü rastgele şifre: büyük/küçük harf, rakam ve sembol içerir */
export function generatePassword(length = 14) {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%&*?'];
  const all = sets.join('');
  const rnd = (n) => {
    const a = new Uint32Array(1);
    window.crypto.getRandomValues(a);
    return a[0] % n;
  };
  const chars = sets.map((s) => s[rnd(s.length)]);
  while (chars.length < length) chars.push(all[rnd(all.length)]);
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = rnd(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** "lat, lon" → [lat, lon] | null */
function parseLocation(location) {
  if (typeof location !== 'string') return null;
  const parts = location.split(',').map((c) => parseFloat(c.trim()));
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null;
  if (Math.abs(parts[0]) > 90 || Math.abs(parts[1]) > 180) return null;
  return parts;
}

const formatCoords = (pos) => `${Number(pos[0]).toFixed(6)}, ${Number(pos[1]).toFixed(6)}`;

/** Sunucu hata mesajı: standart mesaj + forma bağlanmayan alan hataları (errors sözlüğü) */
function serverError(e, fallback) {
  return formErrorMessage(null, e, fallback);
}

/** Üyelik durumu */
export function membershipInfo(o) {
  if (o.membershipSuspended) return { key: 'suspended', label: i18n.t('adminVenues:businesses.membership.suspended'), cls: 'is-rejected' };
  if (o.membershipUntil) {
    const until = dayjs(o.membershipUntil);
    if (until.isBefore(dayjs())) return { key: 'expired', label: i18n.t('adminVenues:businesses.membership.expired'), cls: 'is-done' };
    const days = Math.ceil(until.diff(dayjs(), 'day', true));
    if (days < 30) return { key: 'soon', label: i18n.t('adminVenues:businesses.membership.daysLeft', { count: days }), cls: 'is-pending' };
  }
  return { key: 'active', label: i18n.t('adminVenues:businesses.membership.active'), cls: 'is-approved' };
}

const ownerName = (o) => o.owner?.name || o.owner?.playerName || o.owner?.userName || i18n.t('adminVenues:businesses.ownerFallback');
const ownerContact = (o) => o.owner?.contactName || o.owner?.playerSurname || null;

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    message.success(i18n.t('adminVenues:businesses.copied'));
  } catch {
    message.error(i18n.t('adminVenues:businesses.copyFailed'));
  }
}

/** turkiyeapi.dev il listesi (ilçeleriyle) */
function useProvinces() {
  const [provinces, setProvinces] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    axios
      .get('https://api.turkiyeapi.dev/v1/provinces')
      .then((r) => !cancelled && setProvinces(r.data?.data || []))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);
  return { provinces, loading };
}

/* ---------------- Harita parçaları ---------------- */

function FlyTo({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom, { duration: 0.8 });
  }, [map, center, zoom]);
  return null;
}

/** Modal içinde açılan harita boyutunu düzeltir */
function FixSize() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

function ClickPicker({ onPick }) {
  useMapEvents({
    click(e) {
      onPick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

/* ---------------- Yeni işletme sihirbazı ---------------- */

const STEP_FIELDS = [
  ['bizName', 'contactName', 'userName', 'email', 'phoneNumber', 'password', 'membershipUntil'],
  ['venueName', 'city', 'district', 'address', 'venuePhone', 'description', 'location'],
  [],
  [],
];
const REQUIRED_FIELDS = ['bizName', 'contactName', 'userName', 'email', 'phoneNumber', 'password', 'venueName', 'city', 'district', 'address', 'location'];

// Sunucu alan adları (CreateOwner model: owner.* / venue.*) → sihirbaz form alanları
const CREATE_OWNER_FIELD_ALIASES = {
  'owner.name': 'bizName',
  'owner.contactName': 'contactName',
  'owner.userName': 'userName',
  'owner.email': 'email',
  'owner.phoneNumber': 'phoneNumber',
  'owner.password': 'password',
  'owner.membershipUntil': 'membershipUntil',
  'venue.name': 'venueName',
  'venue.city': 'city',
  'venue.district': 'district',
  'venue.address': 'address',
  'venue.location': 'location',
  'venue.phone': 'venuePhone',
  'venue.description': 'description',
};

// Hata kodu → sihirbaz adımı (0 hesap, 1 tesis, 2 fotoğraflar)
const STEP_BY_CODE = {
  ADMIN_USERNAME_TAKEN: 0,
  ADMIN_CREATE_OWNER_FAILED: 0,
  VENUE_USERNAME_TAKEN: 0,
  AUTH_USERNAME_TAKEN: 0,
  AUTH_USERNAME_REQUIRED: 0,
  AUTH_PASSWORD_REQUIRED: 0,
  AUTH_PASSWORD_TOO_SHORT: 0,
  VENUE_OWNER_INFO_REQUIRED: 0,
  VALIDATION_INVALID_EMAIL: 0,
  VENUE_INFO_REQUIRED: 1,
  VENUE_INFO_EMPTY: 1,
  VENUE_ADDRESS_EMPTY: 1,
  VENUE_INVALID_LOCATION: 1,
  VENUE_INVALID_LOCATION_FORMAT: 1,
  VENUE_LOCATION_REQUIRED: 1,
  VENUE_PHOTO_REQUIRED: 2,
  VENUE_PHOTO_LIMIT_EXCEEDED: 2,
  ADMIN_PHOTO_UPLOAD_FAILED: 2,
};

/** Hatanın ilgili olduğu sihirbaz adımı: önce hata kodu, sonra alan hataları (errors sözlüğü) */
function stepForError(e, appliedFields) {
  const code = errorCode(e);
  if (code && STEP_BY_CODE[code] != null) return STEP_BY_CODE[code];
  if (code && /^(MEDIA_|OWNER_PHOTO_)/.test(code)) return 2;
  const steps = (appliedFields || [])
    .map((name) => STEP_FIELDS.findIndex((fields) => fields.includes(Array.isArray(name) ? name[0] : name)))
    .filter((i) => i >= 0);
  if (steps.length) return Math.min(...steps);
  const keys = Object.keys(fieldErrorsOf(e) || {}).map((k) => k.toLowerCase());
  if (keys.some((k) => k.startsWith('photo'))) return 2;
  if (keys.some((k) => k.startsWith('venue.'))) return 1;
  if (keys.some((k) => k.startsWith('owner.'))) return 0;
  return null;
}

function NewBusinessWizard({ open, onClose, onCreated }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const isPhone = Grid.useBreakpoint().md === false;
  const [form] = Form.useForm();
  // Fotoğraf sınırları: yükleme boyutu herkese açık parametreden; adet (venue.createOwnerMaxPhotos) herkese açık değil → katalog varsayılanı
  const params = usePublicParams();
  const MAX_PHOTO_MB = params.get('media.maxUploadMb');
  const MAX_PHOTOS = params.get('venue.createOwnerMaxPhotos');
  const [step, setStep] = useState(0);
  useScrollTopOn(step); // adım değişince sayfanın başına
  const [photos, setPhotos] = useState([]); // { uid, file, url }
  const [photoError, setPhotoError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);
  const [view, setView] = useState({ center: null, zoom: 6 });
  const [searching, setSearching] = useState(false);
  const { provinces, loading: provincesLoading } = useProvinces();
  const city = Form.useWatch('city', form);
  const location = Form.useWatch('location', form);
  const position = parseLocation(location);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  // Önizleme adreslerini serbest bırak
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const reset = useCallback(() => {
    photosRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    photosRef.current = [];
    setPhotos([]);
    setStep(0);
    setError(null);
    setCreated(null);
    setPhotoError(null);
    setView({ center: null, zoom: 6 });
    form.resetFields();
  }, [form]);

  const close = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const districts = provinces.find((p) => p.name === city)?.districts || [];

  const pickPosition = (pos) => {
    form.setFieldValue('location', formatCoords(pos));
    form.validateFields(['location']).catch(() => {});
  };

  const geocode = async (query) => {
    const q = (query || '').trim();
    if (!q) return;
    setSearching(true);
    try {
      const r = await axios.get('https://nominatim.openstreetmap.org/search', { params: { format: 'json', q } });
      if (r.data?.length > 0) {
        const pos = [parseFloat(r.data[0].lat), parseFloat(r.data[0].lon)];
        pickPosition(pos);
        setView({ center: pos, zoom: 16 });
      } else {
        message.warning(t('adminVenues:businesses.wizard.messages.locationNotFound'));
      }
    } catch {
      message.error(t('adminVenues:businesses.wizard.messages.locationSearchFailed'));
    } finally {
      setSearching(false);
    }
  };

  const geocodeAddress = () => {
    const { address, district, city: c } = form.getFieldsValue(['address', 'district', 'city']);
    if (!address?.trim()) {
      message.warning(t('adminVenues:businesses.wizard.messages.enterAddressFirst'));
      return;
    }
    geocode([address, district, c, 'Türkiye'].filter(Boolean).join(', '));
  };

  /* Fotoğraflar */
  const beforeUpload = (file) => {
    const okType = ACCEPTED_IMAGE_TYPES.includes(file.type);
    if (!okType) {
      message.error(t('adminVenues:businesses.wizard.messages.photoInvalidType', { name: file.name }));
      return false;
    }
    if (file.size / 1024 / 1024 > MAX_PHOTO_MB) {
      message.error(t('adminVenues:businesses.wizard.messages.photoTooLarge', { name: file.name, maxMb: MAX_PHOTO_MB }));
      return false;
    }
    // Çoklu seçimde beforeUpload art arda çağrılır; güncel listeyi ref üzerinden tut
    if (photosRef.current.length >= MAX_PHOTOS) {
      message.warning(t('adminVenues:businesses.wizard.messages.photoLimit', { max: MAX_PHOTOS, name: file.name }));
      return false;
    }
    const nextList = [...photosRef.current, { uid: file.uid, file, url: URL.createObjectURL(file) }];
    photosRef.current = nextList;
    setPhotos(nextList);
    setPhotoError(null);
    return false;
  };

  const updatePhotos = (nextList) => {
    photosRef.current = nextList;
    setPhotos(nextList);
  };

  const removePhoto = (uid) => {
    const p = photosRef.current.find((x) => x.uid === uid);
    if (p) URL.revokeObjectURL(p.url);
    updatePhotos(photosRef.current.filter((x) => x.uid !== uid));
  };

  const makeCover = (uid) => {
    const p = photosRef.current.find((x) => x.uid === uid);
    if (p) updatePhotos([p, ...photosRef.current.filter((x) => x.uid !== uid)]);
  };

  /* Adımlar */
  const next = async () => {
    setError(null);
    if (step === 2) {
      if (photos.length < 1) {
        setPhotoError(t('adminVenues:businesses.wizard.messages.photoRequired'));
        return;
      }
      setStep(3);
      return;
    }
    try {
      await form.validateFields(STEP_FIELDS[step]);
      setStep(step + 1);
    } catch {
      // alan hataları formda gösterilir
    }
  };

  const submit = async () => {
    const v = form.getFieldsValue(true);
    const missing = [0, 1].find((i) => STEP_FIELDS[i].some((f) => REQUIRED_FIELDS.includes(f) && !v[f]));
    if (missing != null) {
      setStep(missing);
      return;
    }
    if (photos.length < 1) {
      setStep(2);
      setPhotoError(t('adminVenues:businesses.wizard.messages.photoRequired'));
      return;
    }
    const model = {
      owner: {
        name: v.bizName.trim(),
        contactName: v.contactName?.trim() || '',
        userName: v.userName.trim(),
        email: v.email.trim(),
        phoneNumber: v.phoneNumber?.trim() || '',
        password: v.password,
        membershipUntil: v.membershipUntil ? v.membershipUntil.endOf('day').format('YYYY-MM-DDTHH:mm:ss') : null,
      },
      venue: {
        name: v.venueName.trim(),
        city: v.city,
        district: v.district,
        address: v.address.trim(),
        location: v.location,
        phone: v.venuePhone?.trim() || '',
        description: v.description?.trim() || '',
      },
    };
    setSubmitting(true);
    setError(null);
    try {
      // Kırpma yok; sadece tarayıcıda küçült (başarısız olursa orijinal gönderilir)
      const files = await Promise.all(photos.map((p) => prepareImage(p.file)));
      const res = await adminVenuesApi.createOwner(model, files);
      if (res && res.success === false) throw Object.assign(new Error(res.message), { response: { data: res } });
      setCreated({ name: model.owner.name, userName: model.owner.userName, password: model.owner.password, email: model.owner.email });
      message.success(t('adminVenues:businesses.wizard.messages.created'));
      onCreated?.();
    } catch (e) {
      // Alan hataları ilgili form alanlarının altında; eşleşmeyenler genel mesajda gösterilir
      const { applied, unmatched } = applyFieldErrors(form, e, { aliases: CREATE_OWNER_FIELD_ALIASES, scroll: false });
      const base = apiErrorMessage(e, t('adminVenues:businesses.wizard.messages.createFailed'));
      setError([base, ...unmatched.filter((m) => m !== base)].join(' '));
      const target = stepForError(e, applied);
      if (target != null) setStep(target);
    } finally {
      setSubmitting(false);
    }
  };

  const loginUrl = `${window.location.origin}/`;
  const credentialsText = created
    ? t('adminVenues:businesses.wizard.credentialsText', { url: loginUrl, userName: created.userName, password: created.password })
    : '';

  const footer = created
    ? [
        <Button key="copy" icon={<CopyOutlined />} onClick={() => copyText(credentialsText, message)}>
          {t('adminVenues:businesses.wizard.copyAll')}
        </Button>,
        <Button key="close" type="primary" onClick={close}>
          {t('common:actions.close')}
        </Button>,
      ]
    : [
        <Button key="cancel" onClick={close} disabled={submitting}>
          {t('common:actions.cancel')}
        </Button>,
        step > 0 && (
          <Button key="back" onClick={() => setStep(step - 1)} disabled={submitting}>
            {t('common:actions.back')}
          </Button>
        ),
        step < 3 ? (
          <Button key="next" type="primary" onClick={next}>
            {t('adminVenues:businesses.wizard.next')}
          </Button>
        ) : (
          <Button key="submit" type="primary" icon={<ThunderboltOutlined />} loading={submitting} onClick={submit}>
            {t('adminVenues:businesses.wizard.create')}
          </Button>
        ),
      ].filter(Boolean);

  // Form yalnızca sihirbaz açıkken bağlıdır
  const values = open && !created && step === 3 ? form.getFieldsValue(true) : {};

  return (
    <Modal
      open={open}
      onCancel={close}
      width={920}
      title={
        <Space>
          <ShopOutlined /> {t('adminVenues:businesses.wizard.title')}
        </Space>
      }
      footer={footer}
      maskClosable={false}
      className="mb-biz-wizard"
      destroyOnClose
    >
      {created ? (
        <Result
          status="success"
          title={t('adminVenues:businesses.wizard.result.title', { name: created.name })}
          subTitle={t('adminVenues:businesses.wizard.result.subTitle')}
          extra={
            <div className="mb-biz-credentials">
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label={t('adminVenues:businesses.wizard.result.loginUrl')}>
                  <Text copyable={{ text: loginUrl }}>{loginUrl}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={t('adminVenues:businesses.wizard.result.userName')}>
                  <Text copyable>{created.userName}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={t('adminVenues:businesses.wizard.result.tempPassword')}>
                  <Text copyable>{created.password}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={t('adminVenues:businesses.wizard.result.email')}>{created.email}</Descriptions.Item>
              </Descriptions>
            </div>
          }
        />
      ) : (
        <>
          <Steps
            current={step}
            size="small"
            responsive={false}
            items={[
              { title: t('adminVenues:businesses.wizard.steps.account') },
              { title: t('adminVenues:businesses.wizard.steps.venue') },
              { title: t('adminVenues:businesses.wizard.steps.photos') },
              { title: t('adminVenues:businesses.wizard.steps.summary') },
            ]}
          />
          {error && (
            <Alert type="error" showIcon closable onClose={() => setError(null)} message={error} style={{ marginBottom: 16 }} />
          )}
          <Form
            form={form}
            layout="vertical"
            requiredMark="optional"
            preserve
            initialValues={{ membershipUntil: dayjs().add(1, 'year') }}
            onValuesChange={(changed) => {
              if ('city' in changed) form.setFieldValue('district', undefined);
            }}
          >
            {step === 0 && (
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="bizName"
                    label={t('adminVenues:businesses.wizard.account.bizName')}
                    rules={[{ required: true, whitespace: true, message: t('adminVenues:businesses.wizard.account.bizNameRequired') }]}
                  >
                    <Input placeholder={t('adminVenues:businesses.wizard.account.bizNamePlaceholder')} maxLength={100} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="contactName"
                    label={t('adminVenues:businesses.wizard.account.contactName')}
                    rules={[{ required: true, whitespace: true, message: t('adminVenues:businesses.wizard.account.contactNameRequired') }]}
                  >
                    <Input placeholder={t('adminVenues:businesses.wizard.account.contactNamePlaceholder')} maxLength={100} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="userName"
                    label={t('adminVenues:businesses.wizard.account.userName')}
                    rules={[
                      { required: true, whitespace: true, message: t('adminVenues:businesses.wizard.account.userNameRequired') },
                      { pattern: /^[A-Za-z0-9_.]{3,30}$/, message: t('adminVenues:businesses.wizard.account.userNamePattern') },
                    ]}
                  >
                    <Input placeholder={t('adminVenues:businesses.wizard.account.userNamePlaceholder')} maxLength={30} autoComplete="off" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="email"
                    label={t('adminVenues:businesses.wizard.account.email')}
                    rules={[
                      { required: true, message: t('adminVenues:businesses.wizard.account.emailRequired') },
                      { type: 'email', message: t('adminVenues:businesses.wizard.account.emailInvalid') },
                    ]}
                  >
                    <Input placeholder={t('adminVenues:businesses.wizard.account.emailPlaceholder')} maxLength={120} autoComplete="off" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="phoneNumber"
                    label={t('adminVenues:businesses.wizard.account.phone')}
                    rules={[
                      { required: true, whitespace: true, message: t('adminVenues:businesses.wizard.account.phoneRequired') },
                      { pattern: /^[0-9+()\s-]{7,20}$/, message: t('adminVenues:businesses.wizard.account.phoneInvalid') },
                    ]}
                  >
                    <Input placeholder="05xx xxx xx xx" maxLength={20} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="membershipUntil"
                    label={t('adminVenues:businesses.wizard.account.membershipUntil')}
                    extra={t('adminVenues:businesses.wizard.account.membershipUntilExtra')}
                  >
                    <DatePicker
                      format="DD.MM.YYYY"
                      style={{ width: '100%' }}
                      disabledDate={(d) => d && d.isBefore(dayjs(), 'day')}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item
                    label={t('adminVenues:businesses.wizard.account.tempPassword')}
                    required
                    extra={t('adminVenues:businesses.wizard.account.tempPasswordExtra')}
                  >
                    <Space.Compact style={{ width: '100%' }}>
                      <Form.Item
                        name="password"
                        noStyle
                        rules={[
                          { required: true, message: t('adminVenues:businesses.wizard.account.passwordRequired') },
                          { min: 8, message: t('adminVenues:businesses.wizard.account.passwordMin') },
                        ]}
                      >
                        <Input.Password placeholder={t('adminVenues:businesses.wizard.account.passwordPlaceholder')} autoComplete="new-password" />
                      </Form.Item>
                      <Button
                        icon={<ThunderboltOutlined />}
                        onClick={() => {
                          form.setFieldValue('password', generatePassword());
                          form.validateFields(['password']).catch(() => {});
                        }}
                      >
                        {t('adminVenues:businesses.wizard.account.generate')}
                      </Button>
                      <Tooltip title={t('adminVenues:businesses.wizard.account.copy')}>
                        <Button
                          icon={<CopyOutlined />}
                          onClick={() => {
                            const p = form.getFieldValue('password');
                            if (p) copyText(p, message);
                          }}
                        />
                      </Tooltip>
                    </Space.Compact>
                  </Form.Item>
                  <Form.Item shouldUpdate noStyle>
                    {() =>
                      form.getFieldError('password').length > 0 && (
                        <Text type="danger" style={{ display: 'block', marginTop: -16, marginBottom: 16 }}>
                          {form.getFieldError('password')[0]}
                        </Text>
                      )
                    }
                  </Form.Item>
                </Col>
              </Row>
            )}

            {step === 1 && (
              <Row gutter={16}>
                <Col xs={24} md={10}>
                  <Form.Item
                    name="venueName"
                    label={t('adminVenues:businesses.wizard.venue.name')}
                    rules={[{ required: true, whitespace: true, message: t('adminVenues:businesses.wizard.venue.nameRequired') }]}
                  >
                    <Input placeholder={t('adminVenues:businesses.wizard.venue.namePlaceholder')} maxLength={100} />
                  </Form.Item>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item
                        name="city"
                        label={t('adminVenues:businesses.wizard.venue.city')}
                        rules={[{ required: true, message: t('adminVenues:businesses.wizard.venue.cityRequired') }]}
                      >
                        <Select
                          showSearch
                          loading={provincesLoading}
                          placeholder={t('adminVenues:businesses.wizard.venue.cityPlaceholder')}
                          optionFilterProp="label"
                          options={provinces.map((p) => ({ value: p.name, label: p.name }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="district"
                        label={t('adminVenues:businesses.wizard.venue.district')}
                        rules={[{ required: true, message: t('adminVenues:businesses.wizard.venue.districtRequired') }]}
                      >
                        <Select
                          showSearch
                          disabled={!city}
                          placeholder={
                            city ? t('adminVenues:businesses.wizard.venue.districtPlaceholder') : t('adminVenues:businesses.wizard.venue.selectCityFirst')
                          }
                          optionFilterProp="label"
                          options={districts.map((d) => ({ value: d.name, label: d.name }))}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item
                    name="address"
                    label={t('adminVenues:businesses.wizard.venue.address')}
                    rules={[{ required: true, whitespace: true, message: t('adminVenues:businesses.wizard.venue.addressRequired') }]}
                  >
                    <Input.TextArea rows={2} placeholder={t('adminVenues:businesses.wizard.venue.addressPlaceholder')} maxLength={250} />
                  </Form.Item>
                  <Form.Item
                    name="venuePhone"
                    label={t('adminVenues:businesses.wizard.venue.phone')}
                    rules={[{ pattern: /^[0-9+()\s-]{7,20}$/, message: t('adminVenues:businesses.wizard.account.phoneInvalid') }]}
                  >
                    <Input placeholder="0xxx xxx xx xx" maxLength={20} />
                  </Form.Item>
                  <Form.Item name="description" label={t('adminVenues:businesses.wizard.venue.description')}>
                    <Input.TextArea rows={3} placeholder={t('adminVenues:businesses.wizard.venue.descriptionPlaceholder')} maxLength={500} showCount />
                  </Form.Item>
                </Col>
                <Col xs={24} md={14}>
                  <div style={{ marginBottom: 12 }}>
                      <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
                        <Input.Search
                          placeholder={t('adminVenues:businesses.wizard.venue.searchPlaceholder')}
                          enterButton={<SearchOutlined />}
                          allowClear
                          loading={searching}
                          onSearch={geocode}
                        />
                        <Tooltip title={isPhone ? t('adminVenues:businesses.wizard.venue.findFromAddress') : undefined}>
                          <Button
                            icon={<AimOutlined />}
                            onClick={geocodeAddress}
                            loading={searching}
                            aria-label={t('adminVenues:businesses.wizard.venue.findFromAddress')}
                          >
                            {isPhone ? null : t('adminVenues:businesses.wizard.venue.findFromAddress')}
                          </Button>
                        </Tooltip>
                      </Space.Compact>
                      <MapContainer center={position || DEFAULT_CENTER} zoom={position ? 16 : 6} className="mb-biz-map">
                        <TileLayer
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        />
                        <FixSize />
                        <FlyTo center={view.center} zoom={view.zoom} />
                        <ClickPicker onPick={pickPosition} />
                        {position && <Marker position={position} icon={pinIcon} />}
                      </MapContainer>
                  </div>
                  <Form.Item
                    name="location"
                    label={t('adminVenues:businesses.wizard.venue.location')}
                    rules={[
                      { required: true, message: t('adminVenues:businesses.wizard.venue.locationRequired') },
                      {
                        validator: (_, v) =>
                          !v || parseLocation(v)
                            ? Promise.resolve()
                            : Promise.reject(new Error(t('adminVenues:businesses.wizard.venue.locationInvalid'))),
                      },
                    ]}
                    extra={t('adminVenues:businesses.wizard.venue.locationExtra')}
                  >
                    <Input readOnly prefix={<EnvironmentOutlined />} placeholder={t('adminVenues:businesses.wizard.venue.locationPlaceholder')} />
                  </Form.Item>
                </Col>
              </Row>
            )}
          </Form>

          {step === 2 && (
            <>
              <Upload.Dragger
                accept={ACCEPTED_IMAGE_ACCEPT}
                multiple
                fileList={[]}
                showUploadList={false}
                beforeUpload={beforeUpload}
                disabled={photos.length >= MAX_PHOTOS}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">{t('adminVenues:businesses.wizard.photos.dropText')}</p>
                <p className="ant-upload-hint">
                  {t('adminVenues:businesses.wizard.photos.hint', { maxMb: MAX_PHOTO_MB, max: MAX_PHOTOS, count: photos.length })}
                </p>
              </Upload.Dragger>
              {photoError && <Alert type="error" showIcon message={photoError} style={{ marginTop: 12 }} />}
              {photos.length > 0 ? (
                <div className="mb-biz-photos">
                  {photos.map((p, i) => (
                    <div key={p.uid} className={`mb-biz-photo${i === 0 ? ' is-cover' : ''}`}>
                      <img src={p.url} alt={p.file.name} decoding="async" />
                      {i === 0 && <span className="mb-biz-photo__badge">{t('adminVenues:businesses.wizard.photos.cover')}</span>}
                      <div className="mb-biz-photo__actions">
                        {i === 0 ? (
                          <span />
                        ) : (
                          <Button size="small" icon={<StarOutlined />} onClick={() => makeCover(p.uid)}>
                            {t('adminVenues:businesses.wizard.photos.makeCover')}
                          </Button>
                        )}
                        <Tooltip title={t('adminVenues:businesses.wizard.photos.remove')}>
                          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removePhoto(p.uid)} />
                        </Tooltip>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState description={t('adminVenues:businesses.wizard.photos.empty')} />
              )}
            </>
          )}

          {step === 3 && (
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Card size="small" title={t('adminVenues:businesses.wizard.summary.account')}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label={t('adminVenues:businesses.wizard.summary.business')}>{values.bizName}</Descriptions.Item>
                    <Descriptions.Item label={t('adminVenues:businesses.wizard.summary.contact')}>{values.contactName || '-'}</Descriptions.Item>
                    <Descriptions.Item label={t('adminVenues:businesses.wizard.summary.userName')}>{values.userName}</Descriptions.Item>
                    <Descriptions.Item label={t('adminVenues:businesses.wizard.summary.email')}>{values.email}</Descriptions.Item>
                    <Descriptions.Item label={t('adminVenues:businesses.wizard.summary.phone')}>{values.phoneNumber || '-'}</Descriptions.Item>
                    <Descriptions.Item label={t('adminVenues:businesses.wizard.summary.membershipUntil')}>
                      {values.membershipUntil ? formatDate(values.membershipUntil) : t('adminVenues:businesses.wizard.summary.unlimited')}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card size="small" title={t('adminVenues:businesses.wizard.summary.venue')}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label={t('adminVenues:businesses.wizard.summary.venue')}>{values.venueName}</Descriptions.Item>
                    <Descriptions.Item label={t('adminVenues:businesses.wizard.summary.cityDistrict')}>
                      {values.city} / {values.district}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('adminVenues:businesses.wizard.summary.address')}>{values.address}</Descriptions.Item>
                    <Descriptions.Item label={t('adminVenues:businesses.wizard.summary.location')}>{values.location}</Descriptions.Item>
                    <Descriptions.Item label={t('adminVenues:businesses.wizard.summary.phone')}>{values.venuePhone || '-'}</Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
              <Col xs={24}>
                <Card size="small" title={t('adminVenues:businesses.wizard.summary.photos', { count: photos.length })}>
                  <div className="mb-biz-summary-photos">
                    {photos.map((p) => (
                      <img key={p.uid} src={p.url} alt={p.file.name} decoding="async" />
                    ))}
                  </div>
                </Card>
              </Col>
              <Col xs={24}>
                <Alert
                  type="info"
                  showIcon
                  message={t('adminVenues:businesses.wizard.summary.defaultsInfo')}
                />
              </Col>
            </Row>
          )}
        </>
      )}
    </Modal>
  );
}

/* ---------------- Sayfa ---------------- */

/** Admin: anlaşmalı işletmeler ve üyelikleri */
export default function Businesses() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const isPhone = Grid.useBreakpoint().md === false;
  const [searchParams, setSearchParams] = useSearchParams();
  const [owners, setOwners] = useState([]);
  const [stadiums, setStadiums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [wizardOpen, setWizardOpen] = useState(searchParams.get('new') === '1');
  const [membershipOwner, setMembershipOwner] = useState(null);
  const [assignOwner, setAssignOwner] = useState(null);
  const [assignStadiumId, setAssignStadiumId] = useState();
  const [saving, setSaving] = useState(false);
  const [listedBusy, setListedBusy] = useState(null);
  const [listedOverrides, setListedOverrides] = useState({});
  const [membershipForm] = Form.useForm();
  const [detailOwnerId, setDetailOwnerId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, s] = await Promise.all([
        adminVenuesApi.owners(),
        api.get('/api/Stadium/GetStadiumList').then((r) => r.data).catch(() => []),
      ]);
      setOwners(Array.isArray(o) ? o : []);
      setStadiums(Array.isArray(s) ? s : []);
      setListedOverrides({});
    } catch (e) {
      message.error(apiErrorMessage(e, t('adminVenues:businesses.messages.loadFailed')));
    } finally {
      setLoading(false);
    }
  }, [message, t]);

  useEffect(() => {
    load();
  }, [load]);

  const openWizard = () => setWizardOpen(true);
  const closeWizard = () => {
    setWizardOpen(false);
    if (searchParams.get('new')) {
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
  };

  const stadiumById = useMemo(() => {
    const map = {};
    stadiums.forEach((s) => {
      map[s.stadiumId] = s;
    });
    return map;
  }, [stadiums]);

  const assignedIds = useMemo(() => {
    const set = new Set();
    owners.forEach((o) => (o.venues || []).forEach((v) => set.add(v.stadiumId)));
    return set;
  }, [owners]);

  const freeStadiums = useMemo(
    () => stadiums.filter((s) => !assignedIds.has(s.stadiumId) && s.ownerPlayerId == null),
    [stadiums, assignedIds]
  );

  const isListed = (stadiumId) => listedOverrides[stadiumId] ?? stadiumById[stadiumId]?.isListed ?? true;

  const stats = useMemo(() => {
    const infos = owners.map(membershipInfo);
    return {
      total: owners.length,
      active: owners.filter((o) => o.membershipActive).length,
      soon: infos.filter((i) => i.key === 'soon').length,
      suspended: infos.filter((i) => i.key === 'suspended').length,
    };
  }, [owners]);

  const data = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr');
    if (!q) return owners;
    return owners.filter((o) =>
      [ownerName(o), ownerContact(o), o.owner?.userName, o.owner?.email, o.owner?.phoneNumber, ...(o.venues || []).map((v) => v.name)].some(
        (v) => (v || '').toLocaleLowerCase('tr').includes(q)
      )
    );
  }, [owners, search]);

  /* İşlemler */
  const openMembership = (o) => {
    setMembershipOwner(o);
    membershipForm.setFieldsValue({
      until: o.membershipUntil ? dayjs(o.membershipUntil) : null,
      suspended: Boolean(o.membershipSuspended),
    });
  };

  const saveMembership = async () => {
    const v = await membershipForm.validateFields();
    setSaving(true);
    try {
      await adminVenuesApi.updateMembership(
        membershipOwner.owner.playerId,
        v.until ? v.until.endOf('day').format('YYYY-MM-DDTHH:mm:ss') : null,
        Boolean(v.suspended)
      );
      message.success(t('adminVenues:businesses.messages.membershipUpdated'));
      setMembershipOwner(null);
      load();
    } catch (e) {
      message.error(formErrorMessage(membershipForm, e, t('adminVenues:businesses.messages.membershipUpdateFailed'), { aliases: { membershipUntil: 'until' } }));
    } finally {
      setSaving(false);
    }
  };

  const saveAssign = async () => {
    if (!assignStadiumId) {
      message.warning(t('adminVenues:businesses.messages.selectVenue'));
      return;
    }
    setSaving(true);
    try {
      await adminVenuesApi.assignVenue(assignStadiumId, assignOwner.owner.playerId);
      message.success(t('adminVenues:businesses.messages.venueAssigned'));
      setAssignOwner(null);
      setAssignStadiumId(undefined);
      load();
    } catch (e) {
      message.error(serverError(e, t('adminVenues:businesses.messages.venueAssignFailed')));
    } finally {
      setSaving(false);
    }
  };

  const toggleListed = async (venue) => {
    const nextValue = !isListed(venue.stadiumId);
    setListedBusy(venue.stadiumId);
    try {
      await adminVenuesApi.setListed(venue.stadiumId, nextValue);
      setListedOverrides((m) => ({ ...m, [venue.stadiumId]: nextValue }));
      message.success(nextValue ? t('adminVenues:businesses.listing.listed') : t('adminVenues:businesses.listing.unlisted'));
      load();
    } catch (e) {
      message.error(serverError(e, t('adminVenues:businesses.listing.failed')));
    } finally {
      setListedBusy(null);
    }
  };

  const columns = [
    {
      title: t('adminVenues:businesses.table.business'),
      key: 'name',
      sorter: (a, b) => ownerName(a).localeCompare(ownerName(b), 'tr'),
      render: (_, o) => (
        <Space direction="vertical" size={0}>
          <Text strong>{ownerName(o)}</Text>
          {ownerContact(o) && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('adminVenues:businesses.table.contactPerson', { name: ownerContact(o) })}
            </Text>
          )}
          {o.createdAt && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('adminVenues:businesses.table.registered', { date: formatDate(o.createdAt) })}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: t('adminVenues:businesses.table.userName'),
      key: 'userName',
      responsive: ['md'],
      render: (_, o) => <Text copyable={o.owner?.userName ? { text: o.owner.userName } : false}>@{o.owner?.userName || '-'}</Text>,
    },
    {
      title: t('adminVenues:businesses.table.contact'),
      key: 'contact',
      render: (_, o) => (
        <Space direction="vertical" size={0}>
          <Text>{o.owner?.email || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {o.owner?.phoneNumber || '-'}
          </Text>
        </Space>
      ),
    },
    {
      title: t('adminVenues:businesses.table.venues'),
      key: 'venues',
      render: (_, o) =>
        (o.venues || []).length === 0 ? (
          <Text type="secondary">{t('adminVenues:businesses.table.noVenues')}</Text>
        ) : (
          <div className="mb-biz-venues">
            {o.venues.map((v) => {
              const listed = isListed(v.stadiumId);
              return (
                <span key={v.stadiumId} className={`mb-biz-venue${listed ? '' : ' is-unlisted'}`}>
                  <Tooltip title={v.isVisible ? t('adminVenues:businesses.visibleToPlayers') : t('adminVenues:businesses.notVisibleToPlayers')}>
                    <span className={`mb-biz-dot${v.isVisible ? ' is-visible' : ''}`} />
                  </Tooltip>
                  <span className="mb-biz-venue__name" title={v.name}>
                    {v.name}
                  </span>
                  <Popconfirm
                    title={listed ? t('adminVenues:businesses.listing.unlistConfirm') : t('adminVenues:businesses.listing.listConfirm')}
                    description={
                      listed ? t('adminVenues:businesses.listing.unlistDescription') : t('adminVenues:businesses.listing.listDescription')
                    }
                    okText={listed ? t('adminVenues:businesses.listing.unlist') : t('adminVenues:businesses.listing.list')}
                    cancelText={t('common:actions.cancel')}
                    okButtonProps={{ danger: listed }}
                    onConfirm={() => toggleListed(v)}
                  >
                    <Tooltip title={listed ? t('adminVenues:businesses.listing.unlist') : t('adminVenues:businesses.listing.list')}>
                      <Button
                        size="small"
                        type="text"
                        icon={listed ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                        loading={listedBusy === v.stadiumId}
                      />
                    </Tooltip>
                  </Popconfirm>
                </span>
              );
            })}
          </div>
        ),
    },
    {
      title: t('adminVenues:businesses.table.membership'),
      key: 'membership',
      sorter: (a, b) => new Date(a.membershipUntil || '9999-12-31') - new Date(b.membershipUntil || '9999-12-31'),
      render: (_, o) => {
        const info = membershipInfo(o);
        return (
          <Space direction="vertical" size={2}>
            <span className={`mb-chip ${info.cls}`}>{info.label}</span>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {o.membershipUntil
                ? t('adminVenues:businesses.membership.until', { date: formatDate(o.membershipUntil) })
                : t('adminVenues:businesses.membership.unlimited')}
            </Text>
          </Space>
        );
      },
    },
    {
      title: t('adminVenues:businesses.table.actions'),
      key: 'actions',
      align: 'right',
      render: (_, o) => (
        <Space size={4} wrap style={{ justifyContent: 'flex-end' }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openMembership(o)}>
            {t('adminVenues:businesses.table.editMembership')}
          </Button>
          <Button size="small" icon={<LinkOutlined />} onClick={() => setAssignOwner(o)}>
            {t('adminVenues:businesses.table.assignVenue')}
          </Button>
        </Space>
      ),
    },
  ];

  const statCards = [
    { key: 'total', title: t('adminVenues:businesses.stats.total'), value: stats.total, icon: <ShopOutlined />, color: colors.info },
    { key: 'active', title: t('adminVenues:businesses.stats.active'), value: stats.active, icon: <ThunderboltOutlined />, color: colors.pitch },
    { key: 'soon', title: t('adminVenues:businesses.stats.soon'), value: stats.soon, icon: <CalendarOutlined />, color: colors.gold },
    { key: 'suspended', title: t('adminVenues:businesses.stats.suspended'), value: stats.suspended, icon: <PauseCircleOutlined />, color: colors.danger },
  ];

  return (
    <>
      <PageHeader
        title={t('adminVenues:businesses.title')}
        subtitle={t('adminVenues:businesses.subtitle')}
        icon={<ShopOutlined />}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
              {t('common:actions.refresh')}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openWizard}>
              {t('adminVenues:businesses.newBusiness')}
            </Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]} className="mb-biz-stats" style={{ marginBottom: 16 }}>
        {statCards.map((s) => (
          <Col xs={12} xl={6} key={s.key}>
            <Card bordered={false} loading={loading} className="mb-admin-stat-card">
              <Statistic
                title={s.title}
                value={s.value}
                prefix={<span style={{ color: s.color, marginRight: 4 }}>{s.icon}</span>}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card bordered={false}>
        <Space
          wrap
          size={12}
          className="mb-admin-toolbar"
          style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}
        >
          <Input
            className="mb-admin-filter"
            allowClear
            prefix={<SearchOutlined />}
            placeholder={t('adminVenues:businesses.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 300 }}
          />
          <Space size={16} wrap>
            <Space size={6}>
              <span className="mb-biz-dot is-visible" />
              <Text type="secondary">{t('adminVenues:businesses.visibleToPlayers')}</Text>
            </Space>
            <Space size={6}>
              <span className="mb-biz-dot" />
              <Text type="secondary">{t('adminVenues:businesses.notVisible')}</Text>
            </Space>
          </Space>
        </Space>
        <Table
          rowKey={(o) => o.owner?.playerId}
          columns={columns}
          rowClassName={() => 'mb-biz-row'}
          onRow={(o) => ({
            // Satıra tıklayınca işletmenin tüm bilgileri açılır (butonlar, anahtarlar ve bağlantılar hariç)
            onClick: (e) => {
              if (e.target.closest('button, a, .ant-switch, .ant-popover, .ant-dropdown, input')) return;
              setDetailOwnerId(o.owner?.playerId);
            },
          })}
          dataSource={data}
          loading={loading}
          scroll={{ x: isPhone ? 'max-content' : 1100 }}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          locale={{
            emptyText: (
              <EmptyState description={t('adminVenues:businesses.empty')}>
                <Button type="primary" icon={<PlusOutlined />} onClick={openWizard}>
                  {t('adminVenues:businesses.newBusiness')}
                </Button>
              </EmptyState>
            ),
          }}
        />
      </Card>

      <NewBusinessWizard open={wizardOpen} onClose={closeWizard} onCreated={load} />

      <OwnerDetailModal ownerId={detailOwnerId} open={Boolean(detailOwnerId)} onClose={() => setDetailOwnerId(null)} />

      <Modal
        open={Boolean(membershipOwner)}
        title={
          membershipOwner
            ? t('adminVenues:businesses.membershipModal.titleWithName', { name: ownerName(membershipOwner) })
            : t('adminVenues:businesses.membershipModal.title')
        }
        okText={t('common:actions.save')}
        cancelText={t('common:actions.cancel')}
        confirmLoading={saving}
        onOk={saveMembership}
        onCancel={() => setMembershipOwner(null)}
        destroyOnClose
      >
        <Form form={membershipForm} layout="vertical" preserve={false}>
          <Form.Item
            name="until"
            label={t('adminVenues:businesses.membershipModal.until')}
            extra={t('adminVenues:businesses.membershipModal.untilExtra')}
          >
            <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="suspended"
            label={t('adminVenues:businesses.membershipModal.suspend')}
            valuePropName="checked"
            extra={t('adminVenues:businesses.membershipModal.suspendExtra')}
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={Boolean(assignOwner)}
        title={
          assignOwner
            ? t('adminVenues:businesses.assignModal.titleWithName', { name: ownerName(assignOwner) })
            : t('adminVenues:businesses.assignModal.title')
        }
        okText={t('adminVenues:businesses.assignModal.ok')}
        cancelText={t('common:actions.cancel')}
        confirmLoading={saving}
        onOk={saveAssign}
        onCancel={() => {
          setAssignOwner(null);
          setAssignStadiumId(undefined);
        }}
        destroyOnClose
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Text type="secondary">{t('adminVenues:businesses.assignModal.hint')}</Text>
          <Select
            showSearch
            allowClear
            style={{ width: '100%' }}
            placeholder={
              freeStadiums.length ? t('adminVenues:businesses.assignModal.selectPlaceholder') : t('adminVenues:businesses.assignModal.noAssignable')
            }
            optionFilterProp="label"
            value={assignStadiumId}
            onChange={setAssignStadiumId}
            options={freeStadiums.map((s) => ({
              value: s.stadiumId,
              label: [s.stadiumName, s.district, s.city].filter((x) => x && Number.isNaN(Number(x))).join(' · ') || s.stadiumName,
            }))}
            notFoundContent={<EmptyState description={t('adminVenues:businesses.assignModal.noFreeVenues')} />}
          />
          {freeStadiums.length === 0 && !loading && (
            <Alert type="info" showIcon icon={<PictureOutlined />} message={t('adminVenues:businesses.assignModal.newVenueHint')} />
          )}
        </Space>
      </Modal>
    </>
  );
}
