import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { App, Button, Card, Skeleton } from 'antd';
import { CalendarOutlined, CheckOutlined, CloseOutlined, EnvironmentOutlined, MailOutlined, TeamOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { Trans, useTranslation } from 'react-i18next';
import { emit, INVITES_CHANGED, invitesApi } from '../../api/social';
import { PARTICIPANT_STATUS } from '../../api/matches';
import { CapacityRing, EmptyState, PageHeader, PlayerAvatar } from '../../ui';
import { apiErrorMessage, fromNow, isPast } from '../../utils/format';
import { PlayerLink } from '../Social/FollowButton';
import './Invites.css';

function InviteCard({ invite, kind, busy, onRespond }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const m = invite.match;
  const team = invite.team;
  const date = m ? dayjs(m.matchDate) : null;
  const expired = m ? isPast(m.matchDate) || m.isActive === 3 : false;

  return (
    <article className={`mb-invite-card ${kind === 'team' ? 'is-team' : ''}`}>
      <div className="mb-invite-card__stub">
        {m ? (
          <>
            <span className="mb-invite-card__dow">{date.format('ddd')}</span>
            <span className="mb-invite-card__day">{date.format('DD')}</span>
            <span className="mb-invite-card__month">{date.format('MMM')}</span>
            <span className="mb-invite-card__time">{date.format('HH:mm')}</span>
          </>
        ) : (
          <span className="mb-invite-card__logo">{(team?.teamName || '?').charAt(0).toUpperCase()}</span>
        )}
      </div>

      <div className="mb-invite-card__body">
        <div className="mb-invite-card__who">
          <PlayerAvatar player={invite.inviter} size={28} />
          <span>
            {m ? (
              <Trans
                i18nKey="invites:card.invitedToMatch"
                values={{ match: m.matchName }}
                components={{
                  inviter: <PlayerLink player={invite.inviter} />,
                  link: <Link to={`/match-details/${m.matchId}`} className="mb-player-link" />,
                  b: <strong />,
                }}
              />
            ) : (
              <Trans
                i18nKey="invites:card.invitedToTeam"
                values={{ team: team?.teamName }}
                components={{ inviter: <PlayerLink player={invite.inviter} />, b: <strong /> }}
              />
            )}
          </span>
          <small>{fromNow(invite.createdAt)}</small>
        </div>
        <h3 className="mb-invite-card__title" onClick={() => m && navigate(`/match-details/${m.matchId}`)}>
          {m ? m.matchName : team?.teamName}
        </h3>
        <div className="mb-invite-card__meta">
          {m ? (
            <>
              <span><EnvironmentOutlined /> {m.stadiumName || t('invites:card.defaultVenue')}</span>
              <span><CalendarOutlined /> {date.format('DD MMMM dddd, HH:mm')}</span>
            </>
          ) : (
            <span><TeamOutlined /> {t('invites:card.members', { count: team?.memberCount ?? 0 })}</span>
          )}
        </div>
        {expired && <span className="mb-chip is-done" style={{ marginTop: 8 }}>{t('invites:card.expired')}</span>}
      </div>

      <div className="mb-invite-card__side">
        {m && <CapacityRing going={m.goingCount} capacity={m.capacity} size={44} />}
        <div className="mb-invite-card__actions">
          <Button icon={<CloseOutlined />} loading={busy === 'no'} disabled={!!busy} onClick={() => onRespond(false)}>
            {t('common:actions.reject')}
          </Button>
          <Button type="primary" icon={<CheckOutlined />} loading={busy === 'yes'} disabled={!!busy || expired} onClick={() => onRespond(true)}>
            {t('invites:card.accept')}
          </Button>
        </div>
      </div>
    </article>
  );
}

export default function Invites() {
  const { message, notification } = App.useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState({ matchInvites: [], teamInvites: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({}); // `${kind}-${id}` -> 'yes' | 'no'

  const load = useCallback(async () => {
    try {
      const res = await invitesApi.my();
      setData({ matchInvites: res?.matchInvites || [], teamInvites: res?.teamInvites || [] });
    } catch (e) {
      message.error(apiErrorMessage(e, t('invites:page.loadFailed')));
    } finally {
      setLoading(false);
    }
  }, [message, t]);

  useEffect(() => {
    load();
    window.addEventListener(INVITES_CHANGED, load);
    return () => window.removeEventListener(INVITES_CHANGED, load);
  }, [load]);

  const respond = async (kind, invite, accept) => {
    const key = `${kind}-${invite.inviteId}`;
    setBusy((b) => ({ ...b, [key]: accept ? 'yes' : 'no' }));
    try {
      const res = await invitesApi.respond(kind, invite.inviteId, accept);
      const listKey = kind === 'match' ? 'matchInvites' : 'teamInvites';
      setData((d) => ({ ...d, [listKey]: d[listKey].filter((i) => i.inviteId !== invite.inviteId) }));
      if (!accept) {
        message.info(t('invites:respond.rejected'));
      } else if (kind === 'match') {
        const waitlist = res?.status === PARTICIPANT_STATUS.WAITLIST;
        const matchId = invite.match.matchId;
        const nKey = `invite-${invite.inviteId}`;
        // Bildirim kutusu Router dışında çizildiği için Link yerine navigate kullanılır
        notification[waitlist ? 'warning' : 'success']({
          key: nKey,
          message: waitlist ? t('invites:respond.waitlistTitle') : t('invites:respond.squadTitle'),
          description:
            res?.message || (waitlist ? t('invites:respond.waitlistText') : t('invites:respond.squadText')),
          btn: (
            <Button
              type="primary"
              size="small"
              onClick={() => {
                notification.destroy(nKey);
                navigate(`/match-details/${matchId}`);
              }}
            >
              {t('invites:respond.goToMatch')}
            </Button>
          ),
          placement: 'bottomRight',
        });
      } else {
        message.success(res?.message || t('invites:respond.joinedTeam', { team: invite.team?.teamName }));
      }
    } catch (e) {
      message.error(apiErrorMessage(e, t('invites:respond.failed')));
    } finally {
      setBusy((b) => {
        const n = { ...b };
        delete n[key];
        return n;
      });
      emit(INVITES_CHANGED);
    }
  };

  const total = data.matchInvites.length + data.teamInvites.length;

  const section = (kind, title, icon, items, emptyText) => (
    <section className="mb-invites-section">
      <div className="mb-section-head">
        <h2 className="mb-section-title">
          {icon} {title}
          {items.length > 0 && <span className="mb-invites-count">{items.length}</span>}
        </h2>
      </div>
      {loading ? (
        <Card>
          <Skeleton active avatar paragraph={{ rows: 2 }} />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState description={emptyText} />
        </Card>
      ) : (
        <div className="mb-invites-list">
          {items.map((inv) => (
            <InviteCard
              key={inv.inviteId}
              invite={inv}
              kind={kind}
              busy={busy[`${kind}-${inv.inviteId}`]}
              onRespond={(accept) => respond(kind, inv, accept)}
            />
          ))}
        </div>
      )}
    </section>
  );

  return (
    <>
      <PageHeader
        eyebrow={t('invites:page.eyebrow')}
        title={t('invites:page.title')}
        icon={<MailOutlined />}
        subtitle={
          loading
            ? t('invites:page.loading')
            : total
              ? t('invites:page.pending', { count: total })
              : t('invites:page.none')
        }
        extra={
          <Button icon={<CalendarOutlined />} onClick={() => navigate('/calendar')}>
            {t('invites:page.myCalendar')}
          </Button>
        }
      />
      {section('match', t('invites:page.matchInvites'), null, data.matchInvites, t('invites:page.noMatchInvites'))}
      {section('team', t('invites:page.teamInvites'), null, data.teamInvites, t('invites:page.noTeamInvites'))}
    </>
  );
}
