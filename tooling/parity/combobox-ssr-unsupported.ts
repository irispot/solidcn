function unsupported(name: string): never {
  throw new Error(`The Combobox SSR fixture bridge does not support ${name}.`);
}

// These imports occur only inside cases outside the selected SSR group.
// Any use must fail clearly until a native route is added.
export const CompositeRoot = () => unsupported("CompositeRoot");
export const CompositeItem = () => unsupported("CompositeItem");
export const useComboboxRootContext = () =>
  unsupported("useComboboxRootContext");
export const createPortal = () => unsupported("ReactDOM.createPortal");
