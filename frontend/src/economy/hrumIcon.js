import React from 'react';
import HrumIconUrl from '../assets/icons/hrum.png';

export { HrumIconUrl };

export function HrumIcon({ size = 18, alt = 'Хрумы', style, title }) {
  return (
    <img
      src={HrumIconUrl}
      alt={alt}
      title={title}
      width={size}
      height={size}
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    />
  );
}

