import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Avatar, Button, Card, Col, Form, Input, InputNumber, Row, Space, Typography, Upload } from 'antd';
import { EditOutlined, LockOutlined, UploadOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/config';
import { USER_CHANGED } from '../../layout/AppLayout';
import { PageHeader } from '../../ui';
import ImageCrop from '../../ui/ImageCrop';
import { apiErrorMessage, formErrorMessage, getCurrentUser, mediaUrl } from '../../utils/format';
import { ACCEPTED_IMAGE_ACCEPT, imageError, preparedImageError, prepareImage } from '../../utils/image';
import { usePublicParams } from '../../api/parameters';
import './User.css';

const { Text } = Typography;

function UserUpdate() {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [user, setUser] = useState(getCurrentUser() || {});
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const rejectedRef = useRef(null); // kırpma öncesi reddedilen dosya
  const params = usePublicParams();
  const maxMb = params.get('media.maxUploadMb');
  const passwordMin = params.get('security.passwordMinLength');

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
      .catch((e) => message.error(apiErrorMessage(e, t('profile:loadError'))));
  }, [form, message, t]);

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
    const sizeErr = preparedImageError(prepared);
    if (sizeErr) {
      message.error(sizeErr);
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
      message.success(t('profile:edit.success'));
      navigate('/user');
    } catch (e) {
      // Sunucu alan hataları (errors sözlüğü) ilgili form alanlarının altında gösterilir
      message.error(formErrorMessage(form, e, t('profile:edit.error')));
    } finally {
      setSaving(false);
    }
  };

  const avatarSrc = preview || mediaUrl(user.profilePictureUrl, 'sm');

  return (
    <>
      <PageHeader title={t('profile:edit.title')} subtitle={t('profile:edit.subtitle')} icon={<EditOutlined />} />
      <Form form={form} layout="vertical" onFinish={submit} requiredMark="optional">
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}>
            <Card bordered={false} title={t('profile:edit.photo.title')} style={{ marginBottom: 24 }}>
              <div className="mb-upload-row">
                <Avatar size={88} src={avatarSrc} icon={!avatarSrc && <UserOutlined />} />
                <Space direction="vertical" size={4}>
                  <ImageCrop variant="avatar" beforeCrop={beforeCrop}>
                    <Upload beforeUpload={beforeUpload} showUploadList={false} accept={ACCEPTED_IMAGE_ACCEPT} maxCount={1}>
                      <Button icon={<UploadOutlined />}>{t('profile:edit.photo.select')}</Button>
                    </Upload>
                  </ImageCrop>
                  <Text type="secondary" style={{ fontSize: 12 }}>{t('profile:edit.photo.hint', { maxMb })}</Text>
                  {file && <Text style={{ fontSize: 12 }}>{t('profile:edit.photo.selected', { name: file.name })}</Text>}
                </Space>
              </div>
            </Card>

            <Card bordered={false} title={t('profile:edit.personal')} style={{ marginBottom: 24 }}>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="playerName" label={t('profile:fields.firstName')} rules={[{ required: true, whitespace: true, message: t('profile:edit.required.firstName') }]}>
                    <Input maxLength={100} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="playerSurname" label={t('profile:fields.lastName')} rules={[{ required: true, whitespace: true, message: t('profile:edit.required.lastName') }]}>
                    <Input maxLength={100} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="userName" label={t('profile:fields.userName')} rules={[{ required: true, whitespace: true, message: t('profile:edit.required.userName') }]}>
                    <Input prefix="@" maxLength={25} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="email"
                    label={t('profile:fields.email')}
                    rules={[
                      { required: true, message: t('profile:edit.required.email') },
                      { type: 'email', message: t('validation:email') },
                    ]}
                  >
                    <Input maxLength={100} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="phoneNumber" label={t('profile:fields.phone')} rules={[{ required: true, message: t('profile:edit.required.phone') }]}>
                    <Input placeholder="+90 5xx xxx xx xx" maxLength={20} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="address" label={t('profile:fields.address')} rules={[{ required: true, message: t('profile:edit.required.address') }]}>
                    <Input maxLength={200} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card bordered={false} title={t('profile:edit.physical')}>
              <Row gutter={16}>
                <Col xs={24} sm={8}>
                  <Form.Item name="age" label={t('profile:fields.age')} rules={[{ required: true, message: t('profile:edit.required.short') }]}>
                    <InputNumber min={10} max={80} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item name="size" label={t('profile:fields.height')} rules={[{ required: true, message: t('profile:edit.required.short') }]}>
                    <InputNumber min={120} max={230} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item name="weight" label={t('profile:fields.weight')} rules={[{ required: true, message: t('profile:edit.required.short') }]}>
                    <InputNumber min={30} max={200} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card bordered={false} title={t('profile:edit.password.title')} style={{ marginBottom: 24 }}>
              <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                {t('profile:edit.password.hint')}
              </Text>
              <Form.Item name="password" label={t('profile:edit.password.new')} rules={[{ min: passwordMin, message: t('profile:edit.password.minLength', { count: passwordMin }) }]} hasFeedback>
                <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
              </Form.Item>
              <Form.Item
                name="confirm"
                label={t('profile:edit.password.confirm')}
                dependencies={['password']}
                hasFeedback
                rules={[
                  ({ getFieldValue }) => ({
                    validator: (_, v) =>
                      !getFieldValue('password') || getFieldValue('password') === v
                        ? Promise.resolve()
                        : Promise.reject(new Error(t('validation:passwordMismatch'))),
                  }),
                ]}
              >
                <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
              </Form.Item>
            </Card>
            <Card bordered={false}>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button onClick={() => navigate('/user')}>{t('common:actions.cancel')}</Button>
                <Button type="primary" htmlType="submit" loading={saving}>
                  {t('profile:edit.submit')}
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
