import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject, useProjectStore } from '../store/projectStore';
import { createStructureHandlers } from './useStructureHandlers';

const store = () => useProjectStore.getState();
const walls = () => store().project.room.walls;
let h = createStructureHandlers(store);

beforeEach(() => {
  useProjectStore.setState({
    project: createDefaultProject(),
    selectedItemId: null,
    selectedStructure: null,
    wallPreview: null,
    editMode: 'structure',
    past: [],
    future: [],
  });
  h = createStructureHandlers(store);
});

function draw(from: [number, number], to: [number, number], mmPerPx?: number) {
  h.onBackgroundPointerDown({ x: from[0], z: from[1] });
  h.onPointerMove({ x: to[0], z: to[1] }, mmPerPx);
  h.onPointerUp();
}

describe('벽 그리기', () => {
  it('끄는 동안 미리보기가 곧게 펴져 보이고, 놓으면 벽이 생긴다 (WL-1)', () => {
    h.onBackgroundPointerDown({ x: 1800, z: 0 });
    h.onPointerMove({ x: 1810, z: 2000 });
    expect(store().wallPreview).toEqual({ a: { x: 1800, z: 0 }, b: { x: 1800, z: 2000 } });
    h.onPointerUp();
    expect(store().wallPreview).toBeNull();
    expect(walls()).toHaveLength(1);
    expect(walls()[0]).toMatchObject({ a: { x: 1800, z: 0 }, b: { x: 1800, z: 2000 }, thickness: 100 });
    expect(store().selectedStructure).toEqual({ kind: 'wall', id: walls()[0].id });
    store().undo();
    expect(walls()).toHaveLength(0);
  });

  it('끝점이 바깥 벽 안쪽 면에 붙는다(20 mm 이내, 화면 기준이면 12 px)', () => {
    draw([1803, 14], [1796, 2990]);
    expect(walls()[0]).toMatchObject({ a: { x: 1800, z: 0 }, b: { x: 1800, z: 3000 } });
    draw([500, 1000], [500, 2965], 5); // 35 mm, 12 px × 5 = 60 mm 이내
    expect(walls()[1].b).toEqual({ x: 500, z: 3000 });
  });

  it('mmPerPx 없이 20 mm 밖이면 붙지 않고 10 mm 격자로 간다', () => {
    draw([500, 1000], [500, 2965]);
    expect(walls()[0].b).toEqual({ x: 500, z: 2970 });
  });

  it('다른 칸막이 벽의 중심선과 끝점에 붙는다', () => {
    draw([1800, 0], [1800, 2000]);
    draw([1000, 1000], [1790, 1000]); // 세로 벽 중심선 x = 1800 에 붙음
    expect(walls()[1].b).toEqual({ x: 1800, z: 1000 });
    draw([300, 1500], [300, 1995]); // 끝점 z = 2000 에 붙음
    expect(walls()[2].b).toEqual({ x: 300, z: 2000 });
  });

  it('바깥 벽이 칸막이 벽보다 먼저 붙는다', () => {
    draw([1800, 0], [1800, 2000]);
    // z = 2000 근처와 z = 3000 근처 둘 다 후보가 아닌 경우: 바깥(3000)만 가까움
    draw([300, 1500], [300, 2990]);
    expect(walls()[1].b).toEqual({ x: 300, z: 3000 });
  });

  it('100 mm 미만이면 넣지 않는다', () => {
    draw([1000, 1000], [1000, 1090]);
    expect(walls()).toHaveLength(0);
    expect(store().wallPreview).toBeNull();
  });

  it('길이 100 mm는 넣는다', () => {
    draw([1000, 1000], [1000, 1100]);
    expect(walls()).toHaveLength(1);
  });

  it('누르고 움직이지 않고 떼면 아무것도 만들지 않는다', () => {
    h.onBackgroundPointerDown({ x: 1000, z: 1000 });
    h.onPointerUp();
    expect(walls()).toHaveLength(0);
  });
});

describe('벽 이동·선택', () => {
  const addVertical = () => store().addWall({ a: { x: 1800, z: 0 }, b: { x: 1800, z: 2000 } })!;

  it('칸막이 벽을 누르면 선택, 끌면 수직 방향으로만 평행 이동한다', () => {
    const id = addVertical();
    store().selectStructure(null);
    h.onTargetPointerDown({ kind: 'wall', id }, { x: 1800, z: 1000 });
    expect(store().selectedStructure).toEqual({ kind: 'wall', id });
    h.onPointerMove({ x: 2103, z: 1500 });
    h.onPointerUp();
    expect(walls()[0]).toMatchObject({ a: { x: 2100, z: 0 }, b: { x: 2100, z: 2000 } });
  });

  it('가로 벽은 z만 움직인다', () => {
    const id = store().addWall({ a: { x: 0, z: 1000 }, b: { x: 1500, z: 1000 } })!;
    h.onTargetPointerDown({ kind: 'wall', id }, { x: 700, z: 1000 });
    h.onPointerMove({ x: 900, z: 1400 });
    expect(walls()[0]).toMatchObject({ a: { x: 0, z: 1400 }, b: { x: 1500, z: 1400 } });
  });

  it('연속 이동은 되돌리기 한 단계다', () => {
    const id = addVertical();
    const before = store().past.length;
    h.onTargetPointerDown({ kind: 'wall', id }, { x: 1800, z: 1000 });
    h.onPointerMove({ x: 1900, z: 1000 });
    h.onPointerMove({ x: 2000, z: 1000 });
    h.onPointerMove({ x: 2100, z: 1000 });
    h.onPointerUp();
    expect(store().past.length).toBe(before + 1);
  });

  it('누르기만 하면 벽 데이터는 바뀌지 않고 기록도 늘지 않는다', () => {
    const id = addVertical();
    const before = store().past.length;
    h.onTargetPointerDown({ kind: 'wall', id }, { x: 1800, z: 1000 });
    h.onPointerMove({ x: 1802, z: 1000 });
    h.onPointerUp();
    expect(store().past.length).toBe(before);
  });

  it('바깥 벽: 짧게 누르면 선택만, 벽은 움직이지 않는다', () => {
    const before = store().project.room.corners;
    h.onTargetPointerDown({ kind: 'outerWall', index: 1 }, { x: 3600, z: 1000 });
    h.onPointerUp();
    expect(store().selectedStructure).toEqual({ kind: 'outerWall', index: 1 });
    expect(store().project.room.corners).toEqual(before);
    expect(walls()).toHaveLength(0);
  });

  it('바깥 벽을 누른 채 끌면 안쪽 면에서 칸막이를 그린다 (D-T037-01)', () => {
    const before = store().project.room.corners;
    // 벽 두께 위(z = -40)를 눌러도 안쪽 면 z = 0에서 시작한다
    h.onTargetPointerDown({ kind: 'outerWall', index: 0 }, { x: 1800, z: -40 });
    h.onPointerMove({ x: 1810, z: 2000 });
    h.onPointerUp();
    expect(walls()).toHaveLength(1);
    expect(walls()[0]).toMatchObject({ a: { x: 1800, z: 0 }, b: { x: 1800, z: 2000 } });
    expect(store().project.room.corners).toEqual(before);
  });
});

describe('문·창문·이름표 끌기', () => {
  const addDoor = () => store().addOpening({ type: 'door', wall: 0, offset: 1000 });

  it('문을 누르면 선택, 끌면 벽을 따라 offset이 바뀐다', () => {
    const id = addDoor();
    store().selectStructure(null);
    h.onTargetPointerDown({ kind: 'opening', id }, { x: 1450, z: 0 });
    expect(store().selectedStructure).toEqual({ kind: 'opening', id });
    h.onPointerMove({ x: 1950, z: 300 });
    expect(store().project.room.openings[0].offset).toBe(1500);
  });

  it('벽 밖으로 나가지 않는다(0 ~ 길이 − 폭)', () => {
    const id = addDoor();
    h.onTargetPointerDown({ kind: 'opening', id }, { x: 1450, z: 0 });
    h.onPointerMove({ x: -5000, z: 0 });
    expect(store().project.room.openings[0].offset).toBe(0);
    h.onPointerMove({ x: 9000, z: 0 });
    expect(store().project.room.openings[0].offset).toBe(3600 - 900);
  });

  it('10 mm 격자로 움직인다', () => {
    const id = addDoor();
    h.onTargetPointerDown({ kind: 'opening', id }, { x: 1450, z: 0 });
    h.onPointerMove({ x: 1457, z: 0 });
    expect(store().project.room.openings[0].offset).toBe(1010);
  });

  it('칸막이 벽 위의 문도 그 벽을 따라 움직인다', () => {
    const wid = store().addWall({ a: { x: 1800, z: 0 }, b: { x: 1800, z: 2000 } })!;
    const id = store().addOpening({ type: 'window', wall: wid, offset: 100 });
    h.onTargetPointerDown({ kind: 'opening', id }, { x: 1800, z: 700 });
    h.onPointerMove({ x: 1800, z: 1000 });
    expect(store().project.room.openings[0].offset).toBe(400);
  });

  it('이름표를 누르면 선택, 끌면 at이 바뀐다', () => {
    const id = store().addLabel({ name: '거실', at: { x: 900, z: 900 } });
    store().selectStructure(null);
    h.onTargetPointerDown({ kind: 'label', id }, { x: 900, z: 900 });
    expect(store().selectedStructure).toEqual({ kind: 'label', id });
    h.onPointerMove({ x: 1200, z: 1100 });
    h.onPointerUp();
    expect(store().project.room.labels[0].at).toEqual({ x: 1200, z: 1100 });
  });
});

describe('빈 곳 탭', () => {
  it('구조 선택을 해제한다', () => {
    const id = store().addLabel({ name: '거실', at: { x: 900, z: 900 } });
    expect(store().selectedStructure).toEqual({ kind: 'label', id });
    h.onBackgroundTap();
    expect(store().selectedStructure).toBeNull();
  });
});
