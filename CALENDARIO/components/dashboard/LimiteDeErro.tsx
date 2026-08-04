/**
 * Cerca em volta do dashboard.
 *
 * Existe por causa de um susto real, em 2026-08-04: a API subiu sem um campo que
 * a tela lia (`grade_hoje`), o componente estourou num `.map` de `undefined` e o
 * React desmontou a árvore INTEIRA — o barbeiro não perdeu o dashboard, perdeu o
 * calendário, com a tela preta e nenhuma mensagem.
 *
 * O dado desta tela vem de uma rota só, montada em cima de várias tabelas. É a
 * parte do app com mais superfície para um campo faltar, e é também a mais
 * dispensável: quem precisa trabalhar, trabalha na agenda. Então o dashboard
 * quebra sozinho e devolve o app inteiro em pé.
 */
import React from "react";

interface Props {
  children: React.ReactNode;
  onFechar: () => void;
}

interface State {
  erro: Error | null;
}

export class LimiteDeErro extends React.Component<Props, State> {
  state: State = { erro: null };

  static getDerivedStateFromError(erro: Error): State {
    return { erro };
  }

  componentDidCatch(erro: Error, info: React.ErrorInfo) {
    console.error("[dashboard] quebrou e foi contido:", erro, info);
  }

  componentDidUpdate(anterior: Props) {
    // Fechar e abrir de novo é a tentativa mais natural de quem viu quebrar, e
    // ela precisa funcionar — senão a única saída é F5.
    if (anterior.children !== this.props.children && this.state.erro) {
      this.setState({ erro: null });
    }
  }

  render() {
    if (!this.state.erro) return this.props.children;

    return (
      <div className="dash-root dash-veu">
        <div className="dash-modal" role="alert" style={{ maxWidth: 460, height: "auto" }}>
          <div style={{ padding: "26px 28px" }}>
            <h2
              style={{
                margin: "0 0 8px",
                fontSize: 16,
                fontWeight: 650,
                color: "var(--text-strong)",
              }}
            >
              O dashboard não conseguiu carregar
            </h2>
            <p style={{ margin: "0 0 18px", color: "var(--text-muted)" }}>
              A agenda continua funcionando normalmente. Se insistir, verifique se
              a API do calendário está no ar.
            </p>
            <p
              style={{
                margin: "0 0 20px",
                fontSize: 12,
                fontFamily: "ui-monospace, monospace",
                color: "var(--text-muted)",
                wordBreak: "break-word",
              }}
            >
              {this.state.erro.message}
            </p>
            <button
              className="chip chip--on"
              onClick={() => {
                this.setState({ erro: null });
                this.props.onFechar();
              }}
            >
              Voltar para a agenda
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default LimiteDeErro;
