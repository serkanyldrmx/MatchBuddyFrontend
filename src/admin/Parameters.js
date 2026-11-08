import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Collapse,
  Drawer,
  Empty,
  Grid,
  Input,
  InputNumber,
  Skeleton,
  Space,
  Switch,
  Tag,
  Timeline,
  Tooltip,
  Typography,
} from 'antd';
import { ControlOutlined, HistoryOutlined, ReloadOutlined, SaveOutlined, SearchOutlined, UndoOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { adminParametersApi, loadPublicParams, PARAM_TYPES } from '../api/parameters';
import { EmptyState, PageHeader } from '../ui';
import { apiErrorMessage, fieldErrorsOf, formatDateTime } from '../utils/format';
import './AdminResponsive.css';
import './Parameters.css';

const { Text } = Typography;

const isNum = (type) => type === PARAM_TYPES.INT || type === PARAM_TYPES.DECIMAL;
const toNumber = (v) => (v == null || v === '' ? null : Number(v));

/** Yerel (istemci) doğrulama: sunucu kurallarının aynısı; hata metni ya da null */
function validate(param, raw, t) {
  const value = raw == null ? '' : String(raw);
  if (!value.trim()) return t('admin:parameters.validation.required');
  const { dataType, minValue, maxValue, defaultValue } = param;
  if (isNum(dataType)) {
    const n = Number(value);
    if (!Number.isFinite(n) || (dataType === PARAM_TYPES.INT && !Number.isInteger(n))) {
      return t('admin:parameters.validation.number', { type: t(`admin:parameters.types.${dataType}`) });
    }
    const min = toNumber(minValue);
    const max = toNumber(maxValue);
    if ((min != null && n < min) || (max != null && n > max)) {
      return t('admin:parameters.validation.range', { min: minValue ?? '-∞', max: maxValue ?? '∞' });
    }
  }
  if (dataType === PARAM_TYPES.BOOL && value !== 'true' && value !== 'false') return t('admin:parameters.validation.bool');
  if (dataType === PARAM_TYPES.JSON) {
    let parsed;
    try {
      parsed = JSON.parse(value);
    } catch {
      return t('admin:parameters.validation.json');
    }
    // Varsayılanı dizi olan parametreler: boş olmayan pozitif tam sayı dizisi
    let defaultIsArray = false;
    try {
      defaultIsArray = Array.isArray(JSON.parse(defaultValue));
    } catch {
      defaultIsArray = false;
    }
    if (defaultIsArray && (!Array.isArray(parsed) || !parsed.length || !parsed.every((x) => Number.isInteger(x) && x > 0))) {
      return t('admin:parameters.validation.intList');
    }
  }
  return null;
}

/** Karşılaştırma için normalize edilmiş metin (sunucu da normalize eder: " 15 " → "15", JSON yeniden yazılır) */
function normalize(param, raw) {
  const value = raw == null ? '' : String(raw).trim();
  if (isNum(param.dataType) && value !== '' && Number.isFinite(Number(value))) return String(Number(value));
  if (param.dataType === PARAM_TYPES.JSON) {
    try {
      return JSON.stringify(JSON.parse(value));
    } catch {
      return value;
    }
  }
  return value;
}

const displayValue = (param, v) => {
  if (v == null || v === '') return '—';
  if (param.dataType === PARAM_TYPES.JSON) {
    try {
      return JSON.stringify(JSON.parse(v));
    } catch {
      return v;
    }
  }
  return v;
};

/** Türe göre düzenleyici */
function ValueEditor({ param, value, onChange, disabled, invalid }) {
  const { t } = useTranslation();
  const status = invalid ? 'error' : undefined;
  if (param.dataType === PARAM_TYPES.BOOL) {
    return (
      <Switch
        checked={value === 'true'}
        onChange={(v) => onChange(v ? 'true' : 'false')}
        disabled={disabled}
        checkedChildren={t('admin:parameters.boolOn')}
        unCheckedChildren={t('admin:parameters.boolOff')}
      />
    );
  }
  if (isNum(param.dataType)) {
    const decimal = param.dataType === PARAM_TYPES.DECIMAL;
    return (
      <InputNumber
        className="mb-param-editor__number"
        value={value === '' ? null : value}
        onChange={(v) => onChange(v == null ? '' : String(v))}
        min={param.minValue != null ? (decimal ? param.minValue : Number(param.minValue)) : undefined}
        max={param.maxValue != null ? (decimal ? param.maxValue : Number(param.maxValue)) : undefined}
        precision={decimal ? undefined : 0}
        step={decimal ? '0.1' : 1}
        stringMode={decimal}
        disabled={disabled}
        status={status}
      />
    );
  }
  if (param.dataType === PARAM_TYPES.JSON) {
    return (
      <Input.TextArea
        className="mb-param-editor__json"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoSize={{ minRows: 1, maxRows: 6 }}
        disabled={disabled}
        status={status}
        spellCheck={false}
      />
    );
  }
  return <Input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} status={status} maxLength={4000} />;
}

/** Tek parametre satırı */
function ParameterRow({ param, onSaved, onHistory }) {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const [draft, setDraft] = useState(param.value ?? '');
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState(null);
  const keepDraftRef = useRef(false); // kayıt başarısız olunca kullanıcının girdisi ve hata korunur

  // Sunucudan yeni değer gelince taslağı eşitle
  useEffect(() => {
    if (keepDraftRef.current) {
      keepDraftRef.current = false;
      return;
    }
    setDraft(param.value ?? '');
    setServerError(null);
  }, [param.value]);

  const localError = validate(param, draft, t);
  const dirty = normalize(param, draft) !== normalize(param, param.value);
  const isDefault = normalize(param, param.value) === normalize(param, param.defaultValue);
  const error = serverError || (dirty ? localError : null);

  const change = (v) => {
    setDraft(v);
    setServerError(null);
  };

  const doSave = async (next) => {
    setSaving(true);
    setServerError(null);
    // İyimser güncelleme: değer hemen yeni hâliyle gösterilir, hata olursa geri alınır
    const previous = param;
    onSaved({ ...param, value: next });
    try {
      const res = await adminParametersApi.update(param.key, next);
      const saved = res?.parameter || { ...param, value: next };
      onSaved(saved);
      message.success(t('admin:parameters.saved', { key: param.key }));
      if (saved.isPublic ?? param.isPublic) loadPublicParams({ force: true });
    } catch (e) {
      keepDraftRef.current = true;
      onSaved(previous);
      setDraft(next);
      const fieldMsg = fieldErrorsOf(e)?.value?.[0];
      const msg = fieldMsg || apiErrorMessage(e, t('admin:parameters.saveFailed'));
      setServerError(msg);
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (localError || !dirty) return;
    const next = draft.trim();
    modal.confirm({
      title: t('admin:parameters.confirmTitle'),
      content: (
        <div className="mb-param-confirm">
          <code>{param.key}</code>
          <div className="mb-param-confirm__diff">
            <span className="is-old">{displayValue(param, param.value)}</span>
            <span aria-hidden>→</span>
            <span className="is-new">{displayValue(param, next)}</span>
          </div>
          <Text type="secondary">{param.isPublic ? t('admin:parameters.confirmPublic') : t('admin:parameters.confirmText')}</Text>
        </div>
      ),
      okText: t('common:actions.save'),
      cancelText: t('common:actions.cancel'),
      onOk: () => doSave(next),
    });
  };

  const range =
    param.minValue != null || param.maxValue != null
      ? t('admin:parameters.range', { min: param.minValue ?? '-∞', max: param.maxValue ?? '∞' })
      : null;

  return (
    <div className={`mb-param-row${dirty ? ' is-dirty' : ''}`}>
      <div className="mb-param-row__info">
        <div className="mb-param-row__title">
          <code className="mb-param-row__key">{param.key}</code>
          <Tag className="mb-param-row__type">{t(`admin:parameters.types.${param.dataType}`, { defaultValue: param.dataType })}</Tag>
          {param.isPublic && (
            <Tooltip title={t('admin:parameters.publicHint')}>
              <Tag color="blue">{t('admin:parameters.public')}</Tag>
            </Tooltip>
          )}
          {!isDefault && <Tag color="gold">{t('admin:parameters.changed')}</Tag>}
        </div>
        {param.description && <p className="mb-param-row__desc">{param.description}</p>}
        <div className="mb-param-row__meta">
          <span>
            {t('admin:parameters.current')}: <strong>{displayValue(param, param.value)}</strong>
          </span>
          <span>
            {t('admin:parameters.default')}: <strong>{displayValue(param, param.defaultValue)}</strong>
          </span>
          {range && <span>{range}</span>}
          {param.updatedAt && (
            <span>
              {param.updatedByUserName
                ? t('admin:parameters.updatedBy', { date: formatDateTime(param.updatedAt), user: param.updatedByUserName })
                : t('admin:parameters.updatedAt', { date: formatDateTime(param.updatedAt) })}
            </span>
          )}
        </div>
      </div>
      <div className="mb-param-row__editor">
        <ValueEditor param={param} value={draft} onChange={change} disabled={saving} invalid={Boolean(error)} />
        {error && <div className="mb-param-row__error">{error}</div>}
      </div>
      <div className="mb-param-row__actions">
        <Tooltip title={t('admin:parameters.resetToDefault')}>
          <Button
            icon={<UndoOutlined />}
            onClick={() => change(param.defaultValue ?? '')}
            disabled={saving || normalize(param, draft) === normalize(param, param.defaultValue)}
            aria-label={t('admin:parameters.resetToDefault')}
          />
        </Tooltip>
        <Tooltip title={t('admin:parameters.history')}>
          <Button icon={<HistoryOutlined />} onClick={() => onHistory(param)} aria-label={t('admin:parameters.history')} />
        </Tooltip>
        {dirty && (
          <Button onClick={() => change(param.value ?? '')} disabled={saving}>
            {t('common:actions.cancel')}
          </Button>
        )}
        <Button type="primary" icon={<SaveOutlined />} onClick={save} loading={saving} disabled={!dirty || Boolean(localError)}>
          {t('common:actions.save')}
        </Button>
      </div>
    </div>
  );
}

/** Değişiklik geçmişi */
function HistoryDrawer({ param, onClose }) {
  const { t } = useTranslation();
  const isPhone = Grid.useBreakpoint().md === false;
  const [state, setState] = useState({ loading: false, items: [], error: null });

  useEffect(() => {
    if (!param) return undefined;
    let alive = true;
    setState({ loading: true, items: [], error: null });
    adminParametersApi
      .history(param.key, 100)
      .then((items) => alive && setState({ loading: false, items: Array.isArray(items) ? items : [], error: null }))
      .catch((e) => alive && setState({ loading: false, items: [], error: apiErrorMessage(e, t('admin:parameters.historyFailed')) }));
    return () => {
      alive = false;
    };
  }, [param, t]);

  return (
    <Drawer
      open={Boolean(param)}
      onClose={onClose}
      width={isPhone ? '100%' : 460}
      title={
        <span className="mb-param-history__title">
          <HistoryOutlined /> {t('admin:parameters.historyTitle')}
          {param && <code>{param.key}</code>}
        </span>
      }
      destroyOnClose
    >
      {state.loading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : state.error ? (
        <Alert type="error" showIcon message={state.error} />
      ) : !state.items.length ? (
        <Empty description={t('admin:parameters.historyEmpty')} />
      ) : (
        <Timeline
          className="mb-param-history"
          items={state.items.map((h) => ({
            key: h.id,
            children: (
              <div className="mb-param-history__item">
                <div className="mb-param-history__head">
                  <strong>{h.changedByUserName ? `@${h.changedByUserName}` : t('admin:parameters.system')}</strong>
                  <Text type="secondary">{formatDateTime(h.changedAt)}</Text>
                </div>
                <div className="mb-param-confirm__diff">
                  <span className="is-old">{h.oldValue ?? '—'}</span>
                  <span aria-hidden>→</span>
                  <span className="is-new">{h.newValue ?? '—'}</span>
                </div>
              </div>
            ),
          }))}
        />
      )}
    </Drawer>
  );
}

const matches = (p, q) =>
  !q ||
  [p.key, p.description, p.group, p.value].some((x) => String(x ?? '').toLocaleLowerCase().includes(q));

/** Sistem parametreleri (yönetici) */
export default function Parameters() {
  const { t } = useTranslation();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [openGroups, setOpenGroups] = useState(null); // null = hepsi açık
  const [historyParam, setHistoryParam] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    adminParametersApi
      .list()
      .then((list) => setGroups(Array.isArray(list) ? list : []))
      .catch((e) => setError(apiErrorMessage(e, t('admin:parameters.loadFailed'))))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  // Satırdan gelen güncelleme (iyimser, kesin ya da geri alma)
  const replaceParam = useCallback((param) => {
    setGroups((list) =>
      list.map((g) => ({
        ...g,
        parameters: (g.parameters || []).map((p) => (p.key.toLowerCase() === param.key.toLowerCase() ? { ...p, ...param } : p)),
      }))
    );
  }, []);

  const q = search.trim().toLocaleLowerCase();
  const filtered = useMemo(
    () => groups.map((g) => ({ ...g, parameters: (g.parameters || []).filter((p) => matches(p, q)) })).filter((g) => g.parameters.length),
    [groups, q]
  );
  const total = groups.reduce((n, g) => n + (g.parameters?.length || 0), 0);
  const groupLabel = (g) => t(`admin:parameters.groups.${g}`, { defaultValue: g });

  // Arama yapılırken eşleşen tüm gruplar açık
  const activeKeys = q || openGroups == null ? filtered.map((g) => g.group) : openGroups;

  return (
    <div className="mb-params">
      <PageHeader
        title={t('admin:parameters.title')}
        subtitle={t('admin:parameters.subtitle')}
        icon={<ControlOutlined />}
        extra={
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            {t('common:actions.refresh')}
          </Button>
        }
      />

      <Alert type="info" showIcon className="mb-params__note" message={t('admin:parameters.cacheNote')} />

      <Space className="mb-admin-toolbar mb-params__toolbar" size={12} wrap>
        <Input
          allowClear
          className="mb-admin-filter mb-params__search"
          prefix={<SearchOutlined />}
          placeholder={t('admin:parameters.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {!loading && (
          <Text type="secondary">
            {q ? t('admin:parameters.matchCount', { count: filtered.reduce((n, g) => n + g.parameters.length, 0), total }) : t('admin:parameters.totalCount', { count: total })}
          </Text>
        )}
      </Space>

      {error && (
        <Alert
          type="error"
          showIcon
          message={error}
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" onClick={load}>
              {t('common:actions.retry')}
            </Button>
          }
        />
      )}

      {loading && !groups.length ? (
        <Card bordered={false}>
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      ) : !filtered.length ? (
        !error && <EmptyState description={q ? t('admin:parameters.noMatch') : t('admin:parameters.empty')} />
      ) : (
        <Collapse
          className="mb-params__groups"
          activeKey={activeKeys}
          onChange={(keys) => !q && setOpenGroups(Array.isArray(keys) ? keys : [keys])}
          items={filtered.map((g) => ({
            key: g.group,
            label: (
              <span className="mb-params__group-label">
                <strong>{groupLabel(g.group)}</strong>
                <Tag>{g.parameters.length}</Tag>
              </span>
            ),
            children: (
              <div className="mb-params__rows">
                {g.parameters.map((p) => (
                  <ParameterRow key={p.key} param={p} onSaved={replaceParam} onHistory={setHistoryParam} />
                ))}
              </div>
            ),
          }))}
        />
      )}

      <HistoryDrawer param={historyParam} onClose={() => setHistoryParam(null)} />
    </div>
  );
}
