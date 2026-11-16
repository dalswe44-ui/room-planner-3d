import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject, useProjectStore } from '../store/projectStore';
import { handleUndoKey } from './useUndoShortcuts';

const st = () => useProjectStore.getState();
const press = (init: KeyboardEventInit, target: EventTarget = document.body) => {
  const e = new KeyboardEvent('keydown', { ...init, cancelable: true });
  Object.defineProperty(e, 'target', { value: target });
  return { handled: handleUndoKey(e), prevented: e.defaultPrevented };
};

describe('되돌리기 단축키', () => {
  beforeEach(() => {
    useProjectStore.setState({ project: createDefaultProject(), selectedItemId: null, dragPreview: null, past: [], future: [] });
  });

  it('Ctrl+Z는 되돌리고 Ctrl+Shift+Z·Ctrl+Y·Cmd+Shift+Z는 다시 실행한다', () => {
    st().addItem({ name: 'A', w: 100, d: 100, h: 100 });
    expect(press({ key: 'z', ctrlKey: true })).toEqual({ handled: true, prevented: true });
    expect(st().project.items).toHaveLength(0);
    press({ key: 'Z', ctrlKey: true, shiftKey: true });
    expect(st().project.items).toHaveLength(1);
    press({ key: 'z', metaKey: true });
    press({ key: 'y', ctrlKey: true });
    expect(st().project.items).toHaveLength(1);
  });

  it('입력 칸에서는 가로채지 않는다', () => {
    st().addItem({ name: 'A', w: 100, d: 100, h: 100 });
    const input = document.createElement('input');
    expect(press({ key: 'z', ctrlKey: true }, input)).toEqual({ handled: false, prevented: false });
    expect(st().project.items).toHaveLength(1);
  });

  it('수정 키 없는 z는 무시한다', () => {
    expect(press({ key: 'z' }).handled).toBe(false);
  });
});
