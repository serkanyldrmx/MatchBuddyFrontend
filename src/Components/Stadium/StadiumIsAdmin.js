import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import dayjs from 'dayjs';
import { Alert, App, Button, Card, Col, Form, Grid, Input, Row, Select, Space, TimePicker, Typography } from 'antd';
import { AimOutlined, PlusCircleOutlined, SaveOutlined } from '@ant-design/icons';
import { Trans, useTranslation } from 'react-i18next';
import { api } from '../../api/config';
import { PageHeader } from '../../ui';
import { apiErrorMessage } from '../../utils/format';
import { UserLocationMarker, venuePinIcon } from '../../ui/map/mapKit';
import './StadiumAdmin.css';

const { Text } = Typography;
const DEFAULT_CENTER = [39.9334, 32.8597]; // Ankara
const DEFAULT_VALUES = {
  openingTime: dayjs('08:00', 'HH:mm'),
  closingTime: dayjs('23:00', 'HH:mm'),
};

const customIcon = venuePinIcon({ active: true });

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
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const isPhone = Grid.useBreakpoint().md === false;
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
      .catch(() => message.error(t('venues:stadium.add.citiesError')))
      .finally(() => setCitiesLoading(false));
  }, [message, t]);

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
        message.warning(t('venues:stadium.add.locationNotFound'));
      }
    } catch (e) {
      message.error(t('venues:stadium.add.searchError'));
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (values) => {
    if (!selectedPosition) {
      message.warning(t('venues:stadium.add.pickLocationWarning'));
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
        message.error(r.data.message || t('venues:stadium.add.saveError'));
        return;
      }
      message.success(t('venues:stadium.add.saved'));
      form.resetFields();
      setSelectedPosition(null);
      navigate('/adminPanel/stadiums');
    } catch (e) {
      message.error(apiErrorMessage(e, t('venues:stadium.add.saveError')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title={t('venues:stadium.add.title')}
        subtitle={t('venues:stadium.add.subtitle')}
        icon={<PlusCircleOutlined />}
      />
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message={t('venues:stadium.add.warning')}
        description={
          <Trans i18nKey="venues:stadium.add.warningDescription" components={{ link: <Link to="/adminPanel/businesses?new=1" /> }} />
        }
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card bordered={false} title={t('venues:stadium.add.formTitle')}>
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
                label={t('venues:stadium.add.name')}
                rules={[{ required: true, whitespace: true, message: t('venues:stadium.add.nameRequired') }]}
              >
                <Input placeholder={t('venues:stadium.add.namePlaceholder')} maxLength={100} />
              </Form.Item>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="city" label={t('venues:stadium.add.city')} rules={[{ required: true, message: t('venues:stadium.add.cityRequired') }]}>
                    <Select
                      showSearch
                      loading={citiesLoading}
                      placeholder={t('venues:stadium.add.cityRequired')}
                      optionFilterProp="label"
                      options={cities.map((c) => ({ value: c.name, label: c.name }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="district" label={t('venues:stadium.add.district')} rules={[{ required: true, message: t('venues:stadium.add.districtRequired') }]}>
                    <Select
                      showSearch
                      disabled={!cityName}
                      placeholder={cityName ? t('venues:stadium.add.districtRequired') : t('venues:stadium.add.cityFirst')}
                      optionFilterProp="label"
                      options={districts.map((d) => ({ value: d.name, label: d.name }))}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                name="address"
                label={t('venues:stadium.add.address')}
                rules={[{ required: true, whitespace: true, message: t('venues:stadium.add.addressRequired') }]}
              >
                <Input.TextArea rows={2} placeholder={t('venues:stadium.add.addressPlaceholder')} maxLength={250} />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="openingTime"
                    label={t('venues:stadium.add.openingTime')}
                    rules={[{ required: true, message: t('venues:stadium.add.openingTimeRequired') }]}
                  >
                    <TimePicker format="HH:mm" minuteStep={30} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="closingTime"
                    label={t('venues:stadium.add.closingTime')}
                    rules={[{ required: true, message: t('venues:stadium.add.closingTimeRequired') }]}
                  >
                    <TimePicker format="HH:mm" minuteStep={30} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                name="description"
                label={t('venues:stadium.add.description')}
                rules={[{ required: true, whitespace: true, message: t('venues:stadium.add.descriptionRequired') }]}
              >
                <Input.TextArea rows={3} placeholder={t('venues:stadium.add.descriptionPlaceholder')} maxLength={500} showCount />
              </Form.Item>
              <Form.Item
                name="location"
                label={t('venues:stadium.add.location')}
                extra={isPhone ? t('venues:stadium.add.locationExtraPhone') : t('venues:stadium.add.locationExtra')}
                rules={[{ required: true, message: t('venues:stadium.add.locationRequired') }]}
              >
                <Input readOnly prefix={<AimOutlined />} placeholder={t('venues:stadium.add.locationPlaceholder')} />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Space wrap className="mb-stadium-form-actions">
                  <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
                    {t('venues:stadium.add.save')}
                  </Button>
                  <Button onClick={() => navigate('/adminPanel/stadiums')}>{t('common:actions.cancel')}</Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card bordered={false} title={t('venues:stadium.add.mapTitle')}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Input.Search
                placeholder={t('venues:stadium.add.searchPlaceholder')}
                enterButton={t('common:actions.search')}
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
                <UserLocationMarker position={userPosition} />
                {selectedPosition && (
                  <Marker position={selectedPosition} icon={customIcon}>
                    <Popup>{t('venues:stadium.add.selectedLocation')}</Popup>
                  </Marker>
                )}
              </MapContainer>
              <Text type="secondary">
                {selectedPosition
                  ? t('venues:stadium.add.selectedLocationValue', { coords: formatCoords(selectedPosition) })
                  : t('venues:stadium.add.noLocationYet')}
              </Text>
            </Space>
          </Card>
        </Col>
      </Row>
    </>
  );
}

export default StadiumIsAdmin;
