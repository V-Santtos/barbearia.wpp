import type { ChangeEvent } from "react";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// R$ 99.999.999,99 basta para qualquer lançamento de barbearia.
const MAX_DIGITOS = 10;

interface CurrencyFieldProps {
  id: string;
  name: string;
  /** Valor em centavos; `null` deixa o campo vazio e mostra o placeholder. */
  centavos: number | null;
  onChange: (centavos: number | null) => void;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  className?: string;
}

/**
 * Máscara de maquininha: os dígitos entram pela direita, então "150" vira
 * R$ 1,50 e "15000" vira R$ 150,00. Não há vírgula ou ponto para errar.
 */
export function CurrencyField({
  id,
  name,
  centavos,
  onChange,
  ariaDescribedBy,
  ariaInvalid,
  className,
}: CurrencyFieldProps) {
  const aoDigitar = (event: ChangeEvent<HTMLInputElement>) => {
    const digitos = event.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, MAX_DIGITOS);
    onChange(digitos ? Number(digitos) : null);
  };

  return (
    <input
      id={id}
      name={name}
      inputMode="numeric"
      autoComplete="off"
      className={className}
      placeholder={moeda.format(0)}
      value={centavos === null ? "" : moeda.format(centavos / 100)}
      aria-invalid={ariaInvalid || undefined}
      aria-describedby={ariaDescribedBy}
      onChange={aoDigitar}
    />
  );
}
