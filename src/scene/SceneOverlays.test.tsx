// 겹침 DOM(치수 글자)은 첫 위치 계산 전에는 보이지 않고, 계산된 뒤에 보인다.
import { cleanup, render, screen } from '@testing-library/react';
import { OrthographicCamera } from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject, useProjectStore } from '../store/projectStore';
import { SceneOverlays } from './SceneOverlays';
import type { SceneRuntime } from './sceneProbe';

beforeEach(() => {
  useProjectStore.setState({ project: createDefaultProject(), viewMode: '2d', selectedItemId: null, dragPreview: null });
});
afterEach(cleanup);

const ids = ['room-dim-width', 'room-dim-depth'];

describe('SceneOverlays 첫 위치', () => {
  it('장면이 준비되기 전(runtime.get 없음)에는 치수 글자에 visible이 주어지지 않는다', () => {
    const runtime = { get: null, controlsRef: { current: null } } as SceneRuntime;
    render(<SceneOverlays runtime={runtime} />);
    for (const id of ids) expect(screen.getByTestId(id).style.visibility).not.toBe('visible');
  });

  it('카메라가 준비돼 위치를 잡은 뒤에는 보인다', () => {
    const camera = new OrthographicCamera(-4, 4, 3, -3, 0.1, 100);
    camera.position.set(0, 10, 0);
    camera.lookAt(0, 0, 0);
    const runtime = {
      get: () => ({ camera, size: { width: 800, height: 600, top: 0, left: 0 } }),
      controlsRef: { current: null },
    } as unknown as SceneRuntime;
    render(<SceneOverlays runtime={runtime} />);
    for (const id of ids) {
      const el = screen.getByTestId(id);
      expect(el.style.visibility).toBe('visible');
      expect(el.style.transform).toContain('translate(');
    }
  });
});
