import React, { useState } from 'react';
import { App, DatePicker, Form, Input, InputNumber, Modal, Radio, Select } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { tournamentsApi, TOURNAMENT_FORMAT } from '../../api/tournaments';
import { formErrorMessage } from '../../utils/format';
import { usePublicParams } from '../../api/parameters';
import { FormatIcon } from './tournamentUtils';

const FORMAT_OPTIONS = [
  {
    value: TOURNAMENT_FORMAT.LEAGUE,
    titleKey: 'tournaments:format.league',
    textKey: 'tournaments:create.leagueHint',
  },
  {
    value: TOURNAMENT_FORMAT.KNOCKOUT,
    titleKey: 'tournaments:format.knockout',
    textKey: 'tournaments:create.knockoutHint',
  },
];

const isPowerOfTwo = (n) => n > 0 && (n & (n - 1)) === 0;

export default function CreateTournamentModal({ open, onClose, onCreated, stadiums = [] }) {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const format = Form.useWatch('format', form);
  const maxTeams = Form.useWatch('maxTeams', form);
  // Takım kapasitesi aralığı sunucu parametrelerinden (tournament.minTeams / maxTeams)
  const params = usePublicParams();
  const minCap = params.get('tournament.minTeams');
  const maxCap = Math.max(minCap, params.get('tournament.maxTeams'));
  const quickSizes = [4, 8, 16, 32, 64, 128].filter((n) => n >= minCap && n <= maxCap);

  const submit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const res = await tournamentsApi.create({
        name: values.name.trim(),
        description: values.description?.trim() || null,
        format: values.format,
        startDate: values.startDate.format('YYYY-MM-DDTHH:mm:00'),
        maxTeams: values.maxTeams,
        stadiumId: values.stadiumId ?? null,
      });
      if (res?.success === false) {
        message.error(res.message || t('tournaments:create.error'));
        return;
      }
      message.success(res?.message || t('tournaments:create.success'));
      form.resetFields();
      onCreated?.(res?.tournamentId);
    } catch (e) {
      message.error(formErrorMessage(form, e, t('tournaments:create.error')));
    } finally {
      setSaving(false);
    }
  };

  const knockoutHint =
    format === TOURNAMENT_FORMAT.KNOCKOUT && maxTeams && !isPowerOfTwo(maxTeams)
      ? t('tournaments:create.powerOfTwoHint')
      : undefined;

  return (
    <Modal
      open={open}
      title={t('tournaments:list.create')}
      okText={t('tournaments:create.ok')}
      cancelText={t('common:actions.cancel')}
      confirmLoading={saving}
      onOk={submit}
      onCancel={onClose}
      destroyOnClose
      width={620}
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={{ format: TOURNAMENT_FORMAT.LEAGUE, maxTeams: Math.min(Math.max(8, minCap), maxCap) }}
        requiredMark={false}
      >
        <Form.Item
          name="name"
          label={t('tournaments:create.name')}
          rules={[
            { required: true, whitespace: true, message: t('tournaments:create.nameRequired') },
            { max: 80, message: t('tournaments:create.maxChars', { count: 80 }) },
          ]}
        >
          <Input placeholder={t('tournaments:create.namePlaceholder')} maxLength={80} />
        </Form.Item>

        <Form.Item name="description" label={t('tournaments:create.description')} rules={[{ max: 500, message: t('tournaments:create.maxChars', { count: 500 }) }]}>
          <Input.TextArea rows={3} maxLength={500} showCount placeholder={t('tournaments:create.descriptionPlaceholder')} />
        </Form.Item>

        <Form.Item name="format" label={t('tournaments:create.format')} rules={[{ required: true }]}>
          <Radio.Group className="mb-tr-format-radio">
            {FORMAT_OPTIONS.map((o) => (
              <Radio.Button key={o.value} value={o.value} className="mb-tr-format-option">
                <span className="mb-tr-format-option__icon">
                  <FormatIcon format={o.value} />
                </span>
                <span className="mb-tr-format-option__text">
                  <strong>{t(o.titleKey)}</strong>
                  <small>{t(o.textKey)}</small>
                </span>
              </Radio.Button>
            ))}
          </Radio.Group>
        </Form.Item>

        <div className="mb-tr-form-row">
          <Form.Item
            name="startDate"
            label={t('tournaments:create.startDate')}
            rules={[
              { required: true, message: t('tournaments:create.startDateRequired') },
              {
                validator: (_, v) =>
                  !v || v.isAfter(dayjs()) ? Promise.resolve() : Promise.reject(new Error(t('tournaments:create.pastDate'))),
              },
            ]}
          >
            <DatePicker
              showTime={{ format: 'HH:mm', minuteStep: 15 }}
              format="DD.MM.YYYY HH:mm"
              disabledDate={(d) => d && d.isBefore(dayjs().startOf('day'))}
              style={{ width: '100%' }}
              placeholder={t('tournaments:create.dateTimePlaceholder')}
            />
          </Form.Item>

          <Form.Item
            name="maxTeams"
            label={t('tournaments:create.maxTeams')}
            rules={[{ required: true, message: t('tournaments:create.maxTeamsRequired') }]}
            help={knockoutHint}
            validateStatus={knockoutHint ? 'warning' : undefined}
          >
            <InputNumber min={minCap} max={maxCap} precision={0} style={{ width: '100%' }} />
          </Form.Item>
        </div>

        {format === TOURNAMENT_FORMAT.KNOCKOUT && (
          <div className="mb-tr-quick-sizes">
            {quickSizes.map((n) => (
              <button
                type="button"
                key={n}
                className={`mb-tr-quick-size ${maxTeams === n ? 'is-active' : ''}`}
                onClick={() => form.setFieldValue('maxTeams', n)}
              >
                {t('tournaments:create.teamSize', { count: n })}
              </button>
            ))}
          </div>
        )}

        <Form.Item name="stadiumId" label={t('tournaments:create.pitch')}>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={t('tournaments:create.pitchPlaceholder')}
            options={stadiums.map((s) => ({ value: s.stadiumId, label: s.stadiumName }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
