import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar, Button, Result, Spin, Tooltip, message } from 'antd';
import { CalendarOutlined, ClockCircleOutlined, EnvironmentOutlined, LoginOutlined, TeamOutlined, UserAddOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { getToken } from '../../api/config';
import { invitesApi, PENDING_INVITE_KEY } from '../../api/invite';
import { formatPrice } from '../../api/venues';
import { PlayerAvatar } from '../../ui';
import { apiErrorMessage, errorCode, fullName, getCurrentUser } from '../../utils/format';
import { roleOf, ROLE } from '../../utils/roles';
import logo from '../../images/mutch_buddy_Logo.png';
import './MatchInvite.css';

/**
 * Herkese açık davet sayfası: /davet/:code (ve /m/:code). Giriş gerekmez.
 * Girişliyse "Kadroya katıl" doğrudan katılır; değilse kod saklanır, giriş / kayıttan sonra buraya dönülüp katılınır.
 */
export default function MatchInvite() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState(null);
  const [joining, setJoining] = useState(false);
  const loggedIn = !!getToken() && !!getCurrentUser();
  const isPlayer = loggedIn && roleOf(getCurrentUser()) === ROLE.PLAYER;

  useEffect(() => {
    invitesApi
      .publicMatch(code)
      .then(setInvite)
      .catch((e) => setError(apiErrorMessage(e, t('invite:notFound'))));
  }, [code, t]);

  const join = useCallback(async () => {
    setJoining(true);
    try {
      const res = await invitesApi.joinByCode(code);
      localStorage.removeItem(PENDING_INVITE_KEY);
      message.success(res?.message || t('invite:joined'));
      navigate(`/match-details/${res.matchId}`, { replace: true });
    } catch (e) {
      const c = errorCode(e);
      localStorage.removeItem(PENDING_INVITE_KEY);
      if (c === 'MATCH_ALREADY_JOINED' || c === 'MATCH_ALREADY_WAITLISTED') {
        navigate(`/match-details/${invite?.matchId}`, { replace: true });
        return;
      }
      message.error(apiErrorMessage(e, t('invite:joinFailed')));
    } finally {
      setJoining(false);
    }
  }, [code, invite, navigate, t]);

  // Giriş / kayıttan dönüldüyse otomatik katıl
  useEffect(() => {
    if (invite && isPlayer && localStorage.getItem(PENDING_INVITE_KEY) === code && !invite.isPast && !invite.isClosed) join();
  }, [invite, isPlayer, code, join]);

  const goAuth = (path) => {
    localStorage.setItem(PENDING_INVITE_KEY, code);
    navigate(path);
  };

  if (error) {
    return (
      <div className="mb-invite">
        <Result status="404" title={t('invite:notFoundTitle')} subTitle={error} extra={<Button type="primary" onClick={() => navigate('/')}>{t('invite:openApp')}</Button>} />
      </div>
    );
  }
  if (!invite) {
    return (
      <div className="mb-invite mb-invite--loading">
        <Spin size="large" />
      </div>
    );
  }

  const start = dayjs(invite.matchDate);
  const venue = [invite.venueName, invite.district || invite.city].filter(Boolean).join(', ');
  const closed = invite.isPast || invite.isClosed;
  const pct = invite.capacity ? Math.min(100, Math.round((invite.goingCount / invite.capacity) * 100)) : 0;

  return (
    <div className="mb-invite">
      <div className="mb-invite__card">
        <img src={logo} alt="MatchBuddy" className="mb-invite__logo" />
        <div className="mb-invite__eyebrow">{t('invite:eyebrow', { name: invite.hostName || t('invite:someone') })}</div>
        <h1 className="mb-invite__title">{invite.matchName}</h1>
        {invite.homeTeam && (
          <div className="mb-invite__teams">
            <strong>{invite.homeTeam}</strong> <i>vs</i> <strong>{invite.awayTeam || '?'}</strong>
          </div>
        )}

        <div className="mb-invite__facts">
          <span>
            <CalendarOutlined /> {start.format('DD MMMM dddd')}
          </span>
          <span>
            <ClockCircleOutlined /> {start.format('HH:mm')}–{start.add(invite.durationMinutes, 'minute').format('HH:mm')}
          </span>
          {venue && (
            <span>
              <EnvironmentOutlined /> {venue}
            </span>
          )}
          {invite.perPlayer != null && <span>💸 {t('invite:perPlayer', { price: formatPrice(invite.perPlayer) })}</span>}
        </div>

        <div className="mb-invite__squad">
          <div className="mb-invite__squad-head">
            <span>
              <TeamOutlined /> {t('invite:squad', { going: invite.goingCount, capacity: invite.capacity })}
            </span>
            {!closed && invite.missing > 0 && <b>{t('invite:missing', { count: invite.missing })}</b>}
          </div>
          <div className="mb-invite__bar">
            <span style={{ width: `${pct}%` }} />
          </div>
          {invite.participants?.length > 0 && (
            <Avatar.Group max={{ count: 8 }} size={34}>
              {invite.participants.map((p) => (
                <Tooltip key={p.playerId} title={fullName(p)}>
                  <PlayerAvatar player={p} size={34} />
                </Tooltip>
              ))}
            </Avatar.Group>
          )}
        </div>

        {closed ? (
          <div className="mb-invite__closed">{invite.isClosed ? t('invite:closed') : t('invite:past')}</div>
        ) : isPlayer ? (
          <Button type="primary" size="large" block icon={<UserAddOutlined />} loading={joining} onClick={join}>
            {invite.missing > 0 ? t('invite:join') : t('invite:joinWaitlist')}
          </Button>
        ) : loggedIn ? (
          <div className="mb-invite__closed">{t('invite:playersOnly')}</div>
        ) : (
          <div className="mb-invite__auth">
            <Button type="primary" size="large" block icon={<UserAddOutlined />} onClick={() => goAuth('/register')}>
              {t('invite:registerAndJoin')}
            </Button>
            <Button size="large" block icon={<LoginOutlined />} onClick={() => goAuth('/')}>
              {t('invite:loginAndJoin')}
            </Button>
            <p>{t('invite:authHint')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
