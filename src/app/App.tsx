// 앱의 조립 지점. 각 모듈이 내보낸 컴포넌트를 여기서 한 화면으로 묶는다. 이 파일은 헤드만 고친다.
import { useMemo } from 'react';
import type { ItemStatus, PlacementHandlers } from '../contracts/types';
import { RoomPanel } from '../room/RoomPanel';
import { SceneView } from '../scene/SceneView';
import { ViewToggle } from '../scene/ViewToggle';
import { useProjectStore } from '../store/projectStore';
import { UnitToggle } from '../ui/UnitToggle';

// T-004(usePlacement, useItemStatuses)가 들어오기 전까지 쓰는 임시 연결.
// 가구를 누르면 선택하고, 빈 곳을 누르면 선택을 푼다. 끌기와 경고는 아직 없다.
const NO_STATUSES: Record<string, ItemStatus> = {};

function useTemporaryHandlers(): PlacementHandlers {
  const selectItem = useProjectStore((s) => s.selectItem);
  return useMemo(
    () => ({
      onItemPointerDown: (itemId) => selectItem(itemId),
      onBackgroundTap: () => selectItem(null),
      onFloorPointerMove: () => {},
      onPointerUp: () => {},
    }),
    [selectItem],
  );
}

export function App() {
  const handlers = useTemporaryHandlers();
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
      </aside>
      <main className="app-scene" data-testid="scene">
        <ViewToggle />
        <SceneView handlers={handlers} statuses={NO_STATUSES} />
      </main>
    </div>
  );
}
