// 앱의 조립 지점. 각 모듈이 내보낸 컴포넌트를 여기서 한 화면으로 묶는다. 이 파일은 헤드만 고친다.
import { useState } from 'react';
import { FurniturePanel } from '../furniture/FurniturePanel';
import { useItemStatuses } from '../furniture/useItemStatuses';
import { useKeyboardNudge } from '../furniture/keyboardNudge';
import { usePlacement } from '../furniture/usePlacement';
import { PhotoPanel } from '../photo';
import { RoomPanel } from '../room/RoomPanel';
import { SceneView } from '../scene/SceneView';
import { ViewToggle } from '../scene/ViewToggle';
import { useProjectStore } from '../store/projectStore';
import { UnitToggle } from '../ui/UnitToggle';
import { useUndoShortcuts } from './useUndoShortcuts';

export function App() {
  const handlers = usePlacement();
  useKeyboardNudge();
  useUndoShortcuts();
  const canUndo = useProjectStore((s) => s.past.length > 0);
  const canRedo = useProjectStore((s) => s.future.length > 0);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const statuses = useItemStatuses();
  const [tab, setTab] = useState<'main' | 'photo'>('main');
  return (
    <div className="app">
      <header className="app-header">
        <h1>3D 가구배치</h1>
        <p className="app-sub">방 치수를 입력하고, 가구를 미리 놓아 보세요.</p>
        <div className="app-header-tools">
          <div className="app-history" role="group" aria-label="되돌리기">
            <button type="button" className="app-history-btn" data-testid="undo" onClick={undo} disabled={!canUndo} title="되돌리기 (Ctrl+Z)">
              되돌리기
            </button>
            <button type="button" className="app-history-btn" data-testid="redo" onClick={redo} disabled={!canRedo} title="다시 실행 (Ctrl+Shift+Z)">
              다시 실행
            </button>
          </div>
          <UnitToggle />
        </div>
      </header>
      <aside className="app-panel" data-testid="panel">
        <div className="app-tabs" role="tablist" aria-label="패널">
          <button
            type="button"
            role="tab"
            className="app-tab"
            data-testid="tab-main"
            aria-selected={tab === 'main'}
            onClick={() => setTab('main')}
          >
            방·가구
          </button>
          <button
            type="button"
            role="tab"
            className="app-tab"
            data-testid="tab-photo"
            aria-selected={tab === 'photo'}
            onClick={() => setTab('photo')}
          >
            사진·배치도
          </button>
        </div>
        {tab === 'main' ? (
          <>
            <section className="app-section" aria-label="방">
              <RoomPanel />
            </section>
            <section className="app-section" aria-label="가구">
              <FurniturePanel />
            </section>
          </>
        ) : (
          <section className="app-section" aria-label="사진·배치도">
            <PhotoPanel />
          </section>
        )}
      </aside>
      <main className="app-scene" data-testid="scene">
        <ViewToggle />
        <SceneView handlers={handlers} statuses={statuses} />
      </main>
    </div>
  );
}
