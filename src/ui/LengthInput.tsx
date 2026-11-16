// 공용 길이 입력 칸. 입력 중인 글자는 이 컴포넌트의 상태로만 들고 있다가 Enter나 포커스 이탈 때 mm로 확정한다.
import { useId, useState } from 'react';
import type { DisplayUnit, Mm } from '../contracts/types';
import { formatLength, parseLength, UNIT_LABEL } from '../contracts/units';
import './ui.css';

export interface LengthInputProps {
  label: string;
  valueMm: Mm;
  unit: DisplayUnit;
  onCommit(mm: Mm): void;
  min?: Mm;
  max?: Mm;
  testId?: string;
}

type InputError = 'unreadable' | 'range';

export function LengthInput({ label, valueMm, unit, onCommit, min = 1, max, testId }: LengthInputProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const shown = formatLength(valueMm, unit);
  const [text, setText] = useState(shown);
  const [error, setError] = useState<InputError | null>(null);

  // valueMm이나 unit이 밖에서 바뀌면 칸의 글자를 새 값으로 맞춘다. 그 밖의 렌더에서는 입력 중인 글자를 건드리지 않는다.
  const [lastShown, setLastShown] = useState(shown);
  if (shown !== lastShown) {
    setLastShown(shown);
    setText(shown);
    setError(null);
  }

  function commit() {
    const mm = parseLength(text, unit);
    if (mm === null) {
      setError('unreadable');
      return;
    }
    if (mm < min || (max !== undefined && mm > max)) {
      setError('range');
      return;
    }
    setError(null);
    setText(formatLength(mm, unit));
    if (mm !== valueMm) onCommit(mm);
  }

  const unitLabel = UNIT_LABEL[unit];
  const range =
    max === undefined
      ? `${formatLength(min, unit)} ${unitLabel} 이상`
      : `${formatLength(min, unit)} ~ ${formatLength(max, unit)} ${unitLabel}`;
  const message =
    error === 'unreadable'
      ? `읽을 수 없는 값입니다. 허용 범위: ${range}`
      : `범위를 벗어났습니다. 허용 범위: ${range}`;

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
  );
}
