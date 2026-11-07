import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { App, Button, Checkbox, Col, DatePicker, Form, Input, InputNumber, Modal, Row, Select, Skeleton, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { EXPENSE_CATEGORIES, expenseCategoryLabel, formatPrice, ownerApi } from '../api/venues';
import { EmptyState } from '../ui';
import { apiErrorMessage, formErrorMessage } from '../utils/format';
import { CategoryChip } from './FinanceCharts';
import { WriteButton, asList, notifyOwnerChanged, ymd } from './shared';

const { Text } = Typography;

// category: sunucuya kaydedilen değer (çevrilmez); key: finance:expenseModal.quick.<key>.{label,description}
const QUICK = [
  { key: 'rent', category: 'Kira' },
  { key: 'electricity', category: 'Elektrik' },
  { key: 'water', category: 'Su' },
  { key: 'naturalGas', category: 'Doğalgaz' },
  { key: 'staff', category: 'Personel' },
  { key: 'maintenance', category: 'Bakım-onarım' },
];

const categoryOptions = EXPENSE_CATEGORIES.map((c) => ({ value: c, label: <CategoryChip category={c} compact /> }));

/** Seçili ay içinde varsayılan tarih: bugün o aydaysa bugün, değilse ayın ilk günü */
const defaultDate = (month) => (dayjs().isSame(month, 'month') ? dayjs().startOf('day') : month.startOf('month'));

/**
 * Gider ekle / düzenle.
 * expense: null → yeni kayıt; { expenseId, date, category, amount, description } → düzenleme
 */
export default function ExpenseModal({ open, expense, month, venueId, onClose, onSaved }) {
  const { t } = useTranslation();
  return (
    <Modal open={open} title={expense?.expenseId ? t('finance:expenseModal.titleEdit') : t('finance:expenseModal.titleAdd')}onCancel={onClose} footer={null} destroyOnClose width={520}>
      {open && <ExpenseForm expense={expense} month={month} venueId={venueId} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function ExpenseForm({ expense, month, venueId, onClose, onSaved }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const editing = Boolean(expense?.expenseId);

  const initialValues = useMemo(
    () => ({
      date: expense?.date ? dayjs(expense.date) : defaultDate(month),
      category: expense?.category,
      amount: expense?.amount != null ? Number(expense.amount) : null,
      description: expense?.description || '',
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const submit = async () => {
    const v = await form.validateFields().catch(() => null);
    if (!v) return;
    setSaving(true);
    try {
      await ownerApi.saveExpense({
        expenseId: expense?.expenseId,
        stadiumId: venueId,
        date: ymd(v.date),
        category: v.category,
        amount: Number(v.amount),
        description: v.description?.trim() || undefined,
      });
      message.success(editing ? t('finance:expenseModal.updated') : t('finance:expenseModal.added'));
      notifyOwnerChanged();
      onSaved?.();
    } catch (e) {
      message.error(formErrorMessage(form, e, t('finance:expenseModal.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form form={form} layout="vertical" requiredMark={false} initialValues={initialValues}>
      {!editing && (
        <>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('finance:expenseModal.quickAdd')}
          </Text>
          <div className="mb-mbk-chips" style={{ marginTop: 6 }}>
            {QUICK.map((q) => (
              <span
                key={q.key}
                role="button"
                tabIndex={0}
                className="mb-mbk-chip"
                onClick={() =>
                  form.setFieldsValue({ category: q.category, description: t(`finance:expenseModal.quick.${q.key}.description`) })
                }
              >
                {t(`finance:expenseModal.quick.${q.key}.label`)}
              </span>
            ))}
          </div>
        </>
      )}
      <Row gutter={12}>
        <Col xs={24} sm={12}>
          <Form.Item
            name="date"
            label={t('finance:expenseModal.date')}
            rules={[{ required: true, message: t('finance:expenseModal.dateRequired') }]}
          >
            <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} allowClear={false} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item
            name="category"
            label={t('finance:expenseModal.category')}
            rules={[{ required: true, message: t('finance:expenseModal.categoryRequired') }]}
          >
            <Select options={categoryOptions} placeholder={t('finance:expenseModal.categoryPlaceholder')} />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item
        name="amount"
        label={t('finance:expenseModal.amount')}
        rules={[
          { required: true, message: t('finance:expenseModal.amountRequired') },
          { type: 'number', min: 0.01, message: t('finance:expenseModal.amountPositive') },
        ]}
      >
        <InputNumber min={0} max={100000000} step={100} style={{ width: '100%' }} addonAfter="₺" decimalSeparator="," autoFocus={editing} />
      </Form.Item>
      <Form.Item name="description" label={t('finance:expenseModal.description')}>
        <Input maxLength={200} showCount placeholder={t('finance:expenseModal.descriptionPlaceholder')} />
      </Form.Item>
      <div className="mb-mbk-footer">
        <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
        <WriteButton type="primary" loading={saving} onClick={submit}>
          {editing ? t('finance:expenseModal.saveChanges') : t('finance:expenseModal.submitAdd')}
        </WriteButton>
      </div>
    </Form>
  );
}

/** Geçen ayın giderlerinden seçilenleri bu aya kopyalar (aynı gün, ay sonuna sığdırılarak) */
export function CopyExpensesModal({ open, month, venueId, onClose, onDone }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [checked, setChecked] = useState([]);
  const [saving, setSaving] = useState(false);
  const prev = month.subtract(1, 'month').startOf('month');

  useEffect(() => {
    if (!open || !venueId) return undefined;
    let alive = true;
    setList(null);
    setError(null);
    ownerApi
      .expenses(venueId, ymd(prev), ymd(month.startOf('month')))
      .then((res) => {
        if (!alive) return;
        const items = asList(res).filter((e) => dayjs(e.date).isSame(prev, 'month'));
        setList(items);
        setChecked(items.map((e) => e.expenseId));
      })
      .catch((e) => alive && setError(apiErrorMessage(e, t('finance:copyModal.loadFailed'))));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, venueId, month.valueOf()]);

  const copy = async () => {
    const items = (list || []).filter((e) => checked.includes(e.expenseId));
    if (!items.length) return;
    setSaving(true);
    let ok = 0;
    for (const e of items) {
      const day = Math.min(dayjs(e.date).date(), month.daysInMonth());
      try {
        // eslint-disable-next-line no-await-in-loop
        await ownerApi.saveExpense({
          stadiumId: venueId,
          date: ymd(month.startOf('month').date(day)),
          category: e.category,
          amount: Number(e.amount),
          description: e.description || undefined,
        });
        ok += 1;
      } catch {
        /* diğerlerine devam */
      }
    }
    setSaving(false);
    if (ok) {
      message.success(t('finance:copyModal.copied', { count: ok, month: month.format('MMMM') }));
      notifyOwnerChanged();
      onDone?.();
    }
    if (ok < items.length) message.error(t('finance:copyModal.copyFailed', { count: items.length - ok }));
  };

  const total = (list || []).filter((e) => checked.includes(e.expenseId)).reduce((s, e) => s + (Number(e.amount) || 0), 0);

  return (
    <Modal open={open} title={t('finance:copyModal.title')} onCancel={onClose} footer={null} destroyOnClose width={560}>
      <Text type="secondary">
        {t('finance:copyModal.intro', { prev: prev.format('MMMM YYYY'), month: month.format('MMMM YYYY') })}
      </Text>
      <div className="mb-fin-copy">
        {error ? (
          <Text type="danger">{error}</Text>
        ) : !list ? (
          <Skeleton active paragraph={{ rows: 3 }} title={false} />
        ) : list.length === 0 ? (
          <EmptyState description={t('finance:copyModal.empty')} />
        ) : (
          <Checkbox.Group value={checked} onChange={setChecked} style={{ width: '100%' }}>
            {list.map((e) => (
              <Checkbox key={e.expenseId} value={e.expenseId} className="mb-fin-copy__row">
                <span className="mb-fin-copy__inner">
                  <CategoryChip category={e.category} compact />
                  <span className="mb-fin-copy__desc">{e.description || expenseCategoryLabel(e.category)}</span>
                  <span className="mb-fin-copy__date">{dayjs(e.date).format('DD MMM')}</span>
                  <strong>{formatPrice(e.amount)}</strong>
                </span>
              </Checkbox>
            ))}
          </Checkbox.Group>
        )}
      </div>
      <div className="mb-mbk-footer" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Text type="secondary">
          {checked.length ? t('finance:copyModal.summary', { count: checked.length, total: formatPrice(total) }) : ''}
        </Text>
        <span style={{ display: 'inline-flex', gap: 8 }}>
          <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
          <WriteButton type="primary" loading={saving} disabled={!checked.length || !list?.length} onClick={copy}>
            {t('finance:copyModal.copySelected')}
          </WriteButton>
        </span>
      </div>
    </Modal>
  );
}
