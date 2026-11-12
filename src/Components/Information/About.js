import React from 'react';
import { Avatar, Button, Card, Col, Descriptions, Grid, Row, Space, Statistic, Typography } from 'antd';
import {
  EnvironmentOutlined,
  GithubOutlined,
  InfoCircleOutlined,
  LinkedinOutlined,
  MailOutlined,
  PhoneOutlined,
  YoutubeOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../ui';
import SerkanYildirim from './SerkanYildirim.jpg';
import Logo from '../../images/logo.png';

const { Title, Paragraph, Text } = Typography;

// Metin anahtarları render anında t() ile çevrilir
const TEAM = [
  { id: 'serkan', name: 'Serkan Yıldırım', roleKey: 'info:about.team.roles.founder', photo: SerkanYildirim },
  { id: 'other', nameKey: 'info:about.team.otherMember', roleKey: 'info:about.team.roles.frontend', photo: SerkanYildirim },
];

const STATS = [
  { titleKey: 'info:about.stats.users', value: '10,000+' },
  { titleKey: 'info:about.stats.matches', value: '5,000+' },
  { titleKey: 'info:about.stats.teams', value: '1,000+' },
];

const SOCIAL = [
  { href: 'https://www.linkedin.com/in/serkan-y%C4%B1ld%C4%B1r%C4%B1m-558571222/', icon: <LinkedinOutlined />, label: 'LinkedIn' },
  { href: 'https://github.com/serkanyldrmx', icon: <GithubOutlined />, label: 'GitHub' },
  { href: 'https://www.youtube.com/', icon: <YoutubeOutlined />, label: 'YouTube' },
];

const About = () => {
  const isPhone = Grid.useBreakpoint().md === false;
  const { t } = useTranslation();
  return (
  <>
    <PageHeader title={t('info:about.title')} subtitle={t('info:about.subtitle')} icon={<InfoCircleOutlined />} />
    <Row gutter={[16, 16]}>
      <Col xs={24}>
        <Card bordered={false}>
          <Space size={20} align="center" wrap>
            <Avatar src={Logo} size={72} shape="square" style={{ background: 'transparent', borderRadius: 16 }} />
            <div>
              <Title level={3} style={{ margin: 0 }}>
                MatcBuddy
              </Title>
              <Text type="secondary">{t('info:about.tagline')}</Text>
            </div>
          </Space>
        </Card>
      </Col>

      <Col xs={24} md={12}>
        <Card bordered={false} title={t('info:about.whoWeAre.title')} style={{ height: '100%' }}>
          <Paragraph style={{ margin: 0 }}>
            {t('info:about.whoWeAre.text')}
          </Paragraph>
        </Card>
      </Col>
      <Col xs={24} md={12}>
        <Card bordered={false} title={t('info:about.mission.title')} style={{ height: '100%' }}>
          <Paragraph style={{ margin: 0 }}>
            {t('info:about.mission.text')}
          </Paragraph>
        </Card>
      </Col>

      <Col xs={24} lg={14}>
        <Card bordered={false} title={t('info:about.team.title')} style={{ height: '100%' }}>
          <Row gutter={[16, 16]}>
            {TEAM.map((m) => (
              <Col xs={24} sm={12} key={m.id}>
                <Space align="start" size={14}>
                  <Avatar src={m.photo} size={64} />
                  <div>
                    <Text strong>{m.nameKey ? t(m.nameKey) : m.name}</Text>
                    <br />
                    <Text type="secondary">{t(m.roleKey)}</Text>
                  </div>
                </Space>
              </Col>
            ))}
          </Row>
        </Card>
      </Col>
      <Col xs={24} lg={10}>
        <Card bordered={false} title={t('info:about.stats.title')} style={{ height: '100%' }}>
          <Row gutter={16}>
            {STATS.map((s) => (
              <Col span={8} key={s.titleKey}>
                <Statistic
                  title={t(s.titleKey)}
                  value={s.value}
                  valueStyle={isPhone ? { fontSize: 20 } : undefined}
                />
              </Col>
            ))}
          </Row>
        </Card>
      </Col>

      <Col xs={24}>
        <Card bordered={false} title={t('info:about.contact.title')}>
          <Descriptions column={{ xs: 1, md: 3 }} size="small">
            <Descriptions.Item label={<PhoneOutlined />}>
              <a href="tel:+905455218249">+90 545 521 82 49</a>
            </Descriptions.Item>
            <Descriptions.Item label={<MailOutlined />}>
              <a href="mailto:bmserkanyildirim@matcbuddy.com">bmserkanyildirim@matcbuddy.com</a>
            </Descriptions.Item>
            <Descriptions.Item label={<EnvironmentOutlined />}>
              {t('info:about.contact.address')}
            </Descriptions.Item>
          </Descriptions>
          <Paragraph type="secondary" style={{ marginTop: 12 }}>
            {t('info:about.contact.followUs')}
          </Paragraph>
          <Space wrap>
            {SOCIAL.map((s) => (
              <Button key={s.label} icon={s.icon} href={s.href} target="_blank" rel="noopener noreferrer">
                {s.label}
              </Button>
            ))}
          </Space>
        </Card>
      </Col>
    </Row>
    <Paragraph type="secondary" style={{ textAlign: 'center', marginTop: 24, marginBottom: 0 }}>
      {t('info:copyright')}
    </Paragraph>
  </>
  );
};

export default About;
