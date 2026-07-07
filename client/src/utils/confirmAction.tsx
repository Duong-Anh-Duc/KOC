import React from 'react';
import { createRoot } from 'react-dom/client';

interface ConfirmActionOptions {
  title: string;
  okText?: string;
  cancelText?: string;
  onConfirm: () => void;
}

export function confirmAction({
  title,
  okText = 'Đồng ý',
  cancelText = 'Hủy',
  onConfirm,
}: ConfirmActionOptions) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const root = createRoot(container);

  const close = () => {
    root.unmount();
    container.remove();
  };

  const handleConfirm = () => {
    close();
    onConfirm();
  };

  root.render(
    <div
      className="app-confirm-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="app-confirm-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="app-confirm-title">{title}</div>
        <div className="app-confirm-actions">
          <button type="button" className="app-confirm-button" onClick={close}>
            {cancelText}
          </button>
          <button type="button" className="app-confirm-button app-confirm-button-primary" onClick={handleConfirm}>
            {okText}
          </button>
        </div>
      </div>
    </div>
  );
}
