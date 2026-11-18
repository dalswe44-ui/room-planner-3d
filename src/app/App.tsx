// 앱의 조립 지점. 각 모듈이 내보낸 컴포넌트를 여기서 한 화면으로 묶는다. 이 파일은 헤드만 고친다.
import { lazy, Suspense, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { DraftToolbar } from '../furniture/DraftToolbar';
import { FurniturePanel } from '../furniture/FurniturePanel';
import { ItemToolbar } from '../furniture/ItemToolbar';
import { useSelectedWallDistances } from '../furniture/useSelectedWallDistances';
import { useItemStatuses } from '../furniture/useItemStatuses';
import { useKeyboardNudge } from '../furniture/keyboardNudge';
import { usePlacement } from '../furniture/usePlacement';
import { usePersistence, useSaveStatus } from '../persistence';
import { ProjectMenu } from '../persistence/ProjectMenu';
import { SaveStatusBadge } from '../persistence/SaveStatusBadge';
import { RoomPanel } from '../room/RoomPanel';
import { ViewToggle } from '../scene/ViewToggle';
import { useProjectStore } from '../store/projectStore';
import { StructurePanel, useStructureHandlers } from '../structure';
import { IconPlan, IconRedo, IconUndo } from '../ui/icons';
import { UnitToggle } from '../ui/UnitToggle';
import { FirstSteps } from './FirstSteps';
import { useUndoShortcuts } from './useUndoShortcuts';
import { WarningLive } from './WarningLive';

// 3D 장면(three.js)과 자주 쓰지 않는 탭은 따로 내려받는다(QA 4-13). 패널은 장면보다 먼저 보인다.
const SceneView = lazy(() => import('../scene/SceneView').then((m) => ({ default: m.SceneView })));
const PhotoPanel = lazy(() => import('../photo').then((m) => ({ default: m.PhotoPanel })));
const SuggestPanel = lazy(() => import('../suggest').then((m) => ({ default: m.SuggestPanel })));

type Tab = 'main' | 'structure' | 'photo' | 'suggest';
const TABS: { id: Tab; label: string }[] = [
  { id: 'main', label: '방·가구' },
  { id: 'structure', label: '벽·문' },
  { id: 'photo', label: '배치도 사진' },
  { id: 'suggest', label: 'AI 추천' },
];

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
  const shareNote = useSaveStatus((s) => s.shareNote);
  // 사람 뷰는 둘러보기 전용이다(SPEC 4-7). 패널의 입력과 버튼을 막는다(D-1118-04).
  const walking = useProjectStore((s) => s.viewMode === 'walk');
  const [tab, setTab] = useState<Tab>('main');
  const tabRefs = useRef(new Map<Tab, HTMLButtonElement>());
  // 벽·문 탭에 있을 때만 구조 편집 모드. 탭을 떠나면 가구 모드로 돌아간다.
  useEffect(() => {
    setEditMode(tab === 'structure' ? 'structure' : 'furniture');
  }, [tab, setEditMode]);

  // 탭 목록의 키보드 조작(QA 4-10): 왼쪽·오른쪽 화살표, Home, End로 옮기며 바로 연다.
  const onTabKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const next =
      e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    setTab(TABS[next].id);
    tabRefs.current.get(TABS[next].id)?.focus();
  };

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
          <SaveStatusBadge />
          <ProjectMenu />
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
        {shareNote && (
          <p className={`share-note${shareNote === 'broken' ? ' share-note--broken' : ''}`} role="status" data-testid="share-note">
            {shareNote === 'loaded'
              ? '공유 링크의 배치를 열었습니다. 되돌리기를 누르면 이 브라우저에서 쓰던 배치로 돌아갑니다.'
              : '공유 링크를 읽지 못했습니다. 링크가 잘리지 않았는지 확인하세요. 이 브라우저에서 쓰던 배치를 그대로 열었습니다.'}
          </p>
        )}
        <div className="app-tabs" role="tablist" aria-label="패널" onKeyDown={onTabKey}>
          {TABS.map((t) => (
            <button
              key={t.id}
              ref={(el) => {
                if (el) tabRefs.current.set(t.id, el);
                else tabRefs.current.delete(t.id);
              }}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              className="app-tab"
              data-testid={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="app-tabpanel"
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {walking && (
          <p className="app-walk-note" role="status" data-testid="walk-edit-locked">
            사람 뷰에서는 둘러보기만 할 수 있어요. 편집하려면 위쪽의 평면이나 3D 뷰로 바꾸세요.
          </p>
        )}
        <div id="app-tabpanel" role="tabpanel" aria-labelledby={`tab-${tab}`} data-testid="tabpanel">
          <fieldset className="app-panel-body" disabled={walking} data-testid="panel-body">
            <Suspense fallback={<p className="app-placeholder">불러오는 중…</p>}>
              {tab === 'main' ? (
                <>
                  <FirstSteps onPhoto={() => setTab('photo')} />
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
                <section className="app-section" aria-label="배치도 사진">
                  <PhotoPanel />
                </section>
              )}
            </Suspense>
          </fieldset>
        </div>
        <WarningLive statuses={statuses} />
      </aside>
      <main className="app-scene" data-testid="scene">
        <ViewToggle />
        <Suspense fallback={<p className="app-placeholder" data-testid="scene-loading">3D 화면을 불러오는 중…</p>}>
          <SceneView handlers={handlers} statuses={statuses} selectionOverlay={hasDraft ? <DraftToolbar /> : <ItemToolbar />} wallDistances={wallDistances} structureHandlers={structureHandlers} />
        </Suspense>
      </main>
    </div>
  );
}
