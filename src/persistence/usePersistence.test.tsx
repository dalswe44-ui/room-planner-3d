import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject, useProjectStore } from '../store/projectStore';
import { serializeProject, STORAGE_KEY } from './savedProject';
import { SAVE_DELAY_MS, usePersistence } from './usePersistence';

function Host() {
  usePersistence();
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  useProjectStore.setState({ ...useProjectStore.getInitialState(), project: createDefaultProject(), past: [], future: [] });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('usePersistence', () => {
  it('바뀐 프로젝트를 지연 뒤 저장하고, 연속 변경은 한 번으로 묶는다', () => {
    const set = vi.spyOn(Storage.prototype, 'setItem');
    render(<Host />);
    act(() => {
      useProjectStore.getState().addItem({ name: '침대', w: 1000, d: 2000, h: 450 });
      useProjectStore.getState().setDisplayUnit('cm');
    });
    expect(set).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(SAVE_DELAY_MS));
    expect(set).toHaveBeenCalledTimes(1);
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved).toMatchObject({ format: 'room-planner-project', version: 1 });
    expect(saved.project.items).toHaveLength(1);
    expect(saved.project.displayUnit).toBe('cm');
  });

  it('선택만 바뀌면 저장하지 않는다', () => {
    const set = vi.spyOn(Storage.prototype, 'setItem');
    render(<Host />);
    act(() => useProjectStore.getState().selectItem('x'));
    act(() => void vi.advanceTimersByTime(SAVE_DELAY_MS * 2));
    expect(set).not.toHaveBeenCalled();
  });

  it('시작 때 저장된 프로젝트를 불러오고 되돌리기 기록에는 넣지 않는다', () => {
    const saved = { ...createDefaultProject(), displayUnit: 'm' as const, items: [{ id: 'a', name: '책상', w: 1200, d: 600, h: 720, x: 900, z: 700, rotationDeg: 0, elevation: 0, color: '#fff' }] };
    localStorage.setItem(STORAGE_KEY, serializeProject(saved));
    render(<Host />);
    expect(useProjectStore.getState().project).toEqual(saved);
    expect(useProjectStore.getState().past).toHaveLength(0);
  });

  it('깨진 값이면 기본 방으로 시작하고 오류를 던지지 않는다', () => {
    for (const bad of ['{ 깨짐', 'null', JSON.stringify({ format: 'room-planner-project', version: 1, project: { x: 1 } })]) {
      localStorage.setItem(STORAGE_KEY, bad);
      expect(() => render(<Host />)).not.toThrow();
      expect(useProjectStore.getState().project).toEqual(createDefaultProject());
      cleanup();
    }
  });

  it('localStorage가 예외를 던져도 조용히 동작한다', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('차단');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('가득 참');
    });
    render(<Host />);
    expect(() => {
      act(() => {
        useProjectStore.getState().addItem({ name: 'a', w: 100, d: 100, h: 100 });
      });
      act(() => void vi.advanceTimersByTime(SAVE_DELAY_MS));
    }).not.toThrow();
    expect(useProjectStore.getState().project.items).toHaveLength(1);
  });

  it('해제하면 밀린 저장을 먼저 끝낸다', () => {
    const { unmount } = render(<Host />);
    act(() => useProjectStore.getState().setRoomSize({ width: 4200, depth: 2800, ceilingHeight: 2300 }));
    unmount();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).project.room.ceilingHeight).toBe(2300);
  });
});
