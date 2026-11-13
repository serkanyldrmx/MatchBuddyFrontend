import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Rate,
  Result,
  Row,
  Select,
  Table,
  Tabs,
  Tooltip,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  CheckOutlined,
  CrownFilled,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  FlagOutlined,
  HeartFilled,
  HomeOutlined,
  InfoCircleOutlined,
  HeartOutlined,
  LogoutOutlined,
  MessageOutlined,
  SendOutlined,
  StarOutlined,
  SunOutlined,
  SwapOutlined,
  UserAddOutlined,
  VideoCameraOutlined,
  RobotOutlined,
  SyncOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { Trans, useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { api } from '../../api/config';
import { matchesApi, PARTICIPANT_STATUS, SIDE } from '../../api/matches';
import { aiApi } from '../../api/ai';
import { formatPrice, SURFACE, venuesApi } from '../../api/venues';
import { useMessages } from '../../messaging/MessagesContext';
import { CapacityRing, MatchStatusTag, PageLoader, PlayerAvatar, ReliabilityBadge } from '../../ui';
import { apiErrorMessage, fullName, getCurrentUser, mediaUrl } from '../../utils/format';
import { usePublicParams } from '../../api/parameters';
import MatchComments from '../Post/MatchComments';
import InviteModal from '../Invites/InviteModal';
import FollowButton, { PlayerLink } from '../Social/FollowButton';
import GuestModal from './GuestModal';
import ExternalVenueCard from './ExternalVenueCard';
import WeatherBadge from '../../ui/WeatherBadge';
import ShareMatchButton from './ShareMatchButton';
import LeaveMatchModal from './LeaveMatchModal';
import EditMatchModal from './EditMatchModal';
import ShareToGroupModal from './ShareToGroupModal';
import { NoShowCard, SubstituteCard, WithdrawalsCard } from './ReliabilityPanels';
import { roleShort, ROLE_LABELS } from './formations';
import Pitch, { guestInitials, sideRoster } from './Pitch';
import './MatchDetails.css';
import { SwipeTabs } from '../../ui/Swipe';
import MatchReminderCard from './MatchReminderCard';
import { mapsUrl } from '../Venues/ExternalVenueForm';
import VenueMiniMap from '../../ui/map/VenueMiniMap';

const homeName = (d) => d.homeTeam?.teamName || i18n.t('match:sides.home');
const awayName = (d) =>
  d.awayTeam?.teamName || (d.lookingForOpponent ? i18n.t('match:sides.seekingOpponent') : i18n.t('match:sides.away'));

/* ---------------- Maç sonu ---------------- */
function PostMatch({ detail, me, reload }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  // Skor / oyuncu istatistiği / puan üst sınırları sunucu parametrelerinden
  const params = usePublicParams();
  const maxScore = params.get('match.maxScore');
  const maxPlayerStat = params.get('match.maxPlayerStat');
  const ratingMax = params.get('match.ratingMax');
  const going = detail.participants.filter((p) => p.status === PARTICIPANT_STATUS.GOING);
  const iPlayed = detail.myStatus === PARTICIPANT_STATUS.GOING;
  const others = going.filter((p) => p.player.playerId !== me?.playerId);
  // Takip etmediğim takım arkadaşları (oturum boyunca listede kalsınlar ki "Takiptesin" durumu görünsün)
  const [replayIds] = useState(() => others.filter((p) => p.iFollow === false).map((p) => p.player.playerId));
  const replay = others.filter((p) => replayIds.includes(p.player.playerId));

  // Sonuç formu (kurucu / admin)
  const [score, setScore] = useState({ home: detail.result?.homeScore ?? 0, away: detail.result?.awayScore ?? 0 });
  const [stats, setStats] = useState(() =>
    Object.fromEntries(going.map((p) => [p.player.playerId, { goals: p.goals || 0, assists: p.assists || 0 }]))
  );
  const [savingResult, setSavingResult] = useState(false);

  // Puanlar
  const initialRatings = useMemo(
    () => Object.fromEntries((detail.myRatings || []).map((r) => [r.playerId, r.score])),
    [detail.myRatings]
  );
  const [ratings, setRatings] = useState(initialRatings);
  const [savingRatings, setSavingRatings] = useState(false);

  const saveResult = async () => {
    setSavingResult(true);
    try {
      await matchesApi.submitResult({
        matchId: detail.matchId,
        homeScore: score.home,
        awayScore: score.away,
        stats: Object.entries(stats).map(([playerId, s]) => ({ playerId: Number(playerId), ...s })),
      });
      message.success(t('match:post.resultSaved'));
      reload();
    } catch (e) {
      message.error(apiErrorMessage(e, t('match:post.resultFailed')));
    } finally {
      setSavingResult(false);
    }
  };

  const vote = async (playerId) => {
    try {
      await matchesApi.voteMvp(detail.matchId, playerId);
      message.success(t('match:post.mvpVoted'));
      reload();
    } catch (e) {
      message.error(apiErrorMessage(e, t('match:post.voteFailed')));
    }
  };

  const saveRatings = async () => {
    const list = Object.entries(ratings)
      .filter(([, s]) => s > 0)
      .map(([playerId, s]) => ({ playerId: Number(playerId), score: s }));
    if (!list.length) {
      message.warning(t('match:post.rateAtLeastOne'));
      return;
    }
    setSavingRatings(true);
    try {
      await matchesApi.ratePlayers(detail.matchId, list);
      message.success(t('match:post.ratingsSaved'));
      reload();
    } catch (e) {
      message.error(apiErrorMessage(e, t('match:post.ratingsFailed')));
    } finally {
      setSavingRatings(false);
    }
  };

  const statColumns = [
    {
      title: t('match:post.columns.player'),
      render: (_, p) => (
        <span className="mb-inline-player">
          <PlayerAvatar player={p.player} size={28} /> {fullName(p.player)}
          <span className={`mb-side-dot ${p.side === SIDE.AWAY ? 'is-away' : 'is-home'}`} />
        </span>
      ),
    },
    ...['goals', 'assists'].map((k) => ({
      title: k === 'goals' ? t('match:post.columns.goals') : t('match:post.columns.assists'),
      width: 110,
      render: (_, p) => (
        <InputNumber
          min={0}
          max={maxPlayerStat}
          size="small"
          value={stats[p.player.playerId]?.[k]}
          onChange={(v) => setStats((s) => ({ ...s, [p.player.playerId]: { ...s[p.player.playerId], [k]: v || 0 } }))}
        />
      ),
    })),
  ];

  return (
    <Row gutter={[20, 20]}>
      {detail.canManage && (
        <Col xs={24}>
          <Card title={detail.result ? t('match:post.editResult') : t('match:post.enterResult')}>
            <div className="mb-result-form">
              <div className="mb-result-form__side is-home">
                <span>{homeName(detail)}</span>
                <InputNumber min={0} max={maxScore} size="large" value={score.home} onChange={(v) => setScore((s) => ({ ...s, home: v || 0 }))} />
              </div>
              <span className="mb-result-form__sep">:</span>
              <div className="mb-result-form__side is-away">
                <span>{awayName(detail)}</span>
                <InputNumber min={0} max={maxScore} size="large" value={score.away} onChange={(v) => setScore((s) => ({ ...s, away: v || 0 }))} />
              </div>
            </div>
            <Table rowKey={(p) => p.player.playerId} size="small" pagination={false} columns={statColumns} dataSource={going} style={{ marginTop: 16 }} />
            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <Button type="primary" icon={<CheckOutlined />} loading={savingResult} onClick={saveResult}>
                {t('match:post.saveResult')}
              </Button>
            </div>
          </Card>
        </Col>
      )}

      {iPlayed && replay.length > 0 && (
        <Col xs={24}>
          <Card className="mb-replay-card" title={t('match:post.replayTitle')}>
            <p className="mb-replay-card__text">{t('match:post.replayText')}</p>
            <div className="mb-replay-list">
              {replay.map((p) => (
                <div key={p.player.playerId} className="mb-replay-item">
                  <PlayerAvatar player={p.player} size={44} />
                  <div className="mb-replay-item__name">
                    <PlayerLink player={p.player} />
                    <small>
                      {p.goals > 0 ? t('match:post.goals', { count: p.goals }) : `@${p.player.userName}`}
                      {p.avgRating != null && ` · ${t('match:post.avgRating', { value: p.avgRating.toFixed(1) })}`}
                    </small>
                  </div>
                  <FollowButton player={{ ...p.player, iFollow: p.iFollow }} size="small" />
                </div>
              ))}
            </div>
          </Card>
        </Col>
      )}

      <Col xs={24} lg={12}>
        <Card
          title={
            <span>
              <CrownFilled style={{ color: 'var(--mb-gold)', marginRight: 8 }} />
              {t('match:post.mvpTitle')}
            </span>
          }
        >
          {!iPlayed ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('match:post.mvpOnlyPlayers')} />
          ) : others.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('match:post.mvpNoOne')} />
          ) : (
            <div className="mb-mvp-grid">
              {others.map((p) => {
                const mine = detail.myMvpVote === p.player.playerId;
                const leader = detail.mvp?.player?.playerId === p.player.playerId;
                return (
                  <button
                    type="button"
                    key={p.player.playerId}
                    className={`mb-mvp-card ${mine ? 'is-voted' : ''} ${leader ? 'is-leader' : ''}`}
                    onClick={() => vote(p.player.playerId)}
                  >
                    {leader && <CrownFilled className="mb-mvp-card__crown" />}
                    <PlayerAvatar player={p.player} size={48} />
                    <strong>{p.player.playerName}</strong>
                    <span>{t('match:post.votes', { count: p.mvpVotes || 0 })}</span>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </Col>

      <Col xs={24} lg={12}>
        <Card title={t('match:post.rateTitle')}>
          {!iPlayed ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('match:post.rateOnlyPlayers')} />
          ) : (
            <>
              <div className="mb-rate-list">
                {others.map((p) => (
                  <div key={p.player.playerId} className="mb-rate-row">
                    <span className="mb-inline-player">
                      <PlayerAvatar player={p.player} size={32} />
                      <span>
                        {fullName(p.player)}
                        {p.avgRating != null && <small> · {t('match:post.avgRating', { value: p.avgRating.toFixed(1) })}</small>}
                      </span>
                    </span>
                    <Rate count={ratingMax} value={ratings[p.player.playerId] || 0} onChange={(v) => setRatings((r) => ({ ...r, [p.player.playerId]: v }))} />
                  </div>
                ))}
              </div>
              <Button type="primary" block style={{ marginTop: 16 }} loading={savingRatings} onClick={saveRatings}>
                {t('match:post.rateSubmit')}
              </Button>
              <p className="mb-hint">{t('match:post.rateHint')}</p>
            </>
          )}
        </Card>
      </Col>

      {detail.canReview && (
        <Col xs={24}>
          <VenueReviewCard detail={detail} reload={reload} />
        </Col>
      )}
    </Row>
  );
}

/* ---------------- Tesis değerlendirme ---------------- */
function VenueReviewCard({ detail, reload }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [rating, setRating] = useState(detail.myReview?.rating || 0);
  const [comment, setComment] = useState(detail.myReview?.comment || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!rating) {
      message.warning(t('match:review.starFirst'));
      return;
    }
    setSaving(true);
    try {
      await venuesApi.review(detail.matchId, rating, comment.trim() || undefined);
      message.success(detail.myReview ? t('match:review.updated') : t('match:review.thanks'));
      reload();
    } catch (e) {
      message.error(apiErrorMessage(e, t('match:review.failed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      className="mb-venue-review-card"
      title={
        <span>
          <StarOutlined style={{ color: 'var(--mb-gold)', marginRight: 8 }} />
          {t('match:review.title')}
        </span>
      }
    >
      <div className="mb-venue-review">
        {detail.venue?.coverPhotoUrl && <img src={mediaUrl(detail.venue.coverPhotoUrl, 'sm')} alt="" decoding="async" />}
        <div className="mb-venue-review__form">
          <strong>{detail.venue?.name}</strong>
          <span className="mb-hint">{t('match:review.hint')}</span>
          <Rate value={rating} onChange={setRating} className="mb-venue-review__rate" />
          <Input.TextArea
            rows={3}
            maxLength={500}
            showCount
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('match:review.placeholder')}
          />
          <div>
            <Button type="primary" loading={saving} onClick={save}>
              {detail.myReview ? t('match:review.update') : t('match:review.submit')}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ---------------- Rezervasyon kartı ---------------- */
function ReservationCard({ d, onMessageOwner }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const v = d.venue;

  useEffect(() => {
    if (!v?.stadiumId) return undefined;
    let alive = true;
    venuesApi
      .detail(v.stadiumId)
      .then((r) => alive && setInfo(r))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [v?.stadiumId]);

  // Detay yanıtında ayrı saha/ekstra tutarı yoksa tesisin güncel fiyatlarından hesaplanır
  const computedExtras =
    info?.prices != null
      ? (d.cleatCount || 0) * (info.prices.cleatRentalPrice || 0) + (d.cameraRequested ? info.prices.cameraPrice || 0 : 0)
      : null;
  const extras = d.extrasPrice ?? computedExtras;
  const pitchPrice = d.pitchPrice ?? (d.totalPrice != null && extras != null ? d.totalPrice - extras : null);
  const start = dayjs(d.matchDate);
  const duration = d.durationMinutes || 60;
  const hasExtras = d.cleatCount > 0 || d.cameraRequested;

  return (
    <Card className="mb-booking" title={t('match:booking.title')}>
      <button type="button" className="mb-booking__head" onClick={() => navigate(`/venues/${v.stadiumId}`)}>
        {v.coverPhotoUrl ? <img src={mediaUrl(v.coverPhotoUrl, 'sm')} alt="" loading="lazy" decoding="async" /> : <span className="mb-booking__ph mb-pitch-bg" />}
        <span className="mb-booking__head-text">
          <strong>{v.name}</strong>
          <span>
            {v.isIndoor ? <HomeOutlined /> : <SunOutlined />} {v.pitchName} · {SURFACE[v.surface] || t('common:pitch')} ·{' '}
            {v.isIndoor ? t('common:indoor') : t('common:outdoor')}
          </span>
          <span>
            {start.format('DD MMM, HH:mm')}–{start.add(duration, 'minute').format('HH:mm')} · {t('match:booking.minutes', { count: duration })}
          </span>
        </span>
      </button>

      <div className="mb-booking__lines">
        {pitchPrice != null && (
          <div>
            <span>{t('common:pitch')}</span>
            <span>{formatPrice(pitchPrice)}</span>
          </div>
        )}
        {hasExtras && (
          <div>
            <span>
              {t('match:booking.extras')}
              <small>
                {d.cleatCount > 0 && t('match:booking.cleats', { count: d.cleatCount })}
                {d.cleatCount > 0 && d.cameraRequested && ' · '}
                {d.cameraRequested && (
                  <>
                    <VideoCameraOutlined /> {t('match:booking.recording')}
                  </>
                )}
              </small>
            </span>
            <span>{extras != null ? formatPrice(extras) : '-'}</span>
          </div>
        )}
        <div className="is-total">
          <span>{t('match:booking.total')}</span>
          <span>{formatPrice(d.totalPrice)}</span>
        </div>
      </div>
      {d.perPlayer != null && (
        <div className="mb-booking__per">
          <span>{t('match:booking.perPlayer')}</span>
          <strong>{formatPrice(d.perPlayer)}</strong>
        </div>
      )}
      {d.perPlayer != null && d.cleatPrice != null && (
        <p className="mb-hint">{t('match:booking.cleatOnlyRenter', { price: formatPrice(d.cleatPrice) })}</p>
      )}
      {info?.cancellationPolicy && (
        <p className="mb-booking__policy">
          <InfoCircleOutlined /> <span>{info.cancellationPolicy}</span>
        </p>
      )}
      <p className="mb-hint">{t('match:booking.payOnSite')}</p>
      <div className="mb-booking__actions">
        <Button onClick={() => navigate(`/venues/${v.stadiumId}`)}>{t('match:booking.goToVenue')}</Button>
        {d.ownerPlayerId && (
          <Button icon={<MessageOutlined />} onClick={() => onMessageOwner(info?.owner?.name)}>
            {t('match:booking.messageOwner')}
          </Button>
        )}
      </div>
    </Card>
  );
}

/* ---------------- Sayfa ---------------- */
function MatchDetails() {
  const { t } = useTranslation();
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const { openMessages } = useMessages();
  const me = getCurrentUser();

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('lineup');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [myTeams, setMyTeams] = useState([]);
  const [claimTeamId, setClaimTeamId] = useState();
  const [claiming, setClaiming] = useState(false);
  // Misafir oyuncu modalı: { open, guest?, side? }
  const [guestModal, setGuestModal] = useState({ open: false });
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [groupShareOpen, setGroupShareOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await matchesApi.detail(matchId);
      if (!d) setNotFound(true);
      setDetail(d);
      setLoadError(null);
    } catch (e) {
      if (e?.response?.status === 404) setNotFound(true);
      else setLoadError(apiErrorMessage(e, t('match:details.loadFailed')));
    } finally {
      setLoading(false);
    }
  }, [matchId, t]);

  useEffect(() => {
    load();
  }, [load]);

  // Bitmiş maçta varsayılan sekme "Maç sonu"
  useEffect(() => {
    if (detail?.isPast) setTab((t) => (t === 'lineup' ? 'post' : t));
  }, [detail?.isPast]);

  const run = async (fn, okText) => {
    setBusy(true);
    try {
      const res = await fn();
      message.success(res?.message || okText);
      await load();
    } catch (e) {
      message.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const openClaim = async () => {
    setClaimOpen(true);
    try {
      const r = await api.get('/api/Team/GetTeamList');
      setMyTeams((r.data || []).filter((t) => (t.playerId || []).includes(me?.playerId) && t.teamId !== detail?.homeTeam?.teamId));
    } catch (e) {
      message.error(apiErrorMessage(e, t('match:details.teamsFailed')));
    }
  };

  const claim = async () => {
    if (!claimTeamId) {
      message.warning(t('match:details.selectTeam'));
      return;
    }
    setClaiming(true);
    try {
      const res = await venuesApi.claimOpponent(detail.matchId, claimTeamId);
      message.success(res?.message || t('match:details.claimed'));
      setClaimOpen(false);
      await load();
    } catch (e) {
      message.error(apiErrorMessage(e, t('match:details.claimFailed')));
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return <PageLoader caption={t('match:details.loading')} />;
  }
  // Geçmiş yoksa (bildirimden / linkten doğrudan açıldıysa) geri tuşu ana sayfaya döner
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/home'));

  if (!notFound && !detail && loadError) {
    return (
      <Result
        status="warning"
        title={t('match:details.loadErrorTitle')}
        subTitle={loadError}
        extra={[
          <Button
            key="retry"
            type="primary"
            onClick={() => {
              setLoading(true);
              load();
            }}
          >
            {t('match:details.retry')}
          </Button>,
          <Button key="home" onClick={() => navigate('/home')}>
            {t('match:details.backToFixture')}
          </Button>,
        ]}
      />
    );
  }
  if (notFound || !detail) {
    return (
      <Result
        status="404"
        title={t('match:details.notFound')}
        extra={
          <Button type="primary" onClick={() => navigate('/home')}>
            {t('match:details.backToFixture')}
          </Button>
        }
      />
    );
  }

  const d = detail;
  const date = dayjs(d.matchDate);
  const going = d.participants.filter((p) => p.status === PARTICIPANT_STATUS.GOING);
  const waitlist = d.participants.filter((p) => p.status === PARTICIPANT_STATUS.WAITLIST);
  const guests = d.guests || [];
  // Kadro sayıları misafirleri de kapsar (Going + misafir)
  const rosterCount = going.length + guests.length;
  const perSide = Math.max(Math.ceil(d.capacity / 2), 1);
  const homeRoster = sideRoster(d, SIDE.HOME);
  const awayRoster = sideRoster(d, SIDE.AWAY);
  const closed = d.isPast || d.isActive === 3;
  const canManageGuests = !!d.canManage && !closed;
  const canJoin = !closed && !d.myStatus;
  const hoursLeft = date.diff(dayjs(), 'hour');

  // Sahada boş bir yere dokunulduysa { side, slot } gelir (düğmeden gelen tıklama olayı yok sayılır)
  const join = (pos) =>
    run(
      () => (Number.isInteger(pos?.side) ? matchesApi.join(d.matchId, pos.side, pos.slot) : matchesApi.join(d.matchId)),
      t('match:actions.joined')
    );
  // "Maça gelemiyorum": mazeret + ceza önizlemesi (docs/reliability-api.md)
  const leave = () => setLeaveOpen(true);
  const confirmAttendance = () => run(() => matchesApi.confirm(d.matchId), t('match:details.confirmed'));
  const toggleLike = () =>
    run(() =>
      matchesApi.toggleLike(d.matchId).then((r) => ({ message: r.liked ? t('match:details.liked') : t('match:details.unliked') }))
    );
  const swap = (p) =>
    run(
      () => matchesApi.setSide(d.matchId, p.player.playerId, p.side === SIDE.AWAY ? SIDE.HOME : SIDE.AWAY),
      t('match:details.sideChanged')
    );
  // Katılan oyuncuları güçlerine göre iki dengeli tarafa böler (yalnızca kurucu)
  const balanceSides = () =>
    run(() => aiApi.balanceTeams({ matchId: d.matchId, apply: true }), t('match:details.balanced'));
  const msg = (player) => openMessages({ type: 'user', data: player });
  const openGuestModal = (side, guest) => setGuestModal({ open: true, side, guest });
  const editGuest = (g) => openGuestModal(undefined, g);
  const moveGuest = (g) =>
    run(
      () => matchesApi.updateGuest(g.guestId, g.side === SIDE.AWAY ? SIDE.HOME : SIDE.AWAY, g.name, g.note || undefined),
      t('match:details.guestMoved', { name: g.name })
    );
  // Sahada sürükle-bırak ile kurulan diziliş (Pitch → düzenleme modu). Başarıda true döner.
  const arrangeLineup = async (items) => {
    setBusy(true);
    try {
      const res = await matchesApi.arrangeLineup(d.matchId, items);
      message.success(res?.message || t('match:pitch.arrangeSaved'));
      await load();
      return true;
    } catch (e) {
      message.error(apiErrorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const removeGuest = (g) => run(() => matchesApi.removeGuest(g.guestId), t('match:details.guestRemoved', { name: g.name }));
  const messageOwner = (ownerName) =>
    openMessages({
      type: 'user',
      data: {
        playerId: d.ownerPlayerId,
        playerName: ownerName || d.venue?.name || t('match:details.business'),
        userName: t('match:details.businessUserName'),
      },
    });
  const seekingOpponent = d.lookingForOpponent && !d.awayTeam && !closed;
  const remove = () =>
    modal.confirm({
      title: t('match:details.deleteTitle'),
      content: (
        <>
          <p style={{ marginBottom: 8 }}>{t('match:details.deleteContent')}</p>
          {going.length > 1 && <p style={{ marginBottom: 8 }}>{t('match:details.deleteNotify', { count: going.length - 1 })}</p>}
          {going.length > 1 && hoursLeft < 24 && <p className="mb-hint" style={{ margin: 0 }}>{t('match:details.deletePenalty')}</p>}
        </>
      ),
      okText: t('common:actions.delete'),
      okButtonProps: { danger: true },
      cancelText: t('common:actions.cancel'),
      onOk: async () => {
        try {
          await matchesApi.remove(d.matchId);
          message.success(t('match:details.deleted'));
          navigate('/home');
        } catch (e) {
          message.error(apiErrorMessage(e, t('match:details.deleteFailed')));
        }
      },
    });

  // Aksiyon butonları
  let primaryAction = null;
  if (d.myStatus === PARTICIPANT_STATUS.GOING) {
    primaryAction = !d.isPast && (
      <>
        {!d.myConfirmed && (
          <Button type="primary" size="large" icon={<CheckOutlined />} loading={busy} onClick={confirmAttendance}>
            {t('match:details.actions.confirmAttendance')}
          </Button>
        )}
        <Button size="large" icon={<LogoutOutlined />} onClick={leave} className="mb-ghost-btn">
          {t('match:details.actions.leave')}
        </Button>
      </>
    );
  } else if (d.myStatus === PARTICIPANT_STATUS.WAITLIST) {
    primaryAction = !d.isPast && (
      <Button size="large" icon={<LogoutOutlined />} onClick={leave} className="mb-ghost-btn">
        {t('match:details.actions.leaveWaitlist')}
      </Button>
    );
  } else if (canJoin) {
    primaryAction = (
      <Button type="primary" size="large" icon={<UserAddOutlined />} loading={busy} onClick={join}>
        {rosterCount < d.capacity ? t('match:actions.join') : t('match:actions.joinWaitlist')}
      </Button>
    );
  }

  const hasResult = !!d.result;
  const canInvite = !closed && (d.myStatus === PARTICIPANT_STATUS.GOING || d.canManage);

  return (
    <>
      {/* ---------- Skor tabelası ---------- */}
      <section className="mb-match-hero mb-pitch-bg">
        <div className="mb-match-hero__top">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={goBack} className="mb-ghost-link">
            {t('match:details.backLink')}
          </Button>
          <div className="mb-match-hero__chips">
            <MatchStatusTag status={d.isActive} past={d.isPast} />
            {d.repeatWeekly && (
              <span className="mb-chip">
                <SyncOutlined /> {t('match:repeat.chip')}
              </span>
            )}
            {d.myStatus === PARTICIPANT_STATUS.GOING && <span className="mb-chip is-live">{t('match:status.inSquad')}</span>}
            {d.myStatus === PARTICIPANT_STATUS.WAITLIST && <span className="mb-chip is-pending">{t('match:status.waitlisted')}</span>}
          </div>
        </div>

        <h1 className="mb-match-hero__title">{d.matchName}</h1>
        <div className="mb-match-hero__meta">
          <EnvironmentOutlined /> {d.venue ? [d.venue.name, d.venue.pitchName].filter(Boolean).join(' · ') : d.stadium?.stadiumName} ·{' '}
          {date.format('DD MMMM YYYY, dddd')}
          {d.createdBy && (
            <>
              {' · '}
              <Trans i18nKey="match:details.founder" values={{ name: fullName(d.createdBy) }} components={{ b: <strong /> }} />
            </>
          )}
        </div>

        <div className="mb-scoreboard">
          <div className="mb-scoreboard__team is-home">
            <span>{d.homeTeam ? t('match:sides.home') : t('match:players', { count: homeRoster.count })}</span>
            <strong>{d.homeTeam ? d.homeTeam.teamName : t('match:sides.home')}</strong>
          </div>
          <div className="mb-scoreboard__center">
            {hasResult ? (
              <div className="mb-scoreboard__score">
                {d.result.homeScore}
                <i>–</i>
                {d.result.awayScore}
              </div>
            ) : (
              <div className="mb-scoreboard__time">{date.format('HH:mm')}</div>
            )}
            <span className="mb-scoreboard__caption">
              {hasResult
                ? t('match:details.scoreboard.result')
                : d.isPast
                  ? t('match:details.scoreboard.awaitingResult')
                  : hoursLeft < 24
                    ? t('match:details.scoreboard.hoursLeft', { count: Math.max(hoursLeft, 0) })
                    : date.fromNow()}
            </span>
          </div>
          <div className={`mb-scoreboard__team is-away ${seekingOpponent ? 'is-seeking' : ''}`}>
            {d.awayTeam ? (
              <>
                <span>{t('match:sides.away')}</span>
                <strong>{d.awayTeam.teamName}</strong>
              </>
            ) : seekingOpponent ? (
              <>
                <span>{t('match:sides.seekingOpponent')}</span>
                <strong>?</strong>
                <Button size="small" type="primary" icon={<FlagOutlined />} onClick={openClaim} className="mb-scoreboard__claim">
                  {t('match:details.actions.claim')}
                </Button>
              </>
            ) : (
              <>
                <span>{t('match:players', { count: awayRoster.count })}</span>
                <strong>{t('match:sides.away')}</strong>
              </>
            )}
          </div>
        </div>

        <div className="mb-match-hero__bottom">
          <CapacityRing going={rosterCount} capacity={d.capacity} size={48} />
          <div className="mb-match-hero__actions">
            <Tooltip title={d.likedByMe ? t('match:actions.unlike') : t('match:actions.like')}>
              <Button size="large" className="mb-ghost-btn" icon={d.likedByMe ? <HeartFilled style={{ color: 'var(--mb-danger)' }} /> : <HeartOutlined />} onClick={toggleLike}>
                {d.likes}
              </Button>
            </Tooltip>
            {canInvite && (
              <Button size="large" icon={<SendOutlined />} onClick={() => setInviteOpen(true)} className="mb-ghost-btn">
                {t('match:details.actions.invite')}
              </Button>
            )}
            {canInvite && (
              <Button size="large" icon={<TeamOutlined />} onClick={() => setGroupShareOpen(true)} className="mb-ghost-btn">
                {t('match:shareGroup.button')}
              </Button>
            )}
            {!closed && <ShareMatchButton matchId={d.matchId} className="mb-ghost-btn" />}
            {d.canManage && !closed && (
              <Button size="large" icon={<EditOutlined />} onClick={() => setEditOpen(true)} className="mb-ghost-btn">
                {t('match:edit.button')}
              </Button>
            )}
            {primaryAction}
          </div>
        </div>
      </section>

      {d.myStatus === PARTICIPANT_STATUS.GOING && !d.myConfirmed && !d.isPast && hoursLeft <= 24 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('match:details.alerts.confirmSoon')}
        />
      )}
      {d.isActive === 1 && !d.isPast && (
        <Alert type="info" showIcon style={{ marginBottom: 16 }} message={t('match:details.alerts.pendingApproval')} />
      )}
      {d.isActive === 3 && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('match:details.alerts.rejected')}
          description={d.rejectReason ? t('match:details.alerts.rejectReason', { reason: d.rejectReason }) : undefined}
          action={
            d.venue && !d.venue.isExternal && (
              <Button size="small" onClick={() => navigate(`/venues/${d.venue.stadiumId}`)}>
                {t('match:details.actions.otherSlot')}
              </Button>
            )
          }
        />
      )}

      <div className="mb-match-weather">
        <WeatherBadge matchId={d.matchId} matchDate={d.matchDate} closed={closed} compact={false} />
      </div>

      <SwipeTabs>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          className="mb-match-tabs"
          items={[
            {
              key: 'lineup',
              label: t('match:details.tabs.lineup', { count: rosterCount }),
              children: (
                <Row gutter={[20, 20]}>
                  <Col xs={24} xl={17}>
                    <Pitch
                      detail={d}
                      me={me}
                      perSide={perSide}
                      homeLabel={homeName(d)}
                      awayLabel={awayName(d)}
                      closed={closed}
                      canJoin={canJoin}
                      onJoin={join}
                      onSwap={swap}
                      onMessage={msg}
                      onAddGuest={(side) => openGuestModal(side)}
                      onEditGuest={editGuest}
                      onMoveGuest={moveGuest}
                      onRemoveGuest={removeGuest}
                      onArrange={arrangeLineup}
                    />
                  </Col>
                  <Col xs={24} xl={7}>
                    <MatchReminderCard detail={d} />
                    {d.canManage && d.repeatWeekly && (
                      <Button
                        block
                        icon={<SyncOutlined />}
                        loading={busy}
                        style={{ marginBottom: 12 }}
                        onClick={() => run(() => matchesApi.stopRepeat(d.matchId), t('match:repeat.stopped'))}
                      >
                        {t('match:repeat.stop')}
                      </Button>
                    )}
                    {d.canManage && !closed && going.length >= 2 && (
                      <Button block icon={<RobotOutlined />} loading={busy} onClick={balanceSides} style={{ marginBottom: 12 }}>
                        {t('match:details.actions.balanceTeams')}
                      </Button>
                    )}
                    {d.canManage && !closed && waitlist.length === 0 && d.capacity - rosterCount > 0 && (
                      <SubstituteCard detail={d} openSpots={d.capacity - rosterCount} />
                    )}
                    <WithdrawalsCard detail={d} reload={load} />
                    <Card title={t('match:details.waitlistTitle', { count: waitlist.length })} size="small">
                      {waitlist.length === 0 ? (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('match:details.waitlistEmpty')} />
                      ) : (
                        <ol className="mb-waitlist">
                          {waitlist.map((p) => (
                            <li key={p.player.playerId}>
                              <PlayerAvatar player={p.player} size={30} />
                              <span>{p.player.playerId === me?.playerId ? t('match:pitch.you') : <PlayerLink player={p.player} />}</span>
                              {d.canManage && <ReliabilityBadge reliability={p.reliability} compact />}
                            </li>
                          ))}
                        </ol>
                      )}
                    </Card>
                    {guests.length > 0 && (
                      <Card title={t('match:details.guestsTitle', { count: guests.length })} size="small" className="mb-guest-card">
                        <ul className="mb-guest-list">
                          {[...homeRoster.guests, ...awayRoster.guests].map((g) => (
                            <li key={g.guestId}>
                              <span className={`mb-guest-list__avatar is-${g.side === SIDE.AWAY ? 'away' : 'home'}`}>{guestInitials(g.name)}</span>
                              <span className="mb-guest-list__text">
                                <strong>{g.name}</strong>
                                <small>
                                  {g.side === SIDE.AWAY ? awayName(d) : homeName(d)}
                                  {g.note ? ` · ${g.note}` : ''}
                                </small>
                              </span>
                              {canManageGuests && (
                                <span className="mb-guest-list__actions">
                                  <Tooltip title={t('common:actions.edit')}>
                                    <Button
                                      type="text"
                                      size="small"
                                      icon={<EditOutlined />}
                                      onClick={() => editGuest(g)}
                                      aria-label={t('common:actions.edit')}
                                    />
                                  </Tooltip>
                                  <Popconfirm
                                    title={t('match:guest.removeTitle')}
                                    description={t('match:guest.removeDescription', { name: g.name })}
                                    okText={t('match:guest.remove')}
                                    okButtonProps={{ danger: true }}
                                    cancelText={t('common:actions.cancel')}
                                    onConfirm={() => removeGuest(g)}
                                  >
                                    <Button
                                      type="text"
                                      size="small"
                                      danger
                                      icon={<DeleteOutlined />}
                                      aria-label={t('match:guest.remove')}
                                    />
                                  </Popconfirm>
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </Card>
                    )}
                    <div className="mb-legend">
                      <span><CheckCircleFilled style={{ color: 'var(--mb-pitch)' }} /> {t('match:details.legend.confirmed')}</span>
                      <span><CrownFilled style={{ color: 'var(--mb-gold)' }} /> {t('match:details.legend.mvp')}</span>
                      <span><span className="mb-legend__guest" /> {t('match:details.legend.guest')}</span>
                      <span>
                        <span className="mb-legend__pos">{roleShort('KL')}</span>{' '}
                        {[ROLE_LABELS.KL, ...['DF', 'OS', 'FV'].map((r) => `${roleShort(r)} ${ROLE_LABELS[r]}`)].join(' · ')}
                      </span>
                      {d.canManage && <span><SwapOutlined /> {t('match:details.legend.swap')}</span>}
                      {canManageGuests && <span><UserAddOutlined /> {t('match:details.legend.addGuest')}</span>}
                    </div>
                  </Col>
                </Row>
              ),
            },
            {
              key: 'post',
              label: t('match:details.tabs.post'),
              children: d.isPast ? (
                <>
                  <NoShowCard key={d.matchId} detail={d} me={me} reload={load} />
                  <WithdrawalsCard detail={d} reload={load} />
                  <PostMatch detail={d} me={me} reload={load} />
                </>
              ) : (
                <Card>
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('match:details.postEmpty')} />
                </Card>
              ),
            },
            {
              key: 'comments',
              label: t('match:details.tabs.comments'),
              children: (
                <Card>
                  <MatchComments matchId={d.matchId} />
                </Card>
              ),
            },
            {
              key: 'info',
              label: t('match:details.tabs.info'),
              children: (
                <Row gutter={[20, 20]}>
                  {d.venue && (
                    <Col xs={24} lg={10}>
                      {d.venue.isExternal ? (
                        <ExternalVenueCard d={d} canEdit={!!d.canManage && !closed} reload={load} />
                      ) : (
                        <ReservationCard d={d} onMessageOwner={messageOwner} />
                      )}
                    </Col>
                  )}
                  <Col xs={24} lg={d.venue ? 14 : 24}>
                    <Card
                      title={t('match:details.info.title')}
                      extra={
                        d.canManage && (
                          <span className="mb-info-actions">
                            {!closed && (
                              <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>
                                {t('match:edit.button')}
                              </Button>
                            )}
                            {!d.isPast && (
                              <Button danger onClick={remove}>
                                {t('match:details.actions.deleteMatch')}
                              </Button>
                            )}
                          </span>
                        )
                      }
                    >
                  <Descriptions column={{ xs: 1, md: 2 }}>
                    <Descriptions.Item label={t('match:details.info.venue')}>{d.venue?.name || d.stadium?.stadiumName}</Descriptions.Item>
                    {d.stadium?.openingTime && d.stadium?.closingTime && (
                      <Descriptions.Item label={t('match:details.info.hours')}>
                        {d.stadium.openingTime.slice(0, 5)} – {d.stadium.closingTime.slice(0, 5)}
                      </Descriptions.Item>
                    )}
                    <Descriptions.Item label={t('match:details.info.address')} span={2}>
                      {d.stadium?.address || '-'}
                      {mapsUrl({ name: d.venue?.name || d.stadium?.stadiumName, address: d.stadium?.address, location: d.stadium?.location }) && (
                        <a
                          className="mb-directions"
                          href={mapsUrl({ name: d.venue?.name || d.stadium?.stadiumName, address: d.stadium?.address, location: d.stadium?.location })}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <EnvironmentOutlined /> {t('match:details.info.directions')}
                        </a>
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('match:details.info.capacity')}>{t('match:players', { count: d.capacity })}</Descriptions.Item>
                    <Descriptions.Item label={t('match:details.info.date')}>{date.format('DD MMMM YYYY, HH:mm')}</Descriptions.Item>
                    {d.homeTeam && (
                      <Descriptions.Item label={t('match:details.info.matchup')} span={2}>
                        {t('match:details.info.versus', {
                          home: d.homeTeam.teamName,
                          away: d.awayTeam?.teamName || t('match:sides.seekingOpponent'),
                        })}
                      </Descriptions.Item>
                    )}
                    {d.description && (
                      <Descriptions.Item label={t('match:details.info.description')} span={2}>
                        {d.description}
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                  <VenueMiniMap location={d.stadium?.location} name={d.venue?.name || d.stadium?.stadiumName} />
                    </Card>
                  </Col>
                </Row>
              ),
            },
          ]}
        />
      </SwipeTabs>

      <Modal
        open={claimOpen}
        title={t('match:details.claimModal.title')}
        okText={t('match:details.claimModal.ok')}
        cancelText={t('common:actions.cancel')}
        confirmLoading={claiming}
        onOk={claim}
        onCancel={() => setClaimOpen(false)}
      >
        <p className="mb-hint" style={{ marginBottom: 12 }}>
          {t('match:details.claimModal.text', { team: d.homeTeam?.teamName || t('match:sides.homeTeam') })}
        </p>
        {myTeams.length ? (
          <Select
            placeholder={t('match:details.claimModal.placeholder')}
            value={claimTeamId}
            onChange={setClaimTeamId}
            style={{ width: '100%' }}
            options={myTeams.map((team) => ({
              value: team.teamId,
              label: t('match:details.claimModal.teamOption', { name: team.teamName, count: (team.playerId || []).length }),
            }))}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('match:details.claimModal.empty')}>
            <Button onClick={() => navigate('/create-team')}>{t('match:details.claimModal.createTeam')}</Button>
          </Empty>
        )}
      </Modal>

      <LeaveMatchModal matchId={d.matchId} open={leaveOpen} onClose={() => setLeaveOpen(false)} onLeft={load} />
      <EditMatchModal open={editOpen} detail={d} rosterCount={rosterCount} onClose={() => setEditOpen(false)} onSaved={load} />
      <GuestModal
        open={guestModal.open}
        matchId={d.matchId}
        guest={guestModal.guest}
        side={guestModal.side}
        preferredSide={d.mySide || SIDE.HOME}
        free={{
          [SIDE.HOME]: Math.max(perSide - homeRoster.count, 0),
          [SIDE.AWAY]: Math.max(perSide - awayRoster.count, 0),
        }}
        homeLabel={homeName(d)}
        awayLabel={awayName(d)}
        onClose={() => setGuestModal((m) => ({ ...m, open: false }))}
        onSaved={load}
      />

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        kind="match"
        targetId={d.matchId}
        title={d.matchName}
        excludeIds={d.participants.map((p) => p.player.playerId)}
      />
      <ShareToGroupModal open={groupShareOpen} matchId={d.matchId} matchName={d.matchName} onClose={() => setGroupShareOpen(false)} />
    </>
  );
}

export default MatchDetails;
