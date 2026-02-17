import React, { useMemo } from 'react';
import { resolveAssetUrl } from '../utils/resolveAssetUrl';

function formatTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (_) {
    return '';
  }
}

function MediaBlock({ media }) {
  const items = Array.isArray(media) ? media : [];
  if (!items.length) return null;

  const count = items.length;
  let gridClass = 'media-grid-1';
  if (count === 2) gridClass = 'media-grid-2';
  else if (count === 3) gridClass = 'media-grid-3';
  else if (count >= 4) gridClass = 'media-grid-4';

  return (
    <div className={`media-grid ${gridClass}`}>
      {items.slice(0, 4).map((item, idx) => {
        const rawPath = item?.path || item?.url || '';
        const src = resolveAssetUrl(rawPath);
        if (!src) return null;

        const type = String(item?.type || '').toLowerCase();
        const isVideo = type.includes('video');

        return (
          <div key={`${src}-${idx}`} className="media-item">
            {isVideo ? (
              <video src={src} controls className="media-content" />
            ) : (
              <img src={src} alt="" className="media-content" />
            )}
            {idx === 3 && count > 4 && (
              <div className="media-more-overlay">+{count - 4}</div>
            )}
          </div>
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
    <article className="post-card">
      <div className="post-header">
        <div className="avatar-wrap">
          {avatar ? (
            <img src={avatar} alt={author?.name} className="avatar-img" />
          ) : (
            <div className="avatar-fallback">{author?.name?.[0] || '👤'}</div>
          )}
        </div>
        <div className="post-meta">
          <div className="author-name">{author?.name || 'Пользователь'}</div>
          <div className="post-time">{formatTime(post?.createdAt || item?.createdAt)}</div>
        </div>
        <button className="more-btn">•••</button>
      </div>

      {post?.text ? <div className="post-text">{post.text}</div> : null}

      <MediaBlock media={post?.media} />

      <div className="post-footer">
        <button className="action-btn like-btn">
          <span className="icon">❤️</span>
          <span className="count">{likes > 0 ? likes : ''}</span>
        </button>

        <button
          className="action-btn comment-btn"
          onClick={() => onOpenComments?.(post?._id)}
        >
          <span className="icon">💬</span>
          <span className="count">{comments > 0 ? comments : ''}</span>
        </button>

        <button className="action-btn share-btn">
          <span className="icon">↗️</span>
        </button>
      </div>

      <style>{`
        .post-card {
            background-color: var(--bg-card);
            border-radius: var(--radius-card);
            padding: 16px;
            border: 1px solid var(--border-light);
            margin-bottom: 16px;
        }

        .post-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
        }

        .avatar-wrap {
            width: 44px;
            height: 44px;
            flex-shrink: 0;
        }

        .avatar-img {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            object-fit: cover;
        }

        .avatar-fallback {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background-color: var(--bg-surface);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-secondary);
            font-weight: 600;
        }

        .post-meta {
            flex: 1;
        }

        .author-name {
            font-weight: 700;
            color: var(--text-primary);
            font-size: 15px;
        }

        .post-time {
            font-size: 13px;
            color: var(--text-muted);
        }

        .more-btn {
            color: var(--text-secondary);
            padding: 4px;
            border-radius: 50%;
        }

        .more-btn:hover {
            background-color: var(--bg-surface);
            color: var(--text-primary);
        }

        .post-text {
            color: var(--text-primary);
            font-size: 15px;
            line-height: 1.5;
            white-space: pre-wrap;
            margin-bottom: 12px;
        }

        .media-grid {
            display: grid;
            gap: 4px;
            border-radius: 12px;
            overflow: hidden;
            margin-bottom: 12px;
        }

        .media-grid-1 { grid-template-columns: 1fr; }
        .media-grid-2 { grid-template-columns: 1fr 1fr; }
        .media-grid-3 { 
            grid-template-columns: 1fr 1fr; 
            grid-template-areas: "a b" "a c";
        }
        .media-grid-3 .media-item:first-child { grid-area: a; }
        
        .media-grid-4 { grid-template-columns: 1fr 1fr; }

        .media-item {
            position: relative;
            background-color: var(--bg-surface);
            aspect-ratio: 16/9; /* Default aspect ratio */
        }
        
        .media-grid-1 .media-item { aspect-ratio: auto; max-height: 500px; }

        .media-content {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        .media-more-overlay {
            position: absolute;
            inset: 0;
            background-color: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 20px;
            font-weight: 700;
        }

        .post-footer {
            display: flex;
            gap: 4px;
        }

        .action-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 12px;
            border-radius: 20px;
            color: var(--text-secondary);
            font-size: 14px;
            font-weight: 500;
            transition: var(--transition-fast);
        }

        .action-btn:hover {
            background-color: var(--bg-surface);
            color: var(--text-primary);
        }

        .like-btn:hover {
            color: var(--danger);
            background-color: rgba(239, 68, 68, 0.1);
        }

        .icon {
            font-size: 16px;
        }
        
      `}</style>
    </article>
  );
}

