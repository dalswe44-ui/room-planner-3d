// 평면 뷰, 3D 뷰, 사람 뷰 전환 버튼. store의 viewMode를 읽고 바꾼다.
import type { ViewMode } from '../contracts/types';
import { useProjectStore } from '../store/projectStore';

const OPTIONS: { mode: ViewMode; label: string; testId: string }[] = [
  { mode: '2d', label: '평면 뷰', testId: 'view-2d' },
  { mode: '3d', label: '3D 뷰', testId: 'view-3d' },
  { mode: 'walk', label: '사람 뷰', testId: 'view-walk' },
];

export function ViewToggle() {
  const viewMode = useProjectStore((s) => s.viewMode);
  const setViewMode = useProjectStore((s) => s.setViewMode);

  return (
    <div className="view-toggle" role="group" aria-label="화면 종류">
      {OPTIONS.map((option) => (
        <button
          key={option.mode}
          type="button"
          className="view-toggle-btn"
          data-testid={option.testId}
          aria-pressed={viewMode === option.mode}
          onClick={() => setViewMode(option.mode)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
