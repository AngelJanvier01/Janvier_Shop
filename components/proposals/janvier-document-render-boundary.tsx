"use client";

import { Component, type ReactNode } from "react";

import styles from "./janvier-markdown-renderer.module.css";

type BoundaryProps = { children: ReactNode };
type BoundaryState = { failed: boolean };

/** A malformed future renderer node cannot take down the administration page. */
export class JanvierDocumentRenderBoundary extends Component<
  BoundaryProps,
  BoundaryState
> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <section
          className={styles.renderError}
          data-testid="janvier-render-error"
          role="alert"
        >
          <p>RENDER_INTEGRITY_ERROR</p>
          <h2>El documento no pudo representarse de forma segura.</h2>
          <span>
            La fuente no se muestra como HTML ni se intenta recuperar automáticamente.
          </span>
        </section>
      );
    }
    return this.props.children;
  }
}
