import { useEffect, useRef } from "react";
import { ApiError } from "../services/calendarApi";

interface UsePollingOptions {
  /** Intervalo normal entre execuções, em ms. */
  intervalMs: number;
  /** Se false, o polling fica parado. Default: true. */
  enabled?: boolean;
}

/**
 * Executa `fn` periodicamente com proteções contra excesso de requisições:
 * - não dispara enquanto a execução anterior não terminou (guarda inFlight);
 * - pausa quando a aba não está visível (document.hidden);
 * - em erro 429, espera o Retry-After (ou um backoff) antes de tentar de novo;
 * - em qualquer erro, NÃO mexe no estado — quem chama mantém o último dado bom.
 *
 * `fn` deve apenas buscar e atualizar o estado; deixe os erros propagarem
 * (lance/relance) para o hook decidir o backoff.
 */
export function usePolling(
  fn: () => Promise<void>,
  { intervalMs, enabled = true }: UsePollingOptions,
  deps: React.DependencyList,
) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = (ms: number) => {
      if (cancelled) return;
      timer = setTimeout(run, ms);
    };

    const run = async () => {
      if (cancelled) return;
      // Aba em segundo plano ou requisição ainda em voo: re-tenta depois.
      if (document.hidden || inFlight) {
        schedule(intervalMs);
        return;
      }

      inFlight = true;
      let next = intervalMs;
      try {
        await fnRef.current();
      } catch (err) {
        if (err instanceof ApiError && err.status === 429) {
          // Respeita o Retry-After; com piso de backoff pra não martelar.
          next = Math.max(err.retryAfterMs || 0, intervalMs * 2, 5000);
        }
        // Outros erros: mantém o intervalo normal e NÃO altera o estado.
        console.error("[usePolling]", err);
      } finally {
        inFlight = false;
        schedule(next);
      }
    };

    // Primeira execução imediata.
    run();

    // Ao voltar pra aba, atualiza na hora (se não houver req em voo).
    const onVisible = () => {
      if (!document.hidden && !inFlight) {
        if (timer) clearTimeout(timer);
        run();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, enabled, ...deps]);
}
