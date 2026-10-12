import { listarMinhasLojas, lojaAtiva } from "@/lib/loja-ativa";

export default async function PainelPage() {
  const ativa = await lojaAtiva(await listarMinhasLojas());
  if (!ativa) {
    return <p>Não encontramos uma loja para sua conta. Fale com o suporte.</p>;
  }
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">{ativa.nome}</h1>
      <p className="text-sm opacity-70">
        Papel: {ativa.papel} · Cardápio: /{ativa.slug}
      </p>
      <p>Painel em construção. Próximas fases: cardápio, pedidos, salão.</p>
    </section>
  );
}
