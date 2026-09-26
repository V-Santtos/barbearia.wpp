/**
 * Barra superior do espaço de trabalho: navegação da coluna, busca e, à
 * direita, a conta.
 *
 * O avatar mora aqui e não no `CalendarHeader` porque ele não é da agenda — é
 * do aplicativo. Preso ao cabeçalho da agenda, ele sumia ao entrar em Conversas
 * ou Dashboard. A engrenagem saiu de dentro do menu do avatar pelo mesmo
 * motivo: ajuste de aplicativo não se esconde dentro do menu de uma pessoa.
 *
 * No celular o avatar continua no `CalendarHeader` — esta barra é `md:flex`.
 */
import { PanelLeft, PanelLeftClose, Search, Settings } from "lucide-react";
import UserMenu from "../UserMenu";
import type { OwnerSession } from "../LoginScreen";
import type { Professional } from "../../types";

interface Props {
  expandida: boolean;
  onAlternar: () => void;
  busca: string;
  onBusca: (valor: string) => void;
  rotuloBusca?: string;
  owner: OwnerSession;
  onLogout: () => void;
  professionals: Professional[];
}

export default function ControleDaColuna({
  expandida,
  onAlternar,
  busca,
  onBusca,
  rotuloBusca = "Pesquisar",
  owner,
  onLogout,
  professionals,
}: Props) {
  const Icone = expandida ? PanelLeftClose : PanelLeft;
  const rotulo = expandida ? "Recolher menu" : "Expandir menu";

  return (
    <header
      /* Na casca inset a faixa volta aos 48px da referência: os 8px externos
         da própria superfície já devolvem o respiro que antes precisava ser
         fabricado aumentando a altura do cabeçalho.

         O `pr` copia o do cabeçalho da agenda (`CalendarHeader`, linha do
         desktop: `px-6 md:px-8 lg:px-10`). As duas faixas terminam na mesma
         borda da janela, então padding igual põe o avatar na mesma vertical do
         "Mês" logo abaixo. Mudar um sem o outro desalinha os dois. */
      className="relative hidden h-12 flex-shrink-0 items-center bg-[#1c1c1c]
                 pl-4 pr-6 md:flex md:pr-8 lg:pr-10"
    >
      <button
        type="button"
        onClick={onAlternar}
        title={rotulo}
        aria-label={rotulo}
        aria-expanded={expandida}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-white/65
                   transition-colors hover:bg-white/[0.07] hover:text-white
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
      >
        <Icone size={20} strokeWidth={1.8} />
      </button>

      <span aria-hidden="true" className="mx-3 h-5 w-px bg-white/[0.09]" />

      <label className="flex h-9 min-w-0 max-w-72 flex-1 items-center gap-2 rounded-lg px-1 text-white/55 focus-within:text-white/80">
        <Search size={18} strokeWidth={1.8} className="flex-shrink-0" />
        <span className="sr-only">{rotuloBusca}</span>
        <input
          type="search"
          value={busca}
          onChange={(event) => onBusca(event.target.value)}
          placeholder="Pesquisar"
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none
                     placeholder:text-white/45"
        />
      </label>

      <div className="ml-auto flex flex-shrink-0 items-center gap-1.5 pl-4">
        {/* Sem ação ainda — a engrenagem só mudou de lugar; ela já era um item
            sem destino dentro do menu do avatar.
            ponytail: botão inerte, gatilho de upgrade é a tela de ajustes. */}
        <button
          type="button"
          title="Configurações"
          aria-label="Configurações"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-white/65
                     transition-colors hover:bg-white/[0.07] hover:text-white
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
        >
          <Settings size={18} strokeWidth={1.8} />
        </button>

        <UserMenu
          owner={owner}
          onLogout={onLogout}
          professionals={professionals}
          compacto
        />
      </div>

      {/* No inset a linha pertence à superfície inteira, como na referência.
          O raio externo já impede que ela seja lida como moldura da janela. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-px bg-white/[0.06]"
      />
    </header>
  );
}
