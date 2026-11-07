import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, App, Button, Card, Col, Input, List, Row, Select, Space, Spin, Statistic, Typography } from 'antd';
import { ReloadOutlined, RobotOutlined, SaveOutlined, StarFilled, ThunderboltOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/config';
import { aiApi } from '../../api/ai';
import { socialApi } from '../../api/social';
import { EmptyState, PageHeader, PlayerAvatar } from '../../ui';
import { apiErrorMessage, fullName, getCurrentUser } from '../../utils/format';
import './TeamAICreate.css';

const { Text } = Typography;
const total = (team) => Math.round(team.reduce((s, p) => s + (p.power || 0), 0));

function TeamColumn({ side, name, onName, players }) {
  const { t } = useTranslation();
  return (
    <Card
      bordered={false}
      className={`mb-ai-team is-${side}`}
      title={
        <Input
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder={side === 'home' ? t('team:ai.team1Placeholder') : t('team:ai.team2Placeholder')}
          variant="borderless"
          className="mb-ai-team__name"
          maxLength={40}
        />
      }
      extra={<Statistic value={total(players)} prefix={<StarFilled style={{ color: 'var(--mb-gold)' }} />} valueStyle={{ fontSize: 18 }} />}
    >
      <List
        dataSource={players}
        renderItem={(p) => (
          <List.Item extra={<Text type="secondary">{t('team:ai.power', { power: Math.round(p.power || 0) })}</Text>}>
            <List.Item.Meta
              avatar={<PlayerAvatar player={p} size={36} />}
              title={fullName(p)}
              description={t('team:ai.playerStats', { age: p.age || '-', size: p.size || '-', weight: p.weight || '-' })}
            />
          </List.Item>
        )}
      />
    </Card>
  );
}

function TeamAICreate() {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selected, setSelected] = useState([]);
  const [pool, setPool] = useState([]);
  const [teams, setTeams] = useState({ team1: [], team2: [] });
  const [names, setNames] = useState({ team1: '', team2: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const hasTeams = teams.team1.length > 0;
  // Seçilebilecek oyuncular: ben + takip ettiklerim
  useEffect(() => {
    const me = getCurrentUser();
    if (!me?.playerId) return;
    socialApi.following(me.playerId)
      .then((list) => setPool([me, ...(list || []).filter((p) => p.playerId !== me.playerId)]))
      .catch(() => setPool([me]));
  }, []);

  const diff = useMemo(() => Math.abs(total(teams.team1) - total(teams.team2)), [teams]);

  const generate = async () => {
    setLoading(true);
    try {
      const data = await aiApi.balanceTeams({ playerIds: selected });
      setTeams({ team1: data.team1 || [], team2: data.team2 || [] });
      message.success(t('team:ai.generateSuccess'));
    } catch (e) {
      message.error(apiErrorMessage(e, t('team:ai.generateError')));
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!names.team1.trim() || !names.team2.trim()) {
      message.warning(t('team:ai.namesRequired'));
      return;
    }
    setSaving(true);
    try {
      for (const key of ['team1', 'team2']) {
        await api.post('/api/Team/SaveTeam', {
          teamName: names[key].trim(),
          playerId: teams[key].map((p) => p.playerId).filter(Boolean),
        });
      }
      message.success(t('team:ai.saveSuccess'));
      navigate('/team');
    } catch (e) {
      message.error(apiErrorMessage(e, t('team:ai.saveError')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title={t('team:ai.title')}
        subtitle={t('team:ai.subtitle')}
        icon={<RobotOutlined />}
      />

      <Card bordered={false} style={{ marginBottom: 24 }}>
        <div className="mb-ai-settings">
          <Space align="end" wrap size={16}>
            <div style={{ minWidth: 260, maxWidth: 520 }}>
              <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>{t('team:ai.players')}</Text>
              <Select
                mode="multiple"
                allowClear
                value={selected}
                onChange={setSelected}
                placeholder={t('team:ai.playersPlaceholder')}
                style={{ width: '100%', minWidth: 260 }}
                optionFilterProp="label"
                maxTagCount="responsive"
                options={pool.map((p) => ({ value: p.playerId, label: fullName(p) }))}
              />
            </div>
            <Button type="primary" icon={hasTeams ? <ReloadOutlined /> : <ThunderboltOutlined />} onClick={generate} loading={loading}>
              {hasTeams ? t('team:ai.regenerate') : t('team:ai.generate')}
            </Button>
          </Space>
          {hasTeams && (
            <Space wrap size={24}>
              <Statistic title={t('team:ai.scoreDiff')} value={diff} valueStyle={{ color: diff <= 10 ? 'var(--mb-pitch)' : 'var(--mb-gold)' }} />
              <Button type="primary" icon={<SaveOutlined />} onClick={save} loading={saving}>
                {t('team:ai.save')}
              </Button>
            </Space>
          )}
        </div>
      </Card>

      <Spin spinning={loading} tip={t('team:ai.balancing')}>
        {hasTeams ? (
          <>
            {diff > 10 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                message={t('team:ai.highDiff')}
              />
            )}
            <Row gutter={[24, 24]}>
              <Col xs={24} md={12}>
                <TeamColumn side="home" name={names.team1} onName={(v) => setNames((n) => ({ ...n, team1: v }))} players={teams.team1} />
              </Col>
              <Col xs={24} md={12}>
                <TeamColumn side="away" name={names.team2} onName={(v) => setNames((n) => ({ ...n, team2: v }))} players={teams.team2} />
              </Col>
            </Row>
          </>
        ) : (
          <Card bordered={false}>
            <EmptyState description={t('team:ai.empty')} />
          </Card>
        )}
      </Spin>
    </>
  );
}

export default TeamAICreate;
