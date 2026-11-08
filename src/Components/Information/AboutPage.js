import React from 'react';
import { Button, Card, Col, Image, List, Row, Space, Typography } from 'antd';
import {
  CheckCircleOutlined,
  InfoCircleOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../ui';
import aboutImage from '../../images/top.png';
import mackolikIcon from '../../images/Mackolik.png';
import sosyalHalisahaIcon from '../../images/sosyal_Halısaha.png';
import beinSports from '../../images/bein_Sports.png';
import varSistemi from '../../images/varSistemi.png';

const { Title, Paragraph, Text } = Typography;

// Metin anahtarları render anında t() ile çevrilir
const ADVANTAGES = [
  'info:aboutPage.advantages.booking',
  'info:aboutPage.advantages.communication',
  'info:aboutPage.advantages.reliable',
];

const FEATURES = [
  { icon: <ThunderboltOutlined />, titleKey: 'info:aboutPage.features.fastBooking.title', textKey: 'info:aboutPage.features.fastBooking.text' },
  { icon: <TeamOutlined />, titleKey: 'info:aboutPage.features.teamManagement.title', textKey: 'info:aboutPage.features.teamManagement.text' },
  { icon: <SafetyCertificateOutlined />, titleKey: 'info:aboutPage.features.reliableInfo.title', textKey: 'info:aboutPage.features.reliableInfo.text' },
];

const LINKS = [
  { href: 'https://www.mackolik.com', icon: mackolikIcon, label: 'Mackolik' },
  { href: 'https://www.sosyalhalisaha.com', icon: sosyalHalisahaIcon, label: 'Sosyal Halısaha' },
  { href: 'https://beinsports.com.tr', icon: beinSports, label: 'Bein Sports' },
  { href: 'https://varsistemi.com', icon: varSistemi, label: 'Var Sistemi' },
];

function AboutPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader
        title={t('info:aboutPage.title')}
        subtitle={t('info:aboutPage.subtitle')}
        icon={<InfoCircleOutlined />}
      />
      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Card bordered={false}>
            <Row gutter={[24, 16]} align="middle">
              <Col xs={24} md={9} style={{ textAlign: 'center' }}>
                <Image src={aboutImage} alt="Match Buddy" preview={false} style={{ maxHeight: 220, objectFit: 'contain' }} />
              </Col>
              <Col xs={24} md={15}>
                <Title level={4}>{t('info:aboutPage.purposeTitle')}</Title>
                <Paragraph>
                  {t('info:aboutPage.purposeText')}
                </Paragraph>
                <Title level={4}>{t('info:aboutPage.advantagesTitle')}</Title>
                <List
                  split={false}
                  dataSource={ADVANTAGES}
                  renderItem={(a) => (
                    <List.Item style={{ padding: '4px 0' }}>
                      <Space>
                        <CheckCircleOutlined style={{ color: 'var(--mb-pitch)' }} />
                        <Text>{t(a)}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        {FEATURES.map((f) => (
          <Col xs={24} md={8} key={f.titleKey}>
            <Card bordered={false} style={{ height: '100%' }}>
              <Space direction="vertical" size={8}>
                <span className="mb-page-header__icon">{f.icon}</span>
                <Text strong style={{ fontSize: 16 }}>
                  {t(f.titleKey)}
                </Text>
                <Text type="secondary">{t(f.textKey)}</Text>
              </Space>
            </Card>
          </Col>
        ))}

        <Col xs={24}>
          <Card bordered={false} title={t('info:aboutPage.otherSites')}>
            <Space wrap size={12}>
              {LINKS.map((l) => (
                <Button
                  key={l.label}
                  size="large"
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  icon={<img src={l.icon} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />}
                >
                  {l.label}
                </Button>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>
    </>
  );
}

export default AboutPage;
