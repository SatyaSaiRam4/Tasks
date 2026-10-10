import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Where bottom sheets are drawn. A React Native <Modal> opens its own Android
 * window, and keyboard events only reach the main window, so a sheet in a
 * Modal can't move out of the keyboard's way. Sheets rendered through this
 * host sit in the main window, above every screen and the tab bar, and see
 * the keyboard like any other view.
 */
interface HostApi {
  set: (id: number, node: React.ReactNode) => void;
  remove: (id: number) => void;
}

const HostContext = createContext<HostApi | null>(null);

export function SheetHost({ children }: { children: React.ReactNode }) {
  const [nodes, setNodes] = useState<Map<number, React.ReactNode>>(new Map());
  const set = useCallback((id: number, node: React.ReactNode) => {
    setNodes(prev => new Map(prev).set(id, node));
  }, []);
  const remove = useCallback((id: number) => {
    setNodes(prev => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);
  const api = useMemo(() => ({ set, remove }), [set, remove]);
  return (
    <HostContext.Provider value={api}>
      {children}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {[...nodes.entries()].map(([id, node]) => (
          <React.Fragment key={id}>{node}</React.Fragment>
        ))}
      </View>
    </HostContext.Provider>
  );
}

let nextId = 1;

/** True when a SheetHost is above this component. */
export function useHasSheetHost() {
  return useContext(HostContext) !== null;
}

/** Shows `node` in the nearest SheetHost while `active`; it follows every re-render. */
export function useHostedNode(node: React.ReactNode, active: boolean) {
  const host = useContext(HostContext);
  const id = useRef(0);
  if (!id.current) id.current = nextId++;
  useLayoutEffect(() => {
    if (!host) return;
    if (active) host.set(id.current, node);
    else host.remove(id.current);
  });
  useLayoutEffect(() => {
    const key = id.current;
    return () => host?.remove(key);
  }, [host]);
}
