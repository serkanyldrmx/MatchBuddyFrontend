import React, { useEffect, useState } from 'react';
import { Alert, App, DatePicker, InputNumber, Modal, Radio } from 'antd';
import dayjs from 'dayjs';
import { FIXTURE_STATUS, tournamentsApi } from '../../api/tournaments';
import { apiErrorMessage } from '../../utils/format';
import '../Home/MatchDetails.css';

/** Sonuç girme: iki büyük skor kutusu; elemede beraberlikte penaltı kazananı seçilir */
export function ResultModal({ fixture, knockout, onClose, onSaved }) {
  const { message } = App.useApp();
  const [score, setScore] = useState({ home: 0, away: 0 });
  const [winner, setWinner] = useState();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (fixture) {
      setScore({ home: fixture.homeScore ?? 0, away: fixture.awayScore ?? 0 });
      setWinner(fixture.homeScore != null && fixture.homeScore === fixture.awayScore ? fixture.winnerTeamId ?? undefined : undefined);
    }
  }, [fixture]);

  const draw = score.home === score.away;
  const needsWinner = knockout && draw;

  const submit = async () => {
    if (needsWinner && !winner) {
      message.warning('Berabere biten eleme maçında penaltıları kazanan takımı seç.');
      return;
    }
    setSaving(true);
    try {
      const payload = { fixtureId: fixture.fixtureId, homeScore: score.home, awayScore: score.away };
      if (needsWinner) payload.winnerTeamId = winner;
      const res = await tournamentsApi.submitResult(payload);
      if (res?.success === false) {
        message.error(res.message || 'Sonuç kaydedilemedi.');
        return;
      }
      message.success(res?.message || 'Sonuç kaydedildi.');
      onSaved?.();
    } catch (e) {
      message.error(apiErrorMessage(e, 'Sonuç kaydedilemedi.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!fixture}
      title="Sonuç gir"
      okText="Kaydet"
      cancelText="Vazgeç"
      confirmLoading={saving}
      onOk={submit}
      onCancel={onClose}
      destroyOnClose
    >
      {fixture && (
        <>
          <div className="mb-result-form mb-tr-result-form">
            <div className="mb-result-form__side is-home">
              <span title={fixture.homeTeam?.teamName}>{fixture.homeTeam?.teamName}</span>
              <InputNumber
                min={0}
                max={50}
                precision={0}
                size="large"
                value={score.home}
                onChange={(v) => setScore((s) => ({ ...s, home: v ?? 0 }))}
              />
            </div>
            <span className="mb-result-form__sep">:</span>
            <div className="mb-result-form__side is-away">
              <span title={fixture.awayTeam?.teamName}>{fixture.awayTeam?.teamName}</span>
              <InputNumber
                min={0}
                max={50}
                precision={0}
                size="large"
                value={score.away}
                onChange={(v) => setScore((s) => ({ ...s, away: v ?? 0 }))}
              />
            </div>
          </div>

          {needsWinner && (
            <div className="mb-tr-penalty">
              <span>Beraberlik! Penaltıları kim kazandı?</span>
              <Radio.Group value={winner} onChange={(e) => setWinner(e.target.value)} optionType="button" buttonStyle="solid">
                <Radio value={fixture.homeTeam?.teamId}>{fixture.homeTeam?.teamName}</Radio>
                <Radio value={fixture.awayTeam?.teamId}>{fixture.awayTeam?.teamName}</Radio>
              </Radio.Group>
            </div>
          )}

          {fixture.status === FIXTURE_STATUS.PLAYED && (
            <Alert
              style={{ marginTop: 16 }}
              type="info"
              showIcon
              message="Bu maçın sonucu zaten girilmiş; kaydedersen düzeltilir."
            />
          )}
        </>
      )}
    </Modal>
  );
}

/** Fikstür tarihini değiştirme */
export function DateModal({ fixture, onClose, onSaved }) {
  const { message } = App.useApp();
  const [value, setValue] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (fixture) setValue(fixture.matchDate ? dayjs(fixture.matchDate) : null);
  }, [fixture]);

  const submit = async () => {
    if (!value) {
      message.warning('Bir tarih seç.');
      return;
    }
    setSaving(true);
    try {
      const res = await tournamentsApi.updateFixtureDate(fixture.fixtureId, value.format('YYYY-MM-DDTHH:mm:00'));
      if (res?.success === false) {
        message.error(res.message || 'Tarih güncellenemedi.');
        return;
      }
      message.success(res?.message || 'Maç tarihi güncellendi.');
      onSaved?.();
    } catch (e) {
      message.error(apiErrorMessage(e, 'Tarih güncellenemedi.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!fixture}
      title="Tarihi değiştir"
      okText="Kaydet"
      cancelText="Vazgeç"
      confirmLoading={saving}
      onOk={submit}
      onCancel={onClose}
      destroyOnClose
    >
      {fixture && (
        <>
          <p className="mb-tr-modal-sub">
            {fixture.homeTeam?.teamName || 'Belli değil'} – {fixture.awayTeam?.teamName || 'Belli değil'}
          </p>
          <DatePicker
            showTime={{ format: 'HH:mm', minuteStep: 15 }}
            format="DD.MM.YYYY HH:mm"
            value={value}
            onChange={setValue}
            style={{ width: '100%' }}
            placeholder="Tarih ve saat"
          />
        </>
      )}
    </Modal>
  );
}
