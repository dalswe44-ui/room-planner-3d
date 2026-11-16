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

  it.each(['', '   ', 'abc', '-100', '1m20cm', '12 34', '1,200', '10km'])(
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
