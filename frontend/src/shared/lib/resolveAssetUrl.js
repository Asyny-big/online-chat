import { API_URL } from '@/config';

export function resolveAssetUrl(url) {
  if (!url) return '';

  if (typeof url !== 'string') return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;

  const baseUrl = API_URL.replace(/\/api\/?$/, '');
  const normalized = url.startsWith('/') ? url : `/${url}`;

  // Р”РµС„РѕР»С‚РЅС‹Р№ Р°РІР°С‚Р°СЂ РІ СЌС‚РѕР№ СЃР±РѕСЂРєРµ РЅРµ Р»РµР¶РёС‚ РІ uploads.
  // РўСЂР°РєС‚СѓРµРј РєР°Рє "Р°РІР°С‚Р°СЂ РЅРµ Р·Р°РґР°РЅ" вЂ” UI РґРѕР»Р¶РµРЅ РїРѕРєР°Р·Р°С‚СЊ fallback (Р±СѓРєРІСѓ).
  if (/\/avatar-default\.(png|jpg|jpeg|webp|svg)$/i.test(normalized)) {
    return '';
  }

  // РЎС‚Р°СЂС‹Р№ С„РѕСЂРјР°С‚ (РґРѕ /api/uploads)
  if (normalized.startsWith('/uploads/')) {
    return `${API_URL}${normalized}`; // /api + /uploads/... => /api/uploads/...
  }

  // РќРѕРІС‹Р№ С„РѕСЂРјР°С‚
  if (normalized.startsWith('/api/')) {
    return `${baseUrl}${normalized}`;
  }

  return `${baseUrl}${normalized}`;
}




