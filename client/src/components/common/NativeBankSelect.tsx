import React from 'react';
import { VIETNAM_BANK_SELECT_OPTIONS } from '../../constants/banks';

interface Props {
  value?: string | null;
  onChange?: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

const NativeBankSelect: React.FC<Props> = ({
  value,
  onChange,
  placeholder = 'Chọn ngân hàng…',
  disabled,
  id,
}) => {
  return (
    <select
      id={id}
      disabled={disabled}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value || undefined)}
      className="native-bank-select"
    >
      <option value="">{placeholder}</option>
      {VIETNAM_BANK_SELECT_OPTIONS.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
};

export default NativeBankSelect;
