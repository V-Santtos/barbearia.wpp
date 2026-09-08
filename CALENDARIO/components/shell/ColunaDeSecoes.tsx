/**
 * A coluna da esquerda: marca, ação primária e as seções do painel.
 *
 * Ela é UMA peça que recolhe e expande — não um rail fixo com um painel ao
 * lado. Recolhida é só ícone; aberta ganha o nome do app no topo e o rótulo de
 * cada seção. É a estrutura do template shadcn, que o dono escolheu copiar.
 *
 * O `+ Criar` mora aqui e não na gaveta porque marcar horário não é acessório
 * do calendário: é a ação primária do produto, e o dono precisa dela em
 * qualquer seção. Recolhida ela é o "+"; aberta, o botão inteiro. Os dois
 * estados são o mesmo botão, não dois.
 *
 * Só desktop. No celular quem faz este papel é o dock (`MobileBottomNav`), que
 * já está validado e não é tocado aqui.
 */
import { motion, useReducedMotion } from "framer-motion";
import { Plus, Scissors } from "lucide-react";
import { SECOES, type IdSecao } from "./secoes";

const LARGURA_ABERTA = 240;
const LARGURA_RECOLHIDA = 56;

/* ponytail: nome fixo no código.
   Teto: com mais de uma barbearia no ar, este texto vira mentira.
   Gatilho de upgrade: a tabela de barbearias/plano, que ainda não existe. */
const NOME_DO_APP = "Barbearia Admin";

interface Props {
  ativa: IdSecao;
  onSelecionar: (id: IdSecao) => void;
  expandida: boolean;
  onAlternar: () => void;
  onCriar: () => void;
}

export default function ColunaDeSecoes({
  ativa,
  onSelecionar,
  expandida,
  onAlternar,
  onCriar,
}: Props) {
  const reduzir = useReducedMotion();
  const mola = reduzir
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 340, damping: 34 };

  return (
    <motion.nav
      aria-label="Seções"
      className="hidden md:flex flex-shrink-0 flex-col overflow-hidden
                 border-r border-white/[0.06] bg-[#161616] py-3"
      initial={false}
      animate={{ width: expandida ? LARGURA_ABERTA : LARGURA_RECOLHIDA }}
      transition={mola}
    >
      {/* A linha da marca é o próprio interruptor. Recolhida não sobra largura
          para um botão dedicado ao lado, e um alvo que muda de lugar conforme o
          estado é pior que um que está sempre no mesmo canto. */}
      <button
        onClick={onAlternar}
        title={expandida ? "Recolher menu" : "Expandir menu"}
        aria-label={expandida ? "Recolher menu" : "Expandir menu"}
        aria-expanded={expandida}
        className="mx-2 mb-3 flex h-10 items-center gap-2.5 rounded-xl px-2.5
                   text-white/80 transition hover:bg-white/[0.06] hover:text-white
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
      >
        <Scissors size={20} strokeWidth={1.9} className="flex-shrink-0" />
        {expandida && (
          <motion.span
            initial={reduzir ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            className="truncate text-[15px] font-semibold text-white"
          >
            {NOME_DO_APP}
          </motion.span>
        )}
      </button>

      <div className="mx-2 mb-3">
        <button
          onClick={onCriar}
          title="Criar agendamento"
          aria-label="Criar agendamento"
          className={`flex h-10 items-center rounded-full bg-white text-sm font-semibold
                      text-black shadow-[0_4px_14px_rgba(0,0,0,0.30)] transition
                      hover:bg-white/90 focus-visible:outline-none
                      focus-visible:ring-2 focus-visible:ring-white/50 ${
                        expandida ? "w-full justify-center px-4" : "w-10 justify-center"
                      }`}
        >
          {/* O "+" é roxo, não preto: era assim no botão original da Sidebar
              (SVG à mão com `stroke="#6B3EFF"`), e é o único respingo de marca
              nessa peça branca. */}
          <Plus
            size={expandida ? 20 : 22}
            strokeWidth={2}
            className="flex-shrink-0 text-[#6B3EFF]"
          />
          {expandida && <span className="ml-1.5">Criar</span>}
        </button>
      </div>

      <div className="flex flex-col gap-0.5 px-2">
        {SECOES.map(({ id, rotulo, Icone }) => {
          const eAtiva = id === ativa;
          return (
            <button
              key={id}
              onClick={() => onSelecionar(id)}
              title={rotulo}
              aria-current={eAtiva ? "page" : undefined}
              className="relative flex h-10 items-center gap-2.5 rounded-xl px-2.5
                         transition-colors focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-white/25"
            >
              {/* A pílula ativa viaja entre os itens em vez de trocar de lugar —
                  mesma gramática do dock (`layoutId`), para o desktop não
                  inventar um segundo idioma de movimento. */}
              {eAtiva && (
                <motion.span
                  layoutId="coluna-secao-ativa"
                  className="absolute inset-0 rounded-xl bg-white/[0.09]
                             shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]"
                  transition={mola}
                />
              )}
              <Icone
                size={22}
                strokeWidth={eAtiva ? 2.1 : 1.8}
                className={`relative flex-shrink-0 ${
                  eAtiva ? "text-white" : "text-white/55"
                }`}
              />
              {expandida && (
                <span
                  className={`relative truncate text-sm ${
                    eAtiva ? "font-medium text-white" : "text-white/60"
                  }`}
                >
                  {rotulo}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </motion.nav>
  );
}
