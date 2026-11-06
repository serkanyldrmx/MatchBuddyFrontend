import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
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
import { api } from '../api/config';
import { adminVenuesApi } from '../api/venues';
import { colors } from '../theme/theme';
import { EmptyState, PageHeader } from '../ui';
import { apiErrorMessage, formatDate } from '../utils/format';
import LocationIcon from '../images/Location-fotor-bg-remover-2025030545851.png';
import './Businesses.css';
import OwnerDetailModal from './OwnerDetailModal';

const { Text } = Typography;
const DEFAULT_CENTER = [39.9334, 32.8597]; // Ankara
const MAX_PHOTOS = 10;
const MAX_PHOTO_MB = 5;

const pinIcon = new L.Icon({
  iconUrl: LocationIcon,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

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

/** Sunucu hata mesajı (400 alan bazlı mesajlar ve ASP.NET ModelState dahil) */
function serverError(e, fallback) {
  const data = e?.response?.data;
  if (data?.errors && typeof data.errors === 'object') {
    const list = Object.values(data.errors).flat().filter(Boolean);
    if (list.length) return list.join(' ');
  }
  return apiErrorMessage(e, fallback);
}

/** Üyelik durumu */
export function membershipInfo(o) {
  if (o.membershipSuspended) return { key: 'suspended', label: 'Askıda', cls: 'is-rejected' };
  if (o.membershipUntil) {
    const until = dayjs(o.membershipUntil);
    if (until.isBefore(dayjs())) return { key: 'expired', label: 'Süresi doldu', cls: 'is-done' };
    const days = Math.ceil(until.diff(dayjs(), 'day', true));
    if (days < 30) return { key: 'soon', label: `${days} gün kaldı`, cls: 'is-pending' };
  }
  return { key: 'active', label: 'Aktif', cls: 'is-approved' };
}

const ownerName = (o) => o.owner?.name || o.owner?.playerName || o.owner?.userName || 'İşletme';
const ownerContact = (o) => o.owner?.contactName || o.owner?.playerSurname || null;

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    message.success('Kopyalandı.');
  } catch {
    message.error('Kopyalanamadı.');
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

/** Sunucu mesajından ilgili adımı tahmin eder */
function stepForError(msg) {
  const m = (msg || '').toLocaleLowerCase('tr');
  if (m.includes('foto')) return 2;
  if (['konum', 'adres', 'tesis', 'ilçe', ' il '].some((k) => m.includes(k))) return 1;
  if (['kullanıcı', 'e-posta', 'eposta', 'email', 'şifre', 'parola', 'telefon', 'üyelik'].some((k) => m.includes(k))) return 0;
  return null;
}

function NewBusinessWizard({ open, onClose, onCreated }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [step, setStep] = useState(0);
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
        message.warning('Konum bulunamadı. Haritaya tıklayarak seçebilirsiniz.');
      }
    } catch {
      message.error('Konum araması yapılamadı.');
    } finally {
      setSearching(false);
    }
  };

  const geocodeAddress = () => {
    const { address, district, city: c } = form.getFieldsValue(['address', 'district', 'city']);
    if (!address?.trim()) {
      message.warning('Önce açık adresi yazın.');
      return;
    }
    geocode([address, district, c, 'Türkiye'].filter(Boolean).join(', '));
  };

  /* Fotoğraflar */
  const beforeUpload = (file) => {
    const okType = ['image/jpeg', 'image/png'].includes(file.type);
    if (!okType) {
      message.error(`${file.name}: sadece JPG veya PNG yükleyebilirsiniz.`);
      return false;
    }
    if (file.size / 1024 / 1024 > MAX_PHOTO_MB) {
      message.error(`${file.name}: dosya ${MAX_PHOTO_MB} MB'tan büyük olamaz.`);
      return false;
    }
    // Çoklu seçimde beforeUpload art arda çağrılır; güncel listeyi ref üzerinden tut
    if (photosRef.current.length >= MAX_PHOTOS) {
      message.warning(`En fazla ${MAX_PHOTOS} fotoğraf ekleyebilirsiniz: ${file.name} eklenmedi.`);
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
        setPhotoError('En az 1 fotoğraf eklemelisiniz.');
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
      setPhotoError('En az 1 fotoğraf eklemelisiniz.');
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
      const res = await adminVenuesApi.createOwner(
        model,
        photos.map((p) => p.file)
      );
      if (res && res.success === false) throw Object.assign(new Error(res.message), { response: { data: res } });
      setCreated({ name: model.owner.name, userName: model.owner.userName, password: model.owner.password, email: model.owner.email });
      message.success('İşletme oluşturuldu.');
      onCreated?.();
    } catch (e) {
      const msg = serverError(e, 'İşletme oluşturulamadı.');
      setError(msg);
      const target = stepForError(msg);
      if (target != null) setStep(target);
    } finally {
      setSubmitting(false);
    }
  };

  const loginUrl = `${window.location.origin}/`;
  const credentialsText = created
    ? `MatchBuddy işletme paneli\nGiriş: ${loginUrl}\nKullanıcı adı: ${created.userName}\nGeçici şifre: ${created.password}\nİlk girişte şifrenizi değiştirmenizi öneririz.`
    : '';

  const footer = created
    ? [
        <Button key="copy" icon={<CopyOutlined />} onClick={() => copyText(credentialsText, message)}>
          Tümünü kopyala
        </Button>,
        <Button key="close" type="primary" onClick={close}>
          Kapat
        </Button>,
      ]
    : [
        <Button key="cancel" onClick={close} disabled={submitting}>
          Vazgeç
        </Button>,
        step > 0 && (
          <Button key="back" onClick={() => setStep(step - 1)} disabled={submitting}>
            Geri
          </Button>
        ),
        step < 3 ? (
          <Button key="next" type="primary" onClick={next}>
            İleri
          </Button>
        ) : (
          <Button key="submit" type="primary" icon={<ThunderboltOutlined />} loading={submitting} onClick={submit}>
            İşletmeyi oluştur
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
          <ShopOutlined /> Yeni işletme
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
          title={`${created.name} oluşturuldu`}
          subTitle="Bu bilgileri işletmeye iletin; şifre bir daha gösterilmeyecek."
          extra={
            <div className="mb-biz-credentials">
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="Giriş adresi">
                  <Text copyable={{ text: loginUrl }}>{loginUrl}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Kullanıcı adı">
                  <Text copyable>{created.userName}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Geçici şifre">
                  <Text copyable>{created.password}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="E-posta">{created.email}</Descriptions.Item>
              </Descriptions>
            </div>
          }
        />
      ) : (
        <>
          <Steps
            current={step}
            size="small"
            items={[{ title: 'İşletme hesabı' }, { title: 'Tesis' }, { title: 'Fotoğraflar' }, { title: 'Özet & oluştur' }]}
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
                  <Form.Item name="bizName" label="İşletme adı" rules={[{ required: true, whitespace: true, message: 'İşletme adını girin' }]}>
                    <Input placeholder="Örn. Yeşil Vadi Spor Tesisleri" maxLength={100} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="contactName" label="Yetkili kişi" rules={[{ required: true, whitespace: true, message: 'Yetkili kişiyi girin' }]}>
                    <Input placeholder="Ad Soyad" maxLength={100} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="userName"
                    label="Kullanıcı adı"
                    rules={[
                      { required: true, whitespace: true, message: 'Kullanıcı adını girin' },
                      { pattern: /^[A-Za-z0-9_.]{3,30}$/, message: '3–30 karakter; harf, rakam, _ ve . kullanılabilir' },
                    ]}
                  >
                    <Input placeholder="isletme_yesilvadi" maxLength={30} autoComplete="off" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="email"
                    label="E-posta"
                    rules={[
                      { required: true, message: 'E-posta girin' },
                      { type: 'email', message: 'Geçerli bir e-posta girin' },
                    ]}
                  >
                    <Input placeholder="ornek@isletme.com" maxLength={120} autoComplete="off" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="phoneNumber"
                    label="Telefon"
                    rules={[{ required: true, whitespace: true, message: 'Telefon girin' }, { pattern: /^[0-9+()\s-]{7,20}$/, message: 'Geçerli bir telefon girin' }]}
                  >
                    <Input placeholder="05xx xxx xx xx" maxLength={20} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="membershipUntil"
                    label="Üyelik bitişi"
                    extra="Boş bırakılırsa süresiz olur"
                  >
                    <DatePicker
                      format="DD.MM.YYYY"
                      style={{ width: '100%' }}
                      disabledDate={(d) => d && d.isBefore(dayjs(), 'day')}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item label="Geçici şifre" required extra="İşletme ilk girişten sonra şifresini değiştirebilir.">
                    <Space.Compact style={{ width: '100%' }}>
                      <Form.Item
                        name="password"
                        noStyle
                        rules={[
                          { required: true, message: 'Şifre oluşturun' },
                          { min: 8, message: 'En az 8 karakter olmalı' },
                        ]}
                      >
                        <Input.Password placeholder="En az 8 karakter" autoComplete="new-password" />
                      </Form.Item>
                      <Button
                        icon={<ThunderboltOutlined />}
                        onClick={() => {
                          form.setFieldValue('password', generatePassword());
                          form.validateFields(['password']).catch(() => {});
                        }}
                      >
                        Oluştur
                      </Button>
                      <Tooltip title="Kopyala">
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
                  <Form.Item name="venueName" label="Tesis adı" rules={[{ required: true, whitespace: true, message: 'Tesis adını girin' }]}>
                    <Input placeholder="Örn. Yeşil Vadi Halı Saha" maxLength={100} />
                  </Form.Item>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="city" label="İl" rules={[{ required: true, message: 'İl seçin' }]}>
                        <Select
                          showSearch
                          loading={provincesLoading}
                          placeholder="İl seçin"
                          optionFilterProp="label"
                          options={provinces.map((p) => ({ value: p.name, label: p.name }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="district" label="İlçe" rules={[{ required: true, message: 'İlçe seçin' }]}>
                        <Select
                          showSearch
                          disabled={!city}
                          placeholder={city ? 'İlçe seçin' : 'Önce il seçin'}
                          optionFilterProp="label"
                          options={districts.map((d) => ({ value: d.name, label: d.name }))}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="address" label="Açık adres" rules={[{ required: true, whitespace: true, message: 'Açık adresi girin' }]}>
                    <Input.TextArea rows={2} placeholder="Mahalle, cadde, no" maxLength={250} />
                  </Form.Item>
                  <Form.Item name="venuePhone" label="Tesis telefonu" rules={[{ pattern: /^[0-9+()\s-]{7,20}$/, message: 'Geçerli bir telefon girin' }]}>
                    <Input placeholder="0xxx xxx xx xx" maxLength={20} />
                  </Form.Item>
                  <Form.Item name="description" label="Açıklama">
                    <Input.TextArea rows={3} placeholder="Tesis hakkında kısa bilgi" maxLength={500} showCount />
                  </Form.Item>
                </Col>
                <Col xs={24} md={14}>
                  <div style={{ marginBottom: 12 }}>
                      <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
                        <Input.Search
                          placeholder="Yer ara (örn. Kadıköy Moda)"
                          enterButton={<SearchOutlined />}
                          allowClear
                          loading={searching}
                          onSearch={geocode}
                        />
                        <Button icon={<AimOutlined />} onClick={geocodeAddress} loading={searching}>
                          Adresten bul
                        </Button>
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
                    label="Konum"
                    rules={[
                      { required: true, message: 'Haritadan konum seçin' },
                      { validator: (_, v) => (!v || parseLocation(v) ? Promise.resolve() : Promise.reject(new Error('Geçersiz konum'))) },
                    ]}
                    extra="Haritaya tıklayın, yer arayın ya da “Adresten bul” ile açık adresi haritada bulun."
                  >
                    <Input readOnly prefix={<EnvironmentOutlined />} placeholder="Konum seçilmedi" />
                  </Form.Item>
                </Col>
              </Row>
            )}
          </Form>

          {step === 2 && (
            <>
              <Upload.Dragger
                accept=".jpg,.jpeg,.png"
                multiple
                fileList={[]}
                showUploadList={false}
                beforeUpload={beforeUpload}
                disabled={photos.length >= MAX_PHOTOS}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">Fotoğrafları sürükleyip bırakın ya da seçmek için tıklayın</p>
                <p className="ant-upload-hint">
                  JPG/PNG, en fazla {MAX_PHOTO_MB} MB · 1–{MAX_PHOTOS} fotoğraf · ilk fotoğraf kapak olur ({photos.length}/{MAX_PHOTOS})
                </p>
              </Upload.Dragger>
              {photoError && <Alert type="error" showIcon message={photoError} style={{ marginTop: 12 }} />}
              {photos.length > 0 ? (
                <div className="mb-biz-photos">
                  {photos.map((p, i) => (
                    <div key={p.uid} className={`mb-biz-photo${i === 0 ? ' is-cover' : ''}`}>
                      <img src={p.url} alt={p.file.name} />
                      {i === 0 && <span className="mb-biz-photo__badge">Kapak</span>}
                      <div className="mb-biz-photo__actions">
                        {i === 0 ? (
                          <span />
                        ) : (
                          <Button size="small" icon={<StarOutlined />} onClick={() => makeCover(p.uid)}>
                            Kapak yap
                          </Button>
                        )}
                        <Tooltip title="Kaldır">
                          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removePhoto(p.uid)} />
                        </Tooltip>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState description="Henüz fotoğraf eklenmedi" />
              )}
            </>
          )}

          {step === 3 && (
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Card size="small" title="İşletme hesabı">
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="İşletme">{values.bizName}</Descriptions.Item>
                    <Descriptions.Item label="Yetkili">{values.contactName || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Kullanıcı adı">{values.userName}</Descriptions.Item>
                    <Descriptions.Item label="E-posta">{values.email}</Descriptions.Item>
                    <Descriptions.Item label="Telefon">{values.phoneNumber || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Üyelik bitişi">
                      {values.membershipUntil ? formatDate(values.membershipUntil) : 'Süresiz'}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card size="small" title="Tesis">
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Tesis">{values.venueName}</Descriptions.Item>
                    <Descriptions.Item label="İl / ilçe">
                      {values.city} / {values.district}
                    </Descriptions.Item>
                    <Descriptions.Item label="Adres">{values.address}</Descriptions.Item>
                    <Descriptions.Item label="Konum">{values.location}</Descriptions.Item>
                    <Descriptions.Item label="Telefon">{values.venuePhone || '-'}</Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
              <Col xs={24}>
                <Card size="small" title={`Fotoğraflar (${photos.length})`}>
                  <div className="mb-biz-summary-photos">
                    {photos.map((p) => (
                      <img key={p.uid} src={p.url} alt={p.file.name} />
                    ))}
                  </div>
                </Card>
              </Col>
              <Col xs={24}>
                <Alert
                  type="info"
                  showIcon
                  message="Oluşturulunca tesise varsayılan “Saha 1” (7+7, suni çim, kapalı, saatlik 1.500 ₺) ve 09:00–00:00 açılış saatleri eklenir. İşletme bunları kendi panelinden düzenleyebilir."
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
  const { message } = App.useApp();
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
      message.error(apiErrorMessage(e, 'İşletmeler alınamadı.'));
    } finally {
      setLoading(false);
    }
  }, [message]);

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
      message.success('Üyelik güncellendi.');
      setMembershipOwner(null);
      load();
    } catch (e) {
      message.error(serverError(e, 'Üyelik güncellenemedi.'));
    } finally {
      setSaving(false);
    }
  };

  const saveAssign = async () => {
    if (!assignStadiumId) {
      message.warning('Bir tesis seçin.');
      return;
    }
    setSaving(true);
    try {
      await adminVenuesApi.assignVenue(assignStadiumId, assignOwner.owner.playerId);
      message.success('Tesis işletmeye bağlandı.');
      setAssignOwner(null);
      setAssignStadiumId(undefined);
      load();
    } catch (e) {
      message.error(serverError(e, 'Tesis bağlanamadı.'));
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
      message.success(nextValue ? 'Tesis yayına alındı.' : 'Tesis yayından kaldırıldı.');
      load();
    } catch (e) {
      message.error(serverError(e, 'Yayın durumu değiştirilemedi.'));
    } finally {
      setListedBusy(null);
    }
  };

  const columns = [
    {
      title: 'İşletme',
      key: 'name',
      sorter: (a, b) => ownerName(a).localeCompare(ownerName(b), 'tr'),
      render: (_, o) => (
        <Space direction="vertical" size={0}>
          <Text strong>{ownerName(o)}</Text>
          {ownerContact(o) && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Yetkili: {ownerContact(o)}
            </Text>
          )}
          {o.createdAt && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Kayıt: {formatDate(o.createdAt)}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Kullanıcı adı',
      key: 'userName',
      render: (_, o) => <Text copyable={o.owner?.userName ? { text: o.owner.userName } : false}>@{o.owner?.userName || '-'}</Text>,
    },
    {
      title: 'E-posta / telefon',
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
      title: 'Tesisler',
      key: 'venues',
      render: (_, o) =>
        (o.venues || []).length === 0 ? (
          <Text type="secondary">Tesis yok</Text>
        ) : (
          <div className="mb-biz-venues">
            {o.venues.map((v) => {
              const listed = isListed(v.stadiumId);
              return (
                <span key={v.stadiumId} className={`mb-biz-venue${listed ? '' : ' is-unlisted'}`}>
                  <Tooltip title={v.isVisible ? 'Oyunculara görünüyor' : 'Oyunculara görünmüyor'}>
                    <span className={`mb-biz-dot${v.isVisible ? ' is-visible' : ''}`} />
                  </Tooltip>
                  <span className="mb-biz-venue__name" title={v.name}>
                    {v.name}
                  </span>
                  <Popconfirm
                    title={listed ? 'Tesis yayından kaldırılsın mı?' : 'Tesis yayına alınsın mı?'}
                    description={listed ? 'Oyuncular bu tesisi göremez.' : 'Koşullar sağlanıyorsa oyuncular tesisi görür.'}
                    okText={listed ? 'Yayından kaldır' : 'Yayına al'}
                    cancelText="Vazgeç"
                    okButtonProps={{ danger: listed }}
                    onConfirm={() => toggleListed(v)}
                  >
                    <Tooltip title={listed ? 'Yayından kaldır' : 'Yayına al'}>
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
      title: 'Üyelik',
      key: 'membership',
      sorter: (a, b) => new Date(a.membershipUntil || '9999-12-31') - new Date(b.membershipUntil || '9999-12-31'),
      render: (_, o) => {
        const info = membershipInfo(o);
        return (
          <Space direction="vertical" size={2}>
            <span className={`mb-chip ${info.cls}`}>{info.label}</span>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {o.membershipUntil ? `Bitiş: ${formatDate(o.membershipUntil)}` : 'Süresiz'}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'İşlemler',
      key: 'actions',
      align: 'right',
      render: (_, o) => (
        <Space size={4} wrap style={{ justifyContent: 'flex-end' }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openMembership(o)}>
            Üyeliği düzenle
          </Button>
          <Button size="small" icon={<LinkOutlined />} onClick={() => setAssignOwner(o)}>
            Tesis bağla
          </Button>
        </Space>
      ),
    },
  ];

  const statCards = [
    { title: 'Toplam işletme', value: stats.total, icon: <ShopOutlined />, color: colors.info },
    { title: 'Aktif üyelik', value: stats.active, icon: <ThunderboltOutlined />, color: colors.pitch },
    { title: '30 gün içinde dolacak', value: stats.soon, icon: <CalendarOutlined />, color: colors.gold },
    { title: 'Askıda', value: stats.suspended, icon: <PauseCircleOutlined />, color: colors.danger },
  ];

  return (
    <>
      <PageHeader
        title="İşletmeler"
        subtitle="Anlaşmalı halı sahalar ve üyelikleri"
        icon={<ShopOutlined />}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
              Yenile
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openWizard}>
              Yeni işletme
            </Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]} className="mb-biz-stats" style={{ marginBottom: 16 }}>
        {statCards.map((s) => (
          <Col xs={12} xl={6} key={s.title}>
            <Card bordered={false} loading={loading}>
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
        <Space wrap size={12} style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="İşletme, kullanıcı adı veya tesis ara"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 300 }}
          />
          <Space size={16} wrap>
            <Space size={6}>
              <span className="mb-biz-dot is-visible" />
              <Text type="secondary">Oyunculara görünüyor</Text>
            </Space>
            <Space size={6}>
              <span className="mb-biz-dot" />
              <Text type="secondary">Görünmüyor</Text>
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
          scroll={{ x: 1100 }}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          locale={{
            emptyText: (
              <EmptyState description="Henüz anlaşmalı işletme yok">
                <Button type="primary" icon={<PlusOutlined />} onClick={openWizard}>
                  Yeni işletme
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
        title={membershipOwner ? `Üyeliği düzenle · ${ownerName(membershipOwner)}` : 'Üyeliği düzenle'}
        okText="Kaydet"
        cancelText="Vazgeç"
        confirmLoading={saving}
        onOk={saveMembership}
        onCancel={() => setMembershipOwner(null)}
        destroyOnClose
      >
        <Form form={membershipForm} layout="vertical" preserve={false}>
          <Form.Item name="until" label="Üyelik bitişi" extra="Boş bırakılırsa üyelik süresiz olur.">
            <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="suspended"
            label="Askıya al"
            valuePropName="checked"
            extra="Askıdaki işletme giriş yapabilir ama paneli salt okunur olur ve tesisleri oyunculara görünmez."
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={Boolean(assignOwner)}
        title={assignOwner ? `Tesis bağla · ${ownerName(assignOwner)}` : 'Tesis bağla'}
        okText="Bağla"
        cancelText="Vazgeç"
        confirmLoading={saving}
        onOk={saveAssign}
        onCancel={() => {
          setAssignOwner(null);
          setAssignStadiumId(undefined);
        }}
        destroyOnClose
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Text type="secondary">
            Sadece işletmesi olmayan tesisler listelenir (ör. OpenStreetMap'ten içe aktarılanlar). Tesisin oyunculara
            görünmesi için fotoğraf ve aktif saha da gerekir.
          </Text>
          <Select
            showSearch
            allowClear
            style={{ width: '100%' }}
            placeholder={freeStadiums.length ? 'Tesis seçin' : 'Bağlanabilecek tesis yok'}
            optionFilterProp="label"
            value={assignStadiumId}
            onChange={setAssignStadiumId}
            options={freeStadiums.map((s) => ({
              value: s.stadiumId,
              label: [s.stadiumName, s.district, s.city].filter((x) => x && Number.isNaN(Number(x))).join(' · ') || s.stadiumName,
            }))}
            notFoundContent={<EmptyState description="İşletmesi olmayan tesis yok" />}
          />
          {freeStadiums.length === 0 && !loading && (
            <Alert type="info" showIcon icon={<PictureOutlined />} message="Yeni tesis için “Yeni işletme” sihirbazını ya da “Aday Tesis Bul” ekranını kullanın." />
          )}
        </Space>
      </Modal>
    </>
  );
}
