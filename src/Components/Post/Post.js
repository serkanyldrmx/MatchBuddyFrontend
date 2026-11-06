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
import { Trans, useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      message.success(res?.message || t('match:actions.joined'));
      onChanged?.();
    } catch (err) {
      message.error(apiErrorMessage(err, t('match:actions.joinFailed')));
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
        {t('match:status.inSquad')}
      </Button>
    );
  } else if (match.myStatus === PARTICIPANT_STATUS.WAITLIST) {
    action = <Button onClick={(e) => { e.stopPropagation(); open(); }}>{t('match:status.waitlisted')}</Button>;
  } else if (!closed) {
    action = (
      <Button type="primary" loading={busy} onClick={join}>
        {missing > 0 ? t('match:actions.joinShort') : t('match:actions.joinWaitlist')}
      </Button>
    );
  } else {
    action = <Button onClick={(e) => { e.stopPropagation(); open(); }}>{hasResult ? t('match:card.report') : t('common:actions.detail')}</Button>;
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
            <Tooltip title={t('match:card.rejectReason', { reason: match.rejectReason })}>
              <span>
                <MatchStatusTag status={match.isActive} past={past} />
              </span>
            </Tooltip>
          ) : (
            <MatchStatusTag status={match.isActive} past={past} />
          )}
          {!past && missing > 0 && missing <= 3 && <span className="mb-chip is-live">{t('match:card.missing', { count: missing })}</span>}
          {lookingOpp && <span className="mb-chip is-pending">{t('match:sides.seekingOpponent')}</span>}
          {match.perPlayer != null && !hasResult && (
            <span className="mb-fixture__price">{t('match:card.perPlayer', { price: formatPrice(match.perPlayer) })}</span>
          )}
        </div>
        <h3 className="mb-fixture__title">{match.matchName}</h3>
        {match.homeTeam && (
          <div className="mb-fixture__teams">
            <strong className="is-home">{match.homeTeam.teamName}</strong>
            <i>{t('match:card.versus')}</i>
            {match.awayTeam ? <strong className="is-away">{match.awayTeam.teamName}</strong> : <strong className="is-tbd">?</strong>}
          </div>
        )}
        <div className="mb-fixture__meta">
          {venue ? (
            <span>
              <Tooltip title={`${SURFACE[venue.surface] || t('common:pitch')} · ${venue.isIndoor ? t('common:indoor') : t('common:outdoor')}`}>
                {venue.isIndoor ? <HomeOutlined /> : <SunOutlined />}
              </Tooltip>{' '}
              {venue.name}
              {venue.pitchName ? ` · ${venue.pitchName}` : ''}
            </span>
          ) : (
            <span><EnvironmentOutlined /> {match.stadiumName || t('match:card.venueFallback')}</span>
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
              <Trans
                i18nKey={
                  match.followingGoingCount > 1
                    ? past
                      ? 'match:card.friendsPlayed'
                      : 'match:card.friendsGoing'
                    : past
                      ? 'match:card.friendPlayed'
                      : 'match:card.friendGoing'
                }
                count={match.followingGoingCount - 1}
                values={{ name: match.followingPreview[0].playerName || match.followingPreview[0].userName }}
                components={{ b: <strong /> }}
              />
            </span>
          ) : null}
          {match.mvp ? (
            <span className="mb-fixture__mvp">
              <CrownFilled /> {t('match:card.mvp', { name: fullName(match.mvp) })}
            </span>
          ) : match.createdBy && !friendsGoing ? (
            <span className="mb-fixture__host">{t('match:card.host', { name: fullName(match.createdBy) })}</span>
          ) : null}
        </div>
      </div>

      {/* Sağ: kadro + aksiyon */}
      <div className="mb-fixture__side">
        {!hasResult && <CapacityRing going={match.goingCount} capacity={match.capacity} size={44} />}
        <div className="mb-fixture__actions">
          <Tooltip title={liked ? t('match:actions.unlike') : t('match:actions.like')}>
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
