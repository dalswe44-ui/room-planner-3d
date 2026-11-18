// 헤더의 "파일" 메뉴(2026-11-19 QA 4-2, 5-2): 새로 시작, 예시 방, 파일로 저장·불러오기, 그림(PNG)으로 저장, 공유 링크.
// 프로젝트를 통째로 바꾸는 동작은 화면 안의 확인 줄을 거친다. 바꾼 뒤에는 되돌리기 한 번으로 돌아간다.
import { useEffect, useRef, useState } from 'react';
import { usePhotoStore } from '../photo/photoStore';
import { createDefaultProject, useProjectStore } from '../store/projectStore';
import { IconFile } from '../ui/icons';
import { captureScene } from '../scene/capture';
import { createExampleProject, downloadBlob, downloadText, parseProjectFile, PROJECT_FILE_NAME, projectFileText } from './projectFile';
import { makeShareLink } from './shareLink';

export const PNG_FILE_NAME = 'room-plan.png';
/** 이보다 긴 링크는 메신저 등에서 잘릴 수 있어 파일로 저장을 권한다 */
const LONG_LINK = 8000;
import './persistence.css';

type Pending = 'new' | 'example' | null;

const CONFIRM_TEXT: Record<Exclude<Pending, null>, string> = {
  new: '지금의 방과 가구를 지우고 기본 방(3600 × 3000 mm)으로 시작합니다. 첨부한 사진도 지웁니다. 방과 가구는 되돌리기로 되살릴 수 있습니다.',
  example: '지금의 방과 가구가 예시 방으로 바뀝니다. 되돌리기로 돌아올 수 있습니다.',
};

export function ProjectMenu() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 메뉴 밖을 누르거나 Escape를 누르면 닫는다.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        e.stopPropagation();
      }
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const toggle = () => {
    setOpen((v) => !v);
    setPending(null);
    setNote(null);
    setShareUrl(null);
  };

  const savePng = async () => {
    const blob = await captureScene();
    if (!blob) {
      setNote({ text: '화면을 그림으로 만들지 못했습니다. 3D 화면이 다 열린 뒤 다시 눌러 주세요.', error: true });
      return;
    }
    downloadBlob(PNG_FILE_NAME, blob);
    setNote({ text: `지금 보이는 화면을 ${PNG_FILE_NAME}로 저장했습니다. 평면·3D·사람 뷰를 바꿔 가며 저장할 수 있습니다.` });
  };

  const share = async () => {
    const url = makeShareLink(useProjectStore.getState().project);
    setShareUrl(url);
    const long = url.length > LONG_LINK ? ' 링크가 길어 일부 메신저에서 잘릴 수 있습니다. 그럴 때는 "파일로 저장"을 보내세요.' : '';
    try {
      await navigator.clipboard.writeText(url);
      setNote({ text: `공유 링크를 복사했습니다. 받은 사람이 열면 이 배치가 보입니다(사진은 담기지 않습니다).${long}` });
    } catch {
      setNote({ text: `아래 링크를 길게 눌러 복사하세요. 사진은 담기지 않습니다.${long}` });
    }
  };

  const confirm = () => {
    const store = useProjectStore.getState();
    if (pending === 'new') {
      store.replaceProject({ ...createDefaultProject(), displayUnit: store.project.displayUnit });
      usePhotoStore.getState().clear();
      setNote({ text: '기본 방으로 새로 시작했습니다.' });
    } else if (pending === 'example') {
      store.replaceProject({ ...createExampleProject(), displayUnit: store.project.displayUnit });
      setNote({ text: '예시 방을 열었습니다.' });
    }
    setPending(null);
  };

  const exportFile = () => {
    downloadText(PROJECT_FILE_NAME, projectFileText(useProjectStore.getState().project));
    setNote({ text: `${PROJECT_FILE_NAME} 파일로 저장했습니다.` });
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      setNote({ text: '파일을 읽지 못했습니다.', error: true });
      return;
    }
    const project = parseProjectFile(text);
    if (!project) {
      setNote({ text: '이 앱에서 저장한 프로젝트 파일이 아닙니다. 방이나 가구 값이 범위를 벗어났을 수도 있습니다.', error: true });
      return;
    }
    useProjectStore.getState().replaceProject(project);
    setNote({ text: '파일을 불러왔습니다. 되돌리기로 전 상태로 돌아갈 수 있습니다.' });
  };

  return (
    <div className="project-menu" ref={rootRef}>
      <button
        type="button"
        className="btn btn--quiet project-menu__button"
        data-testid="project-menu"
        aria-expanded={open}
        aria-controls="project-menu-panel"
        onClick={toggle}
      >
        <IconFile size={20} />
        <span className="project-menu__label">파일</span>
      </button>
      {open && (
        <div className="project-menu__panel card" id="project-menu-panel" data-testid="project-menu-panel" role="group" aria-label="파일">
          <button type="button" className="btn btn--quiet" data-testid="project-new" onClick={() => setPending('new')}>
            새로 시작
          </button>
          <button type="button" className="btn btn--quiet" data-testid="project-example" onClick={() => setPending('example')}>
            예시 방 열기
          </button>
          {pending && (
            <div className="project-menu__confirm" role="alertdialog" aria-label="바꾸기 확인" data-testid="project-confirm">
              <p>{CONFIRM_TEXT[pending]}</p>
              <div className="project-menu__confirm-actions">
                <button type="button" className="btn btn--primary" data-testid="project-confirm-ok" onClick={confirm}>
                  {pending === 'new' ? '새로 시작' : '예시 방 열기'}
                </button>
                <button type="button" className="btn btn--quiet" data-testid="project-confirm-cancel" onClick={() => setPending(null)}>
                  취소
                </button>
              </div>
            </div>
          )}
          <hr className="project-menu__rule" />
          <button type="button" className="btn btn--quiet" data-testid="project-export" onClick={exportFile}>
            파일로 저장 (.json)
          </button>
          <button type="button" className="btn btn--quiet" data-testid="project-import" onClick={() => fileRef.current?.click()}>
            파일 불러오기
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="project-menu__file"
            data-testid="project-import-file"
            aria-label="프로젝트 파일 고르기"
            tabIndex={-1}
            onChange={(e) => {
              void importFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <hr className="project-menu__rule" />
          <button type="button" className="btn btn--quiet" data-testid="project-png" onClick={() => void savePng()}>
            화면을 그림으로 저장 (.png)
          </button>
          <button type="button" className="btn btn--quiet" data-testid="project-share" onClick={() => void share()}>
            공유 링크 만들기
          </button>
          {shareUrl && (
            <input
              className="project-menu__share"
              readOnly
              value={shareUrl}
              aria-label="공유 링크"
              data-testid="share-link-url"
              onFocus={(e) => e.currentTarget.select()}
            />
          )}
          {note && (
            <p className={note.error ? 'project-menu__note project-menu__note--error' : 'project-menu__note'} role="status" data-testid="project-note">
              {note.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
