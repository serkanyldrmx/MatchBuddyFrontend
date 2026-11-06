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
import { Trans, useTranslation } from 'react-i18next';
import { expenseCategoryLabel, formatPrice, ownerApi } from '../api/venues';
import i18n, { intlLocale } from '../i18n';
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

const SOURCE_TEXT_KEYS = { match: 'finance:source.match', manual: 'finance:source.manual', expense: 'finance:source.expense' };
const FILTERS = [
  { value: 'all', labelKey: 'common:all' },
  { value: 'income', labelKey: 'finance:income' },
  { value: 'expense', labelKey: 'finance:expense' },
  { value: 'unpaid', labelKey: 'finance:unpaid' },
];

const num = (v) => Number(v) || 0;
const isUnpaid = (t) => t.source === 'manual' && !t.isPaid;

/** Önceki aya göre değişim yüzdesi (önceki ay 0 ise null) */
const change = (cur, prev) => (num(prev) === 0 ? null : ((num(cur) - num(prev)) / Math.abs(num(prev))) * 100);

function Delta({ value, goodWhenUp = true }) {
  const { t } = useTranslation();
  if (value == null) return <span className="mb-fin-delta is-flat">{t('finance:delta.noPrevious')}</span>;
  const up = value > 0.05;
  const down = value < -0.05;
  const good = (up && goodWhenUp) || (down && !goodWhenUp);
  const cls = !up && !down ? 'is-flat' : good ? 'is-good' : 'is-bad';
  return (
    <span className={`mb-fin-delta ${cls}`}>
      {up ? '▲' : down ? '▼' : '•'} {pctFmt(Math.abs(value))} <em>{t('finance:delta.vsLastMonth')}</em>
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
  const head = ['date', 'time', 'type', 'source', 'description', 'category', 'pitch', 'amount', 'paymentStatus'].map((k) =>
    i18n.t(`finance:csv.${k}`)
  );
  const lines = rows.map((t) => {
    const d = dayjs(t.date);
    return [
      d.format('DD.MM.YYYY'),
      t.source === 'expense' ? '' : d.format('HH:mm'),
      t.type === 'income' ? i18n.t('finance:income') : i18n.t('finance:expense'),
      SOURCE_TEXT_KEYS[t.source] ? i18n.t(SOURCE_TEXT_KEYS[t.source]) : t.source,
      t.title,
      t.category ? expenseCategoryLabel(t.category) : '',
      t.pitchName || '',
      (t.type === 'expense' ? '-' : '') + money(t.amount),
      t.source === 'manual' ? (t.isPaid ? i18n.t('finance:csv.paid') : i18n.t('finance:csv.unpaid')) : '',
    ]
      .map(esc)
      .join(';');
  });
  const csv = `﻿${[head.join(';'), ...lines].join('\r\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const slug = (venueName || i18n.t('finance:csv.venueFallback'))
    .toLocaleLowerCase('tr')
    .replace(/[^a-z0-9çğıöşü]+/gi, '-')
    .replace(/^-|-$/g, '');
  a.href = url;
  a.download = i18n.t('finance:csv.fileName', { slug, month: month.format('YYYY-MM') });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Gelir & Gider: aylık finans özeti, grafikler, hareketler, gider yönetimi */
export default function OwnerFinance() {
  const { t } = useTranslation();
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

  const deleteExpense = async (tx) => {
    try {
      await ownerApi.deleteExpense(tx.refId);
      message.success(t('finance:messages.expenseDeleted'));
      notifyOwnerChanged();
      reload(true);
    } catch (e) {
      message.error(apiErrorMessage(e, t('finance:messages.expenseDeleteFailed')));
    }
  };

  const columns = [
    {
      title: t('finance:table.date'),
      dataIndex: 'date',
      width: 130,
      render: (v, tx) => (
        <div className="mb-owner-when">
          <strong>{dayjs(v).format('DD MMM ddd')}</strong>
          {tx.source !== 'expense' && <span>{dayjs(v).format('HH:mm')}</span>}
        </div>
      ),
    },
    {
      title: t('finance:table.type'),
      dataIndex: 'type',
      width: 90,
      render: (v) => <span className={`mb-fin-type is-${v}`}>{v === 'income' ? t('finance:income') : t('finance:expense')}</span>,
    },
    {
      title: t('finance:table.source'),
      dataIndex: 'source',
      width: 170,
      render: (v, tx) =>
        v === 'expense' ? (
          <CategoryChip category={tx.category} compact />
        ) : v === 'manual' ? (
          <span className="mb-fin-src is-manual">{t('finance:source.manualShort')}</span>
        ) : (
          <span className="mb-fin-src is-match">{t('finance:source.match')}</span>
        ),
    },
    {
      title: t('finance:table.description'),
      dataIndex: 'title',
      // açıklamasız giderlerde sunucu başlık olarak kategori değerini döner → ekranda çevrilmiş kategori adı
      render: (v, tx) =>
        (tx.source === 'expense' && v && v === tx.category ? expenseCategoryLabel(v) : v) || <Text type="secondary">-</Text>,
    },
    { title: t('common:pitch'), dataIndex: 'pitchName', width: 110, render: (v) => v || <Text type="secondary">—</Text> },
    {
      title: t('finance:table.amount'),
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
      title: t('finance:table.payment'),
      key: 'paid',
      width: 140,
      render: (_, tx) =>
        tx.source === 'manual' ? (
          <span className={`mb-pay-cell ${tx.isPaid ? 'is-paid' : 'is-unpaid'}`}>
            <InactiveTip>
              <Switch
                size="small"
                checked={Boolean(tx.isPaid)}
                disabled={!membershipActive || tx.refId == null}
                loading={paid.busyId === tx.refId}
                onChange={(v) => paid.toggle(tx.refId, v)}
              />
            </InactiveTip>
            {tx.isPaid ? t('finance:table.received') : t('finance:table.notReceived')}
          </span>
        ) : tx.source === 'match' ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('finance:source.app')}
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
      render: (_, tx) =>
        tx.source === 'expense' && tx.refId != null ? (
          <Space size={4}>
            <WriteButton
              size="small"
              tooltip={t('common:actions.edit')}
              icon={<EditOutlined />}
              onClick={() => editExpense(tx)}
              aria-label={t('common:actions.edit')}
            />
            <Popconfirm
              title={t('finance:table.deleteTitle')}
              description={t('finance:table.deleteDescription')}
              okText={t('common:actions.delete')}
              cancelText={t('common:actions.cancel')}
              okButtonProps={{ danger: true }}
              onConfirm={() => deleteExpense(tx)}
              disabled={!membershipActive}
            >
              <WriteButton size="small" danger icon={<DeleteOutlined />} aria-label={t('common:actions.delete')} />
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
      meta: t('finance:pitchHours', { hours: num(p.hours).toLocaleString(intlLocale(), { maximumFractionDigits: 1 }) }),
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
        title={t('finance:page.title')}
        icon={<WalletOutlined />}
        subtitle={t('finance:page.subtitle')}
        extra={
          <Space wrap>
            <Space.Compact>
              <Button icon={<LeftOutlined />} onClick={() => shiftMonth(-1)} aria-label={t('finance:page.prevMonth')} />
              <DatePicker
                picker="month"
                value={month}
                allowClear={false}
                format="MMMM YYYY"
                onChange={(d) => d && setMonth(d.startOf('month'))}
                style={{ width: 160 }}
              />
              <Button icon={<RightOutlined />} onClick={() => shiftMonth(1)} aria-label={t('finance:page.nextMonth')} />
            </Space.Compact>
            {!isCurrentMonth && <Button onClick={() => setMonth(dayjs().startOf('month'))}>{t('finance:page.thisMonth')}</Button>}
            <WriteButton type="primary" icon={<PlusOutlined />} onClick={() => setExpenseDraft({ expense: null })}>
              {t('finance:page.addExpense')}
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
            <Kpi label={t('finance:income')} value={formatPrice(income.total ?? 0)} tone="income">
              <span>
                {t('finance:kpi.incomeSplit', { matches: formatPrice(income.matches ?? 0), manual: formatPrice(income.manual ?? 0) })}
              </span>
              <Delta value={change(income.total, prev.income)} />
            </Kpi>
            <Kpi label={t('finance:expense')} value={formatPrice(f.expenses ?? 0)} tone="expense">
              <span>{t('finance:kpi.categories', { count: asList(f.expenseByCategory).length })}</span>
              <Delta value={change(f.expenses, prev.expenses)} goodWhenUp={false} />
            </Kpi>
            <Kpi label={t('finance:netProfit')} value={formatPrice(net)} tone={net >= 0 ? 'net' : 'loss'}>
              <span>
                <Trans
                  i18nKey="finance:kpi.margin"
                  values={{ value: f.marginPercent != null ? pctFmt(f.marginPercent) : '—' }}
                  components={{ b: <strong /> }}
                />
              </span>
              <Delta value={change(f.net, prev.net)} />
            </Kpi>
            <Kpi
              label={t('finance:unpaid')}
              value={formatPrice(f.receivable ?? 0)}
              tone="receivable"
              onClick={unpaidCount ? showUnpaid : undefined}
              title={unpaidCount ? t('finance:kpi.unpaidTitle') : undefined}
            >
              <span>{unpaidCount ? t('finance:kpi.unpaidList', { count: unpaidCount }) : t('finance:kpi.noPending')}</span>
            </Kpi>
            <Kpi label={t('finance:kpi.expected')} value={formatPrice(f.expectedIncome ?? 0)} tone="expected">
              <span>{t('finance:kpi.expectedHint')}</span>
            </Kpi>
          </div>

          <div className="mb-fin-mini">
            <span>
              <Trans i18nKey="finance:mini.matches" count={counts.matches ?? 0} components={{ b: <strong /> }} />
            </span>
            <span>
              <Trans i18nKey="finance:mini.manualBookings" count={counts.manualBookings ?? 0} components={{ b: <strong /> }} />
            </span>
            <span>
              <Trans
                i18nKey="finance:mini.hoursSold"
                values={{ hours: num(counts.hoursSold).toLocaleString(intlLocale(), { maximumFractionDigits: 1 }) }}
                components={{ b: <strong /> }}
              />
            </span>
            {num(counts.hoursSold) > 0 && (
              <span>
                <Trans
                  i18nKey="finance:mini.avgPerHour"
                  values={{ value: formatPrice(Math.round(num(income.total) / num(counts.hoursSold))) }}
                  components={{ b: <strong /> }}
                />
              </span>
            )}
          </div>

          <Row gutter={[16, 16]}>
            <Col xs={24} xl={hasData ? 14 : 24}>
              <Card
                bordered={false}
                className="mb-fin-card"
                title={t('finance:cards.last12Months')}
                extra={
                  <Legend
                    items={[
                      { label: t('finance:income'), color: INCOME_COLOR },
                      { label: t('finance:expense'), color: EXPENSE_COLOR },
                      { label: t('finance:netProfit'), color: 'var(--mb-text)', line: true },
                    ]}
                  />
                }
              >
                {monthly.length ? (
                  <MonthlyChart data={monthly} selected={{ year: month.year(), month: month.month() + 1 }} onSelect={selectMonth} />
                ) : (
                  <EmptyState description={t('finance:cards.noMonthlyData')} />
                )}
                <div className="mb-fin-hint">{t('finance:cards.monthlyHint')}</div>
              </Card>
            </Col>

            {hasData ? (
              <>
                <Col xs={24} xl={10}>
                  <Card
                    bordered={false}
                    className="mb-fin-card"
                    title={t('finance:cards.dailyTitle', { month: month.format('MMMM') })}
                    extra={
                      <Legend
                        items={[
                          { label: t('finance:income'), color: INCOME_COLOR },
                          { label: t('finance:expense'), color: EXPENSE_COLOR },
                        ]}
                      />
                    }
                  >
                    <DailyChart data={daily} />
                    <div className="mb-fin-hint">{t('finance:cards.dailyHint')}</div>
                  </Card>
                </Col>

                <Col xs={24} lg={12}>
                  <Card bordered={false} className="mb-fin-card" title={t('finance:cards.incomeDistribution')}>
                    <div className="mb-fin-section-label">{t('finance:cards.bySource')}</div>
                    <SourceSplit items={sources} />
                    <div className="mb-fin-section-label" style={{ marginTop: 22 }}>
                      {t('finance:cards.byPitch')}
                    </div>
                    <HBarList rows={pitchRows} emptyText={t('finance:cards.noPitchIncome')} />
                  </Card>
                </Col>

                <Col xs={24} lg={12}>
                  <Card
                    bordered={false}
                    className="mb-fin-card"
                    title={t('finance:cards.expenseDistribution')}
                    extra={
                      <WriteButton size="small" icon={<CopyOutlined />} onClick={() => setCopyOpen(true)}>
                        {t('finance:cards.copyFromLastMonth')}
                      </WriteButton>
                    }
                  >
                    {catRows.length ? (
                      <>
                        <div className="mb-fin-cat-total">
                          <span>{t('finance:cards.totalExpense')}</span>
                          <strong>{formatPrice(expenseTotal)}</strong>
                        </div>
                        <HBarList rows={catRows} />
                      </>
                    ) : (
                      <EmptyState description={t('finance:cards.noExpenses')}>
                        <WriteButton type="primary" icon={<PlusOutlined />} onClick={() => setExpenseDraft({ expense: null })}>
                          {t('finance:page.addExpense')}
                        </WriteButton>
                      </EmptyState>
                    )}
                  </Card>
                </Col>

                <Col xs={24}>
                  <div ref={tableRef} className="mb-fin-anchor" />
                  <Card bordered={false} className="mb-fin-card" title={t('finance:cards.movements')}>
                    <div className="mb-owner-toolbar">
                      <Segmented
                        value={filter}
                        onChange={setFilter}
                        options={FILTERS.map((o) => ({
                          value: o.value,
                          label:
                            o.value === 'unpaid' && unpaidCount
                              ? t('finance:filters.unpaidWithCount', { count: unpaidCount })
                              : t(o.labelKey),
                        }))}
                      />
                      <Space wrap className="mb-owner-toolbar__filters">
                        <Input
                          allowClear
                          prefix={<SearchOutlined />}
                          placeholder={t('finance:cards.searchPlaceholder')}
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          style={{ width: 260 }}
                        />
                        <Button icon={<DownloadOutlined />} disabled={!rows.length} onClick={() => downloadCsv(rows, month, venue?.name)}>
                          {t('finance:cards.downloadCsv')}
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
                      rowClassName={(tx) => (isUnpaid(tx) ? 'mb-fin-row-unpaid' : '')}
                      locale={{ emptyText: <EmptyState description={t('finance:cards.noMatchingMovements')} /> }}
                      summary={() =>
                        rows.length ? (
                          <Table.Summary>
                            <Table.Summary.Row className="mb-fin-summary">
                              <Table.Summary.Cell index={0} colSpan={5}>
                                <Text type="secondary">{t('finance:cards.movementCount', { count: rows.length })}</Text>
                              </Table.Summary.Cell>
                              <Table.Summary.Cell index={5} align="right" colSpan={1}>
                                <div className="mb-fin-sum">
                                  <span className="mb-fin-amount is-income">+{formatPrice(totals.income)}</span>
                                  <span className="mb-fin-amount is-expense">−{formatPrice(totals.expense)}</span>
                                </div>
                              </Table.Summary.Cell>
                              <Table.Summary.Cell index={6} colSpan={2}>
                                <span className={`mb-fin-net ${totals.income - totals.expense >= 0 ? 'is-pos' : 'is-neg'}`}>
                                  {t('finance:cards.net', { value: formatPrice(totals.income - totals.expense) })}
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
                  <EmptyState description={t('finance:empty.noRecords', { month: month.format('MMMM YYYY') })}>
                    <div className="mb-fin-empty">
                      <p>
                        <Trans i18nKey="finance:empty.explanation" components={{ b: <strong /> }} />
                      </p>
                      <Space wrap style={{ justifyContent: 'center' }}>
                        <WriteButton type="primary" icon={<PlusOutlined />} onClick={() => setExpenseDraft({ expense: null })}>
                          {t('finance:page.addExpense')}
                        </WriteButton>
                        <WriteButton icon={<CopyOutlined />} onClick={() => setCopyOpen(true)}>
                          {t('finance:cards.copyFromLastMonth')}
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
