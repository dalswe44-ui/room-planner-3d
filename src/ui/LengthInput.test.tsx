import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DisplayUnit, Mm } from '../contracts/types';
import { LengthInput } from './LengthInput';

afterEach(cleanup);

interface HarnessProps {
  initial?: Mm;
  unit?: DisplayUnit;
  min?: Mm;
  max?: Mm;
  onCommit?: (mm: Mm) => void;
}

/** 확정된 값을 부모가 들고 다시 내려 주는, 실제 쓰임과 같은 형태 */
function Harness({ initial = 3600, unit = 'mm', min, max, onCommit }: HarnessProps) {
  const [value, setValue] = useState(initial);
  return (
    <LengthInput
      label="폭"
      valueMm={value}
      unit={unit}
      min={min}
      max={max}
      testId="len"
      onCommit={(mm) => {
        onCommit?.(mm);
        setValue(mm);
      }}
    />
  );
}

const field = () => screen.getByTestId<HTMLInputElement>('len');
const errorText = () => screen.queryByTestId('len-error')?.textContent ?? null;

/** 칸을 비우고 글자를 넣은 뒤 Enter */
async function enter(text: string) {
  const user = userEvent.setup();
  await user.clear(field());
  if (text !== '') await user.type(field(), text);
  await user.keyboard('{Enter}');
}

describe('LengthInput', () => {
  it('값을 표시 단위로 보여 주고, label이 칸에 연결돼 있고, 숫자 키패드를 요청한다', () => {
    render(<Harness initial={3600} unit="cm" />);
    expect(field().value).toBe('360.0');
    expect(screen.getByLabelText('폭')).toBe(field());
    expect(field().tagName).toBe('INPUT');
    expect(field().getAttribute('inputmode')).toBe('decimal');
    expect(errorText()).toBeNull();
  });

  it('Enter로 확정한다', async () => {
    const onCommit = vi.fn();
    render(<Harness min={500} max={20000} onCommit={onCommit} />);
    await enter('4000');
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(4000);
    expect(field().value).toBe('4000');
    expect(errorText()).toBeNull();
  });

  it('포커스 이탈로 확정한다', async () => {
    const onCommit = vi.fn();
    const user = userEvent.setup();
    render(<Harness min={500} max={20000} onCommit={onCommit} />);
    await user.clear(field());
    await user.type(field(), '4200');
    expect(onCommit).not.toHaveBeenCalled();
    await user.tab();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(4200);
  });

  it.each(['', '   ', 'abc', '-100', '1m20cm', '12 34', '1,2', '10km'])(
    '읽을 수 없는 값 "%s"은 확정하지 않고 허용 범위가 든 오류를 보여 준다',
    async (text) => {
      const onCommit = vi.fn();
      render(<Harness min={500} max={20000} onCommit={onCommit} />);
      await enter(text);
      expect(onCommit).not.toHaveBeenCalled();
      expect(errorText()).toContain('500');
      expect(errorText()).toContain('20000');
      expect(field().getAttribute('aria-invalid')).toBe('true');
    },
  );

  // 2026-11-19 QA 4-5: 천 단위 쉼표, 전각 숫자, 빈 칸 문구, 단위 힌트
  it('천 단위 쉼표("3,600")와 전각 숫자("３６００", "３．６ｍ")를 읽는다', async () => {
    for (const [text, mm] of [['3,600', 3600], ['３６００', 3600], ['３．６ｍ', 3600], ['12,000mm', 12000]] as const) {
      const onCommit = vi.fn();
      const { unmount } = render(<Harness initial={1000} min={500} max={20000} onCommit={onCommit} />);
      await enter(text);
      expect(onCommit, text).toHaveBeenCalledWith(mm);
      unmount();
    }
  });

  it('빈 칸은 "값을 넣어 주세요"를 보인다', async () => {
    render(<Harness min={500} max={20000} onCommit={vi.fn()} />);
    await enter('');
    expect(errorText()).toContain('값을 넣어 주세요');
  });

  it('mm 칸의 3.5는 범위 오류와 함께 "3.5m처럼 단위를 붙여 보세요"를 보인다', async () => {
    render(<Harness min={500} max={20000} onCommit={vi.fn()} />);
    await enter('3.5');
    expect(errorText()).toContain('3.5m처럼 단위를 붙여 보세요');
    expect(errorText()).toContain('500');
  });

  it.each(['0', '499', '20001', '3.5'])('범위 밖의 값 "%s"은 확정하지 않고 오류를 보여 준다', async (text) => {
    const onCommit = vi.fn();
    render(<Harness min={500} max={20000} onCommit={onCommit} />);
    await enter(text);
    expect(onCommit).not.toHaveBeenCalled();
    expect(errorText()).toContain('500');
    expect(errorText()).toContain('20000');
  });

  it('포커스 이탈로 확정할 때도 잘못된 값은 거부한다', async () => {
    const onCommit = vi.fn();
    const user = userEvent.setup();
    render(<Harness min={500} max={20000} onCommit={onCommit} />);
    await user.clear(field());
    await user.type(field(), 'abc');
    await user.tab();
    expect(onCommit).not.toHaveBeenCalled();
    expect(errorText()).not.toBeNull();
  });

  it('경계값 min과 max는 받아들인다', async () => {
    const onCommit = vi.fn();
    render(<Harness min={500} max={20000} onCommit={onCommit} />);
    await enter('500');
    await enter('20000');
    expect(onCommit.mock.calls).toEqual([[500], [20000]]);
    expect(errorText()).toBeNull();
  });

  it('오류 문구의 허용 범위는 현재 표시 단위의 숫자다', async () => {
    const mm = render(<Harness unit="mm" min={500} max={20000} />);
    await enter('abc');
    expect(errorText()).toContain('500 ~ 20000 mm');
    mm.unmount();

    const cm = render(<Harness unit="cm" min={500} max={20000} />);
    await enter('abc');
    expect(errorText()).toContain('50.0 ~ 2000.0 cm');
    cm.unmount();

    render(<Harness unit="m" min={500} max={20000} />);
    await enter('3600');
    expect(errorText()).toContain('0.500 ~ 20.000 m');
  });

  it('min의 기본값은 1이고, max가 없으면 위쪽은 막지 않는다', async () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    await enter('0');
    expect(onCommit).not.toHaveBeenCalled();
    expect(errorText()).toContain('1 mm');
    await enter('1');
    await enter('123456');
    expect(onCommit.mock.calls).toEqual([[1], [123456]]);
    expect(errorText()).toBeNull();
  });

  it('거부된 글자는 지우지 않고, 올바른 값을 확정하면 오류가 사라진다', async () => {
    const onCommit = vi.fn();
    render(<Harness min={500} max={20000} onCommit={onCommit} />);
    await enter('abc');
    expect(field().value).toBe('abc');
    expect(errorText()).not.toBeNull();
    await enter('4000');
    expect(errorText()).toBeNull();
    expect(field().getAttribute('aria-invalid')).toBe('false');
    expect(onCommit.mock.calls).toEqual([[4000]]);
  });

  it('단위를 붙이면 그 단위로 읽고, 확정한 뒤 칸은 현재 표시 단위로 바뀐다', async () => {
    const onCommit = vi.fn();
    render(<Harness unit="mm" min={500} max={20000} onCommit={onCommit} />);
    await enter('440cm');
    expect(field().value).toBe('4400');
    await enter('4.5m');
    expect(field().value).toBe('4500');
    await enter(' 4.6 M ');
    expect(field().value).toBe('4600');
    expect(onCommit.mock.calls).toEqual([[4400], [4500], [4600]]);
  });

  it('값이 같은 다른 표기를 확정하면 onCommit 없이 칸만 정리한다', async () => {
    const onCommit = vi.fn();
    render(<Harness initial={3600} unit="mm" min={500} max={20000} onCommit={onCommit} />);
    await enter('360cm');
    expect(field().value).toBe('3600');
    expect(onCommit).not.toHaveBeenCalled();
    expect(errorText()).toBeNull();
  });

  it('입력 도중의 글자("1.")는 다시 그려져도 덮어쓰지 않는다', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const view = render(<LengthInput label="폭" valueMm={3600} unit="m" onCommit={onCommit} testId="len" />);
    await user.clear(field());
    await user.type(field(), '1.');
    expect(field().value).toBe('1.');
    view.rerender(<LengthInput label="폭" valueMm={3600} unit="m" onCommit={onCommit} testId="len" />);
    expect(field().value).toBe('1.');
    await user.type(field(), '25');
    expect(field().value).toBe('1.25');
    expect(onCommit).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(onCommit).toHaveBeenCalledWith(1250);
  });

  it('valueMm이 밖에서 바뀌면 칸의 글자가 새 값으로 바뀐다', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const view = render(<LengthInput label="폭" valueMm={3600} unit="mm" onCommit={onCommit} testId="len" />);
    await user.clear(field());
    await user.type(field(), 'abc{Enter}');
    expect(errorText()).not.toBeNull();
    view.rerender(<LengthInput label="폭" valueMm={4200} unit="mm" onCommit={onCommit} testId="len" />);
    expect(field().value).toBe('4200');
    expect(errorText()).toBeNull();
  });

  it('unit이 밖에서 바뀌면 칸의 글자가 formatLength(valueMm, unit)으로 바뀐다', () => {
    const onCommit = vi.fn();
    const view = render(<LengthInput label="폭" valueMm={1234} unit="mm" onCommit={onCommit} testId="len" />);
    expect(field().value).toBe('1234');
    view.rerender(<LengthInput label="폭" valueMm={1234} unit="cm" onCommit={onCommit} testId="len" />);
    expect(field().value).toBe('123.4');
    view.rerender(<LengthInput label="폭" valueMm={1234} unit="m" onCommit={onCommit} testId="len" />);
    expect(field().value).toBe('1.234');
    view.rerender(<LengthInput label="폭" valueMm={1234} unit="mm" onCommit={onCommit} testId="len" />);
    expect(field().value).toBe('1234');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it.each<[DisplayUnit, string]>([
    ['mm', '1234'],
    ['cm', '123.4'],
    ['m', '1.234'],
  ])('%s에서 값을 고치지 않고 Enter를 눌러도 오류가 없고 값이 그대로다', async (unit, shown) => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness initial={1234} unit={unit} min={500} max={20000} onCommit={onCommit} />);
    await user.click(field());
    await user.keyboard('{Enter}');
    await user.tab();
    expect(field().value).toBe(shown);
    expect(errorText()).toBeNull();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('testId가 없으면 data-testid를 붙이지 않는다', async () => {
    const user = userEvent.setup();
    render(<LengthInput label="폭" valueMm={3600} unit="mm" onCommit={() => {}} />);
    const input = screen.getByLabelText<HTMLInputElement>('폭');
    expect(input.hasAttribute('data-testid')).toBe(false);
    await user.clear(input);
    await user.keyboard('{Enter}');
    const alert = screen.getByRole('alert');
    expect(alert.hasAttribute('data-testid')).toBe(false);
    expect(input.getAttribute('aria-describedby')).toBe(alert.id);
  });
});

describe('LengthInput onValidityChange', () => {
  interface ValidityHarnessProps {
    onValidityChange: (valid: boolean) => void;
    onCommit?: (mm: Mm) => void;
  }

  /** 부모가 콜백을 렌더마다 새 함수로 내려 주는, 실제 쓰임과 같은 형태 */
  function ValidityHarness({ onValidityChange, onCommit }: ValidityHarnessProps) {
    const [value, setValue] = useState<Mm>(3600);
    return (
      <>
        <LengthInput
          label="폭"
          valueMm={value}
          unit="mm"
          min={500}
          max={20000}
          testId="len"
          onCommit={(mm) => {
            onCommit?.(mm);
            setValue(mm);
          }}
          onValidityChange={(valid) => onValidityChange(valid)}
        />
        <button type="button">다른 곳</button>
      </>
    );
  }

  it('처음 그릴 때, 다시 그릴 때, 글자를 넣는 동안에는 부르지 않는다', async () => {
    const user = userEvent.setup();
    const onValidityChange = vi.fn();
    const view = render(<ValidityHarness onValidityChange={onValidityChange} />);
    view.rerender(<ValidityHarness onValidityChange={onValidityChange} />);
    await user.clear(field());
    await user.type(field(), 'abc');
    expect(onValidityChange).not.toHaveBeenCalled();
  });

  it.each([
    ['빈 값', ''],
    ['글자', 'abc'],
    ['범위 아래', '499'],
    ['범위 위', '20001'],
    ['m로 생각한 값', '3.5'],
  ])('%s("%s")을 넣고 포커스를 옮기면 false를 한 번 부른다', async (_name, text) => {
    const user = userEvent.setup();
    const onValidityChange = vi.fn();
    const view = render(<ValidityHarness onValidityChange={onValidityChange} />);
    await user.clear(field());
    if (text !== '') await user.type(field(), text);
    await user.tab();
    expect(errorText()).not.toBeNull();
    expect(onValidityChange.mock.calls).toEqual([[false]]);
    view.rerender(<ValidityHarness onValidityChange={onValidityChange} />);
    expect(onValidityChange.mock.calls).toEqual([[false]]);
  });

  it('거부 상태에서 다시 거부돼도(오류 종류가 바뀌어도) 한 번 더 부르지 않는다', async () => {
    const onValidityChange = vi.fn();
    render(<ValidityHarness onValidityChange={onValidityChange} />);
    await enter('abc');
    await enter('abc');
    await enter('499');
    await enter('');
    expect(errorText()).not.toBeNull();
    expect(onValidityChange.mock.calls).toEqual([[false]]);
  });

  it('거부된 뒤 올바른 값을 확정하면 true를 부른다', async () => {
    const onValidityChange = vi.fn();
    const onCommit = vi.fn();
    render(<ValidityHarness onValidityChange={onValidityChange} onCommit={onCommit} />);
    await enter('abc');
    await enter('4000');
    expect(errorText()).toBeNull();
    expect(onValidityChange.mock.calls).toEqual([[false], [true]]);
    expect(onCommit.mock.calls).toEqual([[4000]]);
    await enter('4100');
    expect(onValidityChange.mock.calls).toEqual([[false], [true]]);
  });

  it('거부된 뒤 원래 값과 같은 값을 확정해도(onCommit 없음) true를 부른다', async () => {
    const onValidityChange = vi.fn();
    const onCommit = vi.fn();
    render(<ValidityHarness onValidityChange={onValidityChange} onCommit={onCommit} />);
    await enter('abc');
    await enter('3600');
    expect(onCommit).not.toHaveBeenCalled();
    expect(onValidityChange.mock.calls).toEqual([[false], [true]]);
  });

  it('오류가 없던 칸에 올바른 값을 확정하면 부르지 않는다', async () => {
    const user = userEvent.setup();
    const onValidityChange = vi.fn();
    render(<ValidityHarness onValidityChange={onValidityChange} />);
    await enter('4000');
    await user.clear(field());
    await user.type(field(), '4200');
    await user.tab();
    expect(onValidityChange).not.toHaveBeenCalled();
  });

  it('거부 → 올바른 값 → 거부를 되풀이하면 바뀔 때마다 한 번씩 부른다', async () => {
    const onValidityChange = vi.fn();
    render(<ValidityHarness onValidityChange={onValidityChange} />);
    await enter('abc');
    await enter('4000');
    await enter('0');
    await enter('5000');
    expect(onValidityChange.mock.calls).toEqual([[false], [true], [false], [true]]);
  });

  it('거부 상태에서 valueMm이 밖에서 바뀌어 오류가 사라지면 true를 부른다', async () => {
    const onValidityChange = vi.fn();
    const props = { label: '폭', unit: 'mm' as const, onCommit: () => {}, testId: 'len', onValidityChange };
    const view = render(<LengthInput {...props} valueMm={3600} />);
    await enter('abc');
    expect(onValidityChange.mock.calls).toEqual([[false]]);
    view.rerender(<LengthInput {...props} valueMm={4200} />);
    expect(errorText()).toBeNull();
    expect(onValidityChange.mock.calls).toEqual([[false], [true]]);
    view.rerender(<LengthInput {...props} valueMm={4200} />);
    expect(onValidityChange.mock.calls).toEqual([[false], [true]]);
  });

  it('거부 상태에서 unit이 밖에서 바뀌어 오류가 사라지면 true를 부른다', async () => {
    const onValidityChange = vi.fn();
    const props = { label: '폭', valueMm: 3600, onCommit: () => {}, testId: 'len', onValidityChange };
    const view = render(<LengthInput {...props} unit="mm" />);
    await enter('abc');
    view.rerender(<LengthInput {...props} unit="cm" />);
    expect(field().value).toBe('360.0');
    expect(errorText()).toBeNull();
    expect(onValidityChange.mock.calls).toEqual([[false], [true]]);
  });

  it('오류가 없을 때 valueMm·unit이 밖에서 바뀌면 부르지 않는다', () => {
    const onValidityChange = vi.fn();
    const props = { label: '폭', onCommit: () => {}, testId: 'len', onValidityChange };
    const view = render(<LengthInput {...props} valueMm={3600} unit="mm" />);
    view.rerender(<LengthInput {...props} valueMm={4200} unit="mm" />);
    view.rerender(<LengthInput {...props} valueMm={4200} unit="m" />);
    expect(onValidityChange).not.toHaveBeenCalled();
  });

  /** 가구 추가 폼과 같은 형태: 부모가 칸의 상태를 들고 있고, 버튼의 click 핸들러가 그 상태를 본다 */
  function AddForm({ onAdd }: { onAdd: (seen: { state: boolean; latest: boolean }) => void }) {
    const [value, setValue] = useState<Mm>(1000);
    const [valid, setValid] = useState(true);
    const [latest] = useState({ valid: true });
    return (
      <>
        <LengthInput
          label="폭"
          valueMm={value}
          unit="mm"
          min={10}
          max={10000}
          testId="len"
          onCommit={setValue}
          onValidityChange={(v) => {
            latest.valid = v;
            setValid(v);
          }}
        />
        <button type="button" data-testid="add" onClick={() => onAdd({ state: valid, latest: latest.valid })}>
          추가
        </button>
      </>
    );
  }

  it.each([
    ['빈 값', ''],
    ['글자', 'abc'],
    ['범위 밖', '10001'],
  ])(
    '%s을 넣은 칸에서 곧바로 다른 버튼을 누르면, 그 버튼의 click 핸들러가 실행될 때 이미 false가 전달돼 있다',
    async (_name, text) => {
      const user = userEvent.setup();
      const onAdd = vi.fn();
      render(<AddForm onAdd={onAdd} />);
      await user.clear(field());
      if (text !== '') await user.type(field(), text);
      expect(document.activeElement).toBe(field());
      await user.click(screen.getByTestId('add'));
      expect(onAdd).toHaveBeenCalledTimes(1);
      expect(onAdd).toHaveBeenCalledWith({ state: false, latest: false });
    },
  );

  it('거부된 칸을 올바른 값으로 고치고 곧바로 버튼을 누르면, click 핸들러가 실행될 때 이미 true가 전달돼 있다', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<AddForm onAdd={onAdd} />);
    await enter('abc');
    await user.clear(field());
    await user.type(field(), '1200');
    await user.click(screen.getByTestId('add'));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith({ state: true, latest: true });
  });

  it('Enter로 확정하면 그 keydown 안에서 false나 true가 전달된다', async () => {
    const user = userEvent.setup();
    const seen: boolean[] = [];
    let latest = true;
    render(
      // 폼 안에서 Enter를 누르는 경우처럼, 칸의 keydown 뒤에 이어지는 처리에서 상태를 본다
      <div onKeyDown={(e) => e.key === 'Enter' && seen.push(latest)}>
        <LengthInput
          label="폭"
          valueMm={1000}
          unit="mm"
          onCommit={() => {}}
          testId="len"
          onValidityChange={(v) => {
            latest = v;
          }}
        />
      </div>,
    );
    await user.clear(field());
    await user.keyboard('{Enter}');
    expect(seen).toEqual([false]);
    await user.type(field(), '1200{Enter}');
    expect(seen).toEqual([false, true]);
  });
});

describe('LengthInput 오류 줄 자리', () => {
  // 높이는 CSS(ui.css의 격자 줄 높이)로 정해지고 jsdom은 CSS 높이를 계산하지 않는다.
  // 여기서는 높이를 차지할 요소가 항상 DOM에 있고, 문구는 그 안에만 들어간다는 구조를 확인한다.
  const errorLine = () => field().closest('.length-input')?.querySelector<HTMLElement>('.length-input__error-line') ?? null;

  it('오류가 없을 때도 칸마다 오류 줄 요소가 하나 있고 비어 있다', () => {
    render(<Harness min={500} max={20000} />);
    const line = errorLine();
    expect(line).not.toBeNull();
    expect(line?.childElementCount).toBe(0);
    expect(line?.textContent).toBe('');
    expect(errorText()).toBeNull();
  });

  it('문구가 나타나고 사라져도 오류 줄 요소는 같은 노드로 남고, 문구는 그 안에만 들어간다', async () => {
    render(<Harness min={500} max={20000} />);
    const before = errorLine();
    await enter('abc');
    expect(errorLine()).toBe(before);
    expect(before?.querySelector('[data-testid="len-error"]')).not.toBeNull();
    await enter('4000');
    expect(errorLine()).toBe(before);
    expect(before?.childElementCount).toBe(0);
    expect(errorText()).toBeNull();
  });

  it('오류 줄 요소는 칸 하나에 하나뿐이고, data-testid 요소는 칸과 오류 문구 둘뿐이다', async () => {
    render(<Harness min={500} max={20000} />);
    expect(field().closest('.length-input')?.querySelectorAll('.length-input__error-line')).toHaveLength(1);
    await enter('abc');
    expect(field().closest('.length-input')?.querySelectorAll('.length-input__error-line')).toHaveLength(1);
    expect(screen.getAllByTestId(/^len/)).toHaveLength(2);
  });
});
