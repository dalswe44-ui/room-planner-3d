// 방 치수 입력. 직사각형 방의 폭·깊이·천장 높이를 받아 store에 반영한다(저장은 store가 corners로 한다).
import {
  CEILING_MAX,
  CEILING_MIN,
  ROOM_SIDE_MAX,
  ROOM_SIDE_MIN,
  ROOM_SIDE_USUAL_MAX,
  ROOM_SIDE_USUAL_MIN,
} from '../contracts/limits';
import { useState } from 'react';
import { notchOf, roomBounds, type NotchCorner, type RoomNotch } from '../contracts/room';
import { formatLength, UNIT_LABEL } from '../contracts/units';
import { NOTCH_MIN, NOTCH_REST_MIN, useProjectStore } from '../store/projectStore';
import { LengthInput } from '../ui/LengthInput';
import './room.css';

function isUnusualSide(mm: number): boolean {
  return mm < ROOM_SIDE_USUAL_MIN || mm > ROOM_SIDE_USUAL_MAX;
}

export function RoomPanel() {
  const room = useProjectStore((s) => s.project.room);
  const unit = useProjectStore((s) => s.project.displayUnit);
  const [fitNote, setFitNote] = useState<string | null>(null);
  const { width, depth } = roomBounds(room);
  const ceilingHeight = room.ceilingHeight;

  const notch = notchOf(room.corners);
  // 방을 줄이거나 모양을 바꾸면 store가 칸막이 벽·문을 방 안으로 맞춘다. 무엇이 바뀌었는지 알린다(D-1118-02).
  const withFitNote = (change: () => void) => {
    const before = useProjectStore.getState().project.room;
    change();
    const after = useProjectStore.getState().project.room;
    const wallsGone = before.walls.length - after.walls.length;
    const wallsCut = after.walls.filter((w) => !before.walls.includes(w)).length;
    const openingsGone = before.openings.length - after.openings.length;
    const openingsMoved = after.openings.filter((o) => !before.openings.includes(o)).length;
    const parts = [
      wallsGone > 0 && `방 밖으로 나간 칸막이 벽 ${wallsGone}개를 지웠습니다`,
      wallsCut > 0 && `칸막이 벽 ${wallsCut}개를 방 안으로 잘랐습니다`,
      openingsGone > 0 && `벽이 없어진 문·창문 ${openingsGone}개도 지웠습니다`,
      openingsMoved > 0 && `문·창문 ${openingsMoved}개를 벽 안으로 옮기거나 좁혔습니다`,
    ].filter(Boolean);
    setFitNote(parts.length > 0 ? `${parts.join('. ')}. 되돌리기로 되살릴 수 있습니다.` : null);
  };
  const setRoomSize = (size: { width: number; depth: number; ceilingHeight: number }) => withFitNote(() => useProjectStore.getState().setRoomSize(size));
  const setNotch = (n: RoomNotch | null) => withFitNote(() => useProjectStore.getState().setRoomNotch(n));
  const half = (mm: number) => Math.round(mm / 20) * 10;

  return (
    <section className="room-panel" aria-label="방 치수">
      <h2 className="room-panel__title">방 치수</h2>
      <p className="room-panel__hint">벽 안쪽에서 잰 길이입니다. 360cm, 3.6m처럼 단위를 붙여 넣어도 됩니다.</p>
      <div className="room-panel__fields">
        <LengthInput
          label="폭"
          valueMm={width}
          unit={unit}
          min={ROOM_SIDE_MIN}
          max={ROOM_SIDE_MAX}
          testId="room-width"
          onCommit={(mm) => setRoomSize({ width: mm, depth, ceilingHeight })}
        />
        <LengthInput
          label="깊이"
          valueMm={depth}
          unit={unit}
          min={ROOM_SIDE_MIN}
          max={ROOM_SIDE_MAX}
          testId="room-depth"
          onCommit={(mm) => setRoomSize({ width, depth: mm, ceilingHeight })}
        />
        <LengthInput
          label="천장 높이"
          valueMm={ceilingHeight}
          unit={unit}
          min={CEILING_MIN}
          max={CEILING_MAX}
          testId="room-height"
          onCommit={(mm) => setRoomSize({ width, depth, ceilingHeight: mm })}
        />
      </div>
      <div className="room-panel__shape" role="group" aria-label="방 모양">
        <span className="room-panel__shape-label">모양</span>
        <button type="button" className="chip" data-testid="room-shape-rect" aria-pressed={notch === null} onClick={() => notch && setNotch(null)}>
          직사각형
        </button>
        <button
          type="button"
          className="chip"
          data-testid="room-shape-l"
          aria-pressed={notch !== null}
          onClick={() => !notch && setNotch({ corner: 'br', w: half(width), d: half(depth) })}
        >
          ㄱ자
        </button>
      </div>
      {notch && (
        <div className="room-panel__fields" data-testid="room-notch-fields">
          <div className="room-panel__select">
            <label htmlFor="room-notch-corner">빠진 모서리</label>
            <select
              id="room-notch-corner"
              data-testid="room-notch-corner"
              value={notch.corner}
              onChange={(e) => setNotch({ ...notch, corner: e.target.value as NotchCorner })}
            >
              <option value="br">오른쪽 아래</option>
              <option value="bl">왼쪽 아래</option>
              <option value="tr">오른쪽 위</option>
              <option value="tl">왼쪽 위</option>
            </select>
          </div>
          <LengthInput
            label="빠진 폭"
            valueMm={notch.w}
            unit={unit}
            min={NOTCH_MIN}
            max={width - NOTCH_REST_MIN}
            testId="room-notch-w"
            onCommit={(mm) => setNotch({ ...notch, w: mm })}
          />
          <LengthInput
            label="빠진 깊이"
            valueMm={notch.d}
            unit={unit}
            min={NOTCH_MIN}
            max={depth - NOTCH_REST_MIN}
            testId="room-notch-d"
            onCommit={(mm) => setNotch({ ...notch, d: mm })}
          />
        </div>
      )}
      {fitNote && (
        <p className="room-panel__warning" role="status" data-testid="room-fit-note">
          {fitNote}
        </p>
      )}
      {(isUnusualSide(width) || isUnusualSide(depth)) && (
        <p className="room-panel__warning" role="status" data-testid="room-unit-warning">
          단위를 확인하세요. 폭이나 깊이가 {formatLength(ROOM_SIDE_USUAL_MIN, unit)} {UNIT_LABEL[unit]}보다 작거나{' '}
          {formatLength(ROOM_SIDE_USUAL_MAX, unit)} {UNIT_LABEL[unit]}보다 큽니다. 맞는 값이면 그대로 두어도 됩니다.
        </p>
      )}
    </section>
  );
}
