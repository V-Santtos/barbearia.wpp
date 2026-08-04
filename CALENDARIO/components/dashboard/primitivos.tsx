/**
 * Peças pequenas e compartilhadas entre desktop e celular.
 *
 * Vieram do protótipo com uma troca: o componente `Icon` dele, que desenhava os
 * paths do lucide à mão porque a pasta não tinha `node_modules`, sumiu. Aqui os
 * ícones são importados de `lucide-react` — o mesmo pacote do resto do app, o
 * que faz os ícones do dashboard envelhecerem junto com os das outras telas.
 */
import React from "react";
import { ChevronDown, Filter } from "lucide-react";

interface PanelProps {
  title?: string;
  subtitle?: string;
  meta?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padding?: string;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
}

/**
 * O ícone do cabeçalho saiu no desktop em 2026-08-02: o centro óptico dele caía
 * exatamente na fresta entre título e subtítulo, sem alinhar com nenhum dos
 * dois. `meta` é a contagem que muda todo dia e vive na linha do título.
 */
export const Panel: React.FC<PanelProps> = ({
  title,
  subtitle,
  meta,
  actions,
  children,
  className = "",
  padding = "p-5",
  style,
  bodyStyle,
}) => (
  <section className={`db-panel ${className}`} style={style}>
    {(title || actions) && (
      <header className="db-panel__head">
        <div className="db-panel__head-left">
          <div className="db-panel__titling">
            <h2 className="db-panel__title">{title}</h2>
            {meta && <span className="db-panel__meta">{meta}</span>}
            {subtitle && <p className="db-panel__sub">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="db-panel__actions">{actions}</div>}
      </header>
    )}
    <div className={`db-panel__body ${padding}`} style={bodyStyle}>
      {children}
    </div>
  </section>
);

/**
 * Três linhas à esquerda, sem coluna de ícone. O ladrilho arredondado saiu em
 * 2026-08-02: ocupava 18,6% da largura do card no desktop e ~30% no celular
 * sem carregar informação nenhuma, e vencia a primeira fixação do olho sem
 * recompensar.
 */
export const KpiCard: React.FC<{
  label: string;
  value: React.ReactNode;
  sub?: string;
  destaque?: boolean;
  compact?: boolean;
}> = ({ label, value, sub, destaque, compact }) => (
  <div
    className={`kpi ${compact ? "kpi--compact" : ""} ${destaque ? "kpi--destaque" : ""}`}
  >
    <span className="kpi__label">{label}</span>
    <div className="kpi__value">{value}</div>
    {sub && <div className="kpi__sub">{sub}</div>}
  </div>
);

/**
 * Não é `tablist`: não existe `tabpanel` nem `aria-controls`, e o leitor de tela
 * anunciava "aba" e ia procurar um painel que não existe. É grupo de rádio.
 */
export function PeriodChips<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="chips" role="radiogroup" aria-label="Período">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          className={`chip ${value === o.value ? "chip--on" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export type FiltroProf = "all" | number;

export const ProfFilter: React.FC<{
  value: FiltroProf;
  onChange: (v: FiltroProf) => void;
  profs: { id: number; name: string; short: string; color: string }[];
}> = ({ value, onChange, profs }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const current = value === "all" ? null : profs.find((p) => p.id === value);

  return (
    <div className="proffilter" ref={ref}>
      <button
        className={`proffilter__btn ${open ? "is-open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {current ? (
          <>
            <span
              className="proffilter__dot"
              style={{ background: current.color }}
            />
            <span>{current.short}</span>
          </>
        ) : (
          <>
            <Filter size={12} />
            <span>Todos profissionais</span>
          </>
        )}
        <ChevronDown size={12} />
      </button>

      {open && (
        <div className="proffilter__menu" role="menu">
          <button
            className={`proffilter__opt ${value === "all" ? "is-active" : ""}`}
            onClick={() => {
              onChange("all");
              setOpen(false);
            }}
          >
            <span
              className="proffilter__opt-dot"
              style={{ background: "rgba(255,255,255,.4)" }}
            />
            <span>Todos profissionais</span>
          </button>
          {profs.map((p) => (
            <button
              key={p.id}
              className={`proffilter__opt ${value === p.id ? "is-active" : ""}`}
              onClick={() => {
                onChange(p.id);
                setOpen(false);
              }}
            >
              <span
                className="proffilter__opt-dot"
                style={{ background: p.color }}
              />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * A tag "Agendado" chegou a ser cortada por estar em 80% das linhas. Não deu:
 * `agendamentos.status` é nulo-permitido, então "sem tag" ficaria idêntico a
 * "status não gravado". A tag ficou; o que saiu foi a cor dela.
 */
export const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { label: string; cls: string }> = {
    agendado: { label: "Agendado", cls: "is-agendado" },
    confirmado: { label: "Agendado", cls: "is-agendado" },
    concluido: { label: "Concluído", cls: "is-concluido" },
    "em-atendimento": { label: "Em atendimento", cls: "is-active" },
    reagendado: { label: "Reagendado", cls: "is-reagendado" },
    cancelado: { label: "Cancelado", cls: "is-cancelado" },
  };
  const it = map[status] ?? map.agendado;
  return (
    <span className={`statuspill ${it.cls}`}>
      {status === "em-atendimento" && <span className="statuspill__dot" />}
      {it.label}
    </span>
  );
};
