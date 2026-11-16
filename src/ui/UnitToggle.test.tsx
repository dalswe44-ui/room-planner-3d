import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DisplayUnit } from '../contracts/types';
import { createDefaultProject, useProjectStore } from '../store/projectStore';
import { UnitToggle } from './UnitToggle';

const store = () => useProjectStore.getState();

const pressed = () =>
  (['mm', 'cm', 'm'] as const).filter(
    (unit) => screen.getByTestId(`unit-${unit}`).getAttribute('aria-pressed') === 'true',
  );

beforeEach(() => {
  useProjectStore.setState({
    project: createDefaultProject(),
    selectedItemId: null,
    viewMode: '2d',
    dragPreview: null,
  });
});

afterEach(cleanup);

describe('UnitToggle', () => {
  it('버튼 3개가 있고 처음에는 mm만 눌린 상태다', () => {
    render(<UnitToggle />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('data-testid'))).toEqual(['unit-mm', 'unit-cm', 'unit-m']);
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
    expect(buttons.map((b) => b.getAttribute('type'))).toEqual(['button', 'button', 'button']);
  });

  it('누른 버튼만 aria-pressed="true"가 되고 store의 displayUnit이 바뀐다', async () => {
    const user = userEvent.setup();
    render(<UnitToggle />);
    for (const unit of ['cm', 'm', 'mm'] as DisplayUnit[]) {
      await user.click(screen.getByTestId(`unit-${unit}`));
      expect(store().project.displayUnit).toBe(unit);
      expect(pressed()).toEqual([unit]);
    }
  });

  it('displayUnit 말고는 아무것도 바꾸지 않는다', async () => {
    const user = userEvent.setup();
    store().addItem({ name: '책상', w: 1200, d: 600, h: 720 });
    store().setViewMode('3d');
    const before = store();
    render(<UnitToggle />);
    await user.click(screen.getByTestId('unit-m'));
    const after = store();
    expect(after.project.displayUnit).toBe('m');
    expect(after.project.room).toBe(before.project.room);
    expect(after.project.items).toBe(before.project.items);
    expect(after.project.version).toBe(before.project.version);
    expect(after.selectedItemId).toBe(before.selectedItemId);
    expect(after.viewMode).toBe('3d');
    expect(after.dragPreview).toBe(before.dragPreview);
  });

  it('store의 displayUnit이 밖에서 바뀌면 눌린 버튼도 따라 바뀐다', () => {
    useProjectStore.setState((s) => ({ project: { ...s.project, displayUnit: 'cm' } }));
    render(<UnitToggle />);
    expect(pressed()).toEqual(['cm']);
  });
});
