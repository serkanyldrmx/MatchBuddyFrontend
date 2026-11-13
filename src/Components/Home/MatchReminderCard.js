import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { App, Button, Card, Checkbox, Typography } from 'antd';
import { BellOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { emailApi } from '../../api/email';
import { apiErrorMessage } from '../../utils/format';
import '../Email/EmailCenter.css';

const { Text } = Typography;

const label = (t, m) => (m >= 1440 ? t('match:reminder.days', { count: m / 1440 }) : t('match:reminder.hours', { count: m / 60 }));

// Takvim dosyası (.ics): telefonda dokununca takvime ekleme ekranı açılır
const icsDate = (d) => d.utc().format('YYYYMMDDTHHmmss[Z]');
const icsText = (s) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');

export function downloadIcs(d) {
  const start = dayjs(d.matchDate);
  const end = start.add(d.durationMinutes || 60, 'minute');
  const place = [d.venue?.name || d.stadium?.stadiumName, d.stadium?.address].filter(Boolean).join(', ');
  const url = `${window.location.origin}/match-details/${d.matchId}`;
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MatcBuddy//TR',
    'BEGIN:VEVENT',
    `UID:match-${d.matchId}@matcbuddy.com`,
    `DTSTAMP:${icsDate(dayjs())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(`⚽ ${d.matchName}`)}`,
    `LOCATION:${icsText(place)}`,
    `DESCRIPTION:${icsText(url)}`,
    `URL:${url}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(d.matchName)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `matcbuddy-mac-${d.matchId}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * Maç detayı: maçtaki oyuncu için "E-posta hatırlatıcı" (1 saat / 3 saat / 1 gün önce) ve takvime ekle.
 * Sunucu: GET/POST /api/Email/MatchReminders (docs/email-api.md)
 */
export default function MatchReminderCard({ detail }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [state, setState] = useState(null);
  const [saving, setSaving] = useState(false);
  const inMatch = detail.myStatus === 1 || detail.myStatus === 2;
  const upcoming = detail.matchDate && dayjs(detail.matchDate).isAfter(dayjs());

  useEffect(() => {
    if (!inMatch || !upcoming) return;
    emailApi
      .matchReminders(detail.matchId)
      .then(setState)
      .catch(() => setState(null));
  }, [detail.matchId, inMatch, upcoming]);

  if (!inMatch || !upcoming) return null;

  const change = async (minutes) => {
    const prev = state;
    setState((s) => ({ ...s, minutes }));
    setSaving(true);
    try {
      const r = await emailApi.setMatchReminders(detail.matchId, minutes);
      message.success(r?.message);
    } catch (e) {
      setState(prev);
      message.error(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  // Maça kalan süreden kısa hatırlatmalar hâlâ seçilebilir; geçmiş olanlar gönderilmez
  const left = dayjs(detail.matchDate).diff(dayjs(), 'minute');

  return (
    <Card size="small" bordered={false} className="mb-reminder" title={<span><BellOutlined /> {t('match:reminder.title')}</span>}>
      {state && !state.hasEmail ? (
        <Text type="secondary">
          {t('match:reminder.noEmail')} <Link to="/userUpdate">{t('match:reminder.addEmail')}</Link>
        </Text>
      ) : (
        <>
          <Text type="secondary" className="mb-reminder__hint">
            {t('match:reminder.hint')}
          </Text>
          <Checkbox.Group
            className="mb-reminder__opts"
            disabled={!state || saving}
            value={state?.minutes || []}
            onChange={change}
            options={(state?.options || [60, 180, 1440]).map((m) => ({ value: m, label: label(t, m), disabled: m > left }))}
          />
        </>
      )}
      <Button block icon={<CalendarOutlined />} onClick={() => downloadIcs(detail)}>
        {t('match:reminder.addToCalendar')}
      </Button>
    </Card>
  );
}
