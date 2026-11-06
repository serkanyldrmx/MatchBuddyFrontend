import React from 'react';
import { Spin } from 'antd';
import BallLoader from './BallLoader';

// Uygulama genelinde antd Spin göstergesi: futbol topu.
// Boyut Spin'in size'ına göre CSS ile ayarlanır (theme.js → components.Spin.dotSize / dotSizeSM / dotSizeLG).
// src/index.js içinde bir kez içe aktarılır.
Spin.setDefaultIndicator(<BallLoader />);
