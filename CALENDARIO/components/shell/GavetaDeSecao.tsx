/**
 * A gaveta: a coluna de 288px que traz o contexto da seção aberta.
 *
 * Ela **empurra**, não cobre. Continua sendo filho do flex principal, como o
 * `<aside>` sempre foi, então fechar devolve largura ao conteúdo em vez de
 * revelar calendário por baixo. Cobrir seria mais fácil de animar e traria de
 * volta o problema que motivou sair das camadas.
 *
 * A largura é 288px — a mesma do `w-72` de antes, para nada refluir. E o miolo
 * mantém essa largura fixa enquanto a moldura encolhe: assim o conteúdo é
 * recortado ao fechar, em vez de espremer e redesenhar texto no meio da
 * animação.
 *
 * O "Criar" NÃO mora aqui: ele é da coluna da esquerda, porque é a ação
 * primária do produto e não um acessório do calendário.
 *
 * No celular a gaveta não existe: quem manda lá é o dock, e a `Sidebar` já
 * cuida do próprio painel em tela cheia. Por isso o componente simplesmente
 * some do caminho (`isMobile` devolve os filhos crus) — envolver o painel
 * `fixed` do celular num contêiner animado quebraria o posicionamento dele.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";

interface Props {
  aberta: boolean;
  isMobile: boolean;
  children: React.ReactNode;
}

export default function GavetaDeSecao({ aberta, isMobile, children }: Props) {
  const reduzir = useReducedMotion();

  if (isMobile) return <>{children}</>;

  return (
    <motion.div
      className="relative flex-shrink-0 overflow-hidden bg-[#1c1c1c]"
      initial={false}
      animate={{ width: aberta ? 288 : 0 }}
      transition={
        reduzir
          ? { duration: 0 }
          : { type: "spring", stiffness: 340, damping: 34 }
      }
    >
      <div className="flex h-full w-72 flex-col">
        {children}
      </div>
    </motion.div>
  );
}
