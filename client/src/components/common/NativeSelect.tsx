import React from 'react';

export interface SelectOption {
  value: string | number;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SelectGroup {
  label: string;
  options: SelectOption[];
}

interface Props {
  value?: string | number | null;
  onChange?: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  options?: SelectOption[] | SelectGroup[];
  style?: React.CSSProperties;
  className?: string;
  size?: 'small' | 'middle' | 'large';
}

const isGrouped = (opts: SelectOption[] | SelectGroup[]): opts is SelectGroup[] =>
  opts.length > 0 && 'options' in (opts[0] as SelectGroup);

// Generic AntD Select replacement using a native <select>.
// Trade-off: no in-place search, no multi-select. For those, keep AntD.
const NativeSelect: React.FC<Props> = ({
  value,
  onChange,
  placeholder,
  disabled,
  allowClear,
  options = [],
  style,
  className,
  size = 'middle',
}) => {
  const height = size === 'small' ? 24 : size === 'large' ? 40 : 32;
  return (
    <select
      disabled={disabled}
      value={value == null ? '' : String(value)}
      onChange={(e) => onChange?.(e.target.value === '' ? undefined : e.target.value)}
      style={{ height, ...style }}
      className={`native-bank-select ${className || ''}`.trim()}
    >
      {(allowClear || placeholder) && (
        <option value="">{placeholder ?? ''}</option>
      )}
      {isGrouped(options)
        ? options.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((opt) => (
                <option key={String(opt.value)} value={String(opt.value)} disabled={opt.disabled}>
                  {String(opt.label)}
                </option>
              ))}
            </optgroup>
          ))
        : (options as SelectOption[]).map((opt) => (
            <option key={String(opt.value)} value={String(opt.value)} disabled={opt.disabled}>
              {String(opt.label)}
            </option>
          ))}
    </select>
  );
};

export default NativeSelect;
