import React, { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Alert, App, Button, Card, Col, Dropdown, Empty, Input, Modal, Radio, Result, Row, Skeleton, Spin, Tag, Tooltip } from 'antd';
import {
  CrownFilled,
  FlagOutlined,
  LockOutlined,
  MessageOutlined,
  MoreOutlined,
  StopOutlined,
  TeamOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { Trans, useTranslation } from 'react-i18next';
import { emit, REPORT_REASONS, socialApi, SOCIAL_CHANGED } from '../../api/social';
import { useMessages } from '../../messaging/MessagesContext';
import { EmptyState, PlayerAvatar, Stat } from '../../ui';
import { apiErrorMessage, fullName, getCurrentUser } from '../../utils/format';
import FollowButton, { PlayerLink } from './FollowButton';
import '../User/User.css';
import './PlayerProfile.css';

/** Takipçi / takip edilen listesi (modal) */
function FollowListModal({ playerId, kind, name, onClose }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const me = getCurrentUser();
  const { t } = useTranslation();

  useEffect(() => {
    if (!kind) return;
    setLoading(true);
    setError(null);
    (kind === 'followers' ? socialApi.followers(playerId) : socialApi.following(playerId))
      .then((r) => setList(r || []))
      .catch((e) =>
        setError(
          e?.response?.status === 403
            ? t('social:profile.followList.hidden')
            : apiErrorMessage(e, t('social:friends.loadFailed'))
        )
      )
      .finally(() => setLoading(false));
  }, [playerId, kind, t]);

  return (
    <Modal
      open={!!kind}
      onCancel={onClose}
      footer={null}
      title={kind === 'followers' ? t('social:profile.followList.followersTitle', { name }) : t('social:profile.followList.followingTitle', { name })}
      destroyOnClose
    >
      {loading ? (
        <div className="mb-pp-list__loading"><Spin /></div>
      ) : error ? (
        <EmptyState description={error} />
      ) : !list.length ? (
        <EmptyState description={kind === 'followers' ? t('social:profile.followList.noFollowers') : t('social:profile.followList.noFollowing')} />
      ) : (
        <div className="mb-pp-list">
          {list.map((p) => (
            <div key={p.playerId} className="mb-pp-list__row">
              <PlayerAvatar player={p} size={40} />
              <div className="mb-pp-list__name">
                <PlayerLink player={p} />
                <span>@{p.userName}</span>
              </div>
              {p.playerId !== me?.playerId && <FollowButton player={p} size="small" />}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export default function PlayerProfile() {
  const { playerId } = useParams();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const { openMessages } = useMessages();
  const { t } = useTranslation();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [listKind, setListKind] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState();
  const [details, setDetails] = useState('');
  const [reporting, setReporting] = useState(false);

  const load = useCallback(
    (silent) => {
      if (!silent) setLoading(true);
      return socialApi
        .profile(playerId)
        .then((p) => {
          setProfile(p);
          setNotFound(false);
        })
        .catch((e) => {
          if (e?.response?.status === 404) setNotFound(true);
          else message.error(apiErrorMessage(e, t('social:profile.loadFailed')));
        })
        .finally(() => setLoading(false));
    },
    [playerId, message, t]
  );

  useEffect(() => {
    setListKind(null);
    setProfile(null);
    setNotFound(false);
    load();
  }, [load]);

  if (loading && !profile) {
    return (
      <>
        <Card bordered={false} style={{ marginBottom: 20 }}>
          <Skeleton avatar={{ size: 96 }} active paragraph={{ rows: 3 }} />
        </Card>
        <Card bordered={false}>
          <Skeleton active paragraph={{ rows: 5 }} />
        </Card>
      </>
    );
  }

  if (notFound) {
    return (
      <Result
        status="404"
        title={t('social:profile.notFound.title')}
        subTitle={t('social:profile.notFound.subtitle')}
        extra={
          <Button type="primary" onClick={() => navigate('/friends?tab=discover')}>
            {t('social:friends.discoverPlayers')}
          </Button>
        }
      />
    );
  }

  if (!profile) return <EmptyState description={t('social:profile.loadFailed')} />;
  if (profile.isMe) return <Navigate to="/user" replace />;

  const player = profile.player || {};
  const name = fullName(player);
  const stats = profile.stats;
  const followTarget = { ...player, iFollow: profile.iFollow, followsMe: profile.followsMe };

  const block = () =>
    modal.confirm({
      title: t('social:profile.block.confirmTitle', { name }),
      icon: <StopOutlined style={{ color: 'var(--mb-danger)' }} />,
      content: (
        <ul className="mb-pp-confirm">
          <li>{t('social:profile.block.effectFollows')}</li>
          <li>{t('social:profile.block.effectVisibility')}</li>
          <li>{t('social:profile.block.effectContact')}</li>
          <li>{t('social:profile.block.effectUndo')}</li>
        </ul>
      ),
      okText: t('social:profile.block.block'),
      okButtonProps: { danger: true },
      cancelText: t('common:actions.cancel'),
      onOk: async () => {
        try {
          await socialApi.block(player.playerId);
          message.success(t('social:profile.block.blocked', { name }));
          emit(SOCIAL_CHANGED);
          load(true);
        } catch (e) {
          message.error(apiErrorMessage(e));
        }
      },
    });

  const unblock = async () => {
    try {
      await socialApi.unblock(player.playerId);
      message.success(t('social:profile.block.unblocked'));
      emit(SOCIAL_CHANGED);
      load(true);
    } catch (e) {
      message.error(apiErrorMessage(e));
    }
  };

  const submitReport = async () => {
    setReporting(true);
    try {
      await socialApi.report(player.playerId, reason, details.trim() || undefined);
      message.success(t('social:profile.report.success'));
      setReportOpen(false);
      setReason(undefined);
      setDetails('');
    } catch (e) {
      message.error(apiErrorMessage(e));
    } finally {
      setReporting(false);
    }
  };

  const menu = {
    items: [
      profile.isBlockedByMe
        ? { key: 'unblock', icon: <UnlockOutlined />, label: t('social:profile.block.unblock') }
        : { key: 'block', icon: <StopOutlined />, label: t('social:profile.block.block'), danger: true },
      { key: 'report', icon: <FlagOutlined />, label: t('social:profile.report.action') },
    ],
    onClick: ({ key }) => {
      if (key === 'block') block();
      if (key === 'unblock') unblock();
      if (key === 'report') setReportOpen(true);
    },
  };

  const messageBtn = (
    <Button
      icon={<MessageOutlined />}
      disabled={!profile.canMessage}
      onClick={() => openMessages({ type: 'user', data: { ...followTarget, isMutual: profile.isMutual } })}
      className="mb-ghost-btn"
    >
      {t('social:friends.sendMessage')}
    </Button>
  );

  return (
    <>
      {/* ---------- Oyuncu kartı ---------- */}
      <section className="mb-profile-hero mb-pitch-bg">
        <div className="mb-profile-hero__id">
          <PlayerAvatar player={player} size={112} />
          <div>
            <span className="mb-profile-hero__eyebrow">{t('social:profile.eyebrow')}</span>
            <h1>{name}</h1>
            <span className="mb-profile-hero__user">@{player.userName}</span>
            <div className="mb-pp-chips">
              {profile.isMutual && <span className="mb-chip is-live">{t('social:follow.friends')}</span>}
              {!profile.isMutual && profile.followsMe && <span className="mb-chip is-pending">{t('social:friends.followsYou')}</span>}
              {profile.isBlockedByMe && <span className="mb-chip is-rejected">{t('social:profile.block.blockedChip')}</span>}
            </div>
            <div className="mb-pp-counts">
              <button type="button" onClick={() => setListKind('followers')}>
                <Trans
                  i18nKey="social:profile.followersCount"
                  count={profile.followersCount ?? 0}
                  components={{ b: <strong /> }}
                />
              </button>
              <button type="button" onClick={() => setListKind('following')}>
                <Trans
                  i18nKey="social:profile.followingCount"
                  count={profile.followingCount ?? 0}
                  components={{ b: <strong /> }}
                />
              </button>
            </div>
            <div className="mb-profile-hero__tags">
              {player.age ? <span>{t('social:profile.age', { count: player.age })}</span> : null}
              {player.size ? <span>{t('social:profile.height', { value: player.size })}</span> : null}
              {player.weight ? <span>{t('social:profile.weight', { value: player.weight })}</span> : null}
            </div>
          </div>
        </div>
        <div className="mb-profile-hero__rating">
          <span>{t('social:profile.overallRating')}</span>
          <strong>{player.userScore ?? 0}</strong>
          <div className="mb-pp-actions">
            {!profile.isBlockedByMe && <FollowButton player={followTarget} onChange={() => load(true)} />}
            {!profile.isBlockedByMe &&
              (profile.canMessage ? (
                messageBtn
              ) : (
                <Tooltip title={t('social:profile.friendsOnlyMessages')}>
                  <span>{messageBtn}</span>
                </Tooltip>
              ))}
            <Dropdown menu={menu} trigger={['click']} placement="bottomRight">
              <Button icon={<MoreOutlined />} aria-label={t('common:other')} className="mb-ghost-btn" />
            </Dropdown>
          </div>
        </div>
      </section>

      {profile.isBlockedByMe && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 20 }}
          message={t('social:profile.block.alertTitle')}
          description={t('social:profile.block.alertDescription')}
          action={<Button size="small" onClick={unblock}>{t('social:profile.block.unblock')}</Button>}
        />
      )}

      {!profile.statsVisible ? (
        <Card bordered={false} className="mb-pp-locked">
          <LockOutlined className="mb-pp-locked__icon" />
          <h3>{t('social:profile.locked.title')}</h3>
          <p>{t('social:profile.locked.description')}</p>
          {!profile.iFollow && !profile.isBlockedByMe && (
            <FollowButton player={followTarget} onChange={() => load(true)} />
          )}
        </Card>
      ) : (
        <>
          <div className="mb-stat-strip">
            <Card><Stat value={stats?.matchesPlayed ?? 0} label={t('social:profile.stats.matches')} /></Card>
            <Card><Stat value={stats?.goals ?? 0} label={t('social:profile.stats.goals')} accent="var(--mb-primary)" /></Card>
            <Card><Stat value={stats?.assists ?? 0} label={t('social:profile.stats.assists')} /></Card>
            <Card><Stat value={stats?.mvpCount ?? 0} label={t('social:profile.stats.mvp')} accent="var(--mb-gold)" /></Card>
            <Card>
              <Stat
                value={stats?.avgRating != null ? stats.avgRating.toFixed(1) : '-'}
                label={t('social:profile.stats.avgRating', { count: stats?.ratingCount ?? 0 })}
              />
            </Card>
          </div>

          <Row gutter={[20, 20]}>
            <Col xs={24} lg={15}>
              <Card title={t('social:profile.recentMatches')}>
                {!stats?.recentMatches?.length ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('social:profile.noRecentMatches')} />
                ) : (
                  <div className="mb-recent">
                    {stats.recentMatches.map((m) => {
                      const mine = m.side === 2 ? m.awayScore : m.homeScore;
                      const theirs = m.side === 2 ? m.homeScore : m.awayScore;
                      // res: CSS sınıfı için sabit kod (G/M/B); görünen harf çeviriden gelir
                      const res = m.homeScore == null ? '-' : mine > theirs ? 'G' : mine < theirs ? 'M' : 'B';
                      const resLabel =
                        res === 'G'
                          ? t('social:profile.resultShort.win')
                          : res === 'M'
                            ? t('social:profile.resultShort.loss')
                            : res === 'B'
                              ? t('social:profile.resultShort.draw')
                              : res;
                      return (
                        <div key={m.matchId} className="mb-recent__row" onClick={() => navigate(`/match-details/${m.matchId}`)}>
                          <span className={`mb-result-badge is-${res}`}>{resLabel}</span>
                          <div className="mb-recent__name">
                            <strong>{m.matchName}</strong>
                            <span>{dayjs(m.matchDate).format('DD MMM YYYY')}</span>
                          </div>
                          <span className="mb-recent__score">
                            {m.homeScore ?? '-'} : {m.awayScore ?? '-'}
                          </span>
                          <span className="mb-recent__me">
                            {m.goals > 0 && <>⚽ {m.goals} </>}
                            {m.assists > 0 && <>🅰 {m.assists} </>}
                            {m.wasMvp && <CrownFilled style={{ color: 'var(--mb-gold)' }} />}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </Col>
            <Col xs={24} lg={9}>
              <Card className="mb-pp-together" style={{ marginBottom: 20 }}>
                <TeamOutlined className="mb-pp-together__icon" />
                {profile.playedTogether > 0 ? (
                  <div>
                    <strong>{t('social:profile.together.count', { count: profile.playedTogether })}</strong>
                    <span>{t('social:profile.together.played')}</span>
                  </div>
                ) : (
                  <div>
                    <strong>{t('social:profile.together.none')}</strong>
                    <span>{t('social:profile.together.cta')}</span>
                  </div>
                )}
              </Card>
              <Card title={t('social:profile.teams')}>
                {profile.teams?.length ? (
                  profile.teams.map((team) => (
                    <Tag key={team.teamId} style={{ marginBottom: 8, padding: '4px 10px' }}>
                      {team.teamName}
                    </Tag>
                  ))
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('social:profile.noTeams')} />
                )}
              </Card>
            </Col>
          </Row>
        </>
      )}

      <FollowListModal playerId={player.playerId} kind={listKind} name={name} onClose={() => setListKind(null)} />

      <Modal
        open={reportOpen}
        title={t('social:profile.report.title', { name })}
        okText={t('social:profile.report.action')}
        cancelText={t('common:actions.cancel')}
        okButtonProps={{ danger: true, disabled: !reason, loading: reporting }}
        onOk={submitReport}
        onCancel={() => setReportOpen(false)}
      >
        <p className="mb-pp-report__hint">{t('social:profile.report.hint')}</p>
        <Radio.Group value={reason} onChange={(e) => setReason(e.target.value)} className="mb-pp-report__reasons">
          {REPORT_REASONS.map((r) => (
            <Radio key={r.value} value={r.value}>
              {r.label}
            </Radio>
          ))}
        </Radio.Group>
        <Input.TextArea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder={t('social:profile.report.detailsPlaceholder')}
          autoSize={{ minRows: 3, maxRows: 6 }}
          maxLength={500}
          showCount
        />
      </Modal>
    </>
  );
}
