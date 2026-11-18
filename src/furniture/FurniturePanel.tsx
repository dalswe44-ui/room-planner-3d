// 가구 추가 폼, 가구 목록, 선택한 가구의 수정·회전·삭제와 벽까지 거리. store를 직접 읽고 쓴다.
import { useEffect, useMemo, useRef, useState, type FormEvent, type MutableRefObject } from 'react';
import { roomBounds } from '../contracts/room';
import { FURNITURE_PRESETS, guessKindFromName, KIND_LABEL, type FurniturePreset } from '../contracts/furniturePresets';
import { DEFAULT_ITEM_NAME, ITEM_SIZE_MAX, ITEM_SIZE_MIN, ROOM_SIDE_MAX } from '../contracts/limits';
import type { DisplayUnit, FurnitureItem, FurnitureKind, ItemStatus, Mm, PointMm } from '../contracts/types';
import { formatLength, UNIT_LABEL } from '../contracts/units';
import { useProjectStore } from '../store/projectStore';
import { LengthInput } from '../ui/LengthInput';
import { IconDuplicate, IconPlus, IconRotateLeft, IconRotateRight, IconTrash } from '../ui/icons';
import { duplicateItem } from './duplicateItem';
import { IconCheck, IconClose } from './DraftIcons';
import {
  bringInsideCenter,
  clearances,
  currentFootprint,
  doorRects,
  findFreeSpot,
  footprint,
  narrowSides,
  nextRotation,
  ROTATE_STEP_DEG,
  WALKWAY_MIN_MM,
  wallRects,
} from './placement';
import { useItemStatuses } from './useItemStatuses';
import { useSelectedWallDistances } from './useSelectedWallDistances';
import './furniture.css';

type SizeKey = 'w' | 'd' | 'h';
type Size = Record<SizeKey, Mm>;

const SIZE_FIELDS: { key: SizeKey; label: string }[] = [
  { key: 'w', label: '폭' },
  { key: 'd', label: '깊이' },
  { key: 'h', label: '높이' },
];

/** 추가 폼의 처음 치수(mm). SPEC에 없는 값이라 헤드 확인이 필요하다. */
const INITIAL_SIZE: Size = { w: 600, d: 600, h: 600 };

/** 방향과 평면 뷰(원점 왼쪽 위, +z 아래)에서의 위치 */
const WALL_LABELS = ['위쪽 벽까지', '오른쪽 벽까지', '아래쪽 벽까지', '왼쪽 벽까지'] as const;

/** 새 가구를 놓을 빈 자리. 방과 다른 가구는 누른 순간의 store에서 읽는다. */
function freeSpotFor(size: Pick<FurnitureItem, 'w' | 'd'>, from?: PointMm) {
  const { project } = useProjectStore.getState();
  return findFreeSpot(
    size,
    roomBounds(project.room),
    project.items.map((it) => footprint(it)),
    from,
    [...wallRects(project.room), ...doorRects(project.room)],
  );
}

/** "1200 × 600 × 720 mm" */
function sizeSummary(it: Pick<FurnitureItem, 'w' | 'd' | 'h'>, unit: DisplayUnit): string {
  return `${formatLength(it.w, unit)} × ${formatLength(it.d, unit)} × ${formatLength(it.h, unit)} ${UNIT_LABEL[unit]}`;
}

function nameOrDefault(text: string): string {
  return text.trim() || DEFAULT_ITEM_NAME;
}

function hasWarning(st: ItemStatus | undefined): boolean {
  return st !== undefined && (st.overlap || st.outside || st.wall || st.door || st.ceiling === true);
}

/** 경고 문구. 겹침·방 밖·칸막이·문 자리·천장(2026-11-19 QA 4-8). 경고가 없으면 아무것도 그리지 않는다. */
function StatusLines({ status, item, unit, testId }: { status: ItemStatus | undefined; item: FurnitureItem; unit: DisplayUnit; testId: string }) {
  const ceiling = useProjectStore((s) => s.project.room.ceilingHeight);
  if (!status || !hasWarning(status)) return null;
  return (
    <p className="furniture-editor__status" role="status" data-testid={testId}>
      {status.overlap && <span>겹침: 다른 가구와 겹칩니다.</span>}
      {status.outside && <span>방 밖: 방 경계를 벗어났습니다.</span>}
      {status.wall && <span>칸막이 벽과 겹쳐요.</span>}
      {status.door && <span>문이 열리는 자리예요.</span>}
      {status.ceiling && (
        <span data-testid={`${testId}-ceiling`}>
          천장보다 높아요: 높이 {formatLength(item.h + item.elevation, unit)} {UNIT_LABEL[unit]}, 천장 {formatLength(ceiling, unit)} {UNIT_LABEL[unit]}.
        </span>
      )}
    </p>
  );
}

export function FurniturePanel() {
  const unit = useProjectStore((s) => s.project.displayUnit);
  const items = useProjectStore((s) => s.project.items);
  const selectedItemId = useProjectStore((s) => s.selectedItemId);
  const draft = useProjectStore((s) => s.draft);
  const extraCount = useProjectStore((s) => s.extraSelectedIds.length);
  const statuses = useItemStatuses();
  const selected = items.find((it) => it.id === selectedItemId) ?? null;
  const rootRef = useRef<HTMLDivElement>(null);
  // 이 패널의 추가 버튼으로 막 선택된 가구 id. 추가 직후에는 사용자가 패널에 있으므로 스크롤하지 않는다.
  const addedIdRef = useRef<string | null>(null);

  // 장면이나 목록 클릭으로 선택이 바뀌면 편집 칸을 보이게 한다(좁은 화면에서 패널이 캔버스 아래에 있다).
  useEffect(() => {
    if (selectedItemId === null) return;
    if (selectedItemId === addedIdRef.current) {
      addedIdRef.current = null;
      return;
    }
    rootRef.current?.querySelector('.furniture-editor')?.scrollIntoView({ block: 'nearest' });
  }, [selectedItemId]);

  return (
    <div className="furniture-panel" ref={rootRef}>
      <AddForm unit={unit} addedIdRef={addedIdRef} />
      {draft && <DraftCard key={draft.id} draft={draft} unit={unit} addedIdRef={addedIdRef} />}
      <ItemList items={items} selectedItemId={selectedItemId} statuses={statuses} unit={unit} />
      {selected && extraCount > 0 && <GroupCard count={extraCount + 1} />}
      {selected && <ItemEditor key={selected.id} item={selected} unit={unit} status={statuses[selected.id]} />}
    </div>
  );
}

function AddForm({ unit, addedIdRef }: { unit: DisplayUnit; addedIdRef: MutableRefObject<string | null> }) {
  const addItem = useProjectStore((s) => s.addItem);
  const startDraft = useProjectStore((s) => s.startDraft);
  const draftKind = useProjectStore((s) => s.draft?.kind ?? null);
  const [name, setName] = useState('');
  const [size, setSize] = useState<Size>(INITIAL_SIZE);
  const [invalid, setInvalid] = useState<Record<SizeKey, boolean>>({ w: false, d: false, h: false });
  // 제출 핸들러가 읽는 최신 값. 확정과 거부는 LengthInput이 이벤트 안에서 바로 알리므로,
  // 제출 직전에 포커스를 풀어 일어난 확정도 다시 렌더하기 전에 여기에 반영된다.
  const latest = useRef({ size: INITIAL_SIZE, invalid: { w: false, d: false, h: false } });

  const commitSize = (key: SizeKey, mm: Mm) => {
    latest.current.size = { ...latest.current.size, [key]: mm };
    setSize(latest.current.size);
  };
  const changeValidity = (key: SizeKey, valid: boolean) => {
    latest.current.invalid = { ...latest.current.invalid, [key]: !valid };
    setInvalid(latest.current.invalid);
  };

  // 기본 가구는 바로 추가하지 않고 빈 자리에 미리보기로 놓는다(✓로 확정). 다른 기본 가구를 누르면 미리보기가 바뀌고, 이미 미리보기가 있으면 그 자리 근처에서 빈 자리를 찾는다.
  // 직접 입력 폼과는 따로 동작한다(폼은 값을 다 적고 "추가"를 누르는 것이므로 바로 추가).
  const addPreset = (p: FurniturePreset) => {
    const prev = useProjectStore.getState().draft;
    startDraft({ name: p.label, kind: p.kind, w: p.w, d: p.d, h: p.h, ...freeSpotFor(p, prev ? { x: prev.x, z: prev.z } : undefined) });
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // 입력 칸 포커스를 푼다. 버튼을 눌러도 칸이 포커스를 잃지 않는 브라우저(iOS)에서 입력 중인 값을 먼저 확정하고
    // 키보드를 닫기 위해서다. blur는 동기로 처리되어 latest에 바로 반영된다.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const { size: s, invalid: bad } = latest.current;
    if (bad.w || bad.d || bad.h) return;
    const finalName = nameOrDefault(name);
    const kind = guessKindFromName(name);
    addedIdRef.current = addItem({
      name: finalName,
      w: s.w,
      d: s.d,
      h: s.h,
      ...freeSpotFor(s),
      ...(kind !== 'box' ? { kind } : {}),
    });
  };

  const anyInvalid = invalid.w || invalid.d || invalid.h;

  return (
    <div className="furniture-add-section">
      <h3 className="furniture-panel__title">가구 추가</h3>
      <div className="furniture-presets" role="group" aria-label="기본 가구">
        {FURNITURE_PRESETS.map((p) => (
          <button
            key={p.kind}
            type="button"
            className="chip furniture-presets__button"
            data-testid={`preset-${p.kind}`}
            aria-pressed={draftKind === p.kind}
            onClick={() => addPreset(p)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <form className="furniture-add" aria-label="직접 입력" onSubmit={onSubmit} noValidate>
        <h4 className="furniture-editor__subtitle">직접 입력</h4>
        <div className="furniture-field">
          <label className="furniture-field__label" htmlFor="furniture-name">
            이름
          </label>
          <input
            id="furniture-name"
            className="furniture-field__input"
            type="text"
            autoComplete="off"
            enterKeyHint="done"
            placeholder={DEFAULT_ITEM_NAME}
            value={name}
            data-testid="furniture-name"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        {SIZE_FIELDS.map(({ key, label }) => (
          <LengthInput
            key={key}
            label={label}
            valueMm={size[key]}
            unit={unit}
            min={ITEM_SIZE_MIN}
            max={ITEM_SIZE_MAX}
            testId={`furniture-${key}`}
            onCommit={(mm) => commitSize(key, mm)}
            onValidityChange={(valid) => changeValidity(key, valid)}
          />
        ))}
        <button
          type="submit"
          className="btn btn--primary furniture-add__submit"
          data-testid="furniture-add"
          disabled={anyInvalid}
        >
          <IconPlus size={18} />
          추가
        </button>
      </form>
    </div>
  );
}

function DraftCard({ draft, unit, addedIdRef }: { draft: FurnitureItem; unit: DisplayUnit; addedIdRef: MutableRefObject<string | null> }) {
  const updateDraft = useProjectStore((s) => s.updateDraft);
  const commitDraft = useProjectStore((s) => s.commitDraft);
  const cancelDraft = useProjectStore((s) => s.cancelDraft);
  const status = useItemStatuses()[draft.id];
  const [nameText, setNameText] = useState(draft.name);

  const commitName = () => {
    const next = nameOrDefault(nameText);
    setNameText(next);
    if (next !== draft.name) updateDraft({ name: next });
  };
  const confirm = () => {
    commitName();
    addedIdRef.current = commitDraft();
  };

  return (
    <section className="draft-card card" aria-label="미리보기 가구" data-testid="draft-card">
      <header className="draft-card__head">
        <span className="furniture-editor__swatch" style={{ background: draft.color }} aria-hidden="true" />
        <div className="furniture-editor__headtext">
          <p className="draft-card__hint">위치를 정한 뒤 추가를 누르세요</p>
          <p className="furniture-editor__size num">{sizeSummary(draft, unit)}</p>
        </div>
      </header>
      <StatusLines status={status} item={draft} unit={unit} testId="draft-status" />
      <div className="furniture-field">
        <label className="furniture-field__label" htmlFor="draft-name">
          이름
        </label>
        <input
          id="draft-name"
          className="furniture-field__input"
          type="text"
          autoComplete="off"
          enterKeyHint="done"
          value={nameText}
          data-testid="draft-name"
          onChange={(e) => setNameText(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName();
          }}
        />
      </div>
      {SIZE_FIELDS.map(({ key, label }) => (
        <LengthInput
          key={key}
          label={label}
          valueMm={draft[key]}
          unit={unit}
          min={ITEM_SIZE_MIN}
          max={ITEM_SIZE_MAX}
          testId={`draft-${key}`}
          onCommit={(mm) => updateDraft({ [key]: mm })}
        />
      ))}
      <div className="draft-card__actions">
        <button type="button" className="btn btn--primary" data-testid="draft-card-confirm" onClick={confirm}>
          <IconCheck size={18} />
          추가
        </button>
        <button type="button" className="btn" data-testid="draft-card-cancel" onClick={cancelDraft}>
          <IconClose size={18} />
          취소
        </button>
      </div>
    </section>
  );
}

/** 회전 각도 칸(2026-11-19 QA 5-6): 0 ~ 359 정수 도, 위에서 볼 때 반시계가 양수. */
function AngleInput({ deg, onCommit }: { deg: number; onCommit(deg: number): void }) {
  const [text, setText] = useState(String(deg));
  const [error, setError] = useState(false);
  const commit = () => {
    const t = text.trim().replace(/°$/, '');
    const n = /^-?\d+$/.test(t) ? Number(t) : NaN;
    if (!Number.isInteger(n) || n < 0 || n > 359) {
      setError(true);
      return;
    }
    setError(false);
    if (n !== deg) onCommit(n);
  };
  return (
    <div className="length-input">
      <label className="length-input__label" htmlFor="item-angle">
        회전 (반시계, 도)
      </label>
      <div className="length-input__box" data-invalid={error}>
        <input
          id="item-angle"
          className="length-input__field"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="done"
          value={text}
          aria-invalid={error}
          aria-describedby={error ? 'item-angle-error' : undefined}
          data-testid="item-angle"
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
          }}
        />
        <span className="length-input__unit">°</span>
      </div>
      <div className="length-input__error-line">
        {error && (
          <p id="item-angle-error" className="length-input__error" role="alert" data-testid="item-angle-error">
            0부터 359까지의 정수로 넣어 주세요. 예: 45
          </p>
        )}
      </div>
    </div>
  );
}

const SIDE_NAMES = ['위쪽', '오른쪽', '아래쪽', '왼쪽'] as const;

/** 가구 둘레의 틈이 통로로 쓰기에 좁으면(0 < 틈 < 600 mm) 알린다(2026-11-19 QA 5-5). 막지 않는다. */
function WalkwayNote({ item, unit }: { item: FurnitureItem; unit: DisplayUnit }) {
  const room = useProjectStore((s) => s.project.room);
  const items = useProjectStore((s) => s.project.items);
  const preview = useProjectStore((s) => s.dragPreview);
  const narrow = useMemo(() => {
    const others = items.filter((it) => it.id !== item.id).map((it) => currentFootprint(it, preview));
    return narrowSides(clearances(currentFootprint(item, preview), roomBounds(room), wallRects(room), others));
  }, [item, items, room, preview]);
  if (narrow.length === 0) return null;
  return (
    <p className="furniture-editor__walkway" role="status" data-testid="item-walkway">
      통로가 좁아요({formatLength(WALKWAY_MIN_MM, unit)} {UNIT_LABEL[unit]}보다 좁음):{' '}
      {narrow.map((n) => `${SIDE_NAMES[n.side]} ${formatLength(n.gap, unit)} ${UNIT_LABEL[unit]}`).join(', ')}
    </p>
  );
}

/** 여러 가구를 함께 골랐을 때의 카드(2026-11-19 QA 5-6): 몇 개인지, 함께 지우기, 선택 풀기. */
function GroupCard({ count }: { count: number }) {
  const removeItems = useProjectStore((s) => s.removeItems);
  const selectItem = useProjectStore((s) => s.selectItem);
  const ids = () => {
    const s = useProjectStore.getState();
    return s.selectedItemId === null ? [] : [s.selectedItemId, ...s.extraSelectedIds];
  };
  return (
    <section className="furniture-group card" aria-label="함께 고른 가구" data-testid="group-card">
      <p className="furniture-group__count">
        가구 <strong className="num" data-testid="group-count">{count}</strong>개를 함께 골랐어요. 하나를 끌거나 방향키를 누르면 함께 움직여요.
      </p>
      <div className="furniture-group__actions">
        <button type="button" className="btn btn--danger" data-testid="group-delete" onClick={() => removeItems(ids())}>
          함께 지우기
        </button>
        <button type="button" className="btn btn--quiet" data-testid="group-clear" onClick={() => selectItem(null)}>
          선택 풀기
        </button>
      </div>
    </section>
  );
}

interface ItemListProps {
  items: FurnitureItem[];
  selectedItemId: string | null;
  statuses: Record<string, ItemStatus>;
  unit: DisplayUnit;
}

function ItemList({ items, selectedItemId, statuses, unit }: ItemListProps) {
  const selectItem = useProjectStore((s) => s.selectItem);
  const toggle = useProjectStore((s) => s.toggleItemSelection);
  const extra = useProjectStore((s) => s.extraSelectedIds);
  const multi = useProjectStore((s) => s.multiSelect);
  const setMulti = useProjectStore((s) => s.setMultiSelect);
  if (items.length === 0) return <p className="furniture-panel__empty">아직 가구가 없습니다.</p>;
  return (
    <>
      {items.length > 1 && (
        <div className="furniture-multi">
          <button type="button" className="chip" data-testid="multi-select-toggle" aria-pressed={multi} onClick={() => setMulti(!multi)}>
            여러 개 고르기
          </button>
          <span className="furniture-multi__hint">{multi ? '누르는 가구마다 선택에 더하거나 뺍니다.' : 'Shift나 Ctrl을 누른 채 눌러도 됩니다.'}</span>
        </div>
      )}
      <ItemRows items={items} selectedItemId={selectedItemId} extra={extra} statuses={statuses} unit={unit} onPick={(id, additive) => (additive || multi ? toggle(id) : selectItem(id))} />
    </>
  );
}

function ItemRows({
  items,
  selectedItemId,
  extra,
  statuses,
  unit,
  onPick,
}: ItemListProps & { extra: string[]; onPick(id: string, additive: boolean): void }) {
  return (
    <ul className="furniture-list" aria-label="가구 목록">
      {items.map((it) => {
        const st = statuses[it.id];
        const warn = hasWarning(st);
        return (
          <li key={it.id}>
            <button
              type="button"
              className="furniture-list__row"
              aria-pressed={it.id === selectedItemId || extra.includes(it.id)}
              data-testid="item-row"
              data-item-id={it.id}
              data-warning={warn}
              onClick={(e) => onPick(it.id, e.shiftKey || e.ctrlKey || e.metaKey)}
            >
              <span className="furniture-list__swatch" style={{ background: it.color }} aria-hidden="true" />
              <span className="furniture-list__name">
                {it.name}
                {it.kind && it.kind !== 'box' && KIND_LABEL[it.kind] !== it.name && (
                  <small className="furniture-list__kind"> {KIND_LABEL[it.kind]}</small>
                )}
              </span>
              <span className="furniture-list__size num">{sizeSummary(it, unit)}</span>
              {warn && <span className="furniture-list__warn">경고</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

interface ItemEditorProps {
  item: FurnitureItem;
  unit: DisplayUnit;
  status: ItemStatus | undefined;
}

function ItemEditor({ item, unit, status }: ItemEditorProps) {
  const updateItem = useProjectStore((s) => s.updateItem);
  const removeItem = useProjectStore((s) => s.removeItem);
  const [nameText, setNameText] = useState(item.name);

  const commitName = () => {
    const next = nameOrDefault(nameText);
    setNameText(next);
    if (next !== item.name) updateItem(item.id, { name: next });
  };

  const distances = useSelectedWallDistances() ?? [0, 0, 0, 0];
  const u = UNIT_LABEL[unit];

  return (
    <section className="furniture-editor card" aria-label="선택한 가구">
      <header className="furniture-editor__head">
        <span className="furniture-editor__swatch" style={{ background: item.color }} aria-hidden="true" />
        <div className="furniture-editor__headtext">
          <h3 className="furniture-editor__name">{item.name}</h3>
          <p className="furniture-editor__size num">{sizeSummary(item, unit)}</p>
        </div>
      </header>

      <div className="furniture-editor__actions">
        <button type="button" className="icon-btn" data-testid="item-duplicate" aria-label="복제" title="복제" onClick={() => duplicateItem(item)}>
          <IconDuplicate />
        </button>
        <button
          type="button"
          className="icon-btn"
          data-testid="item-rotate"
          aria-label="왼쪽으로 90° 돌리기"
          title="왼쪽으로 90° 돌리기"
          onClick={() => updateItem(item.id, { rotationDeg: nextRotation(item.rotationDeg) })}
        >
          <IconRotateLeft />
        </button>
        <button
          type="button"
          className="icon-btn"
          data-testid="item-rotate-right"
          aria-label="오른쪽으로 90° 돌리기"
          title="오른쪽으로 90° 돌리기"
          onClick={() => updateItem(item.id, { rotationDeg: item.rotationDeg - ROTATE_STEP_DEG })}
        >
          <IconRotateRight />
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--danger furniture-editor__delete"
          data-testid="item-delete"
          aria-label="삭제"
          title="삭제"
          onClick={() => removeItem(item.id)}
        >
          <IconTrash />
        </button>
      </div>

      <StatusLines status={status} item={item} unit={unit} testId="item-status" />
      {status?.outside && (
        <button
          type="button"
          className="btn furniture-editor__bring"
          data-testid="item-bring-inside"
          onClick={() => updateItem(item.id, bringInsideCenter(item, roomBounds(useProjectStore.getState().project.room)), { merge: false })}
        >
          방 안으로 가져오기
        </button>
      )}
      <WalkwayNote item={item} unit={unit} />

      <div className="furniture-editor__fields">
        <div className="furniture-field">
          <label className="furniture-field__label" htmlFor="item-name">
            이름
          </label>
          <input
            id="item-name"
            className="furniture-field__input"
            type="text"
            autoComplete="off"
            enterKeyHint="done"
            value={nameText}
            data-testid="item-name"
            onChange={(e) => setNameText(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
            }}
          />
        </div>
        <div className="furniture-field">
          <label className="furniture-field__label" htmlFor="item-kind">
            종류
          </label>
          <select
            id="item-kind"
            className="furniture-field__input"
            value={item.kind ?? 'box'}
            data-testid="item-kind"
            onChange={(e) => updateItem(item.id, { kind: e.target.value as FurnitureKind })}
          >
            <option value="box">{KIND_LABEL.box}</option>
            {FURNITURE_PRESETS.map((p) => (
              <option key={p.kind} value={p.kind}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        {/* 선택이 바뀌면 사라지는 칸이므로 onValidityChange를 넘기지 않는다(T-002b) */}
        {SIZE_FIELDS.map(({ key, label }) => (
          <LengthInput
            key={key}
            label={label}
            valueMm={item[key]}
            unit={unit}
            min={ITEM_SIZE_MIN}
            max={ITEM_SIZE_MAX}
            testId={`item-${key}`}
            onCommit={(mm) => updateItem(item.id, { [key]: mm })}
          />
        ))}
        <div className="furniture-field">
          <label className="furniture-field__label" htmlFor="item-color">
            색
          </label>
          <input
            id="item-color"
            className="furniture-field__color"
            type="color"
            value={item.color}
            data-testid="item-color"
            onChange={(e) => updateItem(item.id, { color: e.target.value })}
          />
        </div>
      </div>

      <h4 className="furniture-editor__subtitle">위치와 방향</h4>
      <div className="furniture-editor__fields">
        {/* 중심 위치를 숫자로(2026-11-19 QA 4-4). 왼쪽 벽·위쪽 벽에서 가구 중심까지. */}
        <LengthInput
          label="가로 위치 (왼쪽 벽 → 중심)"
          valueMm={item.x}
          unit={unit}
          min={0}
          max={ROOM_SIDE_MAX}
          testId="item-x"
          onCommit={(mm) => updateItem(item.id, { x: mm }, { merge: false })}
        />
        <LengthInput
          label="세로 위치 (위쪽 벽 → 중심)"
          valueMm={item.z}
          unit={unit}
          min={0}
          max={ROOM_SIDE_MAX}
          testId="item-z"
          onCommit={(mm) => updateItem(item.id, { z: mm }, { merge: false })}
        />
        <AngleInput key={item.rotationDeg} deg={item.rotationDeg} onCommit={(deg) => updateItem(item.id, { rotationDeg: deg })} />
      </div>

      <h4 className="furniture-editor__subtitle">벽까지 거리</h4>
      <dl className="furniture-distances">
        {distances.map((mm, i) => (
          <div key={i} className="furniture-distances__row">
            <dt>{WALL_LABELS[i]}</dt>
            <dd className="num">
              <span data-testid={`item-dist-${i}`}>{formatLength(mm, unit)}</span> {u}
            </dd>
          </div>
        ))}
      </dl>

      <p className="furniture-editor__hint" data-testid="item-nudge-hint">
        방향키로 1 cm, Shift+방향키로 1 mm 이동
      </p>
    </section>
  );
}
