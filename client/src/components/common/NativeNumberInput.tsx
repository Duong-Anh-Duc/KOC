import React from 'react';

interface Props {
  value?: number | string | null;
  onChange?: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  placeholder?: string;
  style?: React.CSSProperties;
  className?: string;
}

// Lightweight AntD InputNumber replacement using native <input type="number">.
// It preserves numeric values for AntD Form.Item through the normal onChange API.
const NativeNumberInput: React.FC<Props> = ({
  value,
  onChange,
  min,
  max,
  step,
  disabled,
  placeholder,
  style,
  className,
}) => (
  <input
    type="number"
    min={min}
    max={max}
    step={step}
    disabled={disabled}
    placeholder={placeholder}
    value={value == null ? '' : value}
    onChange={(e) => {
      const next = e.target.value;
      onChange?.(next === '' ? null : Number(next));
    }}
    className={`native-bank-select native-number-input ${className || ''}`.trim()}
    style={style}
  />
);

export default NativeNumberInput;
