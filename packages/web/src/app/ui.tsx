import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/** What the frame shows: the palette, the drawers, the columns. */
type Ui = {
  palette: boolean;
  setPalette: (open: boolean) => void;
  /** The sidebar as a drawer, below lg. */
  nav: boolean;
  setNav: (open: boolean) => void;
  /** The side panel as a drawer, below xl. */
  panel: boolean;
  setPanel: (open: boolean) => void;
  /** ⌘B and ⌥⌘B on a wide screen fold each column to its icon rail. */
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  panelCollapsed: boolean;
  setPanelCollapsed: (collapsed: boolean) => void;
};

const UiContext = createContext<Ui | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [palette, setPalette] = useState(false);
  const [nav, setNav] = useState(false);
  const [panel, setPanel] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const value = useMemo(
    () => ({
      palette,
      setPalette,
      nav,
      setNav,
      panel,
      setPanel,
      sidebarCollapsed,
      setSidebarCollapsed,
      panelCollapsed,
      setPanelCollapsed,
    }),
    [palette, nav, panel, sidebarCollapsed, panelCollapsed],
  );
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const ui = useContext(UiContext);
  if (!ui) throw new Error('useUi needs a UiProvider');
  return ui;
}
