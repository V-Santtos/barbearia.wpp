import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100dvh",
            gap: "16px",
            padding: "24px",
            textAlign: "center",
            color: "#fff",
          }}
        >
          <p style={{ fontSize: "15px", opacity: 0.8 }}>
            Algo deu errado. Recarregue a página para continuar.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 28px",
              borderRadius: "12px",
              border: "1px solid rgba(119,114,251,0.7)",
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Recarregar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
