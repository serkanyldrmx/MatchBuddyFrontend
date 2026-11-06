import React, { useState } from 'react';
import { App, DatePicker, Form, Input, InputNumber, Modal, Radio, Select } from 'antd';
import dayjs from 'dayjs';
import { tournamentsApi, TOURNAMENT_FORMAT } from '../../api/tournaments';
import { apiErrorMessage } from '../../utils/format';
import { FormatIcon } from './tournamentUtils';

const FORMAT_OPTIONS = [
  {
    value: TOURNAMENT_FORMAT.LEAGUE,
    title: 'Lig',
    text: 'Herkes herkesle oynar, puan tablosu belirler.',
  },
  {
    value: TOURNAMENT_FORMAT.KNOCKOUT,
    title: 'Eleme',
    text: 'Kaybeden elenir, kazanan finale yürür.',
  },
];

const isPowerOfTwo = (n) => n > 0 && (n & (n - 1)) === 0;

export default function CreateTournamentModal({ open, onClose, onCreated, stadiums = [] }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const format = Form.useWatch('format', form);
  const maxTeams = Form.useWatch('maxTeams', form);

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
        message.error(res.message || 'Turnuva oluşturulamadı.');
        return;
      }
      message.success(res?.message || 'Turnuva oluşturuldu, takımları bekliyoruz!');
      form.resetFields();
      onCreated?.(res?.tournamentId);
    } catch (e) {
      message.error(apiErrorMessage(e, 'Turnuva oluşturulamadı.'));
    } finally {
      setSaving(false);
    }
  };

  const knockoutHint =
    format === TOURNAMENT_FORMAT.KNOCKOUT && maxTeams && !isPowerOfTwo(maxTeams)
      ? 'Eleme için 4, 8 veya 16 takım önerilir; eksik yerler bay geçer.'
      : undefined;

  return (
    <Modal
      open={open}
      title="Turnuva oluştur"
      okText="Oluştur"
      cancelText="Vazgeç"
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
        initialValues={{ format: TOURNAMENT_FORMAT.LEAGUE, maxTeams: 8 }}
        requiredMark={false}
      >
        <Form.Item
          name="name"
          label="Ad"
          rules={[
            { required: true, whitespace: true, message: 'Turnuvaya bir ad ver.' },
            { max: 80, message: 'En fazla 80 karakter.' },
          ]}
        >
          <Input placeholder="Örn. Kış Ligi" maxLength={80} />
        </Form.Item>

        <Form.Item name="description" label="Açıklama" rules={[{ max: 500, message: 'En fazla 500 karakter.' }]}>
          <Input.TextArea rows={3} maxLength={500} showCount placeholder="Kurallar, ödül, maç günleri…" />
        </Form.Item>

        <Form.Item name="format" label="Format" rules={[{ required: true }]}>
          <Radio.Group className="mb-tr-format-radio">
            {FORMAT_OPTIONS.map((o) => (
              <Radio.Button key={o.value} value={o.value} className="mb-tr-format-option">
                <span className="mb-tr-format-option__icon">
                  <FormatIcon format={o.value} />
                </span>
                <span className="mb-tr-format-option__text">
                  <strong>{o.title}</strong>
                  <small>{o.text}</small>
                </span>
              </Radio.Button>
            ))}
          </Radio.Group>
        </Form.Item>

        <div className="mb-tr-form-row">
          <Form.Item
            name="startDate"
            label="Başlangıç tarihi ve saati"
            rules={[
              { required: true, message: 'Başlangıç tarihini seç.' },
              {
                validator: (_, v) =>
                  !v || v.isAfter(dayjs()) ? Promise.resolve() : Promise.reject(new Error('Geçmiş bir tarih seçemezsin.')),
              },
            ]}
          >
            <DatePicker
              showTime={{ format: 'HH:mm', minuteStep: 15 }}
              format="DD.MM.YYYY HH:mm"
              disabledDate={(d) => d && d.isBefore(dayjs().startOf('day'))}
              style={{ width: '100%' }}
              placeholder="Tarih ve saat"
            />
          </Form.Item>

          <Form.Item
            name="maxTeams"
            label="Maks. takım"
            rules={[{ required: true, message: 'Takım sayısını gir.' }]}
            help={knockoutHint}
            validateStatus={knockoutHint ? 'warning' : undefined}
          >
            <InputNumber min={4} max={16} precision={0} style={{ width: '100%' }} />
          </Form.Item>
        </div>

        {format === TOURNAMENT_FORMAT.KNOCKOUT && (
          <div className="mb-tr-quick-sizes">
            {[4, 8, 16].map((n) => (
              <button
                type="button"
                key={n}
                className={`mb-tr-quick-size ${maxTeams === n ? 'is-active' : ''}`}
                onClick={() => form.setFieldValue('maxTeams', n)}
              >
                {n} takım
              </button>
            ))}
          </div>
        )}

        <Form.Item name="stadiumId" label="Halı saha (isteğe bağlı)">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Halı saha seç"
            options={stadiums.map((s) => ({ value: s.stadiumId, label: s.stadiumName }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
