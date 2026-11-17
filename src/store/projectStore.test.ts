import { beforeEach, describe, expect, it } from 'vitest';
import { roomBounds } from '../contracts/room';
import { createDefaultProject, straightenWall, useProjectStore } from './projectStore';

const store = () => useProjectStore.getState();

beforeEach(() => {
  useProjectStore.setState({
    project: createDefaultProject(),
    selectedItemId: null,
    viewMode: '2d',
    dragPreview: null,
  });
});

describe('projectStore', () => {
  it('기본 방은 3600 × 3000 × 2400 mm 직사각형이다', () => {
    const { room } = store().project;
    expect(roomBounds(room)).toMatchObject({ width: 3600, depth: 3000 });
    expect(room.ceilingHeight).toBe(2400);
    expect(room.corners).toHaveLength(4);
  });

  it('setRoomSize는 corners를 다시 만들고 정수 mm로 저장한다', () => {
    store().setRoomSize({ width: 4200.4, depth: 2800.6, ceilingHeight: 2300 });
    const { room } = store().project;
    expect(roomBounds(room)).toMatchObject({ width: 4200, depth: 2801 });
    expect(room.ceilingHeight).toBe(2300);
  });

  it('단위 전환은 저장된 mm 값을 바꾸지 않는다', () => {
    const before = JSON.stringify(store().project.room);
    store().setDisplayUnit('m');
    expect(store().project.displayUnit).toBe('m');
    expect(JSON.stringify(store().project.room)).toBe(before);
  });

  it('addItem은 위치를 주지 않으면 방 가운데에 놓고 선택한다', () => {
    const id = store().addItem({ name: '침대', w: 1500, d: 2000, h: 450 });
    const item = store().project.items[0];
    expect(item).toMatchObject({ id, x: 1800, z: 1500, rotationDeg: 0, elevation: 0 });
    expect(store().selectedItemId).toBe(id);
  });

  it('updateItem은 길이를 정수 mm로, 회전을 0 이상 360 미만 정수로 맞춘다', () => {
    const id = store().addItem({ name: '책상', w: 1200, d: 600, h: 720 });
    store().updateItem(id, { x: 600.4, z: 300.6, rotationDeg: -90 });
    expect(store().project.items[0]).toMatchObject({ x: 600, z: 301, rotationDeg: 270 });
    store().updateItem(id, { rotationDeg: 450 });
    expect(store().project.items[0].rotationDeg).toBe(90);
  });

  it('removeItem은 선택과 끌기 상태도 함께 지운다', () => {
    const id = store().addItem({ name: '의자', w: 450, d: 450, h: 800 });
    store().setDragPreview({ itemId: id, x: 10, z: 10 });
    store().removeItem(id);
    expect(store().project.items).toHaveLength(0);
    expect(store().selectedItemId).toBeNull();
    expect(store().dragPreview).toBeNull();
  });

  it('replaceProject는 프로젝트를 통째로 바꾸고 선택을 지운다', () => {
    const id = store().addItem({ name: '의자', w: 450, d: 450, h: 800 });
    expect(store().selectedItemId).toBe(id);
    const next = createDefaultProject();
    next.displayUnit = 'cm';
    store().replaceProject(next);
    expect(store().project.displayUnit).toBe('cm');
    expect(store().project.items).toHaveLength(0);
    expect(store().selectedItemId).toBeNull();
  });
});

describe('되돌리기', () => {
  const st = () => useProjectStore.getState();
  beforeEach(() => {
    useProjectStore.setState({ project: createDefaultProject(), selectedItemId: null, dragPreview: null, past: [], future: [] });
  });

  it('추가·이동·삭제를 차례로 되돌리고 다시 실행한다', () => {
    const id = st().addItem({ name: 'A', w: 1000, d: 600, h: 700 });
    st().updateItem(id, { x: 500 });
    st().removeItem(id);
    expect(st().project.items).toHaveLength(0);
    st().undo();
    expect(st().project.items[0]).toMatchObject({ id, x: 500 });
    st().undo();
    expect(st().project.items[0].x).toBe(1800);
    st().undo();
    expect(st().project.items).toHaveLength(0);
    st().undo();
    expect(st().project.items).toHaveLength(0);
    st().redo();
    st().redo();
    expect(st().project.items[0].x).toBe(500);
  });

  it('같은 가구의 연속 이동은 한 단계로 묶인다', () => {
    const id = st().addItem({ name: 'A', w: 1000, d: 600, h: 700 });
    for (let i = 1; i <= 5; i += 1) st().updateItem(id, { x: 1800 + i * 10 });
    expect(st().project.items[0].x).toBe(1850);
    st().undo();
    expect(st().project.items[0].x).toBe(1800);
  });

  it('새 변경을 하면 다시 실행 목록이 비고, 되돌린 상태에 없는 가구의 선택은 풀린다', () => {
    const id = st().addItem({ name: 'A', w: 1000, d: 600, h: 700 });
    expect(st().selectedItemId).toBe(id);
    st().undo();
    expect(st().selectedItemId).toBeNull();
    st().setRoomSize({ width: 4000, depth: 3000, ceilingHeight: 2400 });
    expect(st().future).toHaveLength(0);
  });

  it('표시 단위·선택·뷰 전환은 기록하지 않는다', () => {
    st().setDisplayUnit('cm');
    st().setViewMode('3d');
    st().selectItem(null);
    expect(st().past).toHaveLength(0);
  });
});

describe('미리보기 가구 (draft)', () => {
  const st = () => useProjectStore.getState();
  beforeEach(() => {
    useProjectStore.setState({ project: createDefaultProject(), selectedItemId: null, dragPreview: null, draft: null, past: [], future: [] });
  });

  it('미리보기는 프로젝트와 기록에 들어가지 않고, 새 미리보기가 이전 것을 바꾼다', () => {
    st().startDraft({ name: '소파', w: 1800, d: 850, h: 800, kind: 'sofa' });
    expect(st().draft).toMatchObject({ name: '소파', kind: 'sofa', x: 1800, z: 1500 });
    st().startDraft({ name: '침대', w: 1100, d: 2000, h: 450, kind: 'bed' });
    expect(st().draft).toMatchObject({ name: '침대', kind: 'bed' });
    expect(st().project.items).toHaveLength(0);
    expect(st().past).toHaveLength(0);
  });

  it('확정하면 한 단계로 들어가 선택되고, 되돌리면 사라진다', () => {
    st().startDraft({ name: '침대', w: 1100, d: 2000, h: 450, kind: 'bed' });
    st().updateDraft({ x: 600, rotationDeg: 90 });
    const id = st().commitDraft();
    expect(st().draft).toBeNull();
    expect(st().project.items).toEqual([expect.objectContaining({ id, x: 600, rotationDeg: 90, kind: 'bed' })]);
    expect(st().selectedItemId).toBe(id);
    expect(st().past).toHaveLength(1);
    st().undo();
    expect(st().project.items).toHaveLength(0);
  });

  it('취소하면 아무것도 남지 않는다. 미리보기가 없으면 확정은 null', () => {
    st().startDraft({ name: '의자', w: 450, d: 500, h: 850 });
    st().cancelDraft();
    expect(st().draft).toBeNull();
    expect(st().project.items).toHaveLength(0);
    expect(st().commitDraft()).toBeNull();
  });

  it('다른 가구를 고르면 미리보기는 버려지고, 미리보기를 만들면 선택이 풀린다', () => {
    const a = st().addItem({ name: 'A', w: 100, d: 100, h: 100 });
    st().startDraft({ name: '의자', w: 450, d: 500, h: 850 });
    expect(st().selectedItemId).toBeNull();
    st().selectItem(a);
    expect(st().draft).toBeNull();
  });
});

describe('칸막이 벽·문·이름표', () => {
  const st = () => useProjectStore.getState();
  beforeEach(() => {
    useProjectStore.setState({ project: createDefaultProject(), selectedItemId: null, selectedStructure: null, dragPreview: null, draft: null, editMode: 'furniture', past: [], future: [] });
  });

  it('벽은 가로·세로로 곧게 펴서 넣고, 길이 0이면 넣지 않는다', () => {
    expect(straightenWall({ x: 0, z: 0 }, { x: 1000, z: 120 })).toEqual({ a: { x: 0, z: 0 }, b: { x: 1000, z: 0 } });
    expect(straightenWall({ x: 500, z: 0 }, { x: 560, z: 2000 })).toEqual({ a: { x: 500, z: 0 }, b: { x: 500, z: 2000 } });
    expect(st().addWall({ a: { x: 1, z: 1 }, b: { x: 1, z: 1 } })).toBeNull();
    const id = st().addWall({ a: { x: 1800, z: 0 }, b: { x: 1810.4, z: 1500.6 } })!;
    expect(st().project.room.walls).toEqual([{ id, a: { x: 1800, z: 0 }, b: { x: 1800, z: 1501 }, thickness: 100 }]);
    expect(st().selectedStructure).toEqual({ kind: 'wall', id });
    expect(st().past).toHaveLength(1);
  });

  it('벽을 지우면 그 벽의 문도 지우고, 되돌리면 둘 다 돌아온다', () => {
    const w = st().addWall({ a: { x: 1800, z: 0 }, b: { x: 1800, z: 3000 } })!;
    const d = st().addOpening({ type: 'door', wall: w, offset: 1000 });
    const o = st().addOpening({ type: 'window', wall: 0, offset: 500 });
    expect(st().project.room.openings.find((x) => x.id === d)).toMatchObject({ width: 900, height: 2100, sill: 0, hinge: 'start', swing: 'normal' });
    expect(st().project.room.openings.find((x) => x.id === o)).toMatchObject({ width: 1200, sill: 900 });
    expect(st().project.room.openings.find((x) => x.id === o)).not.toHaveProperty('hinge');
    st().removeWall(w);
    expect(st().project.room.walls).toHaveLength(0);
    expect(st().project.room.openings.map((x) => x.id)).toEqual([o]);
    st().undo();
    expect(st().project.room.walls).toHaveLength(1);
    expect(st().project.room.openings).toHaveLength(2);
  });

  it('문을 벽 따라 연달아 옮기면 한 단계로 묶인다', () => {
    const d = st().addOpening({ type: 'door', wall: 1, offset: 100 });
    for (let i = 1; i <= 5; i += 1) st().updateOpening(d, { offset: 100 + i * 10 });
    expect(st().project.room.openings[0].offset).toBe(150);
    st().undo();
    expect(st().project.room.openings[0].offset).toBe(100);
  });

  it('이름표는 이름이 비면 "구역", 위치는 정수 mm', () => {
    const l = st().addLabel({ name: '  ', at: { x: 900.6, z: 700.2 } });
    expect(st().project.room.labels).toEqual([{ id: l, name: '구역', at: { x: 901, z: 700 } }]);
    st().updateLabel(l, { name: '거실' });
    expect(st().project.room.labels[0].name).toBe('거실');
  });

  it('구조물을 고르면 가구 선택·미리보기가 풀리고, 가구를 고르면 구조물 선택이 풀린다', () => {
    const a = st().addItem({ name: 'A', w: 100, d: 100, h: 100 });
    const w = st().addWall({ a: { x: 0, z: 1500 }, b: { x: 1000, z: 1500 } })!;
    expect(st().selectedItemId).toBeNull();
    st().startDraft({ name: '의자', w: 450, d: 500, h: 850 });
    expect(st().selectedStructure).toBeNull();
    st().selectStructure({ kind: 'wall', id: w });
    expect(st().draft).toBeNull();
    st().selectItem(a);
    expect(st().selectedStructure).toBeNull();
  });

  it('편집 모드를 바꾸면 구조물 선택이 풀리고, 되돌린 상태에 없는 구조물 선택도 풀린다', () => {
    const w = st().addWall({ a: { x: 0, z: 1500 }, b: { x: 1000, z: 1500 } })!;
    st().undo();
    expect(st().selectedStructure).toBeNull();
    st().redo();
    st().selectStructure({ kind: 'wall', id: w });
    st().setEditMode('structure');
    expect(st().editMode).toBe('structure');
    expect(st().selectedStructure).toBeNull();
  });
});
