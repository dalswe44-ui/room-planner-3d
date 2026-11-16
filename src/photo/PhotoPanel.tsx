// 사진·배치도 가져오기 패널. 사진은 참고용으로만 보이고, 치수는 AI가 만든 JSON에서만 온다.
import { useMemo, useRef, useState } from 'react';
import { FURNITURE_PRESETS } from '../contracts/furniturePresets';
import { LAYOUT_READER_PROMPT } from '../contracts/layoutImport';
import { roomBounds } from '../contracts/room';
import type { FurnitureKind } from '../contracts/types';
import { formatLength, UNIT_LABEL } from '../contracts/units';
import { useProjectStore } from '../store/projectStore';
import { parseLayoutImport } from './parseLayoutImport';
import { usePhotoStore } from './photoStore';
import './photo.css';

function kindLabel(kind: FurnitureKind | undefined): string {
  return FURNITURE_PRESETS.find((p) => p.kind === kind)?.label ?? '상자';
}

export function PhotoPanel() {
  const unit = useProjectStore((s) => s.project.displayUnit);
  const ceilingHeight = useProjectStore((s) => s.project.room.ceilingHeight);
  const replaceProject = useProjectStore((s) => s.replaceProject);
  const photoUrl = usePhotoStore((s) => s.url);
  const [text, setText] = useState('');
  const [fallbackPrompt, setFallbackPrompt] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [applied, setApplied] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const u = UNIT_LABEL[unit];
  const fmt = (mm: number) => formatLength(mm, unit);

  const result = useMemo(
    () => (text.trim() === '' ? null : parseLayoutImport(text, { displayUnit: unit, ceilingHeight })),
    [text, unit, ceilingHeight],
  );

  const changeText = (value: string) => {
    setText(value);
    setConfirming(false);
    setApplied(false);
  };

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(LAYOUT_READER_PROMPT);
      setCopied(true);
      setFallbackPrompt(false);
    } catch {
      setCopied(false);
      setFallbackPrompt(true);
      // textarea가 그려진 뒤 전체 선택
      setTimeout(() => promptRef.current?.select(), 0);
    }
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    changeText(await file.text());
  }

  function apply() {
    if (!result || !result.ok) return;
    replaceProject(result.project);
    setConfirming(false);
    setApplied(true);
  }

  return (
    <div className="photo-panel">
      <section className="photo-section">
        <h3 className="photo-title">방 사진 (참고용)</h3>
        <p className="photo-hint">사진은 이 기기에서만 보이고 밖으로 보내지 않습니다. 새로고침하면 사라집니다.</p>
        <input
          type="file"
          accept="image/*"
          className="photo-file"
          data-testid="photo-file"
          aria-label="사진 고르기"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) usePhotoStore.getState().setFile(file);
            e.target.value = '';
          }}
        />
        {photoUrl && (
          <div className="photo-frame">
            <img src={photoUrl} alt="첨부한 방 사진" className="photo-img" data-testid="photo-preview" />
            <button type="button" className="photo-button" data-testid="photo-remove" onClick={() => usePhotoStore.getState().clear()}>
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
        <button type="button" className="photo-button" data-testid="layout-prompt-copy" onClick={copyPrompt}>
          AI에게 줄 문구 복사
        </button>
        {copied && <p className="photo-ok" role="status">복사했습니다.</p>}
        {fallbackPrompt && (
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
          <div className="photo-preview" data-testid="layout-preview">
            <p className="photo-preview__room">
              방 {fmt(roomBounds(result.project.room).width)} × {fmt(roomBounds(result.project.room).depth)} ×{' '}
              {fmt(result.project.room.ceilingHeight)} {u}
            </p>
            {result.project.items.length === 0 ? (
              <p className="photo-hint">가구가 없습니다.</p>
            ) : (
              <ul className="photo-items">
                {result.project.items.map((it) => (
                  <li key={it.id}>
                    <strong>{it.name}</strong> ({kindLabel(it.kind)}) {fmt(it.w)} × {fmt(it.d)} × {fmt(it.h)} {u}, 중심 ({fmt(it.x)}, {fmt(it.z)}) {u}
                    {it.rotationDeg !== 0 && `, ${it.rotationDeg}° 회전`}
                  </li>
                ))}
              </ul>
            )}
            {result.notes.length > 0 && (
              <div data-testid="layout-notes">
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

        {!confirming && (
          <button
            type="button"
            className="photo-button photo-button--primary"
            data-testid="layout-apply"
            disabled={!result || !result.ok}
            onClick={() => setConfirming(true)}
          >
            이 배치로 바꾸기
          </button>
        )}
        {confirming && (
          <div className="photo-confirm" role="alertdialog" aria-label="바꾸기 확인">
            <p>지금의 방과 가구가 모두 바뀝니다</p>
            <div className="photo-confirm__actions">
              <button type="button" className="photo-button photo-button--primary" data-testid="layout-apply-confirm" onClick={apply}>
                바꾸기
              </button>
              <button type="button" className="photo-button" data-testid="layout-apply-cancel" onClick={() => setConfirming(false)}>
                취소
              </button>
            </div>
          </div>
        )}
        {applied && (
          <p className="photo-ok" role="status" data-testid="layout-applied">
            방과 가구를 바꿨습니다.
          </p>
        )}
      </section>
    </div>
  );
}
