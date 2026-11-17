// 사진·배치도 가져오기 패널. 사진은 참고용으로만 보이고, 치수는 AI가 만든 JSON에서만 온다.
import { useEffect, useMemo, useRef, useState } from 'react';
import { KIND_LABEL } from '../contracts/furniturePresets';
import { LAYOUT_READER_PROMPT } from '../contracts/layoutImport';
import { roomBounds } from '../contracts/room';
import { formatLength, UNIT_LABEL } from '../contracts/units';
import { useProjectStore } from '../store/projectStore';
import { parseLayoutImport } from './parseLayoutImport';
import { usePhotoStore } from './photoStore';
import './photo.css';

export function PhotoPanel() {
  const unit = useProjectStore((s) => s.project.displayUnit);
  const ceilingHeight = useProjectStore((s) => s.project.room.ceilingHeight);
  const replaceProject = useProjectStore((s) => s.replaceProject);
  const photoUrl = usePhotoStore((s) => s.url);
  const storage = usePhotoStore((s) => s.storage);
  const [text, setText] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'fallback'>('idle');
  const [applyState, setApplyState] = useState<'idle' | 'confirming' | 'applied'>('idle');
  const [fileError, setFileError] = useState<string | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);

  // 확인 줄이 나타나면 "바꾸기" 버튼이 화면 안에 보이게 한다(작은 화면에서 아래로 잘림).
  useEffect(() => {
    if (applyState === 'confirming') confirmRef.current?.scrollIntoView({ block: 'nearest' });
  }, [applyState]);

  const result = useMemo(
    () => (text.trim() === '' ? null : parseLayoutImport(text, { displayUnit: unit, ceilingHeight })),
    [text, unit, ceilingHeight],
  );

  // 미리보기는 JSON의 단위로 보여 준다(사용자 그림의 숫자와 맞춰 보기 위해). 적용해도 표시 단위는 그대로.
  const previewUnit = result && result.ok ? result.unit : unit;
  const fmt = (mm: number) => formatLength(mm, previewUnit);
  const u = UNIT_LABEL[previewUnit];

  const changeText = (value: string) => {
    setText(value);
    setApplyState('idle');
  };

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(LAYOUT_READER_PROMPT);
      setCopyState('copied');
    } catch {
      setCopyState('fallback');
      // textarea가 그려진 뒤 전체 선택
      setTimeout(() => promptRef.current?.select(), 0);
    }
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    try {
      changeText(await file.text());
      setFileError(null);
    } catch {
      setFileError('파일을 읽지 못했습니다. 다른 파일을 고르거나 내용을 복사해 위 칸에 붙여 넣으세요.');
    }
  }

  function apply() {
    if (!result || !result.ok) return;
    replaceProject(result.project);
    setApplyState('applied');
  }

  return (
    <div className="photo-panel">
      <section className="photo-section">
        <h3 className="photo-title">방 사진 (참고용)</h3>
        <p className="photo-hint">사진은 이 기기에서만 보이고 밖으로 보내지 않습니다. 긴 변 2048px 이하로 줄여 이 브라우저에 보관하므로 새로고침해도 남습니다.</p>
        {storage === 'failed' && (
          <p className="photo-warn" role="status" data-testid="photo-storage-failed">
            이 브라우저가 보관을 막아 지금 탭에서만 보입니다. 새로고침하면 사라집니다.
          </p>
        )}
        <input
          type="file"
          accept="image/*"
          className="photo-file"
          data-testid="photo-file"
          aria-label="사진 고르기"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void usePhotoStore.getState().setFile(file);
            e.target.value = '';
          }}
        />
        {photoUrl && (
          <div className="photo-frame">
            <img src={photoUrl} alt="첨부한 방 사진" className="photo-img" data-testid="photo-preview" />
            <button type="button" className="btn" data-testid="photo-remove" onClick={() => usePhotoStore.getState().clear()}>
              사진 지우기
            </button>
          </div>
        )}
      </section>

      <section className="photo-section">
        <h3 className="photo-title">배치도로 방 만들기</h3>
        <ol className="photo-steps">
          <li>배치도에 치수를 적고 사진을 찍는다</li>
          <li>사진과 이 문구를 AI에게 보낸다</li>
          <li>AI가 준 JSON을 아래에 붙여 넣는다</li>
        </ol>
        <button type="button" className="btn" data-testid="layout-prompt-copy" onClick={copyPrompt}>
          AI에게 줄 문구 복사
        </button>
        {copyState === 'copied' && <p className="photo-ok" role="status">복사했습니다.</p>}
        {copyState === 'fallback' && (
          <div>
            <p className="photo-hint">자동 복사가 안 됩니다. 아래 문구를 길게 눌러 직접 복사하세요.</p>
            <textarea
              ref={promptRef}
              className="photo-textarea"
              readOnly
              rows={6}
              value={LAYOUT_READER_PROMPT}
              data-testid="layout-prompt-text"
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>
        )}

        <label className="photo-label" htmlFor="layout-json">AI가 준 JSON</label>
        <textarea
          id="layout-json"
          className="photo-textarea"
          rows={8}
          spellCheck={false}
          autoComplete="off"
          value={text}
          data-testid="layout-json"
          onChange={(e) => changeText(e.target.value)}
        />
        <label className="photo-label" htmlFor="layout-json-file">또는 .json 파일</label>
        <input
          id="layout-json-file"
          type="file"
          accept=".json,application/json"
          className="photo-file"
          data-testid="layout-json-file"
          onChange={(e) => {
            void readFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />

        {fileError && (
          <p className="photo-error" role="alert" data-testid="layout-file-error">
            {fileError}
          </p>
        )}

        {result && !result.ok && (
          <div className="photo-error" role="alert" data-testid="layout-error">
            <p>적용할 수 없습니다.</p>
            <ul>
              {result.errors.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        {result && result.ok && (
          <div className="card photo-preview" data-testid="layout-preview">
            <p className="photo-preview__room">
              방 {fmt(roomBounds(result.project.room).width)} × {fmt(roomBounds(result.project.room).depth)} ×{' '}
              {fmt(result.project.room.ceilingHeight)} {u}
            </p>
            {result.project.items.length === 0 ? (
              <p className="photo-hint">가구가 없습니다.</p>
            ) : (
              <ul className="photo-items">
                {result.project.items.map((it) => {
                  // 사용자가 자기 그림의 숫자와 맞춰 볼 수 있게, 가구 왼쪽·위쪽 변까지의 거리로 보여 준다.
                  const turned = it.rotationDeg === 90 || it.rotationDeg === 270;
                  const left = it.x - (turned ? it.d : it.w) / 2;
                  const top = it.z - (turned ? it.w : it.d) / 2;
                  return (
                    <li key={it.id}>
                      <strong>{it.name}</strong> ({KIND_LABEL[it.kind ?? 'box']}) {fmt(it.w)} × {fmt(it.d)} × {fmt(it.h)} {u}
                      {it.rotationDeg !== 0 && `, ${it.rotationDeg}° 회전`}
                      <br />
                      왼쪽 벽에서 {fmt(left)} {u}, 위쪽 벽에서 {fmt(top)} {u}
                    </li>
                  );
                })}
              </ul>
            )}
            {result.notes.length > 0 && (
              <div className="photo-notes" data-testid="layout-notes">
                <p className="photo-label">AI 메모</p>
                <ul>
                  {result.notes.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.warnings.length > 0 && (
              <div className="photo-warn" data-testid="layout-warnings">
                <p className="photo-label">경고</p>
                <ul>
                  {result.warnings.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {applyState !== 'confirming' && (
          <button
            type="button"
            className="btn btn--primary"
            data-testid="layout-apply"
            disabled={!result || !result.ok}
            onClick={() => setApplyState('confirming')}
          >
            이 배치로 바꾸기
          </button>
        )}
        {applyState === 'confirming' && (
          <div ref={confirmRef} className="photo-confirm" role="alertdialog" aria-label="바꾸기 확인">
            <p>지금의 방과 가구가 모두 바뀝니다</p>
            <div className="photo-confirm__actions">
              <button type="button" className="btn btn--primary" data-testid="layout-apply-confirm" onClick={apply}>
                바꾸기
              </button>
              <button type="button" className="btn btn--quiet" data-testid="layout-apply-cancel" onClick={() => setApplyState('idle')}>
                취소
              </button>
            </div>
          </div>
        )}
        {applyState === 'applied' && (
          <p className="photo-ok" role="status" data-testid="layout-applied">
            방과 가구를 바꿨습니다.
          </p>
        )}
      </section>
    </div>
  );
}
