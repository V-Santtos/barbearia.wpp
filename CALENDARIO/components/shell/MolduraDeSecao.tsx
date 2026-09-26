/**
 * A moldura de uma seção do painel.
 *
 * Vem do chat de referência (shadcn-admin, `dashboard/chat`): respiro em volta,
 * título e linha de apoio por fora, e o conteúdo inteiro dentro de uma pílula
 * emoldurada. É ela que separa a seção da barra superior e da busca global, em
 * vez de o conteúdo encostar na borda da janela.
 *
 * Mora aqui, e não em cada seção, porque a partir da segunda seção emoldurada o
 * respiro vira acordo entre telas: mudar o número num lugar e não no outro é
 * como as duas param de parecer a mesma casa.
 *
 * O respiro é simétrico. Antes, uma faixa vazia de 48px no `App.tsx` fabricava
 * o recuo esquerdo; a casca inset removeu essa peça e devolveu o espaçamento à
 * própria moldura, onde ele pertence.
 */
import type { ReactNode } from "react";

interface Props {
  /** Some quando a própria seção já traz o título dentro (o Dashboard traz). */
  titulo?: string;
  descricao?: string;
  /** Nome acessível da pílula. */
  rotulo: string;
  children: ReactNode;
}

export default function MolduraDeSecao({
  titulo,
  descricao,
  rotulo,
  children,
}: Props) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 bg-[#1c1c1c] p-6">
      {titulo && (
        <div className="flex flex-col gap-0.5 px-1">
          <h1 className="text-sm font-medium leading-none text-white">
            {titulo}
          </h1>
          {descricao && <p className="text-sm text-white/45">{descricao}</p>}
        </div>
      )}

      <section
        aria-label={rotulo}
        className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl
                   border border-white/[0.08] bg-[#1a1a1a]"
      >
        {children}
      </section>
    </div>
  );
}
