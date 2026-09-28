import { Check } from "lucide-react";
import type { ConfiguredService } from "../../services/calendarApi";
import { precoDoCatalogo } from "../../lib/fechamento";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

interface SeletorDeServicosProps {
  opcoes: ConfiguredService[];
  /** Nomes marcados. */
  selecionados: string[];
  onChange: (nomes: string[]) => void;
}

/**
 * Seleção de vários serviços, usada pelo lápis (EventModal) e pelo resumo de
 * "Marcar como feito". Combos primeiro, porque é o que o cliente costuma
 * agendar; depois os serviços avulsos. Um nome marcado que saiu da tabela
 * aparece em "Fora da tabela", só para poder ser desmarcado.
 */
export function SeletorDeServicos({ opcoes, selecionados, onChange }: SeletorDeServicosProps) {
  const marcado = new Set(selecionados);
  const alternar = (nome: string) =>
    onChange(marcado.has(nome) ? selecionados.filter((item) => item !== nome) : [...selecionados, nome]);

  const combos = opcoes.filter((opcao) => opcao.category === "combos");
  const avulsos = opcoes.filter((opcao) => opcao.category !== "combos");
  const nomesDaTabela = new Set(opcoes.map((opcao) => opcao.name));
  const foraDaTabela = selecionados.filter((nome) => !nomesDaTabela.has(nome));

  const grupo = (titulo: string, itens: { nome: string; preco?: number }[]) =>
    itens.length > 0 && (
      <div role="group" aria-label={titulo} className="pb-2">
        <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-widest text-white/40">{titulo}</p>
        {itens.map(({ nome, preco }) => {
          const ativo = marcado.has(nome);
          return (
            <button
              key={nome}
              type="button"
              aria-pressed={ativo}
              onClick={() => alternar(nome)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left text-[15px] transition hover:bg-white/10 ${
                ativo ? "bg-white/10" : ""
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border ${
                  ativo ? "border-accent bg-accent text-white" : "border-white/25"
                }`}
              >
                {ativo && <Check size={13} strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1 truncate">{nome}</span>
              {preco !== undefined && (
                <span className="flex-shrink-0 text-[13px] tabular-nums text-white/45">{moeda.format(preco)}</span>
              )}
            </button>
          );
        })}
      </div>
    );

  const comPreco = (lista: ConfiguredService[]) =>
    lista.map((opcao) => ({ nome: opcao.name, preco: precoDoCatalogo(opcao.price) }));

  return (
    <>
      {grupo("Combos", comPreco(combos))}
      {grupo("Serviços", comPreco(avulsos))}
      {grupo("Fora da tabela", foraDaTabela.map((nome) => ({ nome })))}
    </>
  );
}
