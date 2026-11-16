// FurniturePanel을 store에 연결해 SPEC F-1 ~ F-6, W-1·W-4, D-1·D-3을 컴포넌트 단위로 확인한다. probe 대신 store를 본다.
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject, useProjectStore } from '../store/projectStore';
import { UnitToggle } from '../ui/UnitToggle';
import { FurniturePanel } from './FurniturePanel';
import { useItemStatuses } from './useItemStatuses';

const store = () => useProjectStore.getState();
const items = () => store().project.items;
const rows = () => screen.queryAllByTestId('item-row');
const byId = <T extends HTMLElement = HTMLElement>(id: string) => screen.getByTestId<T>(id);
const dists = () => [0, 1, 2, 3].map((i) => byId(`item-dist-${i}`).textContent);

async function fill(id: string, text: string) {
  const user = userEvent.setup();
  await user.clear(byId(id));
  if (text !== '') await user.type(byId(id), text);
}

/** SPEC의 "추가": 이름·폭·깊이·높이를 넣고 furniture-add를 누른다 */
async function add(name: string, w: string, d: string, h: string) {
  await fill('furniture-name', name);
  await fill('furniture-w', w);
  await fill('furniture-d', d);
  await fill('furniture-h', h);
  await userEvent.setup().click(byId('furniture-add'));
}

/** 칸에 값을 넣고 Enter */
async function enter(id: string, text: string) {
  await fill(id, text);
  await userEvent.setup().keyboard('{Enter}');
}

beforeEach(() => {
  useProjectStore.setState({
    project: createDefaultProject(),
    selectedItemId: null,
    viewMode: '2d',
    dragPreview: null,
  });
  render(
    <>
      <UnitToggle />
      <FurniturePanel />
    </>,
  );
});

afterEach(cleanup);

describe('가구 추가', () => {
  it('F-1: 책상 1200·600·720 → 한 줄, 방 가운데, 회전 0, 선택됨', async () => {
    await add('책상', '1200', '600', '720');
    expect(rows()).toHaveLength(1);
    expect(items()[0]).toMatchObject({ name: '책상', w: 1200, d: 600, h: 720, x: 1800, z: 1500, rotationDeg: 0 });
    expect(store().selectedItemId).toBe(items()[0].id);
    expect(rows()[0].getAttribute('data-item-id')).toBe(items()[0].id);
    expect(rows()[0].getAttribute('aria-pressed')).toBe('true');
    expect(rows()[0].textContent).toContain('책상');
  });

  it('F-2: 폭에 빈 값, 0, -5, abc, 9, 10001 → 매번 추가 안 되고 오류. 10, 10000은 추가된다', async () => {
    for (const field of ['furniture-w', 'furniture-d', 'furniture-h']) {
      await fill('furniture-w', '1000');
      await fill('furniture-d', '600');
      await fill('furniture-h', '700');
      const before = rows().length;
      for (const bad of ['', '0', '-5', 'abc', '9', '10001']) {
        await fill(field, bad);
        await userEvent.setup().click(byId('furniture-add'));
        expect(rows()).toHaveLength(before);
        expect(screen.queryByTestId(`${field}-error`)).not.toBeNull();
        expect(byId<HTMLButtonElement>('furniture-add').disabled).toBe(true);
      }
      for (const good of ['10', '10000']) {
        await fill(field, good);
        await userEvent.setup().click(byId('furniture-add'));
        expect(screen.queryByTestId(`${field}-error`)).toBeNull();
      }
      expect(rows()).toHaveLength(before + 2);
    }
  });

  it('F-3: mm에서 폭 0.6 → 오류. cm에서 120·60·72 → 1200·600·720', async () => {
    await add('', '0.6', '600', '700');
    expect(rows()).toHaveLength(0);
    expect(screen.queryByTestId('furniture-w-error')).not.toBeNull();
    await userEvent.setup().click(byId('unit-cm'));
    await add('책상', '120', '60', '72');
    expect(rows()).toHaveLength(1);
    expect(items()[0]).toMatchObject({ w: 1200, d: 600, h: 720 });
  });

  it('F-5: 이름을 비우고 추가하면 "가구"', async () => {
    await add('', '1000', '600', '700');
    expect(items()[0].name).toBe('가구');
    expect(rows()[0].textContent).toContain('가구');
    await add('   ', '1000', '600', '700');
    expect(items()[1].name).toBe('가구');
  });

  it('치수 칸에서 Enter를 누르면 그 값으로 추가된다(form submit)', async () => {
    await fill('furniture-name', '선반');
    await fill('furniture-w', '800');
    await fill('furniture-d', '300');
    await enter('furniture-h', '1800');
    expect(items()).toHaveLength(1);
    expect(items()[0]).toMatchObject({ name: '선반', w: 800, d: 300, h: 1800 });
  });

  it('거부된 칸에서 Enter를 누르면 추가되지 않는다', async () => {
    await fill('furniture-w', '1000');
    await enter('furniture-h', 'abc');
    expect(items()).toHaveLength(0);
    expect(screen.queryByTestId('furniture-h-error')).not.toBeNull();
  });

  it('오류를 고치면 추가 버튼이 다시 켜지고 고친 값으로 추가된다', async () => {
    await fill('furniture-w', 'abc');
    await userEvent.setup().click(byId('furniture-add'));
    expect(byId<HTMLButtonElement>('furniture-add').disabled).toBe(true);
    await fill('furniture-w', '900');
    await userEvent.setup().click(byId('furniture-add'));
    expect(items()).toHaveLength(1);
    expect(items()[0].w).toBe(900);
  });

  it('추가하면 입력 칸의 포커스가 풀린다', async () => {
    await fill('furniture-w', '1000');
    await enter('furniture-h', '700');
    expect(items()).toHaveLength(1);
    expect(document.activeElement).toBe(document.body);
  });
});

describe('선택한 가구의 수정·회전·삭제', () => {
  it('F-4: 폭·깊이·높이 1400·800·900 → 반영, 중심 그대로. 0, 10001, abc → 거부', async () => {
    await add('A', '1000', '600', '700');
    await enter('item-w', '1400');
    await enter('item-d', '800');
    await enter('item-h', '900');
    expect(items()[0]).toMatchObject({ w: 1400, d: 800, h: 900, x: 1800, z: 1500 });
    for (const bad of ['0', '10001', 'abc']) {
      await enter('item-w', bad);
      expect(items()[0].w).toBe(1400);
      expect(screen.queryByTestId('item-w-error')).not.toBeNull();
    }
  });

  it('F-5: 이름을 소파로, 색을 바꿈. 이름을 비우면 "가구"', async () => {
    await add('A', '1000', '600', '700');
    await enter('item-name', '소파');
    expect(items()[0].name).toBe('소파');
    expect(rows()[0].textContent).toContain('소파');
    const color = byId<HTMLInputElement>('item-color');
    act(() => {
      // input type=color는 사용자 입력 대신 값 변경 이벤트로 바꾼다
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(color, '#123456');
      color.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(items()[0].color).toBe('#123456');
    await enter('item-name', '');
    expect(items()[0].name).toBe('가구');
  });

  it('F-6: 목록 줄을 누르면 그 가구만 선택, 삭제하면 하나 남는다', async () => {
    await add('A', '1000', '600', '700');
    await add('B', '1000', '1000', '500');
    const [a, b] = items();
    await userEvent.setup().click(rows()[0]);
    expect(store().selectedItemId).toBe(a.id);
    expect(rows()[0].getAttribute('aria-pressed')).toBe('true');
    expect(rows()[1].getAttribute('aria-pressed')).toBe('false');
    await userEvent.setup().click(byId('item-delete'));
    expect(rows()).toHaveLength(1);
    expect(items().map((it) => it.id)).toEqual([b.id]);
  });

  it('선택이 없으면 수정 칸, 거리, 회전·삭제 버튼이 없다', async () => {
    await add('A', '1000', '600', '700');
    act(() => store().selectItem(null));
    for (const id of ['item-name', 'item-w', 'item-d', 'item-h', 'item-color', 'item-rotate', 'item-delete', 'item-dist-0']) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
  });

  it('선택한 가구의 칸이 거부 상태로 사라져도 추가 버튼은 켜져 있다', async () => {
    await add('A', '1000', '600', '700');
    await enter('item-w', 'abc');
    act(() => store().selectItem(null));
    expect(byId<HTMLButtonElement>('furniture-add').disabled).toBe(false);
  });

  it('선택한 가구 편집 칸에 방향키 안내가 있다', async () => {
    await add('A', '1000', '600', '700');
    expect(byId('item-nudge-hint').textContent).toBe('방향키로 1 cm, Shift+방향키로 1 mm 이동');
  });

  it('P-4: 회전 네 번 → 90, 180, 270, 0, 중심·크기 그대로', async () => {
    await add('A', '1000', '600', '700');
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      await userEvent.setup().click(byId('item-rotate'));
      seen.push(items()[0].rotationDeg);
    }
    expect(seen).toEqual([90, 180, 270, 0]);
    expect(items()[0]).toMatchObject({ x: 1800, z: 1500, w: 1000, d: 600, h: 700 });
  });
});

describe('경고와 벽까지 거리', () => {
  it('W-1: 같은 자리의 B 두 개 → "겹침"', async () => {
    await add('B', '1000', '1000', '500');
    expect(screen.queryByTestId('item-status')).toBeNull();
    await add('B', '1000', '1000', '500');
    expect(byId('item-status').textContent).toContain('겹침');
    expect(rows().every((r) => r.getAttribute('data-warning') === 'true')).toBe(true);
  });

  it('W-4: 3600·3000 → 경고 없음, 폭 3602 → "방 밖"', async () => {
    await add('', '3600', '3000', '500');
    expect(screen.queryByTestId('item-status')).toBeNull();
    await enter('item-w', '3602');
    expect(items()[0].w).toBe(3602);
    expect(byId('item-status').textContent).toContain('방 밖');
  });

  it('D-1: A → 1200, 1300, 1200, 1300 (cm, m 전환), 회전 → 1000, 1500, 1000, 1500', async () => {
    await add('A', '1000', '600', '700');
    expect(dists()).toEqual(['1200', '1300', '1200', '1300']);
    await userEvent.setup().click(byId('unit-cm'));
    expect(dists()).toEqual(['120.0', '130.0', '120.0', '130.0']);
    await userEvent.setup().click(byId('unit-m'));
    expect(dists()).toEqual(['1.200', '1.300', '1.200', '1.300']);
    await userEvent.setup().click(byId('unit-mm'));
    await userEvent.setup().click(byId('item-rotate'));
    expect(dists()).toEqual(['1000', '1500', '1000', '1500']);
  });

  it('D-3: 방과 같은 크기 → 0, 폭 3700 → 벽 1·3이 -50', async () => {
    await add('', '3600', '3000', '500');
    expect(dists()).toEqual(['0', '0', '0', '0']);
    await enter('item-w', '3700');
    expect(dists()).toEqual(['0', '-50', '0', '-50']);
  });

  it('끄는 중이면 거리와 경고가 임시 위치를 따른다', async () => {
    await add('A', '1000', '600', '700');
    const id = items()[0].id;
    act(() => store().setDragPreview({ itemId: id, x: 100, z: 1500 }));
    expect(dists()).toEqual(['1200', '3000', '1200', '-400']);
    expect(byId('item-status').textContent).toContain('방 밖');
    act(() => store().setDragPreview(null));
    expect(screen.queryByTestId('item-status')).toBeNull();
  });
});

describe('useItemStatuses', () => {
  it('store의 가구·방·dragPreview를 따른다', () => {
    cleanup();
    const a = store().addItem({ name: 'A', w: 1000, d: 1000, h: 500 });
    const b = store().addItem({ name: 'B', w: 1000, d: 1000, h: 500 });
    const { result } = renderHook(() => useItemStatuses());
    expect(result.current[a]).toEqual({ overlap: true, outside: false });
    act(() => store().setDragPreview({ itemId: b, x: 600, z: 600 }));
    expect(result.current[a]).toEqual({ overlap: false, outside: false });
    act(() => store().setRoomSize({ width: 1000, depth: 3000, ceilingHeight: 2400 }));
    expect(result.current[a].outside).toBe(true);
  });
});

describe('기본 가구 (T-011)', () => {
  const click = (id: string) => userEvent.setup().click(byId(id));

  it('책상 버튼: 칸을 채우지만 추가하지 않고, 추가하면 kind desk', async () => {
    await click('preset-desk');
    expect(items()).toHaveLength(0);
    expect(byId('preset-desk').getAttribute('aria-pressed')).toBe('true');
    expect(byId<HTMLInputElement>('furniture-name').value).toBe('책상');
    expect(byId<HTMLInputElement>('furniture-w').value).toBe('1200');
    await click('furniture-add');
    expect(items()[0]).toMatchObject({ name: '책상', w: 1200, d: 600, h: 720, kind: 'desk' });
  });

  it('이름을 바꿔도 kind 유지, 치수 수정 반영', async () => {
    await click('preset-chair');
    await fill('furniture-name', '내 물건');
    await fill('furniture-w', '500');
    await click('furniture-add');
    expect(items()[0]).toMatchObject({ name: '내 물건', w: 500, d: 500, h: 850, kind: 'chair' });
  });

  it('직접 입력: 이름으로 짐작하고, 못 찾으면 kind 키 없음', async () => {
    await add('작은 책상', '800', '500', '700');
    expect(items()[0].kind).toBe('desk');
    await add('박스', '800', '500', '700');
    expect('kind' in items()[1]).toBe(false);
  });

  it('preset-box는 기본 가구 선택을 푼다', async () => {
    await click('preset-bed');
    await click('preset-box');
    expect(byId('preset-bed').getAttribute('aria-pressed')).toBe('false');
    expect(byId('preset-box').getAttribute('aria-pressed')).toBe('true');
    await fill('furniture-name', '물건');
    await click('furniture-add');
    expect(items()[0].kind).toBeUndefined();
  });

  it('오류로 남은 입력도 기본값 버튼이 지운다', async () => {
    await fill('furniture-w', 'abc');
    await click('preset-sofa');
    expect(byId<HTMLInputElement>('furniture-w').value).toBe('1800');
    expect((byId('furniture-add') as HTMLButtonElement).disabled).toBe(false);
  });

  it('편집 칸 종류 select가 kind를 바꾼다', async () => {
    await add('물건', '800', '500', '700');
    await userEvent.setup().selectOptions(byId('item-kind'), 'shelf');
    expect(items()[0].kind).toBe('shelf');
    expect(rows()[0].textContent).toContain('책장');
  });
});
