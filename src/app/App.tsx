// 앱의 조립 지점. 각 모듈이 내보낸 컴포넌트를 여기서 한 화면으로 묶는다. 이 파일은 헤드만 고친다.
import { RoomPanel } from '../room/RoomPanel';
import { UnitToggle } from '../ui/UnitToggle';

export function App() {
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
        <p className="app-placeholder">화면 준비 중</p>
      </main>
    </div>
  );
}
