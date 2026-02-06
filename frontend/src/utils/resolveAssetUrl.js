import { API_URL } from '../config';

export function resolveAssetUrl(url) {
  if (!url) return '';

  if (typeof url !== 'string') return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;

  const baseUrl = API_URL.replace(/\/api\/?$/, '');
  const normalized = url.startsWith('/') ? url : `/${url}`;

  // Дефолтный аватар в этой сборке не лежит в uploads.
  // Трактуем как "аватар не задан" — UI должен показать fallback (букву).
  if (/\/avatar-default\.(png|jpg|jpeg|webp|svg)$/i.test(normalized)) {
    return '';
  }

  // Старый формат (до /api/uploads)
  if (normalized.startsWith('/uploads/')) {
    return `${API_URL}${normalized}`; // /api + /uploads/... => /api/uploads/...
  }

  // Новый формат
  if (normalized.startsWith('/api/')) {
    return `${baseUrl}${normalized}`;
  }

  return `${baseUrl}${normalized}`;
}
