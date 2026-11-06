import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Calendar, Card, Col, Row, Segmented, Skeleton } from 'antd';
import { CalendarOutlined, EnvironmentOutlined, LeftOutlined, MailOutlined, RightOutlined, UnorderedListOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { calendarApi, INVITES_CHANGED } from '../../api/social';
import { EmptyState, PageHeader } from '../../ui';
import { apiErrorMessage, isPast } from '../../utils/format';
import './MyCalendar.css';

const KIND = {
  going: { label: 'Katılıyorsun', className: 'is-going' },
  waitlist: { label: 'Yedek', className: 'is-waitlist' },
  invited: { label: 'Davet', className: 'is-invited' },
};

const dayLabel = (d) => {
  const today = dayjs().startOf('day');
  if (d.isSame(today, 'day')) return 'Bugün';
  if (d.isSame(today.add(1, 'day'), 'day')) return 'Yarın';
  return d.format('dddd D MMM');
};

const hasScore = (m) => m.homeScore != null && m.awayScore != null;

/** Bilet tarzı tek satır */
function CalendarRow({ item }) {
  const navigate = useNavigate();
  const k = KIND[item.kind] || KIND.going;
  const date = dayjs(item.matchDate);
  const past = isPast(item.matchDate);
  return (
    <div
      className={`mb-cal-row ${k.className} ${past ? 'is-past' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/match-details/${item.matchId}`)}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/match-details/${item.matchId}`)}
    >
      <div className="mb-cal-row__time">
        {past && hasScore(item) ? (
          <span className="mb-cal-row__score">
            {item.homeScore}<i>:</i>{item.awayScore}
          </span>
        ) : (
          date.format('HH:mm')
        )}
      </div>
      <div className="mb-cal-row__body">
        <strong>{item.matchName}</strong>
        <span>
          <EnvironmentOutlined /> {item.stadiumName || 'Halı saha'}
          {item.capacity ? ` · ${item.goingCount}/${item.capacity} oyuncu` : ''}
        </span>
      </div>
      <div className="mb-cal-row__side">
        {past ? (
          <span className="mb-chip is-done">{hasScore(item) ? 'Bitti' : 'Oynandı'}</span>
        ) : (
          <span className={`mb-cal-chip ${k.className}`}>{k.label}</span>
        )}
        {item.kind === 'invited' && !past && (
          <Button
            size="small"
            type="link"
            icon={<MailOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              navigate('/invites');
            }}
          >
            Yanıtla
          </Button>
        )}
      </div>
    </div>
  );
}

function Agenda({ items, loading }) {
  const navigate = useNavigate();
  const groups = useMemo(() => {
    const map = new Map();
    items
      .slice()
      .sort((a, b) => dayjs(a.matchDate).diff(b.matchDate))
      .forEach((m) => {
        const key = dayjs(m.matchDate).format('YYYY-MM-DD');
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(m);
      });
    return [...map.entries()];
  }, [items]);

  if (loading) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    );
  }
  if (!groups.length) {
    return (
      <Card>
        <EmptyState description="Önümüzdeki 60 günde maçın yok. Fikstüre göz at, bir maça yazıl.">
          <Button type="primary" onClick={() => navigate('/home')}>
            Maç bul
          </Button>
        </EmptyState>
      </Card>
    );
  }
  return (
    <div className="mb-agenda">
      {groups.map(([key, list]) => {
        const d = dayjs(key);
        const isToday = d.isSame(dayjs(), 'day');
        return (
          <section key={key} className="mb-agenda__day">
            <header className={`mb-agenda__head ${isToday ? 'is-today' : ''}`}>
              <span className="mb-agenda__label">{dayLabel(d)}</span>
              <span className="mb-agenda__count">{list.length} maç</span>
            </header>
            <div className="mb-agenda__rows">
              {list.map((m) => (
                <CalendarRow key={`${m.matchId}-${m.kind}`} item={m} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MonthView({ items, loading, month, onMonthChange }) {
  const [selected, setSelected] = useState(() => dayjs());

  const byDay = useMemo(() => {
    const map = {};
    items.forEach((m) => {
      const key = dayjs(m.matchDate).format('YYYY-MM-DD');
      (map[key] = map[key] || []).push(m);
    });
    Object.values(map).forEach((l) => l.sort((a, b) => dayjs(a.matchDate).diff(b.matchDate)));
    return map;
  }, [items]);

  const dayItems = byDay[selected.format('YYYY-MM-DD')] || [];
  const monthItems = items.filter((m) => dayjs(m.matchDate).isSame(month, 'month'));
  const results = monthItems.filter((m) => m.kind === 'going' && isPast(m.matchDate) && hasScore(m));
  const upcomingCount = monthItems.filter((m) => !isPast(m.matchDate)).length;

  const cellRender = (current, info) => {
    if (info.type !== 'date') return info.originNode;
    const list = byDay[current.format('YYYY-MM-DD')] || [];
    if (!list.length) return null;
    return (
      <div className="mb-cal-cell">
        {list.slice(0, 2).map((m) => {
          const past = isPast(m.matchDate);
          const k = KIND[m.kind] || KIND.going;
          return (
            <span key={`${m.matchId}-${m.kind}`} className={`mb-cal-cell__item ${past ? 'is-past' : k.className}`}>
              <i />
              <b>{past && hasScore(m) ? `${m.homeScore}-${m.awayScore}` : dayjs(m.matchDate).format('HH:mm')}</b>
              <em>{m.matchName}</em>
            </span>
          );
        })}
        {list.length > 2 && <span className="mb-cal-cell__more">+{list.length - 2}</span>}
      </div>
    );
  };

  const goMonth = (m) => {
    onMonthChange(m.startOf('month'));
    setSelected(m.isSame(dayjs(), 'month') ? dayjs() : m.startOf('month'));
  };

  const headerRender = () => (
    <div className="mb-cal-header">
      <Button type="text" icon={<LeftOutlined />} onClick={() => goMonth(month.subtract(1, 'month'))} aria-label="Önceki ay" />
      <h3>{month.format('MMMM YYYY')}</h3>
      <Button type="text" icon={<RightOutlined />} onClick={() => goMonth(month.add(1, 'month'))} aria-label="Sonraki ay" />
      {!month.isSame(dayjs(), 'month') && (
        <Button size="small" onClick={() => goMonth(dayjs())}>
          Bugün
        </Button>
      )}
    </div>
  );

  return (
    <Row gutter={[20, 20]}>
      <Col xs={24} xl={16}>
        <Card className="mb-cal-card">
          {loading && <div className="mb-cal-loading" />}
          <Calendar
            value={selected}
            headerRender={headerRender}
            cellRender={cellRender}
            onSelect={(d) => {
              setSelected(d);
              if (!d.isSame(month, 'month')) onMonthChange(d.startOf('month'));
            }}
          />
        </Card>
      </Col>
      <Col xs={24} xl={8}>
        <div className="mb-cal-side">
          <Card title={dayLabel(selected)}>
            {dayItems.length === 0 ? (
              <EmptyState description="Bu gün maçın yok" />
            ) : (
              <div className="mb-agenda__rows">
                {dayItems.map((m) => (
                  <CalendarRow key={`${m.matchId}-${m.kind}`} item={m} />
                ))}
              </div>
            )}
          </Card>
          <Card title={`${month.format('MMMM')} özeti`}>
            <div className="mb-cal-summary">
              <div>
                <strong>{upcomingCount}</strong>
                <span>Yaklaşan</span>
              </div>
              <div>
                <strong>{results.length}</strong>
                <span>Oynanan</span>
              </div>
            </div>
            {results.length > 0 && (
              <div className="mb-agenda__rows" style={{ marginTop: 14 }}>
                {results
                  .slice()
                  .sort((a, b) => dayjs(b.matchDate).diff(a.matchDate))
                  .map((m) => (
                    <CalendarRow key={`r-${m.matchId}`} item={m} />
                  ))}
              </div>
            )}
          </Card>
          <div className="mb-cal-legend">
            <span className="is-going"><i /> Katılıyorsun</span>
            <span className="is-waitlist"><i /> Yedek</span>
            <span className="is-invited"><i /> Davet</span>
            <span className="is-past"><i /> Oynandı</span>
          </div>
        </div>
      </Col>
    </Row>
  );
}

export default function MyCalendar() {
  const { message } = App.useApp();
  const [view, setView] = useState('agenda');
  const [month, setMonth] = useState(() => dayjs().startOf('month'));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let from;
    let to;
    if (view === 'agenda') {
      from = dayjs().startOf('day');
      to = from.add(60, 'day');
    } else {
      // Takvimde görünen önceki/sonraki ayın günleri de dolsun diye bir hafta pay
      from = month.startOf('month').subtract(7, 'day');
      to = month.endOf('month').add(14, 'day');
    }
    try {
      const data = await calendarApi.my(from.toISOString(), to.toISOString());
      setItems(data || []);
    } catch (e) {
      message.error(apiErrorMessage(e, 'Takvim yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, [view, month, message]);

  useEffect(() => {
    load();
    window.addEventListener(INVITES_CHANGED, load);
    return () => window.removeEventListener(INVITES_CHANGED, load);
  }, [load]);

  const agendaItems = useMemo(() => items.filter((m) => !isPast(m.matchDate) || dayjs(m.matchDate).isSame(dayjs(), 'day')), [items]);

  return (
    <>
      <PageHeader
        eyebrow="Fikstürüm"
        title="Takvimim"
        icon={<CalendarOutlined />}
        subtitle="Katıldığın, yedekte beklediğin ve davet edildiğin maçlar tek yerde."
        extra={
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { label: 'Ajanda', value: 'agenda', icon: <UnorderedListOutlined /> },
              { label: 'Ay', value: 'month', icon: <CalendarOutlined /> },
            ]}
          />
        }
      />
      {view === 'agenda' ? (
        <Agenda items={agendaItems} loading={loading} />
      ) : (
        <MonthView items={items} loading={loading} month={month} onMonthChange={setMonth} />
      )}
    </>
  );
}
