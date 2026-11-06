import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import dayjs from 'dayjs';
import { Alert, App, Button, Card, Col, Form, Input, Row, Select, Space, TimePicker, Typography } from 'antd';
import { AimOutlined, PlusCircleOutlined, SaveOutlined } from '@ant-design/icons';
import { api } from '../../api/config';
import { PageHeader } from '../../ui';
import { apiErrorMessage } from '../../utils/format';
import LocationIcon from '../../images/Location-fotor-bg-remover-2025030545851.png';
import './StadiumAdmin.css';

const { Text } = Typography;
const DEFAULT_CENTER = [39.9334, 32.8597]; // Ankara
const DEFAULT_VALUES = {
  openingTime: dayjs('08:00', 'HH:mm'),
  closingTime: dayjs('23:00', 'HH:mm'),
};

const customIcon = new L.Icon({
  iconUrl: LocationIcon,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

/** Haritayı verilen merkeze taşır */
function MapView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom, { duration: 0.8 });
  }, [map, center, zoom]);
  return null;
}

/** Haritaya tıklanınca konumu seçer */
function ClickPicker({ onPick }) {
  useMapEvents({
    click(e) {
      onPick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

const formatCoords = (pos) => (pos ? `${Number(pos[0]).toFixed(6)}, ${Number(pos[1]).toFixed(6)}` : '');

/** Admin: yeni halı saha ekleme */
function StadiumIsAdmin() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [userPosition, setUserPosition] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [view, setView] = useState({ center: null, zoom: 6 });
  const [cities, setCities] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const cityName = Form.useWatch('city', form); // il/ilçe artık metin (isim) olarak saklanır

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = [pos.coords.latitude, pos.coords.longitude];
        setUserPosition(p);
        setView({ center: p, zoom: 13 });
      },
      () => {}
    );
  }, []);

  useEffect(() => {
    axios
      .get('https://api.turkiyeapi.dev/v1/provinces')
      .then((r) => setCities(r.data?.data || []))
      .catch(() => message.error('İl listesi alınamadı.'))
      .finally(() => setCitiesLoading(false));
  }, [message]);

  const districts = cities.find((c) => c.name === cityName)?.districts || [];

  const pickPosition = (pos) => {
    setSelectedPosition(pos);
    form.setFieldValue('location', formatCoords(pos));
    form.validateFields(['location']).catch(() => {});
  };

  const handleSearch = async (query) => {
    const q = (query || '').trim();
    if (!q) return;
    setSearching(true);
    try {
      const r = await axios.get('https://nominatim.openstreetmap.org/search', { params: { format: 'json', q } });
      if (r.data?.length > 0) {
        const pos = [parseFloat(r.data[0].lat), parseFloat(r.data[0].lon)];
        pickPosition(pos);
        setView({ center: pos, zoom: 15 });
      } else {
        message.warning('Konum bulunamadı.');
      }
    } catch (e) {
      message.error('Konum araması yapılamadı.');
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (values) => {
    if (!selectedPosition) {
      message.warning('Lütfen haritadan konum seçin.');
      return;
    }
    const payload = {
      stadiumName: values.stadiumName.trim(),
      location: `${selectedPosition[0]}, ${selectedPosition[1]}`,
      city: values.city,
      district: values.district,
      address: values.address.trim(),
      openingTime: `${values.openingTime.format('HH:mm')}:00`,
      closingTime: `${values.closingTime.format('HH:mm')}:00`,
      description: values.description.trim(),
    };
    setSaving(true);
    try {
      const r = await api.post('/api/Stadium/SaveStadium', payload);
      if (r.data && r.data.success === false) {
        message.error(r.data.message || 'Halı saha kaydedilemedi.');
        return;
      }
      message.success('Halı saha başarıyla kaydedildi.');
      form.resetFields();
      setSelectedPosition(null);
      navigate('/adminPanel/stadiums');
    } catch (e) {
      message.error(apiErrorMessage(e, 'Halı saha kaydedilemedi.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Halı Saha Ekle"
        subtitle="Yeni bir halı saha kaydı oluşturun ve harita üzerinde konumunu belirleyin"
        icon={<PlusCircleOutlined />}
      />
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="Bu ekranla eklenen tesisin işletmesi olmaz ve oyunculara görünmez."
        description={
          <>
            Anlaşmalı bir tesis eklemek için işletme hesabı, fotoğraflar ve konumu tek adımda oluşturan{' '}
            <Link to="/adminPanel/businesses?new=1">Yeni işletme</Link> sihirbazını kullanmanızı öneririz. Burada eklenen tesis
            daha sonra İşletmeler ekranından bir işletmeye bağlanabilir.
          </>
        }
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card bordered={false} title="Halı saha bilgileri">
            <Form
              form={form}
              layout="vertical"
              initialValues={DEFAULT_VALUES}
              onFinish={handleSubmit}
              requiredMark="optional"
              onValuesChange={(changed) => {
                if ('city' in changed) form.setFieldValue('district', undefined);
              }}
            >
              <Form.Item
                name="stadiumName"
                label="Halı saha adı"
                rules={[{ required: true, whitespace: true, message: 'Halı saha adını girin' }]}
              >
                <Input placeholder="Örn. Yıldız Halı Saha" maxLength={100} />
              </Form.Item>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="city" label="İl" rules={[{ required: true, message: 'İl seçin' }]}>
                    <Select
                      showSearch
                      loading={citiesLoading}
                      placeholder="İl seçin"
                      optionFilterProp="label"
                      options={cities.map((c) => ({ value: c.name, label: c.name }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="district" label="İlçe" rules={[{ required: true, message: 'İlçe seçin' }]}>
                    <Select
                      showSearch
                      disabled={!cityName}
                      placeholder={cityName ? 'İlçe seçin' : 'Önce il seçin'}
                      optionFilterProp="label"
                      options={districts.map((d) => ({ value: d.name, label: d.name }))}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                name="address"
                label="Açık adres"
                rules={[{ required: true, whitespace: true, message: 'Açık adresi girin' }]}
              >
                <Input.TextArea rows={2} placeholder="Mahalle, cadde, no" maxLength={250} />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="openingTime"
                    label="Açılış saati"
                    rules={[{ required: true, message: 'Açılış saatini seçin' }]}
                  >
                    <TimePicker format="HH:mm" minuteStep={30} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="closingTime"
                    label="Kapanış saati"
                    rules={[{ required: true, message: 'Kapanış saatini seçin' }]}
                  >
                    <TimePicker format="HH:mm" minuteStep={30} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                name="description"
                label="Açıklama"
                rules={[{ required: true, whitespace: true, message: 'Açıklama girin' }]}
              >
                <Input.TextArea rows={3} placeholder="Saha özellikleri, otopark, duş vb." maxLength={500} showCount />
              </Form.Item>
              <Form.Item
                name="location"
                label="Konum"
                extra="Haritaya tıklayarak konum seçin"
                rules={[{ required: true, message: 'Haritadan konum seçin' }]}
              >
                <Input readOnly prefix={<AimOutlined />} placeholder="Konum seçilmedi" />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Space>
                  <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
                    Halı sahayı kaydet
                  </Button>
                  <Button onClick={() => navigate('/adminPanel/stadiums')}>Vazgeç</Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card bordered={false} title="Konum seçimi">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Input.Search
                placeholder="Adres veya yer ara (örn. Selçuklu, Konya)"
                enterButton="Ara"
                allowClear
                loading={searching}
                onSearch={handleSearch}
              />
              <MapContainer center={DEFAULT_CENTER} zoom={6} className="mb-map">
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <MapView center={view.center} zoom={view.zoom} />
                <ClickPicker onPick={pickPosition} />
                {userPosition && (
                  <Marker position={userPosition} icon={customIcon} opacity={0.6}>
                    <Popup>Mevcut konumunuz</Popup>
                  </Marker>
                )}
                {selectedPosition && (
                  <Marker position={selectedPosition} icon={customIcon}>
                    <Popup>Seçilen konum</Popup>
                  </Marker>
                )}
              </MapContainer>
              <Text type="secondary">
                {selectedPosition ? `Seçilen konum: ${formatCoords(selectedPosition)}` : 'Henüz konum seçilmedi.'}
              </Text>
            </Space>
          </Card>
        </Col>
      </Row>
    </>
  );
}

export default StadiumIsAdmin;
