/**
 * A troca entre Dashboard e Financeiro no celular e no tablet.
 *
 * O dock tem três lugares e o Financeiro não ganhou um quarto: ele mora dentro
 * da aba Dashboard. Até 2026-09-26 a troca era o próprio título com uma seta
 * ("Dashboard ▾"), e quem não conhecia o app não adivinhava que o Financeiro
 * estava ali (2026-09-27, com o dono). Agora são as duas opções à vista, numa
 * pílula: a atual em branco, a outra a um toque. O `<h1>` continua existindo
 * para leitor de tela; na tela, a pílula já diz onde se está. No desktop os
 * dois são seções irmãs na coluna e este componente não aparece.
 */
import { motion, useReducedMotion } from "framer-motion";

export type PainelDoDashboard = "dashboard" | "financeiro";

const ROTULOS: Record<PainelDoDashboard, string> = {
  dashboard: "Dashboard",
  financeiro: "Financeiro",
};

interface Props {
  atual: PainelDoDashboard;
  onTrocar: (painel: PainelDoDashboard) => void;
  /** A classe de título da tela que o recebe; aqui só marca o `<h1>`. */
  classeTitulo: string;
}

export default function SeletorDePainel({ atual, onTrocar, classeTitulo }: Props) {
  const reduzir = useReducedMotion();

  return (
    <div>
      <h1 className={`${classeTitulo} sr-only`}>{ROTULOS[atual]}</h1>
      <div
        role="group"
        aria-label="Trocar de painel"
        className="mb-2 inline-flex rounded-full border border-white/10 bg-white/[0.05] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      >
        {(Object.keys(ROTULOS) as PainelDoDashboard[]).map((painel) => {
          const ativo = painel === atual;
          return (
            <button
              key={painel}
              type="button"
              aria-pressed={ativo}
              onClick={() => !ativo && onTrocar(painel)}
              className={`relative min-h-11 rounded-full px-5 text-[15px] font-semibold transition-colors duration-200
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                            ativo ? "text-[#111]" : "text-white/60 hover:text-white"
                          }`}
            >
              {ativo && (
                <motion.span
                  layoutId="seletor-de-painel"
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
                  transition={reduzir ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <span className="relative">{ROTULOS[painel]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
