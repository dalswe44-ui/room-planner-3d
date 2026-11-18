// 처음 화면의 세 단계 안내(2026-11-19 QA 4-1). 닫으면 이 브라우저에서는 다시 보이지 않는다.
import { useState } from 'react';
import { IconClose } from '../furniture/DraftIcons';

const KEY = 'room-planner-3d/first-steps-closed';

function readClosed(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function FirstSteps({ onPhoto }: { onPhoto(): void }) {
  const [closed, setClosed] = useState(readClosed);
  if (closed) return null;
  const close = () => {
    setClosed(true);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // 보관할 수 없으면 이번에만 닫는다.
    }
  };
  return (
    <section className="first-steps card" aria-label="사용 순서" data-testid="first-steps">
      <div className="first-steps__head">
        <h2 className="first-steps__title">이렇게 써 보세요</h2>
        <button type="button" className="icon-btn first-steps__close" aria-label="안내 닫기" title="안내 닫기" data-testid="first-steps-close" onClick={close}>
          <IconClose size={18} />
        </button>
      </div>
      <ol>
        <li>
          <strong>방 치수</strong>: 아래에 폭·깊이·천장 높이를 넣으세요. 치수를 적은 배치도가 있으면{' '}
          <button type="button" className="link-btn" data-testid="first-steps-photo" onClick={onPhoto}>
            배치도 사진
          </button>
          으로 한 번에 만들 수 있어요(방을 찍은 실내 사진은 치수를 읽지 못해요).
        </li>
        <li>
          <strong>가구 추가</strong>: 침대·책상 같은 기본 가구를 누르거나 치수를 직접 넣으세요. 평면 뷰에서 끌어 옮겨요.
        </li>
        <li>
          <strong>확인</strong>: 위쪽의 평면 뷰·3D 뷰·사람 뷰로 바꿔 보세요. 겹치거나 방 밖이면 빗금과 문구로 알려 줘요.
        </li>
      </ol>
    </section>
  );
}
