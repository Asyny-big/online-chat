import axios from 'axios';
import { API_URL } from '@/config';

function resolveMediaType(file) {
  const mime = String(file?.type || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'file';
}

export async function uploadSocialMediaFile({ file, token }) {
  const formData = new FormData();
  formData.append('file', file);

  const uploadRes = await axios.post(`${API_URL}/upload`, formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data'
    }
  });

  const path = String(uploadRes.data?.url || '').trim();
  if (!path) {
    throw new Error('Upload failed: missing file URL');
  }

  const type = resolveMediaType(file);
  const mediaRes = await axios.post(
    `${API_URL}/social/media`,
    {
      type,
      path,
      size: Number(file?.size || uploadRes.data?.size || 0)
    },
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  return {
    _id: mediaRes.data?._id,
    type: mediaRes.data?.type || type,
    path: mediaRes.data?.path || path,
    size: mediaRes.data?.size || file?.size || 0
  };
}
