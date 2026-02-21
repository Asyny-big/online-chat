import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_URL } from '@/config';
import { resolveAssetUrl } from '@/shared/lib/resolveAssetUrl';
import { CommentIcon, HeartIcon, ShareIcon } from '@/shared/ui/Icons';

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

export default function PostCard({ item, token, onOpenComments, onLikeSuccess }) {
  const post = item?.post || item || {};
  const author = useMemo(() => {
    const raw = post?.authorId;
    if (raw && typeof raw === 'object') return raw;
    return null;
  }, [post?.authorId]);

  const avatar = resolveAssetUrl(author?.avatarUrl || '');
  const likes = Number(post?.stats?.likes || 0);
  const comments = Number(post?.stats?.comments || 0);

  const [isLiking, setIsLiking] = useState(false);
  const [liked, setLiked] = useState(null);
  const [likeDelta, setLikeDelta] = useState(0);

  useEffect(() => {
    setIsLiking(false);
    setLiked(null);
    setLikeDelta(0);
  }, [post?._id, likes]);

  const handleLike = async () => {
    const targetId = post?._id;
    if (!targetId || !token || isLiking) return;

    setIsLiking(true);
    try {
      const res = await axios.post(
        `${API_URL}/social/reactions/toggle`,
        { targetType: 'post', targetId, reaction: 'like' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const nextActive = Boolean(res.data?.active);
      setLiked(nextActive);
      setLikeDelta(nextActive ? 1 : -1);
      await onLikeSuccess?.();
    } catch (_) {
      // Feed-level error handling is enough, do not interrupt UX with alerts here.
    } finally {
      setIsLiking(false);
    }
  };

  const displayedLikes = Math.max(0, likes + likeDelta);

  return (
    <article className="post-card">
      <div className="post-header">
        <div className="avatar-wrap">
          {avatar ? (
            <img src={avatar} alt={author?.name} className="avatar-img" />
          ) : (
            <div className="avatar-fallback">{author?.name?.[0] || 'U'}</div>
          )}
        </div>
        <div className="post-meta">
          <div className="author-name">{author?.name || 'Пользователь'}</div>
          <div className="post-time">{formatTime(post?.createdAt || item?.createdAt)}</div>
        </div>
        <button type="button" className="more-btn" aria-label="More actions">...</button>
      </div>

      {post?.text ? <div className="post-text">{post.text}</div> : null}

      <MediaBlock media={post?.media} />

      <div className="post-footer">
        <button
          type="button"
          className={`action-btn like-btn ${liked ? 'active' : ''}`}
          onClick={handleLike}
          disabled={isLiking}
          aria-label="Like post"
        >
          <span className="icon">
            <HeartIcon size={16} />
          </span>
          <span className="count">{displayedLikes > 0 ? displayedLikes : ''}</span>
        </button>

        <button
          type="button"
          className="action-btn comment-btn"
          onClick={() => onOpenComments?.(post?._id)}
          aria-label="Open comments"
        >
          <span className="icon">
            <CommentIcon size={16} />
          </span>
          <span className="count">{comments > 0 ? comments : ''}</span>
        </button>

        <button type="button" className="action-btn share-btn" aria-label="Share post">
          <span className="icon">
            <ShareIcon size={16} />
          </span>
        </button>
      </div>

      <style>{`
        .post-card {
          background:
            radial-gradient(circle at top left, rgba(99, 102, 241, 0.08), transparent 55%),
            var(--bg-card);
          border-radius: var(--radius-lg);
          padding: var(--space-16);
          border: 1px solid var(--border-color);
          box-shadow: var(--shadow-lg);
        }

        .post-header {
          display: flex;
          align-items: center;
          gap: var(--space-12);
          margin-bottom: var(--space-12);
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
          background: linear-gradient(145deg, #243247, #1d293a);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          font-weight: 700;
        }

        .post-meta {
          flex: 1;
          min-width: 0;
        }

        .author-name {
          font-weight: 700;
          color: var(--text-primary);
          font-size: 15px;
        }

        .post-time {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .more-btn {
          width: 32px;
          height: 32px;
          color: var(--text-secondary);
          border-radius: 10px;
          border: 1px solid transparent;
          transition: var(--transition-normal);
        }

        .more-btn:hover {
          background-color: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-color);
        }

        .post-text {
          color: var(--text-primary);
          font-size: 15px;
          line-height: 1.6;
          white-space: pre-wrap;
          margin-bottom: var(--space-12);
          word-break: break-word;
        }

        .media-grid {
          display: grid;
          gap: var(--space-6);
          border-radius: var(--radius-md);
          overflow: hidden;
          margin-bottom: var(--space-14);
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
          aspect-ratio: 16/9;
        }

        .media-grid-1 .media-item {
          aspect-ratio: auto;
          max-height: 500px;
        }

        .media-content {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .media-more-overlay {
          position: absolute;
          inset: 0;
          background-color: rgba(2, 6, 23, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 20px;
          font-weight: 700;
        }

        .post-footer {
          display: flex;
          gap: var(--space-8);
          border-top: 1px solid var(--border-color);
          padding-top: var(--space-12);
        }

        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: var(--space-6);
          padding: var(--space-8) var(--space-12);
          border-radius: var(--radius-pill);
          color: var(--text-secondary);
          font-size: 14px;
          font-weight: 600;
          border: 1px solid transparent;
          transition: var(--transition-normal);
        }

        .action-btn:hover {
          background-color: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-color);
          transform: translateY(-1px);
        }

        .action-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .like-btn.active {
          color: #fb7185;
          background-color: rgba(244, 63, 94, 0.15);
          border-color: rgba(244, 63, 94, 0.25);
        }

        .like-btn:hover {
          color: #fb7185;
          background-color: rgba(244, 63, 94, 0.12);
        }

        .icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }

        .count {
          min-width: 12px;
        }
      `}</style>
    </article>
  );
}

