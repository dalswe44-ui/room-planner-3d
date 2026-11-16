// 앱의 조립 지점. 각 모듈이 내보낸 컴포넌트를 여기서 한 화면으로 묶는다. 이 파일은 헤드만 고친다.
import { FurniturePanel } from '../furniture/FurniturePanel';
import { useItemStatuses } from '../furniture/useItemStatuses';
import { usePlacement } from '../furniture/usePlacement';
import { RoomPanel } from '../room/RoomPanel';
import { SceneView } from '../scene/SceneView';
import { ViewToggle } from '../scene/ViewToggle';
import { UnitToggle } from '../ui/UnitToggle';

export function App() {
  const handlers = usePlacement();
  const statuses = useItemStatuses();
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
        <section className="app-section">
          <h2>방</h2>
          <RoomPanel />
        </section>
        <section className="app-section">
          <h2>가구</h2>
          <FurniturePanel />
        </section>
      </aside>
      <main className="app-scene" data-testid="scene">
        <ViewToggle />
        <SceneView handlers={handlers} statuses={statuses} />
      </main>
    </div>
  );
}
