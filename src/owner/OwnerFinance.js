import React, { useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { Alert, App, Button, Card, Col, DatePicker, Input, Popconfirm, Row, Segmented, Skeleton, Space, Switch, Table, Typography } from 'antd';
import {
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  LeftOutlined,
  PlusOutlined,
  RightOutlined,
  SearchOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { formatPrice, ownerApi } from '../api/venues';
import { useOwnerVenue } from '../layout/VenueLayout';
import { EmptyState, PageHeader } from '../ui';
import { apiErrorMessage } from '../utils/format';
import ExpenseModal, { CopyExpensesModal } from './ExpenseModal';
import {
  CategoryChip,
  DailyChart,
  EXPENSE_COLOR,
  HBarList,
  INCOME_COLOR,
  Legend,
  MonthlyChart,
  SourceSplit,
  categoryMeta,
  pctFmt,
} from './FinanceCharts';
import { InactiveTip, WriteButton, asList, notifyOwnerChanged, useBlockPaidToggle, useOwnerData, ymd } from './shared';
import './finance.css';

const { Text } = Typography;

const SOURCE_TEXT = { match: 'Uygulama maçı', manual: 'Harici rezervasyon', expense: 'Gider' };
const FILTERS = [
  { value: 'all', label: 'Tümü' },
  { value: 'income', label: 'Gelir' },
  { value: 'expense', label: 'Gider' },
  { value: 'unpaid', label: 'Tahsil edilmemiş' },
];

const num = (v) => Number(v) || 0;
const isUnpaid = (t) => t.source === 'manual' && !t.isPaid;

/** Önceki aya göre değişim yüzdesi (önceki ay 0 ise null) */
const change = (cur, prev) => (num(prev) === 0 ? null : ((num(cur) - num(prev)) / Math.abs(num(prev))) * 100);

function Delta({ value, goodWhenUp = true }) {
  if (value == null) return <span className="mb-fin-delta is-flat">Geçen ay verisi yok</span>;
  const up = value > 0.05;
  const down = value < -0.05;
  const good = (up && goodWhenUp) || (down && !goodWhenUp);
  const cls = !up && !down ? 'is-flat' : good ? 'is-good' : 'is-bad';
  return (
    <span className={`mb-fin-delta ${cls}`}>
      {up ? '▲' : down ? '▼' : '•'} {pctFmt(Math.abs(value))} <em>geçen aya göre</em>
    </span>
  );
}

function Kpi({ label, value, tone, children, onClick, title }) {
  return (
    <div
      className={`mb-fin-kpi${tone ? ` is-${tone}` : ''}${onClick ? ' is-link' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
      title={title}
    >
      <span className="mb-fin-kpi__label">{label}</span>
      <span className="mb-fin-kpi__value">{value}</span>
      <div className="mb-fin-kpi__sub">{children}</div>
    </div>
  );
}

/** CSV (Excel uyumlu: UTF-8 BOM, ";" ayraç, virgüllü ondalık) */
function downloadCsv(rows, month, venueName) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const money = (v) => num(v).toFixed(2).replace('.', ',');
  const head = ['Tarih', 'Saat', 'Tür', 'Kaynak', 'Açıklama', 'Kategori', 'Saha', 'Tutar (TL)', 'Ödeme durumu'];
  const lines = rows.map((t) => {
    const d = dayjs(t.date);
    return [
      d.format('DD.MM.YYYY'),
      t.source === 'expense' ? '' : d.format('HH:mm'),
      t.type === 'income' ? 'Gelir' : 'Gider',
      SOURCE_TEXT[t.source] || t.source,
      t.title,
      t.category || '',
      t.pitchName || '',
      (t.type === 'expense' ? '-' : '') + money(t.amount),
      t.source === 'manual' ? (t.isPaid ? 'Ödendi' : 'Ödenmedi') : '',
    ]
      .map(esc)
      .join(';');
  });
  const csv = `﻿${[head.join(';'), ...lines].join('\r\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const slug = (venueName || 'tesis')
    .toLocaleLowerCase('tr')
    .replace(/[^a-z0-9çğıöşü]+/gi, '-')
    .replace(/^-|-$/g, '');
  a.href = url;
  a.download = `gelir-gider-${slug}-${month.format('YYYY-MM')}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Gelir & Gider: aylık finans özeti, grafikler, hareketler, gider yönetimi */
export default function OwnerFinance() {
  const { message } = App.useApp();
  const { venue, membershipActive } = useOwnerVenue();
  const [month, setMonth] = useState(() => dayjs().startOf('month'));
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expenseDraft, setExpenseDraft] = useState(null); // { expense } | null
  const [copyOpen, setCopyOpen] = useState(false);
  const tableRef = useRef(null);
  const monthKey = month.format('YYYY-MM');

  const { data, loading, error, reload, venueId } = useOwnerData(
    async (id) => {
      const [fin, exp] = await Promise.all([
        ownerApi.finance(id, month.year(), month.month() + 1),
        ownerApi.expenses(id, ymd(month), ymd(month.add(1, 'month'))).catch(() => []),
      ]);
      return { fin: fin || {}, expenses: asList(exp) };
    },
    [monthKey]
  );
  const paid = useBlockPaidToggle(() => reload(true));

  const f = data?.fin || {};
  const income = f.income || {};
  const prev = f.previous || {};
  const counts = f.counts || {};
  const transactions = useMemo(() => asList(f.transactions), [f.transactions]);
  const expensesById = useMemo(() => new Map((data?.expenses || []).map((e) => [e.expenseId, e])), [data]);

  const hasData =
    num(income.total) > 0 || num(f.expenses) > 0 || num(f.receivable) > 0 || num(f.expectedIncome) > 0 || transactions.length > 0;
  const unpaidCount = transactions.filter(isUnpaid).length;

  const rows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr');
    return transactions
      .map((t, i) => ({ ...t, key: `${t.source}-${t.refId ?? i}-${i}` }))
      .filter((t) => {
        if (filter === 'income' && t.type !== 'income') return false;
        if (filter === 'expense' && t.type !== 'expense') return false;
        if (filter === 'unpaid' && !isUnpaid(t)) return false;
        if (q && !`${t.title || ''} ${t.category || ''} ${t.pitchName || ''}`.toLocaleLowerCase('tr').includes(q)) return false;
        return true;
      });
  }, [transactions, filter, search]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (s, t) => {
          if (t.type === 'income') s.income += num(t.amount);
          else s.expense += num(t.amount);
          return s;
        },
        { income: 0, expense: 0 }
      ),
    [rows]
  );

  const shiftMonth = (d) => setMonth((m) => m.add(d, 'month'));
  const selectMonth = (y, m) => setMonth(dayjs(`${y}-${String(m).padStart(2, '0')}-01`));
  const showUnpaid = () => {
    setFilter('unpaid');
    setSearch('');
    setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const editExpense = (t) => {
    const e = expensesById.get(t.refId);
    setExpenseDraft({
      expense: e || {
        expenseId: t.refId,
        date: t.date,
        category: t.category,
        amount: t.amount,
        description: t.title && t.title !== t.category ? t.title : '',
      },
    });
  };

  const deleteExpense = async (t) => {
    try {
      await ownerApi.deleteExpense(t.refId);
      message.success('Gider silindi.');
      notifyOwnerChanged();
      reload(true);
    } catch (e) {
      message.error(apiErrorMessage(e, 'Gider silinemedi.'));
    }
  };

  const columns = [
    {
      title: 'Tarih',
      dataIndex: 'date',
      width: 130,
      render: (v, t) => (
        <div className="mb-owner-when">
          <strong>{dayjs(v).format('DD MMM ddd')}</strong>
          {t.source !== 'expense' && <span>{dayjs(v).format('HH:mm')}</span>}
        </div>
      ),
    },
    {
      title: 'Tür',
      dataIndex: 'type',
      width: 90,
      render: (v) => <span className={`mb-fin-type is-${v}`}>{v === 'income' ? 'Gelir' : 'Gider'}</span>,
    },
    {
      title: 'Kaynak',
      dataIndex: 'source',
      width: 170,
      render: (v, t) =>
        v === 'expense' ? (
          <CategoryChip category={t.category} compact />
        ) : v === 'manual' ? (
          <span className="mb-fin-src is-manual">Harici</span>
        ) : (
          <span className="mb-fin-src is-match">Uygulama maçı</span>
        ),
    },
    { title: 'Açıklama', dataIndex: 'title', render: (v) => v || <Text type="secondary">-</Text> },
    { title: 'Saha', dataIndex: 'pitchName', width: 110, render: (v) => v || <Text type="secondary">—</Text> },
    {
      title: 'Tutar',
      dataIndex: 'amount',
      align: 'right',
      width: 130,
      render: (v, t) => (
        <span className={`mb-fin-amount is-${t.type}`}>
          {t.type === 'income' ? '+' : '−'}
          {formatPrice(v)}
        </span>
      ),
    },
    {
      title: 'Ödeme',
      key: 'paid',
      width: 140,
      render: (_, t) =>
        t.source === 'manual' ? (
          <span className={`mb-pay-cell ${t.isPaid ? 'is-paid' : 'is-unpaid'}`}>
            <InactiveTip>
              <Switch
                size="small"
                checked={Boolean(t.isPaid)}
                disabled={!membershipActive || t.refId == null}
                loading={paid.busyId === t.refId}
                onChange={(v) => paid.toggle(t.refId, v)}
              />
            </InactiveTip>
            {t.isPaid ? 'Alındı' : 'Alınmadı'}
          </span>
        ) : t.source === 'match' ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Uygulama
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      align: 'right',
      render: (_, t) =>
        t.source === 'expense' && t.refId != null ? (
          <Space size={4}>
            <WriteButton size="small" tooltip="Düzenle" icon={<EditOutlined />} onClick={() => editExpense(t)} aria-label="Düzenle" />
            <Popconfirm
              title="Gideri sil"
              description="Bu gider kaydı kalıcı olarak silinecek. Emin misiniz?"
              okText="Sil"
              cancelText="Vazgeç"
              okButtonProps={{ danger: true }}
              onConfirm={() => deleteExpense(t)}
              disabled={!membershipActive}
            >
              <WriteButton size="small" danger icon={<DeleteOutlined />} aria-label="Sil" />
            </Popconfirm>
          </Space>
        ) : null,
    },
  ];

  const isCurrentMonth = month.isSame(dayjs(), 'month');
  const net = num(f.net);
  const monthly = asList(f.monthly);
  const daily = asList(f.daily);
  const pitchRows = asList(f.incomeByPitch)
    .map((p) => ({
      key: p.pitchId ?? p.name,
      label: p.name,
      value: num(p.income),
      meta: `${num(p.hours).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} saat`,
      color: INCOME_COLOR,
    }))
    .sort((a, b) => b.value - a.value);
  const expenseTotal = num(f.expenses);
  const catRows = asList(f.expenseByCategory)
    .map((c) => ({
      key: c.category,
      label: <CategoryChip category={c.category} compact />,
      value: num(c.amount),
      meta: expenseTotal > 0 ? pctFmt((num(c.amount) / expenseTotal) * 100, 0) : null,
      color: categoryMeta(c.category).color,
    }))
    .sort((a, b) => b.value - a.value);
  const sources = asList(f.incomeBySource).length
    ? asList(f.incomeBySource)
    : [
        { source: 'matches', amount: income.matches },
        { source: 'manual', amount: income.manual },
      ];

  return (
    <div className="mb-fin">
      <PageHeader
        eyebrow={venue?.name}
        title="Gelir & Gider"
        icon={<WalletOutlined />}
        subtitle="Aylık gelirinizi, giderlerinizi ve net kârınızı tek ekranda takip edin."
        extra={
          <Space wrap>
            <Space.Compact>
              <Button icon={<LeftOutlined />} onClick={() => shiftMonth(-1)} aria-label="Önceki ay" />
              <DatePicker
                picker="month"
                value={month}
                allowClear={false}
                format="MMMM YYYY"
                onChange={(d) => d && setMonth(d.startOf('month'))}
                style={{ width: 160 }}
              />
              <Button icon={<RightOutlined />} onClick={() => shiftMonth(1)} aria-label="Sonraki ay" />
            </Space.Compact>
            {!isCurrentMonth && <Button onClick={() => setMonth(dayjs().startOf('month'))}>Bu ay</Button>}
            <WriteButton type="primary" icon={<PlusOutlined />} onClick={() => setExpenseDraft({ expense: null })}>
              Gider ekle
            </WriteButton>
          </Space>
        }
      />

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

      {loading && !data ? (
        <>
          <div className="mb-fin-kpis">
            {Array.from({ length: 5 }).map((_, i) => (
              <div className="mb-fin-kpi" key={i}>
                <Skeleton active paragraph={{ rows: 1 }} title={false} />
              </div>
            ))}
          </div>
          <Card bordered={false}>
            <Skeleton active paragraph={{ rows: 8 }} />
          </Card>
        </>
      ) : (
        <>
          <div className={`mb-fin-kpis${loading ? ' is-loading' : ''}`}>
            <Kpi label="Gelir" value={formatPrice(income.total ?? 0)} tone="income">
              <span>
                Uygulama {formatPrice(income.matches ?? 0)} · Harici {formatPrice(income.manual ?? 0)}
              </span>
              <Delta value={change(income.total, prev.income)} />
            </Kpi>
            <Kpi label="Gider" value={formatPrice(f.expenses ?? 0)} tone="expense">
              <span>{asList(f.expenseByCategory).length} kategori</span>
              <Delta value={change(f.expenses, prev.expenses)} goodWhenUp={false} />
            </Kpi>
            <Kpi label="Net kâr" value={formatPrice(net)} tone={net >= 0 ? 'net' : 'loss'}>
              <span>
                Kâr marjı <strong>{f.marginPercent != null ? pctFmt(f.marginPercent) : '—'}</strong>
              </span>
              <Delta value={change(f.net, prev.net)} />
            </Kpi>
            <Kpi
              label="Tahsil edilmemiş"
              value={formatPrice(f.receivable ?? 0)}
              tone="receivable"
              onClick={unpaidCount ? showUnpaid : undefined}
              title={unpaidCount ? 'Ödemesi alınmamış harici rezervasyonları göster' : undefined}
            >
              <span>{unpaidCount ? `${unpaidCount} harici rezervasyon · listele →` : 'Bekleyen ödeme yok'}</span>
            </Kpi>
            <Kpi label="Beklenen gelir" value={formatPrice(f.expectedIncome ?? 0)} tone="expected">
              <span>Henüz oynanmamış onaylı maçlar ve harici rezervasyonlar</span>
            </Kpi>
          </div>

          <div className="mb-fin-mini">
            <span>
              <strong>{counts.matches ?? 0}</strong> maç
            </span>
            <span>
              <strong>{counts.manualBookings ?? 0}</strong> harici rezervasyon
            </span>
            <span>
              <strong>{num(counts.hoursSold).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}</strong> saat satıldı
            </span>
            {num(counts.hoursSold) > 0 && (
              <span>
                Saat başı ortalama <strong>{formatPrice(Math.round(num(income.total) / num(counts.hoursSold)))}</strong>
              </span>
            )}
          </div>

          <Row gutter={[16, 16]}>
            <Col xs={24} xl={hasData ? 14 : 24}>
              <Card
                bordered={false}
                className="mb-fin-card"
                title="Son 12 ay"
                extra={
                  <Legend
                    items={[
                      { label: 'Gelir', color: INCOME_COLOR },
                      { label: 'Gider', color: EXPENSE_COLOR },
                      { label: 'Net kâr', color: 'var(--mb-text)', line: true },
                    ]}
                  />
                }
              >
                {monthly.length ? (
                  <MonthlyChart data={monthly} selected={{ year: month.year(), month: month.month() + 1 }} onSelect={selectMonth} />
                ) : (
                  <EmptyState description="Henüz aylık veri yok" />
                )}
                <div className="mb-fin-hint">Bir aya tıklayarak o ayın ayrıntılarını görebilirsiniz.</div>
              </Card>
            </Col>

            {hasData ? (
              <>
                <Col xs={24} xl={10}>
                  <Card
                    bordered={false}
                    className="mb-fin-card"
                    title={`Günlük akış · ${month.format('MMMM')}`}
                    extra={
                      <Legend
                        items={[
                          { label: 'Gelir', color: INCOME_COLOR },
                          { label: 'Gider', color: EXPENSE_COLOR },
                        ]}
                      />
                    }
                  >
                    <DailyChart data={daily} />
                    <div className="mb-fin-hint">Gelir çizginin üstünde, gider altında gösterilir.</div>
                  </Card>
                </Col>

                <Col xs={24} lg={12}>
                  <Card bordered={false} className="mb-fin-card" title="Gelir dağılımı">
                    <div className="mb-fin-section-label">Kaynağa göre</div>
                    <SourceSplit items={sources} />
                    <div className="mb-fin-section-label" style={{ marginTop: 22 }}>
                      Sahaya göre
                    </div>
                    <HBarList rows={pitchRows} emptyText="Bu ay sahalardan gelir oluşmadı." />
                  </Card>
                </Col>

                <Col xs={24} lg={12}>
                  <Card
                    bordered={false}
                    className="mb-fin-card"
                    title="Gider dağılımı"
                    extra={
                      <WriteButton size="small" icon={<CopyOutlined />} onClick={() => setCopyOpen(true)}>
                        Geçen aydan kopyala
                      </WriteButton>
                    }
                  >
                    {catRows.length ? (
                      <>
                        <div className="mb-fin-cat-total">
                          <span>Toplam gider</span>
                          <strong>{formatPrice(expenseTotal)}</strong>
                        </div>
                        <HBarList rows={catRows} />
                      </>
                    ) : (
                      <EmptyState description="Bu ay için gider girilmemiş">
                        <WriteButton type="primary" icon={<PlusOutlined />} onClick={() => setExpenseDraft({ expense: null })}>
                          Gider ekle
                        </WriteButton>
                      </EmptyState>
                    )}
                  </Card>
                </Col>

                <Col xs={24}>
                  <div ref={tableRef} className="mb-fin-anchor" />
                  <Card bordered={false} className="mb-fin-card" title="Hareketler">
                    <div className="mb-owner-toolbar">
                      <Segmented
                        value={filter}
                        onChange={setFilter}
                        options={FILTERS.map((o) => ({
                          value: o.value,
                          label: o.value === 'unpaid' && unpaidCount ? `${o.label} (${unpaidCount})` : o.label,
                        }))}
                      />
                      <Space wrap className="mb-owner-toolbar__filters">
                        <Input
                          allowClear
                          prefix={<SearchOutlined />}
                          placeholder="Açıklama, kategori ya da saha ara"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          style={{ width: 260 }}
                        />
                        <Button icon={<DownloadOutlined />} disabled={!rows.length} onClick={() => downloadCsv(rows, month, venue?.name)}>
                          CSV indir
                        </Button>
                      </Space>
                    </div>
                    <Table
                      rowKey="key"
                      size="middle"
                      columns={columns}
                      dataSource={rows}
                      loading={loading}
                      scroll={{ x: 980 }}
                      pagination={{ pageSize: 20, hideOnSinglePage: true }}
                      rowClassName={(t) => (isUnpaid(t) ? 'mb-fin-row-unpaid' : '')}
                      locale={{ emptyText: <EmptyState description="Bu filtreye uyan hareket yok" /> }}
                      summary={() =>
                        rows.length ? (
                          <Table.Summary>
                            <Table.Summary.Row className="mb-fin-summary">
                              <Table.Summary.Cell index={0} colSpan={5}>
                                <Text type="secondary">{rows.length} hareket</Text>
                              </Table.Summary.Cell>
                              <Table.Summary.Cell index={5} align="right" colSpan={1}>
                                <div className="mb-fin-sum">
                                  <span className="mb-fin-amount is-income">+{formatPrice(totals.income)}</span>
                                  <span className="mb-fin-amount is-expense">−{formatPrice(totals.expense)}</span>
                                </div>
                              </Table.Summary.Cell>
                              <Table.Summary.Cell index={6} colSpan={2}>
                                <span className={`mb-fin-net ${totals.income - totals.expense >= 0 ? 'is-pos' : 'is-neg'}`}>
                                  Net {formatPrice(totals.income - totals.expense)}
                                </span>
                              </Table.Summary.Cell>
                            </Table.Summary.Row>
                          </Table.Summary>
                        ) : null
                      }
                    />
                  </Card>
                </Col>
              </>
            ) : (
              <Col xs={24}>
                <Card bordered={false} className="mb-fin-card">
                  <EmptyState description={`${month.format('MMMM YYYY')} için henüz gelir ya da gider kaydı yok`}>
                    <div className="mb-fin-empty">
                      <p>
                        Geliriniz otomatik hesaplanır: <strong>onaylanmış ve oynanmış</strong> uygulama maçları ile{' '}
                        <strong>ödemesi alınmış</strong> harici rezervasyonlar, maçın oynandığı aya yazılır. Giderlerinizi (kira, fatura,
                        personel…) buradan ekleyerek net kârınızı görebilirsiniz.
                      </p>
                      <Space wrap style={{ justifyContent: 'center' }}>
                        <WriteButton type="primary" icon={<PlusOutlined />} onClick={() => setExpenseDraft({ expense: null })}>
                          Gider ekle
                        </WriteButton>
                        <WriteButton icon={<CopyOutlined />} onClick={() => setCopyOpen(true)}>
                          Geçen aydan kopyala
                        </WriteButton>
                      </Space>
                    </div>
                  </EmptyState>
                </Card>
              </Col>
            )}
          </Row>
        </>
      )}

      <ExpenseModal
        open={Boolean(expenseDraft)}
        expense={expenseDraft?.expense}
        month={month}
        venueId={venueId}
        onClose={() => setExpenseDraft(null)}
        onSaved={() => {
          setExpenseDraft(null);
          reload(true);
        }}
      />
      <CopyExpensesModal
        open={copyOpen}
        month={month}
        venueId={venueId}
        onClose={() => setCopyOpen(false)}
        onDone={() => {
          setCopyOpen(false);
          reload(true);
        }}
      />
    </div>
  );
}
