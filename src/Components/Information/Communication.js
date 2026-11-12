import React from 'react';
import { App, Avatar, Button, Card, Col, Descriptions, Form, Input, Row, Space, Typography } from 'antd';
import { EnvironmentOutlined, MailOutlined, PhoneOutlined, SendOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../ui';
import SerkanYildirim from './SerkanYildirim.jpg';

const { Text, Paragraph } = Typography;

const Communication = () => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const { t } = useTranslation();

  // Mesaj gönderimi için henüz bir servis yok; mesaj yalnızca not alınır.
  const handleFinish = () => {
    message.info(t('info:contact.submitted'));
    form.resetFields();
  };

  return (
    <>
      <PageHeader
        title={t('info:contact.title')}
        subtitle={t('info:contact.subtitle')}
        icon={<MailOutlined />}
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card bordered={false} title={t('info:contact.infoTitle')} style={{ height: '100%' }}>
            <Space align="center" size={16} style={{ marginBottom: 20 }}>
              <Avatar src={SerkanYildirim} size={64} />
              <div>
                <Text strong>Serkan Yıldırım</Text>
                <br />
                <Text type="secondary">MatcBuddy</Text>
              </div>
            </Space>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label={<Space><EnvironmentOutlined />{t('info:contact.address')}</Space>}>{t('info:contact.addressValue')}</Descriptions.Item>
              <Descriptions.Item label={<Space><PhoneOutlined />{t('info:contact.phone')}</Space>}>
                <a href="tel:+905455218249">+90 545 521 82 49</a>
              </Descriptions.Item>
              <Descriptions.Item label={<Space><MailOutlined />{t('info:contact.email')}</Space>}>
                <a href="mailto:bmserkanyildirim@matcbuddy.com">bmserkanyildirim@matcbuddy.com</a>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card bordered={false} title={t('info:contact.formTitle')} style={{ height: '100%' }}>
            <Form form={form} layout="vertical" onFinish={handleFinish} requiredMark={false}>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="name"
                    label={t('info:contact.name')}
                    rules={[{ required: true, whitespace: true, message: t('info:contact.nameRequired') }]}
                  >
                    <Input placeholder={t('info:contact.namePlaceholder')} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="email"
                    label={t('info:contact.email')}
                    rules={[
                      { required: true, message: t('info:contact.emailRequired') },
                      { type: 'email', message: t('info:contact.emailInvalid') },
                    ]}
                  >
                    <Input placeholder={t('info:contact.emailPlaceholder')} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                name="message"
                label={t('info:contact.message')}
                rules={[{ required: true, whitespace: true, message: t('info:contact.messageRequired') }]}
              >
                <Input.TextArea rows={5} placeholder={t('info:contact.messagePlaceholder')} maxLength={1000} showCount />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" icon={<SendOutlined />}>
                  {t('common:actions.send')}
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
      <Paragraph type="secondary" style={{ textAlign: 'center', marginTop: 24, marginBottom: 0 }}>
        {t('info:copyright')}
      </Paragraph>
    </>
  );
};

export default Communication;
