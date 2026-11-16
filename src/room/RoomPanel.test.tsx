// SPEC 4절의 R-1 ~ R-5, U-1 ~ U-4를 컴포넌트 단위로 확인한다. probe 대신 store의 값을 본다.
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { roomBounds } from '../contracts/room';
import { createDefaultProject, useProjectStore } from '../store/projectStore';
import { UnitToggle } from '../ui/UnitToggle';
import { RoomPanel } from './RoomPanel';

type FieldId = 'room-width' | 'room-depth' | 'room-height';

const store = () => useProjectStore.getState();

/** store에 반영된 방의 [폭, 깊이, 천장 높이] (mm) */
function roomSize(): [number, number, number] {
  const { room } = store().project;
  const { width, depth } = roomBounds(room);
  return [width, depth, room.ceilingHeight];
}

const field = (id: FieldId) => screen.getByTestId<HTMLInputElement>(id);
const fieldTexts = () => [field('room-width').value, field('room-depth').value, field('room-height').value];
const errorOf = (id: FieldId) => screen.queryByTestId(`${id}-error`);
const errors = () =>
  (['room-width', 'room-depth', 'room-height'] as const).filter((id) => errorOf(id) !== null);
const warning = () => screen.queryByTestId('room-unit-warning');

/** SPEC의 "입력": 칸에 값을 넣고 Enter */
async function enter(id: FieldId, text: string) {
  const user = userEvent.setup();
  await user.clear(field(id));
  if (text !== '') await user.type(field(id), text);
  await user.keyboard('{Enter}');
}

async function pressUnit(unit: 'mm' | 'cm' | 'm') {
  await userEvent.setup().click(screen.getByTestId(`unit-${unit}`));
}

function renderPanel() {
  render(
    <>
      <UnitToggle />
      <RoomPanel />
    </>,
  );
}

beforeEach(() => {
  useProjectStore.setState({
    project: createDefaultProject(),
    selectedItemId: null,
    viewMode: '2d',
    dragPreview: null,
  });
});

afterEach(cleanup);

describe('RoomPanel', () => {
  it('R-1 기본 상태: 칸이 3600 / 3000 / 2400이고 오류와 경고가 없다', () => {
    renderPanel();
    expect(fieldTexts()).toEqual(['3600', '3000', '2400']);
    expect(roomSize()).toEqual([3600, 3000, 2400]);
    expect(errors()).toEqual([]);
    expect(warning()).toBeNull();
  });

  it('각 칸에 label이 연결돼 있고 숫자 키패드를 요청한다', () => {
    renderPanel();
    expect(screen.getByLabelText('폭')).toBe(field('room-width'));
    expect(screen.getByLabelText('깊이')).toBe(field('room-depth'));
    expect(screen.getByLabelText('천장 높이')).toBe(field('room-height'));
    for (const id of ['room-width', 'room-depth', 'room-height'] as const) {
      expect(field(id).getAttribute('inputmode')).toBe('decimal');
    }
  });

  it('R-2 room-width의 빈 값, 0, -100, abc, 1m20cm은 거부되고 이어서 4000은 반영된다', async () => {
    renderPanel();
    for (const text of ['', '0', '-100', 'abc', '1m20cm']) {
      await enter('room-width', text);
      expect(roomSize(), `"${text}"`).toEqual([3600, 3000, 2400]);
      expect(errors(), `"${text}"`).toEqual(['room-width']);
    }
    await enter('room-width', '4000');
    expect(roomSize()).toEqual([4000, 3000, 2400]);
    expect(field('room-width').value).toBe('4000');
    expect(errors()).toEqual([]);
  });

  it('R-3 room-width: 499와 20001은 거부, 500과 20000은 반영', async () => {
    renderPanel();
    for (const text of ['499', '20001']) {
      await enter('room-width', text);
      expect(roomSize(), text).toEqual([3600, 3000, 2400]);
      expect(errors(), text).toEqual(['room-width']);
    }
    await enter('room-width', '500');
    expect(roomSize()).toEqual([500, 3000, 2400]);
    expect(errors()).toEqual([]);
    await enter('room-width', '20000');
    expect(roomSize()).toEqual([20000, 3000, 2400]);
    expect(errors()).toEqual([]);
  });

  it('R-3 room-depth: 499와 20001은 거부, 500과 20000은 반영', async () => {
    renderPanel();
    for (const text of ['499', '20001']) {
      await enter('room-depth', text);
      expect(roomSize(), text).toEqual([3600, 3000, 2400]);
      expect(errors(), text).toEqual(['room-depth']);
    }
    await enter('room-depth', '500');
    expect(roomSize()).toEqual([3600, 500, 2400]);
    expect(errors()).toEqual([]);
    await enter('room-depth', '20000');
    expect(roomSize()).toEqual([3600, 20000, 2400]);
    expect(errors()).toEqual([]);
  });

  it('R-3 room-height: 1799와 5001은 거부, 1800과 5000은 반영, 경고는 뜨지 않는다', async () => {
    renderPanel();
    for (const text of ['1799', '5001']) {
      await enter('room-height', text);
      expect(roomSize(), text).toEqual([3600, 3000, 2400]);
      expect(errors(), text).toEqual(['room-height']);
      expect(errorOf('room-height')?.textContent).toContain('1800');
      expect(errorOf('room-height')?.textContent).toContain('5000');
      expect(warning()).toBeNull();
    }
    for (const [text, mm] of [
      ['1800', 1800],
      ['5000', 5000],
    ] as const) {
      await enter('room-height', text);
      expect(roomSize()).toEqual([3600, 3000, mm]);
      expect(errors()).toEqual([]);
      expect(warning()).toBeNull();
    }
  });

  it('R-4 단위 mm에서 room-width에 3.5를 넣으면 거부되고 오류 문구에 500과 20000이 있다', async () => {
    renderPanel();
    await enter('room-width', '3.5');
    expect(roomSize()).toEqual([3600, 3000, 2400]);
    expect(errorOf('room-width')?.textContent).toContain('500');
    expect(errorOf('room-width')?.textContent).toContain('20000');
    expect(warning()).toBeNull();
  });

  it.each([
    ['room-width', (mm: number) => [mm, 3000, 2400]],
    ['room-depth', (mm: number) => [3600, mm, 2400]],
  ] as const)('R-5 %s: 999, 1000, 15000, 15001이 모두 반영되고 999와 15001일 때만 경고가 보인다', async (id, expected) => {
    renderPanel();
    for (const [text, mm, warned] of [
      ['999', 999, true],
      ['1000', 1000, false],
      ['15000', 15000, false],
      ['15001', 15001, true],
    ] as const) {
      await enter(id, text);
      expect(roomSize(), text).toEqual(expected(mm));
      expect(errors(), text).toEqual([]);
      if (warned) {
        expect(warning()?.textContent, text).toContain('단위를 확인하세요');
      } else {
        expect(warning(), text).toBeNull();
      }
    }
  });

  it('U-1 단위를 cm, m, mm로 바꾸면 누른 버튼만 눌린 상태가 되고 칸의 표기만 바뀐다', async () => {
    renderPanel();
    const roomBefore = store().project.room;
    for (const [unit, texts] of [
      ['cm', ['360.0', '300.0', '240.0']],
      ['m', ['3.600', '3.000', '2.400']],
      ['mm', ['3600', '3000', '2400']],
    ] as const) {
      await pressUnit(unit);
      for (const other of ['mm', 'cm', 'm'] as const) {
        expect(screen.getByTestId(`unit-${other}`).getAttribute('aria-pressed')).toBe(String(other === unit));
      }
      expect(fieldTexts()).toEqual(texts);
      expect(store().project.room).toBe(roomBefore);
      expect(roomSize()).toEqual([3600, 3000, 2400]);
    }
  });

  it('U-2 왕복: 1234를 넣고 단위를 mm → cm → m → mm로 바꾸며 고치지 않고 Enter를 눌러도 값이 그대로다', async () => {
    renderPanel();
    await enter('room-width', '1234');
    act(() => void store().addItem({ name: 'A', w: 1000, d: 600, h: 700 }));
    const itemsBefore = JSON.stringify(store().project.items);
    const user = userEvent.setup();
    for (const [unit, text] of [
      ['mm', '1234'],
      ['cm', '123.4'],
      ['m', '1.234'],
      ['mm', '1234'],
    ] as const) {
      await pressUnit(unit);
      await user.click(field('room-width'));
      await user.keyboard('{Enter}');
      expect(field('room-width').value).toBe(text);
      expect(roomSize()).toEqual([1234, 3000, 2400]);
      expect(JSON.stringify(store().project.items)).toBe(itemsBefore);
      expect(errors()).toEqual([]);
    }
  });

  it('U-3 숫자만 넣으면 현재 표시 단위로, 단위를 붙이면 그 단위로 읽는다', async () => {
    renderPanel();
    await pressUnit('cm');
    await enter('room-width', '420');
    expect(roomSize()).toEqual([4200, 3000, 2400]);
    expect(field('room-width').value).toBe('420.0');

    await pressUnit('m');
    await enter('room-width', '4.3');
    expect(roomSize()).toEqual([4300, 3000, 2400]);
    expect(field('room-width').value).toBe('4.300');

    await pressUnit('mm');
    for (const [text, mm] of [
      ['440cm', 4400],
      ['4.5m', 4500],
      [' 4.6 M ', 4600],
    ] as const) {
      await enter('room-width', text);
      expect(roomSize(), text).toEqual([mm, 3000, 2400]);
      expect(field('room-width').value).toBe(String(mm));
    }
    expect(errors()).toEqual([]);
  });

  it('U-4 단위 m에서 room-width에 3600을 넣으면 거부되고 오류 문구의 범위가 m로 적힌다', async () => {
    renderPanel();
    await pressUnit('m');
    await enter('room-width', '3600');
    expect(roomSize()).toEqual([3600, 3000, 2400]);
    expect(errors()).toEqual(['room-width']);
    expect(errorOf('room-width')?.textContent).toContain('0.500');
    expect(errorOf('room-width')?.textContent).toContain('20.000');
  });

  it('포커스 이탈로도 반영되고, 다른 칸의 값은 건드리지 않으며 저장은 정수 mm의 corners 4개다', async () => {
    const user = userEvent.setup();
    renderPanel();
    await pressUnit('m');
    await user.clear(field('room-width'));
    await user.type(field('room-width'), '4.2');
    await user.tab();
    await user.clear(field('room-depth'));
    await user.type(field('room-depth'), '2.8');
    await user.tab();
    await user.clear(field('room-height'));
    await user.type(field('room-height'), '2.3');
    await user.tab();
    expect(roomSize()).toEqual([4200, 2800, 2300]);
    expect(store().project.room.corners).toEqual([
      { x: 0, z: 0 },
      { x: 4200, z: 0 },
      { x: 4200, z: 2800 },
      { x: 0, z: 2800 },
    ]);
    expect(fieldTexts()).toEqual(['4.200', '2.800', '2.300']);
    expect(errors()).toEqual([]);
  });

  it('방을 줄여도 가구의 위치는 바꾸지 않는다', async () => {
    renderPanel();
    act(() => void store().addItem({ name: 'B', w: 1000, d: 1000, h: 500 }));
    const itemsBefore = store().project.items;
    await enter('room-width', '2299');
    expect(roomSize()).toEqual([2299, 3000, 2400]);
    expect(store().project.items).toBe(itemsBefore);
  });

  it('store의 방과 단위가 밖에서 바뀌면 칸과 경고가 따라 바뀐다', () => {
    renderPanel();
    act(() => {
      store().setDisplayUnit('cm');
      store().setRoomSize({ width: 800, depth: 2800, ceilingHeight: 2300 });
    });
    expect(fieldTexts()).toEqual(['80.0', '280.0', '230.0']);
    expect(warning()?.textContent).toContain('단위를 확인하세요');
    act(() => store().replaceProject(createDefaultProject()));
    expect(fieldTexts()).toEqual(['3600', '3000', '2400']);
    expect(warning()).toBeNull();
  });
});
