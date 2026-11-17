import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject, useProjectStore } from '../store/projectStore';
import { StructurePanel } from './StructurePanel';

const store = () => useProjectStore.getState();
const input = (id: string) => screen.getByTestId<HTMLInputElement>(id);
const user = () => userEvent.setup();

beforeEach(() => {
  useProjectStore.setState({ project: createDefaultProject(), selectedItemId: null, selectedStructure: null, editMode: 'structure', past: [], future: [] });
});
afterEach(cleanup);

async function enter(id: string, text: string) {
  const u = user();
  await u.clear(input(id));
  if (text !== '') await u.type(input(id), text);
  await u.keyboard('{Enter}');
}

describe('StructurePanel', () => {
  it('안내 문구와 빈 목록, 선택이 없으면 카드가 없다', () => {
    render(<StructurePanel />);
    expect(screen.getByTestId('structure-hint').textContent).toContain('평면 뷰에서 빈 곳을 끌면 벽이 생겨요');
    expect(screen.getByTestId('wall-list')).toBeTruthy();
    expect(screen.queryByTestId('wall-card')).toBeNull();
    expect(screen.queryByTestId('opening-card')).toBeNull();
  });

  it('벽 목록 행을 누르면 그 벽이 선택되고 카드가 뜬다', async () => {
    const id = store().addWall({ a: { x: 1800, z: 0 }, b: { x: 1800, z: 2000 } })!;
    store().selectStructure(null);
    render(<StructurePanel />);
    const row = screen.getByTestId('wall-row');
    expect(row.getAttribute('data-wall-id')).toBe(id);
    expect(row.textContent).toContain('2000');
    await user().click(row);
    expect(screen.getByTestId('wall-card')).toBeTruthy();
  });

  it('칸막이 벽 카드: 길이·두께·위치를 고친다', async () => {
    store().addWall({ a: { x: 1800, z: 0 }, b: { x: 1800, z: 2000 } });
    render(<StructurePanel />);
    await enter('wall-length', '1500');
    expect(store().project.room.walls[0]).toMatchObject({ a: { x: 1800, z: 0 }, b: { x: 1800, z: 1500 } });
    await enter('wall-position', '2000');
    expect(store().project.room.walls[0]).toMatchObject({ a: { x: 2000, z: 0 }, b: { x: 2000, z: 1500 } });
    await enter('wall-thickness', '150');
    expect(store().project.room.walls[0].thickness).toBe(150);
  });

  it('위치 칸의 이름: 가로 벽은 위쪽 벽에서, 세로 벽은 왼쪽 벽에서', () => {
    store().addWall({ a: { x: 0, z: 1000 }, b: { x: 1500, z: 1000 } });
    render(<StructurePanel />);
    expect(screen.getByLabelText('위쪽 벽에서 거리')).toBe(input('wall-position'));
    expect(input('wall-position').value).toBe('1000');
  });

  it('두께 범위(50 ~ 300)와 길이 0, 글자, 음수, 단위 혼용은 거부한다', async () => {
    store().addWall({ a: { x: 1800, z: 0 }, b: { x: 1800, z: 2000 } });
    render(<StructurePanel />);
    for (const bad of ['10', '400', '0', 'abc', '-100', '', '1.5.2m']) {
      await enter('wall-thickness', bad);
      expect(store().project.room.walls[0].thickness).toBe(100);
      expect(screen.getByTestId('wall-thickness-error')).toBeTruthy();
    }
    for (const bad of ['0', '50', '-3', '글자', '']) {
      await enter('wall-length', bad);
      expect(store().project.room.walls[0].b).toEqual({ x: 1800, z: 2000 });
    }
  });

  it('단위가 cm이면 숫자가 cm로 보인다', () => {
    store().setDisplayUnit('cm');
    store().addWall({ a: { x: 1800, z: 0 }, b: { x: 1800, z: 2000 } });
    render(<StructurePanel />);
    expect(input('wall-length').value).toBe('200.0');
  });

  it('문 추가 → 벽 가운데에 폭 900으로 생기고 선택된다, 카드에서 토글·삭제', async () => {
    const u = user();
    store().selectStructure({ kind: 'outerWall', index: 0 });
    render(<StructurePanel />);
    expect(screen.getByTestId('outer-wall-card').textContent).toContain('위쪽 벽');
    await u.click(screen.getByTestId('wall-add-door'));
    expect(store().project.room.openings[0]).toMatchObject({ type: 'door', wall: 0, offset: 1350, width: 900, hinge: 'start', swing: 'normal' });
    expect(screen.getByTestId('opening-card')).toBeTruthy();
    expect(screen.queryByTestId('opening-sill')).toBeNull();
    expect(screen.queryByTestId('opening-fit-warning')).toBeNull();
    await u.click(screen.getByTestId('opening-flip-hinge'));
    expect(store().project.room.openings[0].hinge).toBe('end');
    await u.click(screen.getByTestId('opening-flip-swing'));
    expect(store().project.room.openings[0].swing).toBe('opposite');
    await u.click(screen.getByTestId('opening-flip-hinge'));
    expect(store().project.room.openings[0].hinge).toBe('start');
    await u.click(screen.getByTestId('opening-delete'));
    expect(store().project.room.openings).toHaveLength(0);
    expect(screen.queryByTestId('opening-card')).toBeNull();
  });

  it('짧은 벽에는 폭을 줄여 맞춘다', async () => {
    const wid = store().addWall({ a: { x: 1000, z: 500 }, b: { x: 1000, z: 1300 } })!;
    render(<StructurePanel />);
    await user().click(screen.getByTestId('wall-add-door'));
    expect(store().project.room.openings[0]).toMatchObject({ wall: wid, width: 800, offset: 0 });
  });

  it('창문 추가: 문턱 높이 칸이 있고 경첩 버튼은 없다', async () => {
    store().selectStructure({ kind: 'outerWall', index: 2 });
    render(<StructurePanel />);
    await user().click(screen.getByTestId('wall-add-window'));
    expect(store().project.room.openings[0]).toMatchObject({ type: 'window', width: 1200, sill: 900, height: 1200 });
    expect(input('opening-sill').value).toBe('900');
    expect(screen.queryByTestId('opening-flip-hinge')).toBeNull();
    await enter('opening-sill', '1000');
    expect(store().project.room.openings[0].sill).toBe(1000);
  });

  it('벽 길이를 넘으면 경고가 뜬다, offset 이름은 벽 방향에 따른다', async () => {
    const id = store().addOpening({ type: 'door', wall: 1, offset: 100 });
    render(<StructurePanel />);
    expect(screen.getByLabelText('위쪽 끝에서')).toBe(input('opening-offset'));
    await enter('opening-offset', '2500');
    expect(store().project.room.openings[0].id).toBe(id);
    expect(screen.getByTestId('opening-fit-warning')).toBeTruthy();
    await enter('opening-width', '0');
    expect(store().project.room.openings[0].width).toBe(900);
  });

  it('종류를 바꾼다', async () => {
    store().addOpening({ type: 'door', wall: 0, offset: 100 });
    render(<StructurePanel />);
    await user().selectOptions(screen.getByTestId('opening-type'), 'window');
    expect(store().project.room.openings[0]).toMatchObject({ type: 'window', sill: 900 });
    expect(screen.getByTestId('opening-sill')).toBeTruthy();
  });

  it('칸막이 벽 삭제는 붙은 문도 지운다', async () => {
    const wid = store().addWall({ a: { x: 1800, z: 0 }, b: { x: 1800, z: 2000 } })!;
    store().addOpening({ type: 'door', wall: wid, offset: 100 });
    store().selectStructure({ kind: 'wall', id: wid });
    render(<StructurePanel />);
    await user().click(screen.getByTestId('wall-delete'));
    expect(store().project.room.walls).toHaveLength(0);
    expect(store().project.room.openings).toHaveLength(0);
    expect(screen.queryByTestId('wall-card')).toBeNull();
  });

  it('구역 이름 추가: "구역"으로 생기고 이름 칸에 포커스, 이름 변경·삭제', async () => {
    const u = user();
    render(<StructurePanel />);
    await u.click(screen.getByTestId('label-add'));
    expect(store().project.room.labels[0]).toMatchObject({ name: '구역', at: { x: 1800, z: 1500 } });
    const name = input('label-name');
    expect(document.activeElement).toBe(name);
    await u.clear(name);
    await u.type(name, '거실');
    await u.keyboard('{Enter}');
    expect(store().project.room.labels[0].name).toBe('거실');
    await u.clear(name);
    await u.keyboard('{Enter}');
    expect(store().project.room.labels[0].name).toBe('구역');
    await u.click(screen.getByTestId('label-delete'));
    expect(store().project.room.labels).toHaveLength(0);
  });

  it('밖(장면)에서 선택이 바뀌면 카드가 따라 바뀐다', () => {
    const id = store().addLabel({ name: '침실', at: { x: 100, z: 100 } });
    render(<StructurePanel />);
    expect(within(screen.getByTestId('label-card')).getByTestId<HTMLInputElement>('label-name').value).toBe('침실');
    act(() => store().selectStructure(null));
    expect(screen.queryByTestId('label-card')).toBeNull();
    act(() => store().selectStructure({ kind: 'label', id }));
    expect(screen.getByTestId('label-card')).toBeTruthy();
  });
});
