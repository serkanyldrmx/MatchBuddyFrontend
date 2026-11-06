import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Avatar, Button, Card, Col, Form, Input, InputNumber, Row, Space, Typography, Upload } from 'antd';
import { EditOutlined, LockOutlined, UploadOutlined, UserOutlined } from '@ant-design/icons';
import { api } from '../../api/config';
import { USER_CHANGED } from '../../layout/AppLayout';
import { PageHeader } from '../../ui';
import ImageCrop from '../../ui/ImageCrop';
import { apiErrorMessage, getCurrentUser, mediaUrl } from '../../utils/format';
import { ACCEPTED_IMAGE_ACCEPT, MAX_IMAGE_BYTES, MAX_IMAGE_MB, imageError, prepareImage } from '../../utils/image';
import './User.css';

const { Text } = Typography;

function UserUpdate() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [user, setUser] = useState(getCurrentUser() || {});
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const rejectedRef = useRef(null); // kırpma öncesi reddedilen dosya

  useEffect(() => {
    // Formu sunucudaki güncel profil ile doldur
    const me = getCurrentUser();
    if (!me?.playerId) return;
    api
      .get(`/api/Players/GetPlayerById?playerId=${me.playerId}`)
      .then((r) => {
        setUser(r.data);
        form.setFieldsValue({
          playerName: r.data.playerName,
          playerSurname: r.data.playerSurname,
          userName: r.data.userName,
          email: r.data.email,
          phoneNumber: r.data.phoneNumber,
          address: r.data.address,
          size: r.data.size || null,
          weight: r.data.weight || null,
          age: r.data.age || null,
        });
      })
      .catch((e) => message.error(apiErrorMessage(e, 'Profil yüklenemedi.')));
  }, [form, message]);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  // Kırpmadan önce tür/boyut kontrolü; uygun değilse kırpma penceresi açılmaz
  const beforeCrop = (f) => {
    const err = imageError(f);
    if (!err) return true;
    message.error(err);
    rejectedRef.current = f;
    return false;
  };

  // Kırpılmış dosya: tarayıcıda küçült, önizle, kaydette gönder
  const beforeUpload = async (f) => {
    if (f === rejectedRef.current) {
      rejectedRef.current = null;
      return Upload.LIST_IGNORE;
    }
    const prepared = await prepareImage(f);
    if (prepared.size > MAX_IMAGE_BYTES) {
      message.error(`Fotoğraf en fazla ${MAX_IMAGE_MB} MB olabilir.`);
      return Upload.LIST_IGNORE;
    }
    setFile(prepared);
    setPreview(URL.createObjectURL(prepared));
    return false;
  };

  const submit = async (values) => {
    setSaving(true);
    try {
      const model = {
        PlayerId: user.playerId,
        PlayerName: values.playerName,
        PlayerSurname: values.playerSurname,
        UserName: values.userName,
        Email: values.email,
        PhoneNumber: values.phoneNumber,
        Address: values.address,
        Size: values.size || 0,
        Weight: values.weight || 0,
        Age: values.age || 0,
        UserScore: user.userScore || 0,
        Password: values.password || '', // boş: mevcut şifre korunur
      };
      const fd = new FormData();
      fd.append('playerModel', JSON.stringify(model));
      if (file) fd.append('profilePicture', file);
      await api.post('/api/Players/UpdatePlayer', fd, { headers: { 'Content-Type': 'multipart/form-data' } });

      const fresh = await api.get(`/api/Players/GetPlayerById?playerId=${user.playerId}`);
      localStorage.setItem('user', JSON.stringify(fresh.data));
      window.dispatchEvent(new Event(USER_CHANGED));
      message.success('Profiliniz güncellendi.');
      navigate('/user');
    } catch (e) {
      message.error(apiErrorMessage(e, 'Profil güncellenemedi.'));
    } finally {
      setSaving(false);
    }
  };

  const avatarSrc = preview || mediaUrl(user.profilePictureUrl, 'sm');

  return (
    <>
      <PageHeader title="Profili düzenle" subtitle="Bilgilerini güncel tut; takım arkadaşların seni daha kolay bulsun." icon={<EditOutlined />} />
      <Form form={form} layout="vertical" onFinish={submit} requiredMark="optional">
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}>
            <Card bordered={false} title="Profil fotoğrafı" style={{ marginBottom: 24 }}>
              <div className="mb-upload-row">
                <Avatar size={88} src={avatarSrc} icon={!avatarSrc && <UserOutlined />} />
                <Space direction="vertical" size={4}>
                  <ImageCrop variant="avatar" beforeCrop={beforeCrop}>
                    <Upload beforeUpload={beforeUpload} showUploadList={false} accept={ACCEPTED_IMAGE_ACCEPT} maxCount={1}>
                      <Button icon={<UploadOutlined />}>Fotoğraf seç</Button>
                    </Upload>
                  </ImageCrop>
                  <Text type="secondary" style={{ fontSize: 12 }}>JPG, PNG veya WebP, en fazla {MAX_IMAGE_MB} MB. Seçtikten sonra kırpabilirsin.</Text>
                  {file && <Text style={{ fontSize: 12 }}>Seçildi: {file.name}</Text>}
                </Space>
              </div>
            </Card>

            <Card bordered={false} title="Kişisel bilgiler" style={{ marginBottom: 24 }}>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="playerName" label="Ad" rules={[{ required: true, whitespace: true, message: 'Ad zorunludur.' }]}>
                    <Input maxLength={100} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="playerSurname" label="Soyad" rules={[{ required: true, whitespace: true, message: 'Soyad zorunludur.' }]}>
                    <Input maxLength={100} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="userName" label="Kullanıcı adı" rules={[{ required: true, whitespace: true, message: 'Kullanıcı adı zorunludur.' }]}>
                    <Input prefix="@" maxLength={25} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="email"
                    label="E-posta"
                    rules={[
                      { required: true, message: 'E-posta zorunludur.' },
                      { type: 'email', message: 'Geçerli bir e-posta girin.' },
                    ]}
                  >
                    <Input maxLength={100} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="phoneNumber" label="Telefon" rules={[{ required: true, message: 'Telefon zorunludur.' }]}>
                    <Input placeholder="+90 5xx xxx xx xx" maxLength={20} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="address" label="Adres" rules={[{ required: true, message: 'Adres zorunludur.' }]}>
                    <Input maxLength={200} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card bordered={false} title="Fiziksel bilgiler">
              <Row gutter={16}>
                <Col xs={24} sm={8}>
                  <Form.Item name="age" label="Yaş" rules={[{ required: true, message: 'Zorunlu' }]}>
                    <InputNumber min={10} max={80} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item name="size" label="Boy (cm)" rules={[{ required: true, message: 'Zorunlu' }]}>
                    <InputNumber min={120} max={230} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item name="weight" label="Kilo (kg)" rules={[{ required: true, message: 'Zorunlu' }]}>
                    <InputNumber min={30} max={200} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card bordered={false} title="Şifre değiştir" style={{ marginBottom: 24 }}>
              <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                Şifrenizi değiştirmek istemiyorsanız boş bırakın.
              </Text>
              <Form.Item name="password" label="Yeni şifre" rules={[{ min: 6, message: 'En az 6 karakter olmalıdır.' }]} hasFeedback>
                <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
              </Form.Item>
              <Form.Item
                name="confirm"
                label="Yeni şifre (tekrar)"
                dependencies={['password']}
                hasFeedback
                rules={[
                  ({ getFieldValue }) => ({
                    validator: (_, v) =>
                      !getFieldValue('password') || getFieldValue('password') === v
                        ? Promise.resolve()
                        : Promise.reject(new Error('Şifreler eşleşmiyor.')),
                  }),
                ]}
              >
                <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
              </Form.Item>
            </Card>
            <Card bordered={false}>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button onClick={() => navigate('/user')}>Vazgeç</Button>
                <Button type="primary" htmlType="submit" loading={saving}>
                  Değişiklikleri kaydet
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>
      </Form>
    </>
  );
}

export default UserUpdate;
