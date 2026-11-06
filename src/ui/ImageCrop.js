import React from 'react';
import ImgCrop from 'antd-img-crop';
import './common.css';

/**
 * antd Upload'ı saran kırpma adımı (antd-img-crop). Türkçe metinler ve ortak varsayılanlarla.
 * variant="avatar": kare + yuvarlak önizleme; variant="venue": 16:10. İkisinde de döndürme + yakınlaştırma.
 * Kırpılan dosya, sarılan Upload'ın beforeUpload'ına gider.
 */
const VARIANTS = {
  avatar: { aspect: 1, cropShape: 'round' },
  venue: { aspect: 16 / 10, cropShape: 'rect', showGrid: true },
};

export default function ImageCrop({ variant = 'avatar', modalClassName, children, ...rest }) {
  return (
    <ImgCrop
      {...VARIANTS[variant]}
      rotationSlider
      zoomSlider
      showReset
      resetText="Sıfırla"
      quality={0.92}
      maxZoom={4}
      modalTitle="Fotoğrafı düzenle"
      modalOk="Tamam"
      modalCancel="Vazgeç"
      modalWidth={560}
      modalClassName={['mb-img-crop', modalClassName].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </ImgCrop>
  );
}
