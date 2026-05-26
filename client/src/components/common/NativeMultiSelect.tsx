import React from 'react';
import type { SelectOption } from './NativeSelect';

interface Props {
  value?: string[];
  onChange?: (value: string[]) => void;
  options?: SelectOption[];
  disabled?: boolean;
  placeholder?: string;
  style?: React.CSSProperties;
  className?: string;
  size?: number;
}

// Native replacement for simple AntD Select mode="multiple".
// The OS renders the list; users can Ctrl/Cmd-click or Shift-click to select.
const NativeMultiSelect: React.FC<Props> = ({
  value = [],
  onChange,
  options = [],
  disabled,
  placeholder,
  style,
  className,
  size = 5,
}) => (
  <select
    multiple
    size={size}
    disabled={disabled}
    value={value}
    onChange={(e) => {
      const selected = Array.from(e.target.selectedOptions).map((opt) => opt.value);
      onChange?.(selected);
    }}
    aria-label={placeholder}
    className={`native-bank-select native-multi-select ${className || ''}`.trim()}
    style={style}
  >
    {options.map((opt) => (
      <option key={String(opt.value)} value={String(opt.value)} disabled={opt.disabled}>
        {String(opt.label)}
      </option>
    ))}
  </select>
);

export default NativeMultiSelect;
