import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VideoTile } from './VideoTile';
import './groupCallGrid.css';

const MAX_SLOTS = 12;
const LOCAL_TILE_ID = 'local';

function getCapacityForCount(count) {
  if (count <= 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 4;
  if (count <= 9) return 9;
  return 12;
}

function getGridDims(capacity) {
  if (capacity <= 1) return { cols: 1, rows: 1 };
  if (capacity === 2) return { cols: 2, rows: 1 };
  if (capacity === 4) return { cols: 2, rows: 2 };
  if (capacity === 9) return { cols: 3, rows: 3 };
  // 12
  return { cols: 4, rows: 3 };
}

/**
 * Sticky capacity с гистерезисом: уменьшение задерживаем, чтобы сетка не «прыгала»
 * при кратковременных disconnect/reconnect и при сетевых просадках.
 */
function useStickyCapacity(count, { downDelayMs = 1600 } = {}) {
  const desired = getCapacityForCount(count);
  const [capacity, setCapacity] = useState(desired);
  const downTimerRef = useRef(null);

  useEffect(() => {
    // Up: мгновенно.
    if (desired > capacity) {
      if (downTimerRef.current) clearTimeout(downTimerRef.current);
      setCapacity(desired);
      return undefined;
    }
    // Down: с задержкой.
    if (desired < capacity) {
      if (downTimerRef.current) clearTimeout(downTimerRef.current);
      downTimerRef.current = setTimeout(() => {
        setCapacity(desired);
      }, downDelayMs);
      return () => {
        if (downTimerRef.current) clearTimeout(downTimerRef.current);
      };
    }
    return undefined;
  }, [capacity, desired, downDelayMs]);

  return capacity;
}

/**
 * Стабильная раскладка по слотам: участники получают «место» один раз,
 * при уходе слот освобождается (остается пустым), остальные не смещаются.
 */
function useStableSlots(tiles, capacity, { lockLocalFirst = true } = {}) {
  const idsBySlotRef = useRef(Array(MAX_SLOTS).fill(null));
  const slotByIdRef = useRef(new Map());

  const tilesById = useMemo(() => {
    const m = new Map();
    tiles.forEach((t) => m.set(t.id, t));
    return m;
  }, [tiles]);

  useEffect(() => {
    const idsBySlot = idsBySlotRef.current;
    const slotById = slotByIdRef.current;

    // Удаляем ушедших.
    for (let i = 0; i < idsBySlot.length; i += 1) {
      const id = idsBySlot[i];
      if (!id) continue;
      if (!tilesById.has(id)) {
        idsBySlot[i] = null;
        slotById.delete(id);
      }
    }

    // Локальный всегда в слоте 0 (чтобы не прыгал при приходах/уходах remote).
    if (lockLocalFirst && tilesById.has(LOCAL_TILE_ID)) {
      const currentLocalSlot = slotById.get(LOCAL_TILE_ID);
      if (currentLocalSlot !== 0) {
        if (typeof currentLocalSlot === 'number') idsBySlot[currentLocalSlot] = null;
        // Если в 0 кто-то был — сдвигаем его в ближайшую дырку.
        const occupant = idsBySlot[0];
        if (occupant && occupant !== LOCAL_TILE_ID) {
          idsBySlot[0] = null;
          slotById.delete(occupant);
          for (let i = 1; i < MAX_SLOTS; i += 1) {
            if (!idsBySlot[i]) {
              idsBySlot[i] = occupant;
              slotById.set(occupant, i);
              break;
            }
          }
        }
        idsBySlot[0] = LOCAL_TILE_ID;
        slotById.set(LOCAL_TILE_ID, 0);
      }
    }

    // Назначаем места новым.
    for (const id of tilesById.keys()) {
      if (slotById.has(id)) continue;
      const start = lockLocalFirst ? 1 : 0;
      for (let i = start; i < MAX_SLOTS; i += 1) {
        if (!idsBySlot[i]) {
          idsBySlot[i] = id;
          slotById.set(id, i);
          break;
        }
      }
    }
  }, [lockLocalFirst, tilesById]);

  const slots = useMemo(() => {
    const ids = idsBySlotRef.current;
    const out = [];
    for (let i = 0; i < Math.min(capacity, MAX_SLOTS); i += 1) {
      const id = ids[i];
      const tile = id ? tilesById.get(id) : null;
      if (tile) {
        out.push({ type: 'tile', key: tile.id, tile });
      } else {
        out.push({ type: 'empty', key: `empty-${i}` });
      }
    }
    return out;
  }, [capacity, tilesById]);

  return slots;
}

/**
 * Fit-to-container: вычисляем размеры тайла так, чтобы grid целиком помещался
 * и сохранял aspect-ratio. Это убирает layout shifts на разных viewport.
 */
function useFittedTileSize(containerRef, { cols, rows, ratioW, ratioH, gapPx }) {
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const computeFromRect = (rect) => {
      if (!rect) return;
      const r = ratioW / ratioH;
      const gapW = gapPx * Math.max(0, cols - 1);
      const gapH = gapPx * Math.max(0, rows - 1);
      const availW = Math.max(0, rect.width - gapW);
      const availH = Math.max(0, rect.height - gapH);

      const wFromWidth = availW / cols;
      const hFromHeight = availH / rows;

      let w;
      let h;
      if (wFromWidth / r <= hFromHeight) {
        w = wFromWidth;
        h = w / r;
      } else {
        h = hFromHeight;
        w = h * r;
      }

      const next = {
        w: Math.max(0, Math.floor(w)),
        h: Math.max(0, Math.floor(h))
      };
      setSize((prev) => (prev.w === next.w && prev.h === next.h ? prev : next));
    };

    // ResizeObserver (основной путь)
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver((entries) => {
        const rect = entries?.[0]?.contentRect;
        computeFromRect(rect);
      });

      ro.observe(el);
      return () => ro.disconnect();
    }

    // Fallback: хотя бы пересчет по window.resize
    let raf = 0;
    const onResize = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        computeFromRect(el.getBoundingClientRect());
      });
    };
    onResize();
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [cols, gapPx, ratioH, ratioW, rows, containerRef]);

  return size;
}

function useResponsiveTileRatio() {
  const [ratio, setRatio] = useState(() => {
    const isMobile =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer:coarse)')?.matches || window.innerWidth <= 640);
    return isMobile ? { w: 4, h: 3 } : { w: 16, h: 9 };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mq = window.matchMedia?.('(pointer:coarse)');
    let raf = 0;

    const compute = () => {
      const isMobile = (mq?.matches ?? false) || window.innerWidth <= 640;
      const next = isMobile ? { w: 4, h: 3 } : { w: 16, h: 9 };
      setRatio((prev) => (prev.w === next.w && prev.h === next.h ? prev : next));
    };

    const onChange = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    };

    window.addEventListener('resize', onChange, { passive: true });
    mq?.addEventListener?.('change', onChange);
    compute();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', onChange);
      mq?.removeEventListener?.('change', onChange);
    };
  }, []);

  return ratio;
}

export function GroupCallGrid({
  tiles,
  pinnedId,
  activeSpeakerId,
  onPinChange
}) {
  const hasPinned = !!pinnedId && tiles.some((t) => t.id === pinnedId) && tiles.length > 1;
  const effectivePinnedId = hasPinned ? pinnedId : null;

  const totalCount = tiles.length;
  const capacity = useStickyCapacity(totalCount);
  const { cols, rows } = useMemo(() => getGridDims(capacity), [capacity]);

  const containerRef = useRef(null);
  const ratio = useResponsiveTileRatio();

  const gapPx = 12;
  const tileSize = useFittedTileSize(containerRef, {
    cols,
    rows,
    ratioW: ratio.w,
    ratioH: ratio.h,
    gapPx
  });

  const slots = useStableSlots(tiles, capacity);
  const pinnedTile = effectivePinnedId ? tiles.find((t) => t.id === effectivePinnedId) : null;
  const stripTiles = useMemo(
    () => (pinnedTile ? tiles.filter((t) => t.id !== pinnedTile.id) : []),
    [pinnedTile, tiles]
  );
  const stripCapacity = useStickyCapacity(stripTiles.length, { downDelayMs: 900 });
  const stripSlots = useStableSlots(stripTiles, Math.min(stripCapacity, MAX_SLOTS), { lockLocalFirst: false });

  const handleTogglePin = useCallback(
    (id) => {
      if (!onPinChange) return;
      if (effectivePinnedId === id) onPinChange(null);
      else onPinChange(id);
    },
    [effectivePinnedId, onPinChange]
  );

  if (pinnedTile) {
    return (
      <section className="lkCallGrid lkCallGrid--pinned" aria-label="Group call grid">
        <div className="lkCallGrid__pinned">
          <div className="lkCallGrid__pinnedInner">
            <VideoTile
              {...pinnedTile}
              isPinned
              isActiveSpeaker={pinnedTile.id === activeSpeakerId}
              onTogglePin={handleTogglePin}
            />
          </div>
        </div>

        <div className="lkCallGrid__strip" aria-label="Other participants">
          <div className="lkCallGrid__stripGrid">
            {stripSlots.map((slot) => {
              if (slot.type === 'empty') {
                return <div key={slot.key} className="lkCallGrid__empty" />;
              }
              const t = slot.tile;
              return (
                <div key={slot.key} className="lkCallGrid__stripItem">
                  <VideoTile
                    {...t}
                    isPinned={t.id === effectivePinnedId}
                    isActiveSpeaker={t.id === activeSpeakerId}
                    onTogglePin={handleTogglePin}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="lkCallGrid lkCallGrid--grid" aria-label="Group call grid">
      <div ref={containerRef} className="lkCallGrid__fitBox">
        <div
          className="lkCallGrid__grid"
          style={{
            gap: `${gapPx}px`,
            gridTemplateColumns: `repeat(${cols}, ${tileSize.w || 1}px)`,
            gridTemplateRows: `repeat(${rows}, ${tileSize.h || 1}px)`,
            // CSS aspect-ratio как fallback/поддержка стабильных переходов
            ['--lk-tile-aspect']: `${ratio.w} / ${ratio.h}`
          }}
        >
          {slots.map((slot) => {
            if (slot.type === 'empty') {
              return <div key={slot.key} className="lkCallGrid__empty" />;
            }

            const t = slot.tile;
            return (
              <VideoTile
                key={slot.key}
                {...t}
                isPinned={t.id === effectivePinnedId}
                isActiveSpeaker={t.id === activeSpeakerId}
                onTogglePin={handleTogglePin}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

