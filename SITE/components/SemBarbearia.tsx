/**
 * O que aparece quando o endereço não diz de qual barbearia é o site.
 *
 * Existe porque não há loja padrão (ver `lib/barbearia.ts`). Quem chega aqui digitou
 * o endereço sem o nome da barbearia, ou seguiu um link antigo — `/agendar` era o
 * endereço antes do site atender mais de uma loja.
 */
export default function SemBarbearia() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        textAlign: "center",
        fontFamily: "Inter, system-ui, sans-serif",
        color: "#f4f4f5",
        background: "#0e0e10",
      }}
    >
      <div style={{ maxWidth: 360 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 12 }}>
          Barbearia não encontrada
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.5, color: "#a1a1aa" }}>
          Este endereço não indica de qual barbearia é o agendamento. Use o link
          que a sua barbearia compartilhou com você.
        </p>
      </div>
    </main>
  );
}
