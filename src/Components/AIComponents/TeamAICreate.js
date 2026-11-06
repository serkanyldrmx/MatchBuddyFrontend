import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, App, Button, Card, Col, Input, InputNumber, List, Row, Space, Spin, Statistic, Typography } from 'antd';
import { ReloadOutlined, RobotOutlined, SaveOutlined, StarFilled, ThunderboltOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { aiFetch, api, TEAM_AI_BASE_URL } from '../../api/config';
import { EmptyState, PageHeader, PlayerAvatar } from '../../ui';
import { apiErrorMessage, fullName } from '../../utils/format';
import './TeamAICreate.css';

const { Text } = Typography;
const total = (team) => team.reduce((s, p) => s + (p.userScore || 0), 0);

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
          <List.Item extra={<Text type="secondary">{t('team:ai.points', { count: p.userScore ?? 0 })}</Text>}>
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
  const [teamSize, setTeamSize] = useState(6);
  const [teams, setTeams] = useState({ team1: [], team2: [] });
  const [names, setNames] = useState({ team1: '', team2: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const hasTeams = teams.team1.length > 0;
  const diff = useMemo(() => Math.abs(total(teams.team1) - total(teams.team2)), [teams]);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await aiFetch(TEAM_AI_BASE_URL, `/create-teams?teamSize=${teamSize}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text && text.length < 200 ? text : t('team:ai.generateError'));
      }
      const data = await res.json();
      setTeams({ team1: data.team1 || [], team2: data.team2 || [] });
      message.success(t('team:ai.generateSuccess'));
    } catch (e) {
      message.error(e.message === 'Failed to fetch' ? t('team:ai.serviceUnreachable') : e.message);
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
            <div>
              <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>{t('team:ai.teamSize')}</Text>
              <InputNumber min={4} max={11} value={teamSize} onChange={(v) => setTeamSize(v || 4)} style={{ width: 140 }} />
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
