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

  useEffect(() => {
    if (!kind) return;
    setLoading(true);
    setError(null);
    (kind === 'followers' ? socialApi.followers(playerId) : socialApi.following(playerId))
      .then((r) => setList(r || []))
      .catch((e) =>
        setError(e?.response?.status === 403 ? 'Bu oyuncu listelerini gizli tutuyor.' : apiErrorMessage(e, 'Liste yüklenemedi.'))
      )
      .finally(() => setLoading(false));
  }, [playerId, kind]);

  return (
    <Modal
      open={!!kind}
      onCancel={onClose}
      footer={null}
      title={kind === 'followers' ? `${name} — Takipçiler` : `${name} — Takip ettikleri`}
      destroyOnClose
    >
      {loading ? (
        <div className="mb-pp-list__loading"><Spin /></div>
      ) : error ? (
        <EmptyState description={error} />
      ) : !list.length ? (
        <EmptyState description={kind === 'followers' ? 'Henüz takipçisi yok.' : 'Henüz kimseyi takip etmiyor.'} />
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
          else message.error(apiErrorMessage(e, 'Profil yüklenemedi.'));
        })
        .finally(() => setLoading(false));
    },
    [playerId, message]
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
        title="Oyuncu bulunamadı"
        subTitle="Bu oyuncu yok ya da profiline erişemiyorsun."
        extra={
          <Button type="primary" onClick={() => navigate('/friends?tab=discover')}>
            Oyuncu keşfet
          </Button>
        }
      />
    );
  }

  if (!profile) return <EmptyState description="Profil yüklenemedi." />;
  if (profile.isMe) return <Navigate to="/user" replace />;

  const player = profile.player || {};
  const name = fullName(player);
  const stats = profile.stats;
  const followTarget = { ...player, iFollow: profile.iFollow, followsMe: profile.followsMe };

  const block = () =>
    modal.confirm({
      title: `${name} engellensin mi?`,
      icon: <StopOutlined style={{ color: 'var(--mb-danger)' }} />,
      content: (
        <ul className="mb-pp-confirm">
          <li>Aranızdaki tüm takipler (iki yönlü) kaldırılır.</li>
          <li>Birbirinizi listelerde, aramada ve akışta görmezsiniz.</li>
          <li>Sana mesaj, takip isteği ya da davet gönderemez.</li>
          <li>Engeli istediğin zaman Ayarlar'dan kaldırabilirsin.</li>
        </ul>
      ),
      okText: 'Engelle',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await socialApi.block(player.playerId);
          message.success(`${name} engellendi.`);
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
      message.success('Engel kaldırıldı.');
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
      message.success('Şikayetin alındı, teşekkürler. Ekibimiz inceleyecek.');
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
        ? { key: 'unblock', icon: <UnlockOutlined />, label: 'Engeli kaldır' }
        : { key: 'block', icon: <StopOutlined />, label: 'Engelle', danger: true },
      { key: 'report', icon: <FlagOutlined />, label: 'Şikayet et' },
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
      Mesaj gönder
    </Button>
  );

  return (
    <>
      {/* ---------- Oyuncu kartı ---------- */}
      <section className="mb-profile-hero mb-pitch-bg">
        <div className="mb-profile-hero__id">
          <PlayerAvatar player={player} size={112} />
          <div>
            <span className="mb-profile-hero__eyebrow">Oyuncu kartı</span>
            <h1>{name}</h1>
            <span className="mb-profile-hero__user">@{player.userName}</span>
            <div className="mb-pp-chips">
              {profile.isMutual && <span className="mb-chip is-live">Arkadaşsınız</span>}
              {!profile.isMutual && profile.followsMe && <span className="mb-chip is-pending">Seni takip ediyor</span>}
              {profile.isBlockedByMe && <span className="mb-chip is-rejected">Engellendi</span>}
            </div>
            <div className="mb-pp-counts">
              <button type="button" onClick={() => setListKind('followers')}>
                <strong>{profile.followersCount ?? 0}</strong> takipçi
              </button>
              <button type="button" onClick={() => setListKind('following')}>
                <strong>{profile.followingCount ?? 0}</strong> takip
              </button>
            </div>
            <div className="mb-profile-hero__tags">
              {player.age ? <span>{player.age} yaş</span> : null}
              {player.size ? <span>{player.size} cm</span> : null}
              {player.weight ? <span>{player.weight} kg</span> : null}
            </div>
          </div>
        </div>
        <div className="mb-profile-hero__rating">
          <span>Genel puan</span>
          <strong>{player.userScore ?? 0}</strong>
          <div className="mb-pp-actions">
            {!profile.isBlockedByMe && <FollowButton player={followTarget} onChange={() => load(true)} />}
            {!profile.isBlockedByMe &&
              (profile.canMessage ? (
                messageBtn
              ) : (
                <Tooltip title="Bu oyuncu sadece arkadaşlarından mesaj kabul ediyor">
                  <span>{messageBtn}</span>
                </Tooltip>
              ))}
            <Dropdown menu={menu} trigger={['click']} placement="bottomRight">
              <Button icon={<MoreOutlined />} aria-label="Diğer" className="mb-ghost-btn" />
            </Dropdown>
          </div>
        </div>
      </section>

      {profile.isBlockedByMe && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 20 }}
          message="Bu oyuncuyu engelledin"
          description="Birbirinize mesaj, takip ya da davet gönderemezsiniz."
          action={<Button size="small" onClick={unblock}>Engeli kaldır</Button>}
        />
      )}

      {!profile.statsVisible ? (
        <Card bordered={false} className="mb-pp-locked">
          <LockOutlined className="mb-pp-locked__icon" />
          <h3>Bu oyuncu istatistiklerini gizli tutuyor</h3>
          <p>Maçlarını ve takımlarını sadece izin verdiği kişiler görebilir.</p>
          {!profile.iFollow && !profile.isBlockedByMe && (
            <FollowButton player={followTarget} onChange={() => load(true)} />
          )}
        </Card>
      ) : (
        <>
          <div className="mb-stat-strip">
            <Card><Stat value={stats?.matchesPlayed ?? 0} label="Maç" /></Card>
            <Card><Stat value={stats?.goals ?? 0} label="Gol" accent="var(--mb-primary)" /></Card>
            <Card><Stat value={stats?.assists ?? 0} label="Asist" /></Card>
            <Card><Stat value={stats?.mvpCount ?? 0} label="MVP" accent="var(--mb-gold)" /></Card>
            <Card>
              <Stat
                value={stats?.avgRating != null ? stats.avgRating.toFixed(1) : '-'}
                label={`Ort. puan (${stats?.ratingCount ?? 0})`}
              />
            </Card>
          </div>

          <Row gutter={[20, 20]}>
            <Col xs={24} lg={15}>
              <Card title="Son maçlar">
                {!stats?.recentMatches?.length ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Henüz oynanmış maçı yok." />
                ) : (
                  <div className="mb-recent">
                    {stats.recentMatches.map((m) => {
                      const mine = m.side === 2 ? m.awayScore : m.homeScore;
                      const theirs = m.side === 2 ? m.homeScore : m.awayScore;
                      const res = m.homeScore == null ? '-' : mine > theirs ? 'G' : mine < theirs ? 'M' : 'B';
                      return (
                        <div key={m.matchId} className="mb-recent__row" onClick={() => navigate(`/match-details/${m.matchId}`)}>
                          <span className={`mb-result-badge is-${res}`}>{res}</span>
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
                    <strong>Birlikte {profile.playedTogether} maç</strong>
                    <span>oynadınız</span>
                  </div>
                ) : (
                  <div>
                    <strong>Henüz birlikte oynamadınız</strong>
                    <span>Bir maça birlikte katılın!</span>
                  </div>
                )}
              </Card>
              <Card title="Takımları">
                {profile.teams?.length ? (
                  profile.teams.map((t) => (
                    <Tag key={t.teamId} style={{ marginBottom: 8, padding: '4px 10px' }}>
                      {t.teamName}
                    </Tag>
                  ))
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Henüz bir takımda değil." />
                )}
              </Card>
            </Col>
          </Row>
        </>
      )}

      <FollowListModal playerId={player.playerId} kind={listKind} name={name} onClose={() => setListKind(null)} />

      <Modal
        open={reportOpen}
        title={`${name} adlı oyuncuyu şikayet et`}
        okText="Şikayet et"
        cancelText="Vazgeç"
        okButtonProps={{ danger: true, disabled: !reason, loading: reporting }}
        onOk={submitReport}
        onCancel={() => setReportOpen(false)}
      >
        <p className="mb-pp-report__hint">Neden şikayet ediyorsun? Şikayetin gizli tutulur.</p>
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
          placeholder="Eklemek istediğin bir detay var mı? (isteğe bağlı)"
          autoSize={{ minRows: 3, maxRows: 6 }}
          maxLength={500}
          showCount
        />
      </Modal>
    </>
  );
}
