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
  /** ⌘B and ⌥⌘B on a wide screen. */
  sidebarHidden: boolean;
  setSidebarHidden: (hidden: boolean) => void;
  panelHidden: boolean;
  setPanelHidden: (hidden: boolean) => void;
};

const UiContext = createContext<Ui | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [palette, setPalette] = useState(false);
  const [nav, setNav] = useState(false);
  const [panel, setPanel] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [panelHidden, setPanelHidden] = useState(false);
  const value = useMemo(
    () => ({
      palette,
      setPalette,
      nav,
      setNav,
      panel,
      setPanel,
      sidebarHidden,
      setSidebarHidden,
      panelHidden,
      setPanelHidden,
    }),
    [palette, nav, panel, sidebarHidden, panelHidden],
  );
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const ui = useContext(UiContext);
  if (!ui) throw new Error('useUi needs a UiProvider');
  return ui;
}
