import React, { useMemo, useState } from 'react';
import { Button, Card, Checkbox, Empty, List, Modal, Skeleton, Tag, message } from 'antd';
import { CheckOutlined, NotificationOutlined, UserDeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { reliabilityApi } from '../../api/reliability';
import { PARTICIPANT_STATUS } from '../../api/matches';
import { PlayerAvatar, ReliabilityBadge } from '../../ui';
import { apiErrorMessage, fromNow, fullName } from '../../utils/format';

/**
 * Kurucu panelleri (docs/reliability-api.md):
 *  - WithdrawalsCard: son dakika çekilenler / gelmeyenler, mazeretleriyle; "Mazereti kabul et" puanı iade eder.
 *  - NoShowCard: maçtan sonra (pencere açıkken) gelmeyenleri işaretleme.
 *  - SubstituteCard: maçta boş yer varken (yedek listesi boşsa) kurucu seçtiği oyunculara "yer açıldı" bildirimi gönderir.
 */

export function SubstituteCard({ detail, openSpots }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState([]);
  const [sending, setSending] = useState(false);

  const show = async () => {
    setOpen(true);
    setData(null);
    setSelected([]);
    try {
      setData(await reliabilityApi.substituteCandidates(detail.matchId));
    } catch (e) {
      message.error(apiErrorMessage(e));
      setOpen(false);
    }
  };

  const send = async () => {
    setSending(true);
    try {
      const res = await reliabilityApi.callSubstitutes(detail.matchId, selected);
      message.success(res?.message || t('match:substitute.sent'));
      setOpen(false);
    } catch (e) {
      message.error(apiErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const toggle = (id, on) => setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)));
  const candidates = data?.candidates || [];

  return (
    <>
      <Card size="small" className="mb-substitute-card" style={{ marginBottom: 12 }}>
        <div className="mb-substitute-card__body">
          <div>
            <strong>{t('match:substitute.openSpots', { count: openSpots })}</strong>
            <span>{t('match:substitute.hint')}</span>
          </div>
          <Button type="primary" icon={<NotificationOutlined />} onClick={show}>
            {t('match:substitute.find')}
          </Button>
        </div>
      </Card>
      <Modal
        open={open}
        title={t('match:substitute.modalTitle')}
        onCancel={() => setOpen(false)}
        okText={t('match:substitute.send', { count: selected.length })}
        okButtonProps={{ disabled: selected.length === 0, loading: sending }}
        onOk={send}
        destroyOnClose
      >
        <p className="mb-hint">{t('match:substitute.modalHint')}</p>
        {!data ? (
          <Skeleton active avatar paragraph={{ rows: 3 }} />
        ) : candidates.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('match:substitute.empty')} />
        ) : (
          <List
            className="mb-substitute-list"
            dataSource={candidates}
            renderItem={(c) => (
              <List.Item
                onClick={() => !c.invited && toggle(c.playerId, !selected.includes(c.playerId))}
                className={c.invited ? 'is-invited' : undefined}
              >
                <Checkbox
                  checked={c.invited || selected.includes(c.playerId)}
                  disabled={c.invited}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => toggle(c.playerId, e.target.checked)}
                />
                <List.Item.Meta
                  avatar={<PlayerAvatar player={c} size={32} />}
                  title={<span>{fullName(c)} <ReliabilityBadge reliability={c.reliability} compact /></span>}
                  description={
                    c.invited
                      ? t('match:substitute.alreadyNotified')
                      : c.matchesTogether > 0
                        ? t('match:substitute.together', { count: c.matchesTogether })
                        : t('match:substitute.following')
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Modal>
    </>
  );
}
export function WithdrawalsCard({ detail, reload }) {
  const { t } = useTranslation();
  const [busyId, setBusyId] = useState(null);
  const rows = detail.withdrawals || [];
  if (!detail.canManage || rows.length === 0) return null;

  const accept = async (row) => {
    setBusyId(row.eventId);
    try {
      const res = await reliabilityApi.acceptExcuse(detail.matchId, row.playerId);
      message.success(res?.message || t('match:reliability.excuseAccepted'));
      await reload();
    } catch (e) {
      message.error(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card size="small" title={t('match:reliability.withdrawalsTitle', { count: rows.length })} style={{ marginBottom: 12 }}>
      <List
        dataSource={rows}
        renderItem={(r) => (
          <List.Item
            actions={[
              r.excused ? (
                <Tag color="green" key="ok"><CheckOutlined /> {t('match:reliability.excused')}</Tag>
              ) : (
                <Button key="accept" size="small" loading={busyId === r.eventId} onClick={() => accept(r)}>
                  {t('match:reliability.acceptExcuse')}
                </Button>
              ),
            ]}
          >
            <List.Item.Meta
              avatar={<PlayerAvatar player={r} size={32} />}
              title={fullName(r)}
              description={[
                t(`match:reliability.types.${r.type}`),
                r.reasonCode ? t(`match:leave.reasons.${r.reasonCode}`) : null,
                r.note ? `“${r.note}”` : null,
                fromNow(r.createdAt),
                r.excused ? null : t('match:reliability.minusPoints', { count: r.penalty }),
              ].filter(Boolean).join(' · ')}
            />
          </List.Item>
        )}
      />
    </Card>
  );
}

export function NoShowCard({ detail, me, reload }) {
  const { t } = useTranslation();
  const going = useMemo(
    () => (detail.participants || []).filter((p) => p.status === PARTICIPANT_STATUS.GOING && p.player.playerId !== me?.playerId),
    [detail.participants, me?.playerId]
  );
  const [selected, setSelected] = useState(() => going.filter((p) => p.noShow).map((p) => p.player.playerId));
  const [saving, setSaving] = useState(false);
  if (!detail.canManage || !detail.noShowWindowOpen || going.length === 0) return null;

  const save = async () => {
    setSaving(true);
    try {
      const res = await reliabilityApi.markNoShows(detail.matchId, selected);
      message.success(res?.message || t('match:reliability.noShowsSaved'));
      await reload();
    } catch (e) {
      message.error(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      size="small"
      title={<span><UserDeleteOutlined /> {t('match:reliability.noShowTitle')}</span>}
      style={{ marginBottom: 16 }}
      extra={<Button type="primary" size="small" loading={saving} onClick={save}>{t('common:actions.save')}</Button>}
    >
      <p style={{ marginTop: 0 }}>{t('match:reliability.noShowHint')}</p>
      <Checkbox.Group value={selected} onChange={setSelected} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {going.map((p) => (
          <Checkbox key={p.player.playerId} value={p.player.playerId}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <PlayerAvatar player={p.player} size={24} /> {fullName(p.player)}
              <ReliabilityBadge reliability={p.reliability} compact />
            </span>
          </Checkbox>
        ))}
      </Checkbox.Group>
    </Card>
  );
}
