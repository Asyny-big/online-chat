import React, { useMemo } from 'react';
import { resolveAssetUrl } from '../utils/resolveAssetUrl';

function formatTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch (_) {
    return '';
  }
}

function MediaBlock({ media }) {
  const items = Array.isArray(media) ? media : [];
  if (!items.length) return null;

  return (
    <div style={styles.mediaGrid}>
      {items.map((item, idx) => {
        const rawPath = item?.path || item?.url || '';
        const src = resolveAssetUrl(rawPath);
        if (!src) return null;

        const type = String(item?.type || '').toLowerCase();
        if (type.includes('video')) {
          return (
            <video key={`${src}-${idx}`} src={src} controls style={styles.media} />
          );
        }

        return (
          <img key={`${src}-${idx}`} src={src} alt="" style={styles.media} />
        );
      })}
    </div>
  );
}

export default function PostCard({ item, onOpenComments }) {
  const post = item?.post || item || {};
  const author = useMemo(() => {
    const raw = post?.authorId;
    if (raw && typeof raw === 'object') return raw;
    return null;
  }, [post?.authorId]);

  const avatar = resolveAssetUrl(author?.avatarUrl || '');
  const likes = Number(post?.stats?.likes || 0);
  const comments = Number(post?.stats?.comments || 0);

  return (
    <article style={styles.card}>
      <div style={styles.header}>
        <div style={styles.avatarWrap}>
          {avatar ? <img src={avatar} alt="" style={styles.avatar} /> : <div style={styles.avatarFallback}>👤</div>}
        </div>
        <div>
          <div style={styles.name}>{author?.name || 'Пользователь'}</div>
          <div style={styles.time}>{formatTime(post?.createdAt || item?.createdAt)}</div>
        </div>
      </div>

      {post?.text ? <div style={styles.text}>{post.text}</div> : null}

      <MediaBlock media={post?.media} />

      <div style={styles.footer}>
        <div style={styles.stat}>❤️ {likes}</div>
        <div style={styles.stat}>💬 {comments}</div>
        <button type="button" style={styles.commentsBtn} onClick={() => onOpenComments?.(post?._id)}>
          Открыть комментарии
        </button>
      </div>
    </article>
  );
}

const styles = {
  card: {
    border: '1px solid #1e293b',
    background: '#0b1220',
    borderRadius: 16,
    padding: 14
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10
  },
  avatarWrap: {
    width: 42,
    height: 42,
    borderRadius: '50%',
    overflow: 'hidden',
    background: '#1e293b',
    border: '1px solid #334155',
    flexShrink: 0
  },
  avatar: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    display: 'grid',
    placeItems: 'center'
  },
  name: {
    color: '#f8fafc',
    fontWeight: 700
  },
  time: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2
  },
  text: {
    marginTop: 12,
    color: '#dbeafe',
    whiteSpace: 'pre-wrap'
  },
  mediaGrid: {
    marginTop: 12,
    display: 'grid',
    gap: 8
  },
  media: {
    width: '100%',
    borderRadius: 12,
    border: '1px solid #1e293b',
    background: '#020617'
  },
  footer: {
    marginTop: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 14
  },
  stat: {
    color: '#93c5fd',
    fontSize: 13
  },
  commentsBtn: {
    marginLeft: 'auto',
    border: '1px solid #334155',
    background: '#020617',
    color: '#e2e8f0',
    borderRadius: 999,
    padding: '8px 12px',
    cursor: 'pointer',
    fontWeight: 600
  }
};
