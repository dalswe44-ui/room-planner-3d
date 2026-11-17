// SPEC 4절 V-1: 버튼으로 뷰를 바꾸고 선택된 버튼이 aria-pressed="true"로 표시된다.
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject, useProjectStore } from '../store/projectStore';
import { ViewToggle } from './ViewToggle';

beforeEach(() => {
  useProjectStore.setState({ project: createDefaultProject(), viewMode: '2d', selectedItemId: null, dragPreview: null });
});

afterEach(() => {
  cleanup();
});

describe('ViewToggle', () => {
  it('처음에는 평면 뷰가 눌린 상태로 보인다', () => {
    render(<ViewToggle />);
    expect(screen.getByTestId('view-2d').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('view-3d').getAttribute('aria-pressed')).toBe('false');
  });

  it('3D 버튼을 누르면 store의 viewMode가 3d가 되고 눌린 표시가 옮겨 간다', async () => {
    render(<ViewToggle />);
    await userEvent.click(screen.getByTestId('view-3d'));
    expect(useProjectStore.getState().viewMode).toBe('3d');
    expect(screen.getByTestId('view-3d').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('view-2d').getAttribute('aria-pressed')).toBe('false');
  });

  it('다시 평면 버튼을 누르면 2d로 돌아온다', async () => {
    useProjectStore.setState({ viewMode: '3d' });
    render(<ViewToggle />);
    await userEvent.click(screen.getByTestId('view-2d'));
    expect(useProjectStore.getState().viewMode).toBe('2d');
  });

  it('사람 뷰 버튼을 누르면 viewMode가 walk가 되고 세 버튼 중 하나만 눌린 표시다', async () => {
    render(<ViewToggle />);
    await userEvent.click(screen.getByTestId('view-walk'));
    expect(useProjectStore.getState().viewMode).toBe('walk');
    expect(screen.getByTestId('view-walk').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('view-2d').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('view-3d').getAttribute('aria-pressed')).toBe('false');
  });
});
