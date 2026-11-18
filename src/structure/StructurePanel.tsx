// 왼쪽 패널의 "벽·문" 탭: 칸막이 벽 목록, 구역 이름표 추가, 고른 벽·문·창문·이름표의 편집 카드. store를 직접 읽고 쓴다.
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { CEILING_MAX, ROOM_SIDE_MAX } from '../contracts/limits';
import { roomBounds } from '../contracts/room';
import { openingFits, wallSegment } from '../contracts/structure';
import type { AreaLabel, DisplayUnit, InteriorWall, Opening, Room, WallRef } from '../contracts/types';
import { formatLength, UNIT_LABEL } from '../contracts/units';
import { DEFAULT_DOOR, DEFAULT_WINDOW, useProjectStore } from '../store/projectStore';
import { LengthInput } from '../ui/LengthInput';
import { IconPlus, IconTrash } from '../ui/icons';
import './structure.css';

export const WALL_THICKNESS_MIN = 50;
export const WALL_THICKNESS_MAX = 300;
const MIN_LENGTH = 100;
export const OUTER_WALL_NAMES = ['위쪽 벽', '오른쪽 벽', '아래쪽 벽', '왼쪽 벽'] as const;
/**
 * 바깥 벽 이름. 직사각형 방은 벽 번호 순서대로, ㄱ자 방(벽 6개, 2026-11-19 QA 5-4)은 벽이 바라보는 쪽으로 정하고
 * 같은 쪽 벽이 둘이면 방 둘레 안쪽에 있는 벽에 "(꺾인 곳)"을 붙인다.
 */
export function outerWallName(room: Pick<Room, 'corners' | 'walls'>, index: number): string {
  if (room.corners.length === 4) return OUTER_WALL_NAMES[index] ?? `바깥 벽 ${index + 1}`;
  const seg = wallSegment(room, index);
  if (!seg) return `바깥 벽 ${index + 1}`;
  const b = roomBounds(room);
  const horizontal = seg.start.z === seg.end.z;
  const side = horizontal ? (seg.start.z === b.minZ ? 0 : seg.start.z === b.maxZ ? 2 : seg.normal.z > 0 ? 0 : 2) : seg.start.x === b.maxX ? 1 : seg.start.x === b.minX ? 3 : seg.normal.x < 0 ? 1 : 3;
  const onEdge = horizontal ? seg.start.z === b.minZ || seg.start.z === b.maxZ : seg.start.x === b.minX || seg.start.x === b.maxX;
  return onEdge ? OUTER_WALL_NAMES[side] : `${OUTER_WALL_NAMES[side]} (꺾인 곳)`;
}

const OPENING_TYPE_LABEL: Record<Opening['type'], string> = { door: '문', window: '창문', opening: '뚫린 문틈' };
const DEFAULT_LABEL_NAME = '구역';

const isHorizontal = (w: InteriorWall) => w.a.z === w.b.z;
const wallLength = (w: InteriorWall) => Math.abs(w.b.x - w.a.x) + Math.abs(w.b.z - w.a.z);

/** 벽 시작이 어느 쪽 끝인지(개구부 offset을 사용자 말로) */
function startEndName(room: Room, ref: WallRef): string {
  const s = wallSegment(room, ref);
  if (!s) return '시작';
  if (Math.abs(s.dir.x) >= Math.abs(s.dir.z)) return s.dir.x >= 0 ? '왼쪽' : '오른쪽';
  return s.dir.z >= 0 ? '위쪽' : '아래쪽';
}

/**
 * 벽 위 빈 구간 중 벽 가운데에 가장 가까운 곳에 문·창문을 넣을 offset. 이미 있는 개구부와 겹치지 않는다.
 * 빈 구간이 폭보다 모두 좁으면 null.
 */
export function freeOpeningOffset(room: Room, ref: WallRef, width: number): number | null {
  const seg = wallSegment(room, ref);
  if (!seg) return null;
  const length = Math.round(seg.length);
  const taken = room.openings
    .filter((o) => o.wall === ref)
    .map((o) => [o.offset, o.offset + o.width] as const)
    .sort((a, b) => a[0] - b[0]);
  const gaps: [number, number][] = [];
  let from = 0;
  for (const [a, b] of taken) {
    if (a > from) gaps.push([from, a]);
    from = Math.max(from, b);
  }
  if (from < length) gaps.push([from, length]);
  const center = (length - width) / 2;
  let best: number | null = null;
  for (const [a, b] of gaps) {
    if (b - a < width) continue;
    const offset = Math.round(Math.max(a, Math.min(b - width, center)));
    if (best === null || Math.abs(offset - center) < Math.abs(best - center)) best = offset;
  }
  return best;
}

/** 벽의 빈 구간에 기본 폭으로(벽이 짧으면 폭을 줄여) 문·창문을 넣는다. 넣은 개구부는 store가 선택한다. 빈자리가 없으면 false. */
function addOpeningTo(ref: WallRef, type: 'door' | 'window'): boolean {
  const s = useProjectStore.getState();
  const seg = wallSegment(s.project.room, ref);
  if (!seg) return false;
  const width = Math.min(type === 'door' ? DEFAULT_DOOR.width : DEFAULT_WINDOW.width, Math.round(seg.length));
  const offset = freeOpeningOffset(s.project.room, ref, width);
  if (offset === null) return false;
  s.addOpening({ type, wall: ref, width, offset });
  return true;
}

export function StructurePanel() {
  const unit = useProjectStore((s) => s.project.displayUnit);
  const room = useProjectStore((s) => s.project.room);
  const selected = useProjectStore((s) => s.selectedStructure);
  const focusLabelRef = useRef<string | null>(null);

  const addLabel = () => {
    const b = roomBounds(room);
    focusLabelRef.current = useProjectStore.getState().addLabel({
      name: DEFAULT_LABEL_NAME,
      at: { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 },
    });
  };

  let card = null;
  if (selected?.kind === 'wall') {
    const w = room.walls.find((x) => x.id === selected.id);
    if (w) card = <WallCard key={w.id} wall={w} unit={unit} />;
  } else if (selected?.kind === 'outerWall') {
    if (selected.index < room.corners.length) card = <OuterWallCard key={selected.index} index={selected.index} room={room} unit={unit} />;
  } else if (selected?.kind === 'opening') {
    const o = room.openings.find((x) => x.id === selected.id);
    if (o) card = <OpeningCard key={o.id} opening={o} room={room} unit={unit} />;
  } else if (selected?.kind === 'label') {
    const l = room.labels.find((x) => x.id === selected.id);
    if (l) card = <LabelCard key={l.id} label={l} focusRef={focusLabelRef} />;
  }

  return (
    <div className="structure-panel" data-testid="structure-panel">
      <p className="structure-panel__hint" data-testid="structure-hint">
        평면 뷰에서 빈 곳을 끌면 벽이 생겨요. 벽을 고르면 문이나 창문을 넣을 수 있어요.
      </p>
      <button type="button" className="btn structure-panel__tool" data-testid="label-add" onClick={addLabel}>
        <IconPlus size={18} />
        구역 이름 추가
      </button>
      <section>
        <h3 className="structure-panel__title">칸막이 벽</h3>
        <ul className="structure-walls" data-testid="wall-list">
          {room.walls.length === 0 && <li className="structure-panel__empty">아직 없어요.</li>}
          {room.walls.map((w, i) => {
            const on = selected?.kind === 'wall' && selected.id === w.id;
            return (
              <li key={w.id}>
                <button
                  type="button"
                  className="chip structure-walls__row"
                  data-testid="wall-row"
                  data-wall-id={w.id}
                  aria-pressed={on}
                  onClick={() => useProjectStore.getState().selectStructure({ kind: 'wall', id: w.id })}
                >
                  <span>{isHorizontal(w) ? '가로' : '세로'} 벽 {i + 1}</span>
                  <span className="num structure-walls__len">
                    {formatLength(wallLength(w), unit)} {UNIT_LABEL[unit]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      {card}
    </div>
  );
}

function AddOpeningButtons({ wall }: { wall: WallRef }) {
  const [full, setFull] = useState(false);
  const add = (type: 'door' | 'window') => setFull(!addOpeningTo(wall, type));
  return (
    <>
      <div className="structure-actions">
        <button type="button" className="btn" data-testid="wall-add-door" onClick={() => add('door')}>
          <IconPlus size={18} />
          문 추가
        </button>
        <button type="button" className="btn" data-testid="wall-add-window" onClick={() => add('window')}>
          <IconPlus size={18} />
          창문 추가
        </button>
      </div>
      {full && (
        <p className="structure-card__warning" role="alert" data-testid="wall-opening-full">
          이 벽에는 빈자리가 없습니다. 있는 문·창문을 옮기거나 좁힌 뒤 다시 넣으세요.
        </p>
      )}
    </>
  );
}

function WallCard({ wall, unit }: { wall: InteriorWall; unit: DisplayUnit }) {
  const horizontal = isHorizontal(wall);
  const len = wallLength(wall);
  const store = useProjectStore.getState;

  // 시작점(a)은 두고 끝점(b)만 옮긴다. 방향은 지금 방향을 따른다.
  const setLength = (mm: number) => {
    const sign = (horizontal ? wall.b.x - wall.a.x : wall.b.z - wall.a.z) >= 0 ? 1 : -1;
    store().updateWall(wall.id, { b: horizontal ? { x: wall.a.x + sign * mm, z: wall.a.z } : { x: wall.a.x, z: wall.a.z + sign * mm } });
  };
  const setPosition = (mm: number) => {
    store().updateWall(wall.id, horizontal ? { a: { x: wall.a.x, z: mm }, b: { x: wall.b.x, z: mm } } : { a: { x: mm, z: wall.a.z }, b: { x: mm, z: wall.b.z } });
  };

  return (
    <section className="card structure-card" aria-label="칸막이 벽" data-testid="wall-card">
      <h3 className="structure-card__title">{horizontal ? '가로' : '세로'} 칸막이 벽</h3>
      <LengthInput label="길이" valueMm={len} unit={unit} min={MIN_LENGTH} max={ROOM_SIDE_MAX} testId="wall-length" onCommit={setLength} />
      <LengthInput
        label="두께"
        valueMm={wall.thickness}
        unit={unit}
        min={WALL_THICKNESS_MIN}
        max={WALL_THICKNESS_MAX}
        testId="wall-thickness"
        onCommit={(mm) => store().updateWall(wall.id, { thickness: mm })}
      />
      <LengthInput
        label={horizontal ? '위쪽 벽에서 거리' : '왼쪽 벽에서 거리'}
        valueMm={horizontal ? wall.a.z : wall.a.x}
        unit={unit}
        min={0}
        max={ROOM_SIDE_MAX}
        testId="wall-position"
        onCommit={setPosition}
      />
      <AddOpeningButtons wall={wall.id} />
      <button type="button" className="btn btn--danger structure-card__delete" data-testid="wall-delete" onClick={() => store().removeWall(wall.id)}>
        <IconTrash size={18} />
        삭제
      </button>
    </section>
  );
}

function OuterWallCard({ index, room, unit }: { index: number; room: Room; unit: DisplayUnit }) {
  const seg = wallSegment(room, index);
  return (
    <section className="card structure-card" aria-label="바깥 벽" data-testid="outer-wall-card">
      <h3 className="structure-card__title">{outerWallName(room, index)}</h3>
      <p className="structure-card__info num">
        길이 {formatLength(Math.round(seg?.length ?? 0), unit)} {UNIT_LABEL[unit]}
      </p>
      <p className="structure-panel__empty">바깥 벽의 크기는 방 탭에서 바꿔요.</p>
      <AddOpeningButtons wall={index} />
    </section>
  );
}

function OpeningCard({ opening: o, room, unit }: { opening: Opening; room: Room; unit: DisplayUnit }) {
  const store = useProjectStore.getState;
  const fits = openingFits(room, o);
  const set = (patch: Partial<Omit<Opening, 'id'>>) => store().updateOpening(o.id, patch);

  const changeType = (type: Opening['type']) => {
    if (type === 'door') set({ type, sill: 0, hinge: o.hinge ?? 'start', swing: o.swing ?? 'normal' });
    else if (type === 'window') set({ type, sill: o.sill === 0 ? DEFAULT_WINDOW.sill : o.sill });
    else set({ type, sill: 0 });
  };

  return (
    <section className="card structure-card" aria-label="문·창문" data-testid="opening-card">
      <h3 className="structure-card__title">{OPENING_TYPE_LABEL[o.type]}</h3>
      <div className="structure-field">
        <label className="structure-field__label" htmlFor="opening-type">
          종류
        </label>
        <select
          id="opening-type"
          className="structure-field__input"
          value={o.type}
          data-testid="opening-type"
          onChange={(e) => changeType(e.target.value as Opening['type'])}
        >
          {(Object.keys(OPENING_TYPE_LABEL) as Opening['type'][]).map((t) => (
            <option key={t} value={t}>
              {OPENING_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>
      <LengthInput label="폭" valueMm={o.width} unit={unit} min={MIN_LENGTH} max={ROOM_SIDE_MAX} testId="opening-width" onCommit={(mm) => set({ width: mm })} />
      <LengthInput
        label={`${startEndName(room, o.wall)} 끝에서`}
        valueMm={o.offset}
        unit={unit}
        min={0}
        max={ROOM_SIDE_MAX}
        testId="opening-offset"
        onCommit={(mm) => set({ offset: mm })}
      />
      <LengthInput label="높이" valueMm={o.height} unit={unit} min={MIN_LENGTH} max={CEILING_MAX} testId="opening-height" onCommit={(mm) => set({ height: mm })} />
      {o.type === 'window' && (
        <LengthInput label="문턱 높이" valueMm={o.sill} unit={unit} min={0} max={CEILING_MAX} testId="opening-sill" onCommit={(mm) => set({ sill: mm })} />
      )}
      {!fits && (
        <p className="structure-card__warning" role="alert" data-testid="opening-fit-warning">
          벽 길이를 넘어요. 폭이나 위치를 줄여 주세요.
        </p>
      )}
      {o.type === 'door' && (
        <div className="structure-actions">
          <button type="button" className="btn" data-testid="opening-flip-hinge" onClick={() => set({ hinge: (o.hinge ?? 'start') === 'start' ? 'end' : 'start' })}>
            경첩 위치 바꾸기
          </button>
          <button type="button" className="btn" data-testid="opening-flip-swing" onClick={() => set({ swing: (o.swing ?? 'normal') === 'normal' ? 'opposite' : 'normal' })}>
            여는 방향 바꾸기
          </button>
        </div>
      )}
      <button type="button" className="btn btn--danger structure-card__delete" data-testid="opening-delete" onClick={() => store().removeOpening(o.id)}>
        <IconTrash size={18} />
        삭제
      </button>
    </section>
  );
}

function LabelCard({ label, focusRef }: { label: AreaLabel; focusRef: MutableRefObject<string | null> }) {
  const [text, setText] = useState(label.name);
  const [lastName, setLastName] = useState(label.name);
  const inputRef = useRef<HTMLInputElement>(null);
  if (label.name !== lastName) {
    setLastName(label.name);
    setText(label.name);
  }

  useEffect(() => {
    if (focusRef.current === label.id) {
      focusRef.current = null;
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [label.id, focusRef]);

  const commit = () => {
    const next = text.trim() || DEFAULT_LABEL_NAME;
    setText(next);
    if (next !== label.name) useProjectStore.getState().updateLabel(label.id, { name: next });
  };

  return (
    <section className="card structure-card" aria-label="구역 이름표" data-testid="label-card">
      <h3 className="structure-card__title">구역 이름표</h3>
      <div className="structure-field">
        <label className="structure-field__label" htmlFor="label-name">
          이름
        </label>
        <input
          id="label-name"
          ref={inputRef}
          className="structure-field__input"
          type="text"
          autoComplete="off"
          enterKeyHint="done"
          value={text}
          data-testid="label-name"
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
          }}
        />
      </div>
      <button type="button" className="btn btn--danger structure-card__delete" data-testid="label-delete" onClick={() => useProjectStore.getState().removeLabel(label.id)}>
        <IconTrash size={18} />
        삭제
      </button>
    </section>
  );
}
