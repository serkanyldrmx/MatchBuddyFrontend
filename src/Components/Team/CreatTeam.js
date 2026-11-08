import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Avatar, Button, Card, Col, Form, Input, Row, Space, Typography } from 'antd';
import { ArrowLeftOutlined, TeamOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/config';
import { PageHeader, PlayerAvatar } from '../../ui';
import { apiErrorMessage, getCurrentUser } from '../../utils/format';
import { PlayerPickerTable } from './PlayerSelectionPopup';

const { Text } = Typography;

const CreateTeam = () => {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = getCurrentUser();
  const [form] = Form.useForm();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  // Takımı kuran kişi varsayılan olarak takımdadır (sonradan kadroyu yönetebilmesi için)
  const [selected, setSelected] = useState(me?.playerId ? [me.playerId] : []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get('/api/Players/GetPlayerList')
      .then((r) => setPlayers((r.data || []).filter((p) => p.isAdmin !== 1)))
      .catch((e) => message.error(apiErrorMessage(e, t('team:loadPlayersError'))))
      .finally(() => setLoading(false));
  }, [message, t]);

  const selectedPlayers = players.filter((p) => selected.includes(p.playerId));

  const submit = async ({ teamName }) => {
    if (selected.length === 0) {
      message.warning(t('team:create.selectAtLeastOne'));
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/api/Team/SaveTeam', { teamName: teamName.trim(), playerId: selected });
      if (res.data?.success === false) {
        message.error(res.data.message || t('team:create.error'));
        return;
      }
      message.success(t('team:create.success'));
      navigate('/team');
    } catch (e) {
      message.error(apiErrorMessage(e, t('team:create.error')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/team')} style={{ paddingLeft: 0, marginBottom: 8 }}>
        {t('team:create.back')}
      </Button>
      <PageHeader title={t('team:list.create')} subtitle={t('team:create.subtitle')} icon={<TeamOutlined />} />

      <Form form={form} layout="vertical" onFinish={submit} requiredMark="optional">
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={8}>
            <Card bordered={false} title={t('team:create.infoTitle')} style={{ position: 'sticky', top: 88 }}>
              <Form.Item
                name="teamName"
                label={t('team:create.teamName')}
                rules={[
                  { required: true, whitespace: true, message: t('team:create.teamNameRequired') },
                  { min: 3, message: t('team:create.minChars', { count: 3 }) },
                ]}
              >
                <Input placeholder={t('team:create.teamNamePlaceholder')} maxLength={40} showCount />
              </Form.Item>

              <Text type="secondary">{t('team:create.selectedPlayers', { count: selected.length })}</Text>
              <div style={{ margin: '8px 0 20px' }}>
                {selectedPlayers.length ? (
                  <Avatar.Group max={{ count: 8 }}>
                    {selectedPlayers.map((p) => (
                      <PlayerAvatar key={p.playerId} player={p} size={36} />
                    ))}
                  </Avatar.Group>
                ) : (
                  <Text type="secondary">{t('team:create.noneSelected')}</Text>
                )}
              </div>

              <Space>
                <Button onClick={() => navigate('/team')}>{t('common:actions.cancel')}</Button>
                <Button type="primary" htmlType="submit" loading={saving}>
                  {t('team:create.submit')}
                </Button>
              </Space>
            </Card>
          </Col>
          <Col xs={24} lg={16}>
            <Card bordered={false} title={t('team:create.playersTitle')}>
              <PlayerPickerTable players={players} selected={selected} onChange={setSelected} loading={loading} />
            </Card>
          </Col>
        </Row>
      </Form>
    </>
  );
};

export default CreateTeam;
