// 장면 위에 DOM으로 얹는 것: 선택한 가구 위의 도구 막대, 가구에서 벽까지의 거리, 방의 폭·깊이 치수선(평면 뷰).
// 위치는 카메라나 가구가 바뀔 때마다 ref.style로 옮긴다(React 재렌더 없이). 값은 store에서 읽기만 한다.
import { useCallback, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { OrthographicCamera } from 'three';
import { roomBounds } from '../contracts/room';
import type { Mm } from '../contracts/types';
import { formatLength, formatLengthWithUnit } from '../contracts/units';
import { useProjectStore } from '../store/projectStore';
import { WALL_THICKNESS_MM, wallSegments } from './geometry';
import { itemScreenRect, placeOverlay, roomDimLines, wallDistanceLines, type DimLine, type PxPoint } from './overlayMath';
import type { SceneRuntime } from './sceneProbe';

/** 치수선 끝 눈금의 길이(px) */
const TICK_PX = 10;
/** 방 치수선을 벽 바깥 면에서 띄우는 거리(px) */
const ROOM_DIM_OFFSET_PX = 20;
const WALL_INDEXES = [0, 1, 2, 3] as const;

interface SceneOverlaysProps {
  runtime: SceneRuntime;
  selectionOverlay?: ReactNode;
  wallDistances?: readonly [Mm, Mm, Mm, Mm] | null;
}

const f = (n: number) => n.toFixed(1);
const segment = (a: PxPoint, b: PxPoint) => `M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}`;
/** 선분 끝에서 선분에 수직인 짧은 눈금 */
function tick(at: PxPoint, dir: PxPoint): string {
  const nx = -dir.y * (TICK_PX / 2);
  const ny = dir.x * (TICK_PX / 2);
  return segment({ x: at.x - nx, y: at.y - ny }, { x: at.x + nx, y: at.y + ny });
}
const place = (el: HTMLElement | null, x: number, y: number, rotate = '') => {
  if (!el) return;
  el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)${rotate}`;
  el.style.visibility = 'visible';
};

export function SceneOverlays({ runtime, selectionOverlay, wallDistances }: SceneOverlaysProps) {
  const project = useProjectStore((s) => s.project);
  const viewMode = useProjectStore((s) => s.viewMode);
  const selectedItemId = useProjectStore((s) => s.selectedItemId);
  const dragPreview = useProjectStore((s) => s.dragPreview);
  const draft = useProjectStore((s) => s.draft);
  const plan = viewMode === '2d';
  const unit = project.displayUnit;
  const selected = draft ?? project.items.find((i) => i.id === selectedItemId) ?? null;
  const showToolbar = selectionOverlay != null && selected !== null && !dragPreview;
  const showDists = plan && selected !== null && wallDistances != null;

  const bounds = useMemo(() => roomBounds(project.room), [project.room]);
  const outward = useMemo(() => wallSegments(project.room.corners).map((w) => w.outward), [project.room.corners]);

  const roomPathRef = useRef<SVGPathElement>(null);
  const distPathRef = useRef<SVGPathElement>(null);
  const warnPathRef = useRef<SVGPathElement>(null);
  const widthChipRef = useRef<HTMLSpanElement>(null);
  const depthChipRef = useRef<HTMLSpanElement>(null);
  const distChipRefs = useRef<(HTMLSpanElement | null)[]>([null, null, null, null]);
  const holderRef = useRef<HTMLDivElement>(null);

  // 렌더마다 최신 값을 담아 두고, 카메라가 바뀔 때도 같은 값으로 위치만 다시 잡는다.
  const latest = useRef({ plan, bounds, outward, wallDistances, showToolbar, showDists });
  latest.current = { plan, bounds, outward, wallDistances, showToolbar, showDists };

  const update = useCallback(() => {
    const s = runtime.get?.();
    if (!s) return;
    const { camera, size } = s;
    const cur = latest.current;
    // 뷰를 바꾸는 중간에는 카메라와 모드가 어긋날 수 있다. 다음 그림에서 맞춘다.
    if ((camera instanceof OrthographicCamera) !== cur.plan) return;
    camera.updateMatrixWorld();
    const st = useProjectStore.getState();
    const item = st.draft ?? st.project.items.find((i) => i.id === st.selectedItemId);
    const at = item && st.dragPreview?.itemId === item.id ? { ...item, x: st.dragPreview.x, z: st.dragPreview.z } : item;

    let holderRect: { left: number; top: number; right: number; bottom: number } | null = null;
    const holder = holderRef.current;
    if (holder && at) {
      const box = { width: holder.offsetWidth, height: holder.offsetHeight };
      const p = placeOverlay(itemScreenRect(camera, size, at), box, size);
      holder.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
      holder.style.visibility = 'visible';
      holderRect = { left: p.x, top: p.y, right: p.x + box.width, bottom: p.y + box.height };
    }

    if (!cur.plan) return;

    const dims = roomDimLines(camera, size, cur.bounds, WALL_THICKNESS_MM, ROOM_DIM_OFFSET_PX);
    const ext = (line: DimLine, wallEdge: number, horizontal: boolean): string =>
      [line.from, line.to]
        .map((p) =>
          horizontal
            ? segment({ x: p.x, y: wallEdge - 2 }, { x: p.x, y: p.y - TICK_PX / 2 })
            : segment({ x: wallEdge - 2, y: p.y }, { x: p.x - TICK_PX / 2, y: p.y }),
        )
        .join('');
    roomPathRef.current?.setAttribute(
      'd',
      [
        segment(dims.width.from, dims.width.to),
        tick(dims.width.from, dims.width.dir),
        tick(dims.width.to, dims.width.dir),
        ext(dims.width, dims.wallOuterTop, true),
        segment(dims.depth.from, dims.depth.to),
        tick(dims.depth.from, dims.depth.dir),
        tick(dims.depth.to, dims.depth.dir),
        ext(dims.depth, dims.wallOuterLeft, false),
      ].join(''),
    );
    place(widthChipRef.current, dims.width.mid.x, dims.width.mid.y);
    place(depthChipRef.current, dims.depth.mid.x, dims.depth.mid.y, ' rotate(-90deg)');

    let ink = '';
    let warn = '';
    if (at && cur.showDists && cur.wallDistances) {
      const lines = wallDistanceLines(camera, size, at, cur.outward, cur.wallDistances);
      lines.forEach((line, i) => {
        const chip = distChipRefs.current[i];
        const negative = (cur.wallDistances?.[i] ?? 0) < 0;
        if (line.length > 0.5) {
          const d = segment(line.from, line.to) + tick(line.from, line.dir) + tick(line.to, line.dir);
          if (negative) warn += d;
          else ink += d;
        }
        const cx = line.mid.x;
        let cy = line.mid.y;
        // 도구 막대가 거리 글자를 덮으면 글자를 도구 막대 바깥쪽(벽 쪽)으로 비킨다.
        if (chip && holderRect && Math.abs(line.dir.y) > 0.5) {
          const half = chip.offsetHeight / 2;
          const overlaps =
            cx + chip.offsetWidth / 2 > holderRect.left && cx - chip.offsetWidth / 2 < holderRect.right &&
            cy + half > holderRect.top && cy - half < holderRect.bottom;
          if (overlaps) {
            const moved = line.dir.y < 0 ? holderRect.top - 4 - half : holderRect.bottom + 4 + half;
            // 치수선 위로 옮길 수 있을 때만 옮긴다. 선 밖(벽 너머)으로 나가면 그대로 둔다(도구 막대 뒤에 가려진다).
            if (moved >= Math.min(line.from.y, line.to.y) && moved <= Math.max(line.from.y, line.to.y)) cy = moved;
          }
        }
        place(chip, cx, Math.max(cy, 10));
      });
    }
    distPathRef.current?.setAttribute('d', ink);
    warnPathRef.current?.setAttribute('d', warn);
  }, [runtime]);

  useLayoutEffect(() => {
    runtime.syncOverlays = update;
    return () => {
      runtime.syncOverlays = null;
    };
  }, [runtime, update]);

  // 값이 바뀐 렌더 직후(가구 이동·크기·회전, 단위, 선택, 뷰 전환)에도 위치를 다시 잡는다.
  useLayoutEffect(() => {
    update();
  });

  return (
    <div className="scene-overlay-layer">
      {plan && (
        <>
          <svg className="scene-dim-svg" aria-hidden="true">
            <path ref={roomPathRef} className="scene-dim-path" />
            <path ref={distPathRef} className="scene-dim-path" />
            <path ref={warnPathRef} className="scene-dim-path scene-dim-path--warn" />
          </svg>
          <span ref={widthChipRef} className="scene-dim-chip scene-dim-chip--room num" data-testid="room-dim-width">
            {formatLengthWithUnit(bounds.width, unit)}
          </span>
          <span ref={depthChipRef} className="scene-dim-chip scene-dim-chip--room num" data-testid="room-dim-depth">
            {formatLengthWithUnit(bounds.depth, unit)}
          </span>
        </>
      )}
      {showDists &&
        WALL_INDEXES.map((i) => (
          <span
            key={i}
            ref={(el) => {
              distChipRefs.current[i] = el;
            }}
            className={`scene-dim-chip num${(wallDistances?.[i] ?? 0) < 0 ? ' scene-dim-chip--warn' : ''}`}
            data-testid={`scene-dist-${i}`}
          >
            {formatLength(wallDistances?.[i] ?? 0, unit)}
          </span>
        ))}
      {showToolbar && (
        <div ref={holderRef} className="scene-overlay-holder" data-scene-overlay="">
          {selectionOverlay}
        </div>
      )}
    </div>
  );
}
