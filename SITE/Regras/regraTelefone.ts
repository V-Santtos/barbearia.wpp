// remove máscara e deixa só dígitos do telefone
export function sanitizePhone(raw: string): string {
return (raw || "").replace(/\D/g, "");
}
