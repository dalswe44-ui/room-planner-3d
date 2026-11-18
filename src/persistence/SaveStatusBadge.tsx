// 헤더의 자동 저장 표시(2026-11-19 QA 4-2). 저장은 usePersistence가 하고 여기는 상태만 보인다.
import { useSaveStatus } from './usePersistence';

const TEXT = {
  idle: '자동 저장 켜짐',
  pending: '저장 중…',
  saved: '자동 저장됨',
  failed: '저장 안 됨',
} as const;

const TITLE = {
  idle: '바꾸면 이 브라우저에 자동으로 저장됩니다',
  pending: '곧 이 브라우저에 저장됩니다',
  saved: '이 브라우저에 저장했습니다. 새로 고쳐도 남습니다',
  failed: '이 브라우저가 저장을 막았습니다. 파일 메뉴의 "파일로 저장"으로 보관하세요',
} as const;

export function SaveStatusBadge() {
  const status = useSaveStatus((s) => s.status);
  return (
    <span className={`save-status save-status--${status}`} data-testid="save-status" data-status={status} title={TITLE[status]} role="status">
      {TEXT[status]}
    </span>
  );
}
