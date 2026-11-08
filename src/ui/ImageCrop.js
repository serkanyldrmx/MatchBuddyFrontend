import React from 'react';
import ImgCrop from 'antd-img-crop';
import { useTranslation } from 'react-i18next';
import './common.css';

/**
 * antd Upload'ı saran kırpma adımı (antd-img-crop). Çevrilmiş metinler ve ortak varsayılanlarla.
 * variant="avatar": kare + yuvarlak önizleme; variant="venue": 16:10. İkisinde de döndürme + yakınlaştırma.
 * Kırpılan dosya, sarılan Upload'ın beforeUpload'ına gider.
 */
const VARIANTS = {
  avatar: { aspect: 1, cropShape: 'round' },
  venue: { aspect: 16 / 10, cropShape: 'rect', showGrid: true },
};

export default function ImageCrop({ variant = 'avatar', modalClassName, children, ...rest }) {
  const { t } = useTranslation();
  return (
    <ImgCrop
      {...VARIANTS[variant]}
      rotationSlider
      zoomSlider
      showReset
      resetText={t('common:imageCrop.reset')}
      quality={0.92}
      maxZoom={4}
      modalTitle={t('common:imageCrop.title')}
      modalOk={t('common:imageCrop.ok')}
      modalCancel={t('common:imageCrop.cancel')}
      modalWidth={560}
      modalClassName={['mb-img-crop', modalClassName].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </ImgCrop>
  );
}
