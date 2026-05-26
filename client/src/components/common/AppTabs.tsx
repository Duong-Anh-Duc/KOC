import React from 'react';

export interface TabItem {
  key: string;
  label: React.ReactNode;
  children?: React.ReactNode;
  disabled?: boolean;
}

interface Props {
  items: TabItem[];
  activeKey?: string;
  defaultActiveKey?: string;
  onChange?: (key: string) => void;
  type?: 'line' | 'card';
  size?: 'small' | 'middle' | 'large';
  tabBarExtraContent?: React.ReactNode;
  destroyInactiveTabPane?: boolean;
  style?: React.CSSProperties;
}

// Lightweight AntD Tabs replacement: button row + content panel.
// API matches the props this app uses (items, activeKey, onChange, type).
const AppTabs: React.FC<Props> = ({
  items,
  activeKey: controlledKey,
  defaultActiveKey,
  onChange,
  type = 'line',
  tabBarExtraContent,
  destroyInactiveTabPane,
  style,
}) => {
  const [internalKey, setInternalKey] = React.useState<string>(
    defaultActiveKey ?? (items[0]?.key ?? '')
  );
  const activeKey = controlledKey ?? internalKey;
  const setKey = (k: string) => {
    if (controlledKey === undefined) setInternalKey(k);
    onChange?.(k);
  };
  const active = items.find((i) => i.key === activeKey);

  return (
    <div className={`app-tabs app-tabs-${type}`} style={style}>
      <div className="app-tabs-bar">
        <div className="app-tabs-nav" role="tablist">
          {items.map((it) => (
            <button
              key={it.key}
              role="tab"
              aria-selected={it.key === activeKey}
              disabled={it.disabled}
              onClick={() => !it.disabled && setKey(it.key)}
              className={`app-tab ${it.key === activeKey ? 'app-tab-active' : ''}`}
              type="button"
            >
              {it.label}
            </button>
          ))}
        </div>
        {tabBarExtraContent && <div className="app-tabs-extra">{tabBarExtraContent}</div>}
      </div>
      <div className="app-tabs-content">
        {destroyInactiveTabPane
          ? active?.children
          : items.map((it) => (
              <div
                key={it.key}
                role="tabpanel"
                style={{ display: it.key === activeKey ? 'block' : 'none' }}
              >
                {it.children}
              </div>
            ))}
      </div>
    </div>
  );
};

export default AppTabs;
