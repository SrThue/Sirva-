import Link from "next/link";

const itens = [
  { href: "/painel", rotulo: "Início" },
  { href: "/painel/cardapio", rotulo: "Cardápio" },
  { href: "/painel/configuracoes", rotulo: "Configurações" },
];

export function NavPainel() {
  return (
    <nav aria-label="Painel" className="flex gap-1 overflow-x-auto border-b border-current/15 px-2">
      {itens.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className="px-3 py-3 text-sm font-medium whitespace-nowrap"
        >
          {i.rotulo}
        </Link>
      ))}
    </nav>
  );
}
