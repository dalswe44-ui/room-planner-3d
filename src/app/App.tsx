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
import { UnitToggle } from '../ui/UnitToggle';

export function App() {
  const handlers = usePlacement();
  useKeyboardNudge();
  const statuses = useItemStatuses();
  const [tab, setTab] = useState<'main' | 'photo'>('main');
  return (
    <div className="app">
      <header className="app-header">
        <h1>3D 가구배치</h1>
        <p className="app-sub">방 치수를 입력하고, 가구를 미리 놓아 보세요.</p>
        <div className="app-header-tools">
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
            <section className="app-section">
              <h2>방</h2>
              <RoomPanel />
            </section>
            <section className="app-section">
              <h2>가구</h2>
              <FurniturePanel />
            </section>
          </>
        ) : (
          <section className="app-section">
            <h2>사진·배치도</h2>
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
