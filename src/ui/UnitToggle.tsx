// 표시 단위 전환. 화면에 보이는 단위만 바꾸고 저장된 mm 값은 건드리지 않는다.
import { DISPLAY_UNITS, UNIT_LABEL } from '../contracts/units';
import { useProjectStore } from '../store/projectStore';
import './ui.css';

export function UnitToggle() {
  const displayUnit = useProjectStore((s) => s.project.displayUnit);
  const setDisplayUnit = useProjectStore((s) => s.setDisplayUnit);

  return (
    <div className="unit-toggle" role="group" aria-label="표시 단위">
      {DISPLAY_UNITS.map((unit) => (
        <button
          key={unit}
          type="button"
          className="unit-toggle__button"
          aria-pressed={unit === displayUnit}
          data-testid={`unit-${unit}`}
          onClick={() => setDisplayUnit(unit)}
        >
          {UNIT_LABEL[unit]}
        </button>
      ))}
    </div>
  );
}
