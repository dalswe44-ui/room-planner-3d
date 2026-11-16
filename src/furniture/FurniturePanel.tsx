// 가구 추가 폼, 가구 목록, 선택한 가구의 수정·회전·삭제와 벽까지 거리. store를 직접 읽고 쓴다.
import { useEffect, useRef, useState, type FormEvent, type MutableRefObject } from 'react';
import { roomBounds } from '../contracts/room';
import { FURNITURE_PRESETS, guessKindFromName, KIND_LABEL, type FurniturePreset } from '../contracts/furniturePresets';
import { DEFAULT_ITEM_NAME, ITEM_SIZE_MAX, ITEM_SIZE_MIN } from '../contracts/limits';
import type { DisplayUnit, FurnitureItem, FurnitureKind, ItemStatus, Mm } from '../contracts/types';
import { formatLength, UNIT_LABEL } from '../contracts/units';
import { useProjectStore } from '../store/projectStore';
import { LengthInput } from '../ui/LengthInput';
import { currentFootprint, findFreeSpot, footprint, nextRotation, wallDistances } from './placement';
import { useItemStatuses } from './useItemStatuses';
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

/** 벽 번호와 평면 뷰(원점 왼쪽 위, +z 아래)에서의 위치 */
const WALL_LABELS = ['위쪽 벽 (벽 0)', '오른쪽 벽 (벽 1)', '아래쪽 벽 (벽 2)', '왼쪽 벽 (벽 3)'] as const;

/** 새 가구를 놓을 빈 자리. 방과 다른 가구는 누른 순간의 store에서 읽는다. */
function freeSpotFor(size: Pick<FurnitureItem, 'w' | 'd'>) {
  const { project } = useProjectStore.getState();
  return findFreeSpot(
    size,
    roomBounds(project.room),
    project.items.map((it) => footprint(it)),
  );
}

function nameOrDefault(text: string): string {
  return text.trim() || DEFAULT_ITEM_NAME;
}

export function FurniturePanel() {
  const unit = useProjectStore((s) => s.project.displayUnit);
  const items = useProjectStore((s) => s.project.items);
  const selectedItemId = useProjectStore((s) => s.selectedItemId);
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
      <ItemList items={items} selectedItemId={selectedItemId} statuses={statuses} unit={unit} />
      {selected && <ItemEditor key={selected.id} item={selected} unit={unit} status={statuses[selected.id]} />}
    </div>
  );
}

function AddForm({ unit, addedIdRef }: { unit: DisplayUnit; addedIdRef: MutableRefObject<string | null> }) {
  const addItem = useProjectStore((s) => s.addItem);
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

  // 기본 가구는 바로 빈 자리에 추가하고 선택한다. 치수는 추가한 뒤 편집 칸에서 고친다. 직접 입력 폼과는 따로 동작한다.
  const addPreset = (p: FurniturePreset) => {
    addedIdRef.current = addItem({ name: p.label, kind: p.kind, w: p.w, d: p.d, h: p.h, ...freeSpotFor(p) });
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
            className="furniture-button furniture-presets__button"
            data-testid={`preset-${p.kind}`}
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
          className="furniture-button furniture-button--primary"
          data-testid="furniture-add"
          disabled={anyInvalid}
        >
          추가
        </button>
      </form>
    </div>
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
  if (items.length === 0) return <p className="furniture-panel__empty">아직 가구가 없습니다.</p>;
  const u = UNIT_LABEL[unit];
  return (
    <ul className="furniture-list" aria-label="가구 목록">
      {items.map((it) => {
        const st = statuses[it.id];
        const warn = st !== undefined && (st.overlap || st.outside);
        return (
          <li key={it.id}>
            <button
              type="button"
              className="furniture-list__row"
              aria-pressed={it.id === selectedItemId}
              data-testid="item-row"
              data-item-id={it.id}
              data-warning={warn}
              onClick={() => selectItem(it.id)}
            >
              <span className="furniture-list__swatch" style={{ background: it.color }} aria-hidden="true" />
              <span className="furniture-list__name">
                {it.name}
                {it.kind && it.kind !== 'box' && KIND_LABEL[it.kind] !== it.name && (
                  <small className="furniture-list__kind"> {KIND_LABEL[it.kind]}</small>
                )}
              </span>
              <span className="furniture-list__size">
                {formatLength(it.w, unit)} × {formatLength(it.d, unit)} × {formatLength(it.h, unit)} {u}
              </span>
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
  const corners = useProjectStore((s) => s.project.room.corners);
  const preview = useProjectStore((s) => s.dragPreview);
  const [nameText, setNameText] = useState(item.name);

  const commitName = () => {
    const next = nameOrDefault(nameText);
    setNameText(next);
    if (next !== item.name) updateItem(item.id, { name: next });
  };

  const distances = wallDistances(currentFootprint(item, preview), roomBounds({ corners }));
  const u = UNIT_LABEL[unit];

  return (
    <section className="furniture-editor" aria-label="선택한 가구">
      <h3 className="furniture-panel__title">선택한 가구</h3>
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

      {status && (status.overlap || status.outside) && (
        <p className="furniture-editor__status" role="status" data-testid="item-status">
          {status.overlap && <span>겹침: 다른 가구와 겹칩니다.</span>}
          {status.outside && <span>방 밖: 방 경계를 벗어났습니다.</span>}
        </p>
      )}

      <p className="furniture-editor__hint" data-testid="item-nudge-hint">
        방향키로 1 cm, Shift+방향키로 1 mm 이동
      </p>

      <h4 className="furniture-editor__subtitle">벽까지 거리 (평면 뷰 기준)</h4>
      <dl className="furniture-distances">
        {distances.map((mm, i) => (
          <div key={i} className="furniture-distances__row">
            <dt>{WALL_LABELS[i]}</dt>
            <dd>
              <span data-testid={`item-dist-${i}`}>{formatLength(mm, unit)}</span> {u}
            </dd>
          </div>
        ))}
      </dl>

      <div className="furniture-editor__actions">
        <button
          type="button"
          className="furniture-button"
          data-testid="item-rotate"
          onClick={() => updateItem(item.id, { rotationDeg: nextRotation(item.rotationDeg) })}
        >
          90° 회전
        </button>
        <button
          type="button"
          className="furniture-button furniture-button--danger"
          data-testid="item-delete"
          onClick={() => removeItem(item.id)}
        >
          삭제
        </button>
      </div>
    </section>
  );
}
