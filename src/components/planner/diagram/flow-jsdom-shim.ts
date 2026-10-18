// React Flow's documented jsdom shim, for the view tests that render the
// Diagram. jsdom has no layout, so React Flow measures nothing and renders no
// node without it. It lives next to the React Flow adapter, so a renderer swap
// touches one directory. No production code imports it, so it never ships.

/** Every property the shim replaces, restored by restoreFlowJsdomShim so it never outlives a test file. */
const shimmed: [object, string][] = [
  [globalThis, "ResizeObserver"],
  [globalThis, "DOMMatrixReadOnly"],
  [HTMLElement.prototype, "offsetHeight"],
  [HTMLElement.prototype, "offsetWidth"],
  [SVGElement.prototype, "getBBox"],
];
let originals: (PropertyDescriptor | undefined)[] = [];

/** Installs the shim; call it in `beforeAll` and pair it with restoreFlowJsdomShim in `afterAll`. */
export function installFlowJsdomShim(): void {
  originals = shimmed.map(([target, key]) => Object.getOwnPropertyDescriptor(target, key));

  class ResizeObserverShim {
    constructor(private readonly callback: ResizeObserverCallback) {}
    // Fires once per observed element, so React Flow measures each node. React
    // Flow 12 also reads the pane's size from `contentRect`, which the shim in
    // its docs omits; it is taken from the shimmed offset size below.
    observe(target: Element) {
      const { offsetWidth: width, offsetHeight: height } = target as HTMLElement;
      this.callback([{ target, contentRect: { width, height } } as ResizeObserverEntry], this);
    }
    unobserve() {
      // Nothing to stop: the shim never observes over time.
    }
    disconnect() {
      // Nothing to stop: the shim never observes over time.
    }
  }

  class DOMMatrixReadOnlyShim {
    m22: number;
    constructor(init?: string) {
      const scale = init?.match(/scale\(([1-9.])\)/)?.[1];
      this.m22 = scale === undefined ? 1 : Number(scale);
    }
  }

  globalThis.ResizeObserver = ResizeObserverShim;
  globalThis.DOMMatrixReadOnly = DOMMatrixReadOnlyShim as unknown as typeof DOMMatrixReadOnly;
  Object.defineProperties(HTMLElement.prototype, {
    offsetHeight: {
      configurable: true,
      get(this: HTMLElement) {
        return Number.parseFloat(this.style.height) || 1;
      },
    },
    offsetWidth: {
      configurable: true,
      get(this: HTMLElement) {
        return Number.parseFloat(this.style.width) || 1;
      },
    },
  });
  // On SVGElement, as React Flow's shim has it; TypeScript types getBBox on SVGGraphicsElement only.
  Object.defineProperty(SVGElement.prototype, "getBBox", {
    configurable: true,
    value: () => ({ x: 0, y: 0, width: 0, height: 0 }),
  });
}

/** Puts back every property installFlowJsdomShim replaced, or removes it where jsdom had none. */
export function restoreFlowJsdomShim(): void {
  shimmed.forEach(([target, key], index) => {
    const original = originals[index];
    if (original) Object.defineProperty(target, key, original);
    else Reflect.deleteProperty(target, key);
  });
}
