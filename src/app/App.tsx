// 앱의 조립 지점. 각 모듈이 내보낸 컴포넌트를 여기서 한 화면으로 묶는다. 이 파일은 헤드만 고친다.
import { formatLengthWithUnit } from '../contracts/units';
import { roomBounds } from '../contracts/room';
import { useProjectStore } from '../store/projectStore';

export function App() {
  const room = useProjectStore((s) => s.project.room);
  const unit = useProjectStore((s) => s.project.displayUnit);
  const bounds = roomBounds(room);

  return (
    <div className="app">
      <header className="app-header">
        <h1>3D 가구배치</h1>
        <p className="app-sub">방 치수를 입력하고, 가구를 미리 놓아 보세요.</p>
      </header>
      <aside className="app-panel" data-testid="panel">
        <p data-testid="room-summary">
          방 {formatLengthWithUnit(bounds.width, unit)} × {formatLengthWithUnit(bounds.depth, unit)} · 천장{' '}
          {formatLengthWithUnit(room.ceilingHeight, unit)}
        </p>
      </aside>
      <main className="app-scene" data-testid="scene">
        <p className="app-placeholder">화면 준비 중</p>
      </main>
    </div>
  );
}
