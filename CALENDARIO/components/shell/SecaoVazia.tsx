/**
 * O lugar de uma seção que ainda não tem conteúdo.
 *
 * Existe para o layout mínimo poder ser andado de ponta a ponta antes de
 * qualquer migração: clicar em Conversas, Dashboard ou Financeiro leva a algum
 * lugar, e esse lugar diz honestamente que está vazio.
 *
 * É o oposto do que encontramos no template shadcn, onde botões como
 * "Add event" e "Quick Create" não fazem nada e nada avisa — o usuário fica
 * achando que quebrou.
 */
import type { LucideIcon } from "lucide-react";

interface Props {
  rotulo: string;
  Icone: LucideIcon;
}

export default function SecaoVazia({ rotulo, Icone }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl
                   bg-white/[0.04] text-white/30
                   shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
      >
        <Icone size={28} strokeWidth={1.6} />
      </div>
      <div>
        <h2 className="text-lg font-medium text-white/85">{rotulo}</h2>
        <p className="mt-1 max-w-sm text-sm text-white/40">
          A casca já existe; o conteúdo desta seção ainda não foi migrado para
          cá. É a próxima parte.
        </p>
      </div>
    </div>
  );
}
