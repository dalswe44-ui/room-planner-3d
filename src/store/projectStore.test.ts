import { beforeEach, describe, expect, it } from 'vitest';
import { roomBounds } from '../contracts/room';
import { createDefaultProject, useProjectStore } from './projectStore';

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
