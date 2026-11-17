// 앱의 조립 지점. 각 모듈이 내보낸 컴포넌트를 여기서 한 화면으로 묶는다. 이 파일은 헤드만 고친다.
import { useEffect, useState } from 'react';
import { DraftToolbar } from '../furniture/DraftToolbar';
import { FurniturePanel } from '../furniture/FurniturePanel';
import { ItemToolbar } from '../furniture/ItemToolbar';
import { useSelectedWallDistances } from '../furniture/useSelectedWallDistances';
import { useItemStatuses } from '../furniture/useItemStatuses';
import { useKeyboardNudge } from '../furniture/keyboardNudge';
import { usePlacement } from '../furniture/usePlacement';
import { usePersistence } from '../persistence';
import { PhotoPanel } from '../photo';
import { RoomPanel } from '../room/RoomPanel';
import { SceneView } from '../scene/SceneView';
import { ViewToggle } from '../scene/ViewToggle';
import { useProjectStore } from '../store/projectStore';
import { StructurePanel, useStructureHandlers } from '../structure';
import { SuggestPanel } from '../suggest';
import { IconPlan, IconRedo, IconUndo } from '../ui/icons';
import { UnitToggle } from '../ui/UnitToggle';
import { useUndoShortcuts } from './useUndoShortcuts';

export function App() {
  // 저장본 불러오기는 첫 그림 전에 일어나야 하므로 다른 훅보다 먼저 부른다.
  usePersistence();
  const handlers = usePlacement();
  useKeyboardNudge();
  useUndoShortcuts();
  const canUndo = useProjectStore((s) => s.past.length > 0);
  const canRedo = useProjectStore((s) => s.future.length > 0);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const statuses = useItemStatuses();
  const wallDistances = useSelectedWallDistances();
  const hasDraft = useProjectStore((s) => s.draft !== null);
  const structureHandlers = useStructureHandlers();
  const setEditMode = useProjectStore((s) => s.setEditMode);
  const [tab, setTab] = useState<'main' | 'structure' | 'photo' | 'suggest'>('main');
  // 벽·문 탭에 있을 때만 구조 편집 모드. 탭을 떠나면 가구 모드로 돌아간다.
  useEffect(() => {
    setEditMode(tab === 'structure' ? 'structure' : 'furniture');
  }, [tab, setEditMode]);
  return (
    <div className="app">
      <header className="app-header">
        <h1>
          <span className="app-title-mark">
            <IconPlan size={24} />
          </span>
          <span className="app-title-text">3D 가구배치</span>
        </h1>
        <p className="app-sub">방 치수를 입력하고, 가구를 미리 놓아 보세요.</p>
        <div className="app-header-tools">
          <div className="app-history" role="group" aria-label="되돌리기">
            <button type="button" className="icon-btn" data-testid="undo" onClick={undo} disabled={!canUndo} title="되돌리기 (Ctrl+Z)" aria-label="되돌리기">
              <IconUndo />
            </button>
            <button type="button" className="icon-btn" data-testid="redo" onClick={redo} disabled={!canRedo} title="다시 실행 (Ctrl+Shift+Z)" aria-label="다시 실행">
              <IconRedo />
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
            data-testid="tab-structure"
            aria-selected={tab === 'structure'}
            onClick={() => setTab('structure')}
          >
            벽·문
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
          <button
            type="button"
            role="tab"
            className="app-tab"
            data-testid="tab-suggest"
            aria-selected={tab === 'suggest'}
            onClick={() => setTab('suggest')}
          >
            AI 추천
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
        ) : tab === 'structure' ? (
          <section className="app-section" aria-label="벽·문">
            <StructurePanel />
          </section>
        ) : tab === 'suggest' ? (
          <section className="app-section" aria-label="AI 추천">
            <SuggestPanel />
          </section>
        ) : (
          <section className="app-section" aria-label="사진·배치도">
            <PhotoPanel />
          </section>
        )}
      </aside>
      <main className="app-scene" data-testid="scene">
        <ViewToggle />
        <SceneView handlers={handlers} statuses={statuses} selectionOverlay={hasDraft ? <DraftToolbar /> : <ItemToolbar />} wallDistances={wallDistances} structureHandlers={structureHandlers} />
      </main>
    </div>
  );
}
