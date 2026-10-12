import Image from "next/image";
import Link from "next/link";
import { Aviso, param } from "@/components/aviso";
import { classeBotao } from "@/components/campo";
import { contextoPainel } from "@/lib/painel";
import { formatarCentavos } from "@/lib/utils/dinheiro";
import {
  alternarCategoria,
  alternarProduto,
  criarCategoria,
  criarProduto,
  excluirCategoria,
  moverCategoria,
  moverProduto,
} from "./acoes";

const mini =
  "rounded border border-current/30 px-2 py-1 text-xs focus-visible:outline-2 disabled:opacity-40";

function Mini({
  acao,
  campos,
  children,
  rotulo,
}: {
  acao: (f: FormData) => Promise<void>;
  campos: Record<string, string>;
  children: React.ReactNode;
  rotulo: string;
}) {
  return (
    <form action={acao}>
      {Object.entries(campos).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button className={mini} aria-label={rotulo} title={rotulo}>
        {children}
      </button>
    </form>
  );
}

export default async function CardapioPage({ searchParams }: PageProps<"/painel/cardapio">) {
  const sp = await searchParams;
  const { supabase, loja, podeEditar } = await contextoPainel();
  const [{ data: categorias }, { data: produtos }] = await Promise.all([
    supabase
      .from("categorias")
      .select("id, nome, ativa, ordem")
      .eq("loja_id", loja.id)
      .order("ordem")
      .order("id"),
    supabase
      .from("produtos")
      .select("id, nome, preco_centavos, ativo, destaque, categoria_id, foto_url")
      .eq("loja_id", loja.id)
      .order("ordem")
      .order("id"),
  ]);

  const grupos = [
    ...(categorias ?? []).map((c) => ({ ...c, id: c.id as string | null })),
    ...((produtos ?? []).some((p) => !p.categoria_id)
      ? [{ id: null, nome: "Sem categoria", ativa: true, ordem: 0 }]
      : []),
  ];
  const importados = param(sp.importados);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Cardápio</h1>
        <Link href="/painel/cardapio/importar" className="text-primaria text-sm underline">
          Importar planilha (CSV)
        </Link>
      </div>
      <Aviso
        erro={param(sp.erro)}
        ok={importados ? `${importados} produtos importados.` : undefined}
      />
      {!podeEditar && <Aviso erro="Seu papel permite apenas visualizar o cardápio." />}

      {podeEditar && (
        <div className="grid gap-4 sm:grid-cols-2">
          <form action={criarCategoria} className="flex gap-2">
            <input
              name="nome"
              placeholder="Nova categoria"
              required
              maxLength={60}
              aria-label="Nome da categoria"
              className="min-w-0 flex-1 rounded-lg border border-current/30 bg-transparent px-3 py-2"
            />
            <button className={classeBotao}>Adicionar</button>
          </form>
          <form action={criarProduto} className="flex flex-wrap gap-2">
            <input
              name="nome"
              placeholder="Novo produto"
              required
              maxLength={80}
              aria-label="Nome do produto"
              className="min-w-0 flex-1 rounded-lg border border-current/30 bg-transparent px-3 py-2"
            />
            <input
              name="preco"
              placeholder="Preço (45,90)"
              required
              inputMode="decimal"
              aria-label="Preço"
              className="w-28 rounded-lg border border-current/30 bg-transparent px-3 py-2"
            />
            <select
              name="categoria_id"
              aria-label="Categoria"
              className="rounded-lg border border-current/30 bg-transparent px-2 py-2"
            >
              <option value="">Sem categoria</option>
              {(categorias ?? []).map((c) => (
                <option key={c.id} value={c.id} className="text-black">
                  {c.nome}
                </option>
              ))}
            </select>
            <button className={classeBotao}>Criar</button>
          </form>
        </div>
      )}

      {grupos.length === 0 && (
        <p className="opacity-70">Nenhuma categoria ainda. Crie uma ou importe uma planilha.</p>
      )}

      {grupos.map((c) => {
        const itens = (produtos ?? []).filter((p) => (p.categoria_id ?? null) === c.id);
        return (
          <section key={c.id ?? "sem"} className="flex flex-col gap-2">
            <header className="flex flex-wrap items-center gap-2 border-b border-current/15 pb-1">
              <h2 className={`text-lg font-semibold ${c.ativa ? "" : "line-through opacity-60"}`}>
                {c.nome}
              </h2>
              {podeEditar && c.id && (
                <div className="ml-auto flex gap-1">
                  <Mini
                    acao={moverCategoria}
                    campos={{ id: c.id, dir: "sobe" }}
                    rotulo="Subir categoria"
                  >
                    ↑
                  </Mini>
                  <Mini
                    acao={moverCategoria}
                    campos={{ id: c.id, dir: "desce" }}
                    rotulo="Descer categoria"
                  >
                    ↓
                  </Mini>
                  <Mini
                    acao={alternarCategoria}
                    campos={{ id: c.id, valor: String(!c.ativa) }}
                    rotulo={c.ativa ? "Ocultar categoria" : "Mostrar categoria"}
                  >
                    {c.ativa ? "Ocultar" : "Mostrar"}
                  </Mini>
                  <Mini acao={excluirCategoria} campos={{ id: c.id }} rotulo="Excluir categoria">
                    Excluir
                  </Mini>
                </div>
              )}
            </header>
            {itens.length === 0 && <p className="text-sm opacity-60">Sem produtos.</p>}
            <ul className="flex flex-col gap-2">
              {itens.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-current/15 p-2"
                >
                  {p.foto_url ? (
                    <Image
                      src={p.foto_url}
                      alt=""
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded bg-current/10" aria-hidden />
                  )}
                  <Link href={`/painel/cardapio/${p.id}`} className="min-w-0 flex-1">
                    <span
                      className={`block truncate font-medium ${p.ativo ? "" : "line-through opacity-60"}`}
                    >
                      {p.destaque && "★ "}
                      {p.nome}
                    </span>
                    <span className="text-sm opacity-70">{formatarCentavos(p.preco_centavos)}</span>
                  </Link>
                  {podeEditar && (
                    <div className="flex gap-1">
                      <Mini
                        acao={moverProduto}
                        campos={{ id: p.id, dir: "sobe" }}
                        rotulo="Subir produto"
                      >
                        ↑
                      </Mini>
                      <Mini
                        acao={moverProduto}
                        campos={{ id: p.id, dir: "desce" }}
                        rotulo="Descer produto"
                      >
                        ↓
                      </Mini>
                      <Mini
                        acao={alternarProduto}
                        campos={{ id: p.id, campo: "ativo", valor: String(!p.ativo) }}
                        rotulo={p.ativo ? "Pausar produto" : "Reativar produto"}
                      >
                        {p.ativo ? "Pausar" : "Reativar"}
                      </Mini>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
