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
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../../api/config';
import { matchesApi, PARTICIPANT_STATUS, SIDE } from '../../api/matches';
import { formatPrice, SURFACE, venuesApi } from '../../api/venues';
import { useMessages } from '../../messaging/MessagesContext';
import { CapacityRing, MatchStatusTag, PageLoader, PlayerAvatar } from '../../ui';
import { apiErrorMessage, fullName, getCurrentUser, mediaUrl } from '../../utils/format';
import MatchComments from '../Post/MatchComments';
import InviteModal from '../Invites/InviteModal';
import FollowButton, { PlayerLink } from '../Social/FollowButton';
import GuestModal from './GuestModal';
import Pitch, { guestInitials, sideRoster } from './Pitch';
import './MatchDetails.css';

const homeName = (d) => d.homeTeam?.teamName || 'Ev sahibi';
const awayName = (d) => d.awayTeam?.teamName || (d.lookingForOpponent ? 'Rakip aranıyor' : 'Deplasman');

/* ---------------- Maç sonu ---------------- */
function PostMatch({ detail, me, reload }) {
  const { message } = App.useApp();
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
      message.success('Maç sonucu kaydedildi. Oyunculara bildirim gönderildi.');
      reload();
    } catch (e) {
      message.error(apiErrorMessage(e, 'Sonuç kaydedilemedi.'));
    } finally {
      setSavingResult(false);
    }
  };

  const vote = async (playerId) => {
    try {
      await matchesApi.voteMvp(detail.matchId, playerId);
      message.success('MVP oyun kaydedildi.');
      reload();
    } catch (e) {
      message.error(apiErrorMessage(e, 'Oy verilemedi.'));
    }
  };

  const saveRatings = async () => {
    const list = Object.entries(ratings)
      .filter(([, s]) => s > 0)
      .map(([playerId, s]) => ({ playerId: Number(playerId), score: s }));
    if (!list.length) {
      message.warning('En az bir oyuncuyu puanla.');
      return;
    }
    setSavingRatings(true);
    try {
      await matchesApi.ratePlayers(detail.matchId, list);
      message.success('Puanların kaydedildi. Teşekkürler!');
      reload();
    } catch (e) {
      message.error(apiErrorMessage(e, 'Puanlar kaydedilemedi.'));
    } finally {
      setSavingRatings(false);
    }
  };

  const statColumns = [
    {
      title: 'Oyuncu',
      render: (_, p) => (
        <span className="mb-inline-player">
          <PlayerAvatar player={p.player} size={28} /> {fullName(p.player)}
          <span className={`mb-side-dot ${p.side === SIDE.AWAY ? 'is-away' : 'is-home'}`} />
        </span>
      ),
    },
    ...['goals', 'assists'].map((k) => ({
      title: k === 'goals' ? 'Gol' : 'Asist',
      width: 110,
      render: (_, p) => (
        <InputNumber
          min={0}
          max={30}
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
          <Card title={detail.result ? 'Sonucu düzenle' : 'Maç sonucunu gir'}>
            <div className="mb-result-form">
              <div className="mb-result-form__side is-home">
                <span>{homeName(detail)}</span>
                <InputNumber min={0} max={50} size="large" value={score.home} onChange={(v) => setScore((s) => ({ ...s, home: v || 0 }))} />
              </div>
              <span className="mb-result-form__sep">:</span>
              <div className="mb-result-form__side is-away">
                <span>{awayName(detail)}</span>
                <InputNumber min={0} max={50} size="large" value={score.away} onChange={(v) => setScore((s) => ({ ...s, away: v || 0 }))} />
              </div>
            </div>
            <Table rowKey={(p) => p.player.playerId} size="small" pagination={false} columns={statColumns} dataSource={going} style={{ marginTop: 16 }} />
            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <Button type="primary" icon={<CheckOutlined />} loading={savingResult} onClick={saveResult}>
                Sonucu kaydet
              </Button>
            </div>
          </Card>
        </Col>
      )}

      {iPlayed && replay.length > 0 && (
        <Col xs={24}>
          <Card className="mb-replay-card" title="Tekrar oynamak ister misin?">
            <p className="mb-replay-card__text">Bu maçta birlikte top koşturduğun ama henüz takip etmediğin oyuncular. Takip et, bir sonraki maçta yine bir arada olun.</p>
            <div className="mb-replay-list">
              {replay.map((p) => (
                <div key={p.player.playerId} className="mb-replay-item">
                  <PlayerAvatar player={p.player} size={44} />
                  <div className="mb-replay-item__name">
                    <PlayerLink player={p.player} />
                    <small>
                      {p.goals > 0 ? `${p.goals} gol` : `@${p.player.userName}`}
                      {p.avgRating != null && ` · ort. ${p.avgRating.toFixed(1)}`}
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
              Maçın oyuncusu
            </span>
          }
        >
          {!iPlayed ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="MVP oylaması sadece maçta oynayanlara açık." />
          ) : others.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Oy verilecek oyuncu yok." />
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
                    <span>{p.mvpVotes || 0} oy</span>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </Col>

      <Col xs={24} lg={12}>
        <Card title="Takım arkadaşlarını puanla">
          {!iPlayed ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Puanlama sadece maçta oynayanlara açık." />
          ) : (
            <>
              <div className="mb-rate-list">
                {others.map((p) => (
                  <div key={p.player.playerId} className="mb-rate-row">
                    <span className="mb-inline-player">
                      <PlayerAvatar player={p.player} size={32} />
                      <span>
                        {fullName(p.player)}
                        {p.avgRating != null && <small> · ort. {p.avgRating.toFixed(1)}</small>}
                      </span>
                    </span>
                    <Rate value={ratings[p.player.playerId] || 0} onChange={(v) => setRatings((r) => ({ ...r, [p.player.playerId]: v }))} />
                  </div>
                ))}
              </div>
              <Button type="primary" block style={{ marginTop: 16 }} loading={savingRatings} onClick={saveRatings}>
                Puanları gönder
              </Button>
              <p className="mb-hint">Puanlar anonimdir ve oyuncuların genel puanını belirler.</p>
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
  const { message } = App.useApp();
  const [rating, setRating] = useState(detail.myReview?.rating || 0);
  const [comment, setComment] = useState(detail.myReview?.comment || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!rating) {
      message.warning('Önce yıldız ver.');
      return;
    }
    setSaving(true);
    try {
      await venuesApi.review(detail.matchId, rating, comment.trim() || undefined);
      message.success(detail.myReview ? 'Yorumun güncellendi.' : 'Değerlendirmen için teşekkürler!');
      reload();
    } catch (e) {
      message.error(apiErrorMessage(e, 'Değerlendirme kaydedilemedi.'));
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
          Tesisi değerlendir
        </span>
      }
    >
      <div className="mb-venue-review">
        {detail.venue?.coverPhotoUrl && <img src={mediaUrl(detail.venue.coverPhotoUrl, 'sm')} alt="" decoding="async" />}
        <div className="mb-venue-review__form">
          <strong>{detail.venue?.name}</strong>
          <span className="mb-hint">Saha, soyunma odası, hizmet… Diğer oyunculara yol göster.</span>
          <Rate value={rating} onChange={setRating} className="mb-venue-review__rate" />
          <Input.TextArea
            rows={3}
            maxLength={500}
            showCount
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Deneyimini birkaç cümleyle anlat (isteğe bağlı)"
          />
          <div>
            <Button type="primary" loading={saving} onClick={save}>
              {detail.myReview ? 'Yorumu güncelle' : 'Değerlendirmeyi gönder'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ---------------- Rezervasyon kartı ---------------- */
function ReservationCard({ d, onMessageOwner }) {
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
    <Card className="mb-booking" title="Rezervasyon">
      <button type="button" className="mb-booking__head" onClick={() => navigate(`/venues/${v.stadiumId}`)}>
        {v.coverPhotoUrl ? <img src={mediaUrl(v.coverPhotoUrl, 'sm')} alt="" loading="lazy" decoding="async" /> : <span className="mb-booking__ph mb-pitch-bg" />}
        <span className="mb-booking__head-text">
          <strong>{v.name}</strong>
          <span>
            {v.isIndoor ? <HomeOutlined /> : <SunOutlined />} {v.pitchName} · {SURFACE[v.surface] || 'Saha'} · {v.isIndoor ? 'Kapalı' : 'Açık'}
          </span>
          <span>
            {start.format('DD MMM, HH:mm')}–{start.add(duration, 'minute').format('HH:mm')} · {duration} dk
          </span>
        </span>
      </button>

      <div className="mb-booking__lines">
        {pitchPrice != null && (
          <div>
            <span>Saha</span>
            <span>{formatPrice(pitchPrice)}</span>
          </div>
        )}
        {hasExtras && (
          <div>
            <span>
              Ekstralar
              <small>
                {d.cleatCount > 0 && `${d.cleatCount} çift krampon`}
                {d.cleatCount > 0 && d.cameraRequested && ' · '}
                {d.cameraRequested && (
                  <>
                    <VideoCameraOutlined /> maç kaydı
                  </>
                )}
              </small>
            </span>
            <span>{extras != null ? formatPrice(extras) : '-'}</span>
          </div>
        )}
        <div className="is-total">
          <span>Toplam</span>
          <span>{formatPrice(d.totalPrice)}</span>
        </div>
      </div>
      {d.perPlayer != null && (
        <div className="mb-booking__per">
          <span>Kişi başı</span>
          <strong>{formatPrice(d.perPlayer)}</strong>
        </div>
      )}
      {info?.cancellationPolicy && (
        <p className="mb-booking__policy">
          <InfoCircleOutlined /> <span>{info.cancellationPolicy}</span>
        </p>
      )}
      <p className="mb-hint">Ödeme sahada yapılır.</p>
      <div className="mb-booking__actions">
        <Button onClick={() => navigate(`/venues/${v.stadiumId}`)}>Tesise git</Button>
        {d.ownerPlayerId && (
          <Button icon={<MessageOutlined />} onClick={() => onMessageOwner(info?.owner?.name)}>
            İşletmeye yaz
          </Button>
        )}
      </div>
    </Card>
  );
}

/* ---------------- Sayfa ---------------- */
function MatchDetails() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const { openMessages } = useMessages();
  const me = getCurrentUser();

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('lineup');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [myTeams, setMyTeams] = useState([]);
  const [claimTeamId, setClaimTeamId] = useState();
  const [claiming, setClaiming] = useState(false);
  // Misafir oyuncu modalı: { open, guest?, side? }
  const [guestModal, setGuestModal] = useState({ open: false });

  const load = useCallback(async () => {
    try {
      const d = await matchesApi.detail(matchId);
      if (!d) setNotFound(true);
      setDetail(d);
    } catch (e) {
      if (e?.response?.status === 404) setNotFound(true);
      else message.error(apiErrorMessage(e, 'Maç yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, [matchId, message]);

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
      message.error(apiErrorMessage(e, 'Takımların yüklenemedi.'));
    }
  };

  const claim = async () => {
    if (!claimTeamId) {
      message.warning('Bir takım seç.');
      return;
    }
    setClaiming(true);
    try {
      const res = await venuesApi.claimOpponent(detail.matchId, claimTeamId);
      message.success(res?.message || 'Takımınla rakip oldun! Takım arkadaşlarına davet gönderildi.');
      setClaimOpen(false);
      await load();
    } catch (e) {
      message.error(apiErrorMessage(e, 'Rakip olunamadı.'));
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return <PageLoader caption="Maç yükleniyor…" />;
  }
  if (notFound || !detail) {
    return <Result status="404" title="Maç bulunamadı" extra={<Button type="primary" onClick={() => navigate('/home')}>Fikstüre dön</Button>} />;
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

  const join = () => run(() => matchesApi.join(d.matchId), 'Maça katıldın.');
  const leave = () =>
    modal.confirm({
      title: 'Maçtan ayrıl',
      content: waitlist.length
        ? 'Yerine yedek listesindeki ilk oyuncu geçecek.'
        : 'Kadrodan çıkacaksın. Emin misin?',
      okText: 'Ayrıl',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: () => run(() => matchesApi.leave(d.matchId), 'Maçtan ayrıldın.'),
    });
  const confirmAttendance = () => run(() => matchesApi.confirm(d.matchId), 'Katılımın onaylandı. Sahada görüşürüz!');
  const toggleLike = () => run(() => matchesApi.toggleLike(d.matchId).then((r) => ({ message: r.liked ? 'Beğendin.' : 'Beğeni kaldırıldı.' })));
  const swap = (p) =>
    run(() => matchesApi.setSide(d.matchId, p.player.playerId, p.side === SIDE.AWAY ? SIDE.HOME : SIDE.AWAY), 'Oyuncunun takımı değişti.');
  const msg = (player) => openMessages({ type: 'user', data: player });
  const openGuestModal = (side, guest) => setGuestModal({ open: true, side, guest });
  const editGuest = (g) => openGuestModal(undefined, g);
  const moveGuest = (g) =>
    run(
      () => matchesApi.updateGuest(g.guestId, g.side === SIDE.AWAY ? SIDE.HOME : SIDE.AWAY, g.name, g.note || undefined),
      `${g.name} diğer takıma geçti.`
    );
  const removeGuest = (g) => run(() => matchesApi.removeGuest(g.guestId), `${g.name} kadrodan çıkarıldı.`);
  const messageOwner = (ownerName) =>
    openMessages({ type: 'user', data: { playerId: d.ownerPlayerId, playerName: ownerName || d.venue?.name || 'İşletme', userName: 'işletme' } });
  const seekingOpponent = d.lookingForOpponent && !d.awayTeam && !closed;
  const remove = () =>
    modal.confirm({
      title: 'Maçı sil',
      content: 'Maç ve kadrosu kalıcı olarak silinecek.',
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await matchesApi.remove(d.matchId);
          message.success('Maç silindi.');
          navigate('/home');
        } catch (e) {
          message.error(apiErrorMessage(e, 'Maç silinemedi.'));
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
            Geliyorum, onayla
          </Button>
        )}
        <Button size="large" icon={<LogoutOutlined />} onClick={leave} className="mb-ghost-btn">
          Ayrıl
        </Button>
      </>
    );
  } else if (d.myStatus === PARTICIPANT_STATUS.WAITLIST) {
    primaryAction = !d.isPast && (
      <Button size="large" icon={<LogoutOutlined />} onClick={leave} className="mb-ghost-btn">
        Yedek listesinden çık
      </Button>
    );
  } else if (canJoin) {
    primaryAction = (
      <Button type="primary" size="large" icon={<UserAddOutlined />} loading={busy} onClick={join}>
        {rosterCount < d.capacity ? 'Maça katıl' : 'Yedeğe yazıl'}
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
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} className="mb-ghost-link">
            Fikstür
          </Button>
          <div className="mb-match-hero__chips">
            <MatchStatusTag status={d.isActive} past={d.isPast} />
            {d.myStatus === PARTICIPANT_STATUS.GOING && <span className="mb-chip is-live">Kadrodasın</span>}
            {d.myStatus === PARTICIPANT_STATUS.WAITLIST && <span className="mb-chip is-pending">Yedektesin</span>}
          </div>
        </div>

        <h1 className="mb-match-hero__title">{d.matchName}</h1>
        <div className="mb-match-hero__meta">
          <EnvironmentOutlined /> {d.venue ? `${d.venue.name} · ${d.venue.pitchName}` : d.stadium?.stadiumName} · {date.format('DD MMMM YYYY, dddd')}
          {d.createdBy && <> · Kurucu: <strong>{fullName(d.createdBy)}</strong></>}
        </div>

        <div className="mb-scoreboard">
          <div className="mb-scoreboard__team is-home">
            <span>{d.homeTeam ? 'Ev sahibi' : `${homeRoster.count} oyuncu`}</span>
            <strong>{d.homeTeam ? d.homeTeam.teamName : 'Ev sahibi'}</strong>
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
              {hasResult ? 'Maç sonucu' : d.isPast ? 'Sonuç bekleniyor' : hoursLeft < 24 ? `${Math.max(hoursLeft, 0)} saat kaldı` : date.fromNow()}
            </span>
          </div>
          <div className={`mb-scoreboard__team is-away ${seekingOpponent ? 'is-seeking' : ''}`}>
            {d.awayTeam ? (
              <>
                <span>Deplasman</span>
                <strong>{d.awayTeam.teamName}</strong>
              </>
            ) : seekingOpponent ? (
              <>
                <span>Rakip aranıyor</span>
                <strong>?</strong>
                <Button size="small" type="primary" icon={<FlagOutlined />} onClick={openClaim} className="mb-scoreboard__claim">
                  Takımınla rakip ol
                </Button>
              </>
            ) : (
              <>
                <span>{awayRoster.count} oyuncu</span>
                <strong>Deplasman</strong>
              </>
            )}
          </div>
        </div>

        <div className="mb-match-hero__bottom">
          <CapacityRing going={rosterCount} capacity={d.capacity} size={48} />
          <div className="mb-match-hero__actions">
            <Tooltip title={d.likedByMe ? 'Beğenmekten vazgeç' : 'Beğen'}>
              <Button size="large" className="mb-ghost-btn" icon={d.likedByMe ? <HeartFilled style={{ color: 'var(--mb-danger)' }} /> : <HeartOutlined />} onClick={toggleLike}>
                {d.likes}
              </Button>
            </Tooltip>
            {canInvite && (
              <Button size="large" icon={<SendOutlined />} onClick={() => setInviteOpen(true)} className="mb-ghost-btn">
                Davet et
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
          message="Maça 24 saatten az kaldı. Katılımını onaylarsan organizatör kadroyu kesinleştirebilir."
        />
      )}
      {d.isActive === 1 && !d.isPast && (
        <Alert type="info" showIcon style={{ marginBottom: 16 }} message="İşletme onayı bekleniyor. Bu sürede kadro kurmaya devam edebilirsin." />
      )}
      {d.isActive === 3 && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Rezervasyon işletme tarafından reddedildi."
          description={d.rejectReason ? `Sebep: ${d.rejectReason}` : undefined}
          action={
            d.venue && (
              <Button size="small" onClick={() => navigate(`/venues/${d.venue.stadiumId}`)}>
                Başka saat seç
              </Button>
            )
          }
        />
      )}

      <Tabs
        activeKey={tab}
        onChange={setTab}
        className="mb-match-tabs"
        items={[
          {
            key: 'lineup',
            label: `Kadro (${rosterCount})`,
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
                  />
                </Col>
                <Col xs={24} xl={7}>
                  <Card title={`Yedekler (${waitlist.length})`} size="small">
                    {waitlist.length === 0 ? (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Yedek yok" />
                    ) : (
                      <ol className="mb-waitlist">
                        {waitlist.map((p) => (
                          <li key={p.player.playerId}>
                            <PlayerAvatar player={p.player} size={30} />
                            <span>{p.player.playerId === me?.playerId ? 'Sen' : <PlayerLink player={p.player} />}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </Card>
                  {guests.length > 0 && (
                    <Card title={`Misafir oyuncular (${guests.length})`} size="small" className="mb-guest-card">
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
                                <Tooltip title="Düzenle">
                                  <Button type="text" size="small" icon={<EditOutlined />} onClick={() => editGuest(g)} aria-label="Düzenle" />
                                </Tooltip>
                                <Popconfirm
                                  title="Misafir oyuncuyu kaldır"
                                  description={`${g.name} kadrodan çıkarılacak.`}
                                  okText="Kaldır"
                                  okButtonProps={{ danger: true }}
                                  cancelText="Vazgeç"
                                  onConfirm={() => removeGuest(g)}
                                >
                                  <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="Kaldır" />
                                </Popconfirm>
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}
                  <div className="mb-legend">
                    <span><CheckCircleFilled style={{ color: 'var(--mb-pitch)' }} /> Katılımını onayladı</span>
                    <span><CrownFilled style={{ color: 'var(--mb-gold)' }} /> Maçın oyuncusu</span>
                    <span><span className="mb-legend__guest" /> Misafir oyuncu (uygulamada hesabı yok)</span>
                    <span><span className="mb-legend__pos">KL</span> Kaleci · DF Defans · OS Orta saha · FV Forvet</span>
                    {d.canManage && <span><SwapOutlined /> Oyuncuya tıklayıp takımını değiştirebilirsin</span>}
                    {canManageGuests && <span><UserAddOutlined /> Boş yere tıklayıp isimle oyuncu ekleyebilirsin</span>}
                  </div>
                </Col>
              </Row>
            ),
          },
          {
            key: 'post',
            label: 'Maç sonu',
            children: d.isPast ? (
              <PostMatch detail={d} me={me} reload={load} />
            ) : (
              <Card>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Maç oynandıktan sonra skor, MVP oylaması ve oyuncu puanlaması burada açılacak." />
              </Card>
            ),
          },
          {
            key: 'comments',
            label: 'Soyunma odası',
            children: (
              <Card>
                <MatchComments matchId={d.matchId} />
              </Card>
            ),
          },
          {
            key: 'info',
            label: 'Saha bilgisi',
            children: (
              <Row gutter={[20, 20]}>
                {d.venue && (
                  <Col xs={24} lg={10}>
                    <ReservationCard d={d} onMessageOwner={messageOwner} />
                  </Col>
                )}
                <Col xs={24} lg={d.venue ? 14 : 24}>
                  <Card
                    title="Maç bilgisi"
                    extra={
                      d.canManage && (
                        <Button danger onClick={remove}>
                          Maçı sil
                        </Button>
                      )
                    }
                  >
                <Descriptions column={{ xs: 1, md: 2 }}>
                  <Descriptions.Item label="Halı saha">{d.venue?.name || d.stadium?.stadiumName}</Descriptions.Item>
                  <Descriptions.Item label="Çalışma saatleri">
                    {d.stadium?.openingTime?.slice(0, 5)} – {d.stadium?.closingTime?.slice(0, 5)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Adres" span={2}>{d.stadium?.address || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Kapasite">{d.capacity} oyuncu</Descriptions.Item>
                  <Descriptions.Item label="Tarih">{date.format('DD MMMM YYYY, HH:mm')}</Descriptions.Item>
                  {d.homeTeam && (
                    <Descriptions.Item label="Eşleşme" span={2}>
                      {d.homeTeam.teamName} vs {d.awayTeam?.teamName || 'Rakip aranıyor'}
                    </Descriptions.Item>
                  )}
                  {d.description && <Descriptions.Item label="Açıklama" span={2}>{d.description}</Descriptions.Item>}
                </Descriptions>
                  </Card>
                </Col>
              </Row>
            ),
          },
        ]}
      />

      <Modal
        open={claimOpen}
        title="Takımınla rakip ol"
        okText="Rakip ol"
        cancelText="Vazgeç"
        confirmLoading={claiming}
        onOk={claim}
        onCancel={() => setClaimOpen(false)}
      >
        <p className="mb-hint" style={{ marginBottom: 12 }}>
          {d.homeTeam?.teamName || 'Ev sahibi takım'} rakip arıyor. Takımını seç; sen deplasman tarafına geçersin, takım arkadaşlarına davet gider.
        </p>
        {myTeams.length ? (
          <Select
            placeholder="Takımını seç"
            value={claimTeamId}
            onChange={setClaimTeamId}
            style={{ width: '100%' }}
            options={myTeams.map((t) => ({ value: t.teamId, label: `${t.teamName} · ${(t.playerId || []).length} oyuncu` }))}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Rakip olabileceğin bir takımın yok.">
            <Button onClick={() => navigate('/create-team')}>Takım kur</Button>
          </Empty>
        )}
      </Modal>

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

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} kind="match" targetId={d.matchId} title={d.matchName} />
    </>
  );
}

export default MatchDetails;
