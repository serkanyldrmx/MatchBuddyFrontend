import React, { useEffect, useState } from 'react';
import { Alert, Input, Modal, Skeleton, Tag, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { matchesApi } from '../../api/matches';
import { EXCUSE_REASONS, reliabilityApi } from '../../api/reliability';
import { apiErrorMessage } from '../../utils/format';
import '../../ui/reliability.css';

/**
 * "Maça gelemiyorum" — tek pencerede hızlı iptal (docs/reliability-api.md).
 * Mazeret seçilir (isteğe bağlı not), ceza önizlemesi gösterilir. Kurucu mazereti kabul ederse puan iade edilir.
 * Ana sayfadaki "sıradaki maç" kartı ve maç detayı kullanır.
 */
export default function LeaveMatchModal({ matchId, open, onClose, onLeft }) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState(null);
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !matchId) return;
    setPreview(null);
    setReason(null);
    setNote('');
    reliabilityApi.leavePreview(matchId)
      .then(setPreview)
      .catch(() => setPreview({ kind: 'none', penalty: 0, isGoing: false }));
  }, [open, matchId]);

  const penalized = preview?.isGoing && preview?.penalty > 0;

  const submit = async () => {
    setSaving(true);
    try {
      const res = await matchesApi.leave(matchId, reason, note.trim() || undefined);
      message.success(res?.message || t('match:details.left'));
      onLeft?.(res);
      onClose();
    } catch (e) {
      message.error(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const hours = Math.max(Math.floor(preview?.hoursLeft ?? 0), 0);

  return (
    <Modal
      open={open}
      title={t('match:leave.title')}
      okText={preview?.isGoing === false ? t('match:details.actions.leaveWaitlist') : t('match:leave.confirm')}
      okButtonProps={{ danger: true, loading: saving, disabled: !preview }}
      cancelText={t('common:actions.cancel')}
      onOk={submit}
      onCancel={onClose}
      destroyOnClose
    >
      {!preview ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : (
        <>
          {preview.isGoing && (
            <>
              <p style={{ marginBottom: 4 }}>{t('match:leave.reasonQuestion')}</p>
              <div className="mb-excuses" role="radiogroup">
                {EXCUSE_REASONS.map((r) => (
                  <Tag.CheckableTag key={r} checked={reason === r} onChange={(c) => setReason(c ? r : null)}>
                    {t(`match:leave.reasons.${r}`)}
                  </Tag.CheckableTag>
                ))}
              </div>
              <Input.TextArea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={200}
                autoSize={{ minRows: 1, maxRows: 3 }}
                placeholder={t('match:leave.notePlaceholder')}
                style={{ marginBottom: 12 }}
              />
            </>
          )}
          {penalized ? (
            <Alert
              type={preview.kind === 'veryLate' ? 'error' : 'warning'}
              showIcon
              message={t('match:leave.penalty', { count: hours, penalty: preview.penalty, score: preview.currentScore - preview.penalty })}
              description={t('match:leave.penaltyHint')}
            />
          ) : (
            <Alert type="info" showIcon message={preview.isGoing ? t('match:leave.noPenalty') : t('match:details.leaveWaitlistContent')} />
          )}
        </>
      )}
    </Modal>
  );
}
