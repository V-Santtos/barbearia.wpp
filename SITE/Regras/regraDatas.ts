// Helper para gerar data local em formato ISO (AAAA-MM-DD)
export function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Normaliza qualquer formato razoável de data em string
 * para "AAAA-MM-DD", sem erro de fuso.
 */
export function normalizeDateToISO(
  dateValue: string | null | undefined
): string | null {
  if (!dateValue) return null;

  const trimmed = String(dateValue).trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) return trimmed.slice(0, 10);

  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) return toLocalISO(parsed);

  return null;
}
