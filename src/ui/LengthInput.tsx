// 공용 길이 입력 칸. 입력 중인 글자는 이 컴포넌트의 상태로만 들고 있다가 Enter나 포커스 이탈 때 mm로 확정한다.
import { useEffect, useId, useRef, useState } from 'react';
import type { DisplayUnit, Mm } from '../contracts/types';
import { DISPLAY_UNITS, formatLength, normalizeLengthInput, parseLength, UNIT_LABEL } from '../contracts/units';
import './ui.css';

export interface LengthInputProps {
  label: string;
  valueMm: Mm;
  unit: DisplayUnit;
  onCommit(mm: Mm): void;
  min?: Mm;
  max?: Mm;
  testId?: string;
  /** 칸이 거부 상태(오류 문구가 보이는 상태)가 되면 false, 거기서 벗어나면 true. 상태가 바뀔 때만 부른다. */
  onValidityChange?(valid: boolean): void;
}

type InputError = 'empty' | 'unreadable' | 'range';

/** 단위 없이 넣은 값이 범위를 벗어났을 때, 다른 단위를 붙이면 범위에 드는지 보고 예를 돌려준다(예: mm 칸의 3.5 → "3.5m"). */
export function unitSuggestion(text: string, unit: DisplayUnit, min: Mm, max: Mm | undefined): string | null {
  const t = text.trim();
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(t)) return null;
  for (const u of DISPLAY_UNITS) {
    if (u === unit) continue;
    const mm = parseLength(t + u, u);
    if (mm !== null && mm >= min && (max === undefined || mm <= max)) return `${t}${UNIT_LABEL[u]}`;
  }
  return null;
}

export function LengthInput({
  label,
  valueMm,
  unit,
  onCommit,
  min = 1,
  max,
  testId,
  onValidityChange,
}: LengthInputProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const shown = formatLength(valueMm, unit);
  const [text, setText] = useState(shown);
  const [error, setError] = useState<InputError | null>(null);
  // 범위를 벗어난 값이 다른 단위로는 맞을 때 보여 줄 예("3.5m"). 2026-11-19 QA 4-5
  const [suggestion, setSuggestion] = useState<string | null>(null);

  // valueMm이나 unit이 밖에서 바뀌면 칸의 글자를 새 값으로 맞춘다. 그 밖의 렌더에서는 입력 중인 글자를 건드리지 않는다.
  const [lastShown, setLastShown] = useState(shown);
  if (shown !== lastShown) {
    setLastShown(shown);
    setText(shown);
    setError(null);
  }

  // 부모에게 마지막으로 알린 상태. 처음에는 오류가 없으므로 true이고, 이 값과 달라질 때만 알린다.
  const reportedValid = useRef(true);
  function reportValidity(valid: boolean) {
    if (reportedValid.current === valid) return;
    reportedValid.current = valid;
    onValidityChange?.(valid);
  }

  // 확정이 아니라 밖에서 바뀐 valueMm·unit 때문에 오류가 사라진 경우를 알린다.
  // 확정으로 생기거나 사라진 오류는 commit()이 그 이벤트 안에서 바로 알린다.
  useEffect(() => {
    if (error === null) reportValidity(true);
  });

  function commit() {
    const normalized = normalizeLengthInput(text);
    if (normalized.trim() === '') {
      setError('empty');
      reportValidity(false);
      return;
    }
    const mm = parseLength(normalized, unit);
    if (mm === null) {
      setError('unreadable');
      reportValidity(false);
      return;
    }
    if (mm < min || (max !== undefined && mm > max)) {
      setError('range');
      setSuggestion(unitSuggestion(normalized, unit, min, max));
      reportValidity(false);
      return;
    }
    setError(null);
    setText(formatLength(mm, unit));
    reportValidity(true);
    if (mm !== valueMm) onCommit(mm);
  }

  const unitLabel = UNIT_LABEL[unit];
  const range =
    max === undefined
      ? `${formatLength(min, unit)} ${unitLabel} 이상`
      : `${formatLength(min, unit)} ~ ${formatLength(max, unit)} ${unitLabel}`;
  const message =
    error === 'empty'
      ? `값을 넣어 주세요. 허용 범위: ${range}`
      : error === 'unreadable'
        ? `읽을 수 없는 값입니다. 숫자만 넣거나 360cm, 3.6m처럼 단위를 붙이세요. 허용 범위: ${range}`
        : `범위를 벗어났습니다. 허용 범위: ${range}${suggestion ? `. ${suggestion}처럼 단위를 붙여 보세요` : ''}`;

  return (
    <div className="length-input">
      <label className="length-input__label" htmlFor={id}>
        {label}
      </label>
      <div className="length-input__box" data-invalid={error !== null}>
        <input
          id={id}
          className="length-input__field"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          value={text}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          data-testid={testId}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
          }}
        />
        <span className="length-input__unit">{unitLabel}</span>
      </div>
      {/* 오류 줄은 문구가 없어도 항상 있다. 문구가 나타나거나 사라져도 이 줄의 DOM 노드와 높이는 그대로다. */}
      <div className="length-input__error-line">
        {error && (
          <p
            id={errorId}
            className="length-input__error"
            role="alert"
            data-testid={testId ? `${testId}-error` : undefined}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
