import { Component, type ErrorInfo, type ReactNode } from "react";

interface RenderErrorBoundaryProps {
  children: ReactNode;
  /** Rendered in place of `children` once a render below has thrown. */
  fallback: (error: unknown) => ReactNode;
  /** Called once per crash, with the component stack React reports for it. */
  onError: (error: unknown, componentStack: string) => void;
}

interface RenderErrorBoundaryState {
  error: unknown;
  /** Separate from `error`, since a render may throw `undefined`. */
  failed: boolean;
}

/**
 * Catches a throw during render below it and shows `fallback` instead of a
 * blank page. A class component, since React 19 has no hook for this. It has no
 * reset method: mount it with a `key` that changes when it should start over
 * (in `Planner`, after going back to the previous project), and the new
 * instance starts with no error.
 */
export class RenderErrorBoundary extends Component<RenderErrorBoundaryProps, RenderErrorBoundaryState> {
  state: RenderErrorBoundaryState = { error: undefined, failed: false };

  static getDerivedStateFromError(error: unknown): RenderErrorBoundaryState {
    return { error, failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    this.props.onError(error, info.componentStack ?? "");
  }

  render() {
    return this.state.failed ? this.props.fallback(this.state.error) : this.props.children;
  }
}
