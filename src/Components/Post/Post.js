import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Avatar, Button, Tooltip } from 'antd';
import {
  CheckOutlined,
  ClockCircleOutlined,
  CrownFilled,
  EnvironmentOutlined,
  HeartFilled,
  HeartOutlined,
  HomeOutlined,
  SunOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { matchesApi, PARTICIPANT_STATUS } from '../../api/matches';
import { formatPrice, SURFACE } from '../../api/venues';
import { CapacityRing, MatchStatusTag, PlayerAvatar } from '../../ui';
import { apiErrorMessage, fullName, isPast } from '../../utils/format';
import './Post.css';

/**
 * Fikstür kartı: ana sayfa akışındaki her maç.
 * Gelecek maçta: tarih/saat bloğu, kadro doluluğu, katıl butonu.
 * Bitmiş maçta: skor tabelası ve MVP.
 */
export default function MatchCard({ match, onChanged }) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [liked, setLiked] = useState(!!match.likedByMe);
  const [likes, setLikes] = useState(match.likes || 0);

  const date = dayjs(match.matchDate);
  const past = isPast(match.matchDate);
  const hasResult = match.homeScore != null && match.awayScore != null;
  const missing = Math.max((match.capacity || 0) - (match.goingCount || 0), 0);
  const closed = past || match.isActive === 3;
  const open = () => navigate(`/match-details/${match.matchId}`);
  const venue = match.venue;
  const lookingOpp = match.lookingForOpponent && !match.awayTeam && !closed;
  const friendsGoing = match.followingGoingCount > 0 && match.followingPreview?.length > 0;

  const join = async (e) => {
    e.stopPropagation();
    setBusy(true);
    try {
      const res = await matchesApi.join(match.matchId);
      message.success(res?.message || 'Maça katıldın.');
      onChanged?.();
    } catch (err) {
      message.error(apiErrorMessage(err, 'Maça katılamadın.'));
    } finally {
      setBusy(false);
    }
  };

  const toggleLike = async (e) => {
    e.stopPropagation();
    const prev = { liked, likes };
    setLiked(!liked);
    setLikes(likes + (liked ? -1 : 1));
    try {
      const res = await matchesApi.toggleLike(match.matchId);
      setLiked(res.liked);
      setLikes(res.likes);
    } catch (err) {
      setLiked(prev.liked);
      setLikes(prev.likes);
      message.error(apiErrorMessage(err));
    }
  };

  let action;
  if (match.myStatus === PARTICIPANT_STATUS.GOING) {
    action = (
      <Button className="mb-fixture__mine" icon={<CheckOutlined />} onClick={(e) => { e.stopPropagation(); open(); }}>
        Kadrodasın
      </Button>
    );
  } else if (match.myStatus === PARTICIPANT_STATUS.WAITLIST) {
    action = <Button onClick={(e) => { e.stopPropagation(); open(); }}>Yedektesin</Button>;
  } else if (!closed) {
    action = (
      <Button type="primary" loading={busy} onClick={join}>
        {missing > 0 ? 'Katıl' : 'Yedeğe yazıl'}
      </Button>
    );
  } else {
    action = <Button onClick={(e) => { e.stopPropagation(); open(); }}>{hasResult ? 'Maç raporu' : 'Detay'}</Button>;
  }

  return (
    <article className={`mb-fixture ${past ? 'is-past' : ''} ${match.myStatus === 1 ? 'is-mine' : ''}`} onClick={open}>
      {/* Sol: tarih/saat ya da skor */}
      {hasResult ? (
        <div className="mb-fixture__when is-score">
          <span className="mb-fixture__score">
            {match.homeScore}<i>:</i>{match.awayScore}
          </span>
          <span className="mb-fixture__date">{date.format('DD MMM')}</span>
        </div>
      ) : (
        <div className="mb-fixture__when">
          <span className="mb-fixture__dow">{date.format('ddd')}</span>
          <span className="mb-fixture__day">{date.format('DD')}</span>
          <span className="mb-fixture__month">{date.format('MMM')}</span>
          <span className="mb-fixture__time">{date.format('HH:mm')}</span>
        </div>
      )}

      {/* Orta: bilgiler */}
      <div className="mb-fixture__body">
        <div className="mb-fixture__top">
          {match.isActive === 3 && match.rejectReason ? (
            <Tooltip title={`Red sebebi: ${match.rejectReason}`}>
              <span>
                <MatchStatusTag status={match.isActive} past={past} />
              </span>
            </Tooltip>
          ) : (
            <MatchStatusTag status={match.isActive} past={past} />
          )}
          {!past && missing > 0 && missing <= 3 && <span className="mb-chip is-live">{missing} kişi eksik</span>}
          {lookingOpp && <span className="mb-chip is-pending">Rakip aranıyor</span>}
          {match.perPlayer != null && !hasResult && <span className="mb-fixture__price">Kişi başı {formatPrice(match.perPlayer)}</span>}
        </div>
        <h3 className="mb-fixture__title">{match.matchName}</h3>
        {match.homeTeam && (
          <div className="mb-fixture__teams">
            <strong className="is-home">{match.homeTeam.teamName}</strong>
            <i>vs</i>
            {match.awayTeam ? <strong className="is-away">{match.awayTeam.teamName}</strong> : <strong className="is-tbd">?</strong>}
          </div>
        )}
        <div className="mb-fixture__meta">
          {venue ? (
            <span>
              <Tooltip title={`${SURFACE[venue.surface] || 'Saha'} · ${venue.isIndoor ? 'Kapalı' : 'Açık'}`}>
                {venue.isIndoor ? <HomeOutlined /> : <SunOutlined />}
              </Tooltip>{' '}
              {venue.name}
              {venue.pitchName ? ` · ${venue.pitchName}` : ''}
            </span>
          ) : (
            <span><EnvironmentOutlined /> {match.stadiumName || 'Halı saha'}</span>
          )}
          {!hasResult && <span><ClockCircleOutlined /> {date.format('dddd, HH:mm')}</span>}
        </div>
        <div className="mb-fixture__people">
          <Avatar.Group max={{ count: 5 }} size={28} className={friendsGoing ? 'mb-fixture__friends-avatars' : ''}>
            {(friendsGoing ? match.followingPreview : match.participantsPreview || []).map((p) => (
              <Tooltip key={p.playerId} title={fullName(p)}>
                <PlayerAvatar player={p} size={28} />
              </Tooltip>
            ))}
          </Avatar.Group>
          {friendsGoing ? (
            <span className="mb-fixture__friends">
              <strong>{match.followingPreview[0].playerName || match.followingPreview[0].userName}</strong>
              {match.followingGoingCount > 1 && <> ve {match.followingGoingCount - 1} arkadaşın</>}{' '}
              {past ? 'oynadı' : 'katılıyor'}
            </span>
          ) : null}
          {match.mvp ? (
            <span className="mb-fixture__mvp">
              <CrownFilled /> MVP: {fullName(match.mvp)}
            </span>
          ) : match.createdBy && !friendsGoing ? (
            <span className="mb-fixture__host">Kurucu: {fullName(match.createdBy)}</span>
          ) : null}
        </div>
      </div>

      {/* Sağ: kadro + aksiyon */}
      <div className="mb-fixture__side">
        {!hasResult && <CapacityRing going={match.goingCount} capacity={match.capacity} size={44} />}
        <div className="mb-fixture__actions">
          <Tooltip title={liked ? 'Beğenmekten vazgeç' : 'Beğen'}>
            <Button
              className="mb-like"
              type="text"
              onClick={toggleLike}
              icon={liked ? <HeartFilled style={{ color: 'var(--mb-danger)' }} /> : <HeartOutlined />}
            >
              {likes}
            </Button>
          </Tooltip>
          {action}
        </div>
      </div>
    </article>
  );
}
