import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso, param } from "@/components/aviso";
import { Campo, classeBotao } from "@/components/campo";
import { contextoPainel } from "@/lib/painel";
import { centavosParaReais, formatarCentavos } from "@/lib/utils/dinheiro";
import { SELOS, SELOS_ROTULO, idSchema } from "@/lib/validacao/cardapio";
import {
  alternarOpcao,
  criarGrupo,
  criarOpcao,
  enviarFoto,
  excluirGrupo,
  excluirOpcao,
  excluirProduto,
  removerFoto,
  salvarProduto,
} from "../acoes";

const linha = "rounded-lg border border-current/30 bg-transparent px-3 py-2";
const mini = "rounded border border-current/30 px-2 py-1 text-xs";

export default async function ProdutoPage({
  params,
  searchParams,
}: PageProps<"/painel/cardapio/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!idSchema.safeParse(id).success) notFound();
  const { supabase, loja, podeEditar } = await contextoPainel();

  const { data: p } = await supabase
    .from("produtos")
    .select(
      "*, grupos_opcoes(id, nome, minimo, maximo, obrigatorio, opcoes(id, nome, adicional_centavos, ativa))",
    )
    .eq("id", id)
    .eq("loja_id", loja.id)
    .maybeSingle();
  if (!p) notFound();
  const { data: categorias } = await supabase
    .from("categorias")
    .select("id, nome")
    .eq("loja_id", loja.id)
    .order("ordem");
  const ro = !podeEditar;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/painel/cardapio" className="text-primaria text-sm underline">
        ← Cardápio
      </Link>
      <h1 className="text-2xl font-semibold">{p.nome}</h1>
      <Aviso erro={param(sp.erro)} ok={sp.ok ? "Salvo." : undefined} />

      <form action={salvarProduto} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={p.id} />
        <Campo
          rotulo="Nome"
          id="nome"
          defaultValue={p.nome}
          required
          maxLength={80}
          disabled={ro}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="descricao" className="text-sm font-medium">
            Descrição
          </label>
          <textarea
            id="descricao"
            name="descricao"
            defaultValue={p.descricao ?? ""}
            maxLength={500}
            rows={3}
            disabled={ro}
            className={linha}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo
            rotulo="Preço (R$)"
            id="preco"
            defaultValue={centavosParaReais(p.preco_centavos)}
            inputMode="decimal"
            required
            disabled={ro}
          />
          <Campo
            rotulo="Estoque (vazio = sem controle)"
            id="estoque"
            defaultValue={p.estoque ?? ""}
            inputMode="numeric"
            disabled={ro}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="categoria_id" className="text-sm font-medium">
            Categoria
          </label>
          <select
            id="categoria_id"
            name="categoria_id"
            defaultValue={p.categoria_id ?? ""}
            disabled={ro}
            className={linha}
          >
            <option value="">Sem categoria</option>
            {(categorias ?? []).map((c) => (
              <option key={c.id} value={c.id} className="text-black">
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="flex flex-wrap gap-3" disabled={ro}>
          <legend className="mb-1 text-sm font-medium">Selos</legend>
          {SELOS.map((s) => (
            <label key={s} className="flex items-center gap-1 text-sm">
              <input type="checkbox" name="selos" value={s} defaultChecked={p.selos?.includes(s)} />
              {SELOS_ROTULO[s]}
            </label>
          ))}
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="destaque" defaultChecked={p.destaque} disabled={ro} />{" "}
          Destaque no cardápio
        </label>
        {!ro && <button className={classeBotao}>Salvar</button>}
      </form>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Foto</h2>
        {p.foto_url && (
          <Image
            src={p.foto_url}
            alt={`Foto de ${p.nome}`}
            width={160}
            height={160}
            className="h-40 w-40 rounded-lg object-cover"
          />
        )}
        {!ro && (
          <div className="flex flex-wrap items-center gap-2">
            <form action={enviarFoto} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={p.id} />
              <input
                type="file"
                name="foto"
                accept="image/jpeg,image/png,image/webp"
                required
                aria-label="Foto do produto"
              />
              <button className={classeBotao}>Enviar foto</button>
            </form>
            {p.foto_url && (
              <form action={removerFoto}>
                <input type="hidden" name="id" value={p.id} />
                <button className={mini}>Remover foto</button>
              </form>
            )}
          </div>
        )}
        <p className="text-xs opacity-60">
          JPG, PNG ou WebP até 2 MB. A imagem é redimensionada e otimizada.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Opções e adicionais</h2>
        {(p.grupos_opcoes ?? []).map(
          (g: {
            id: string;
            nome: string;
            minimo: number;
            maximo: number;
            obrigatorio: boolean;
            opcoes: { id: string; nome: string; adicional_centavos: number; ativa: boolean }[];
          }) => (
            <div key={g.id} className="flex flex-col gap-2 rounded-lg border border-current/15 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <strong>{g.nome}</strong>
                <span className="text-xs opacity-70">
                  {g.obrigatorio ? "obrigatório" : "opcional"} · escolha de {g.minimo} a {g.maximo}
                </span>
                {!ro && (
                  <form action={excluirGrupo} className="ml-auto">
                    <input type="hidden" name="produto_id" value={p.id} />
                    <input type="hidden" name="grupo_id" value={g.id} />
                    <button className={mini}>Excluir grupo</button>
                  </form>
                )}
              </div>
              <ul className="flex flex-col gap-1">
                {g.opcoes.map((o) => (
                  <li key={o.id} className="flex items-center gap-2 text-sm">
                    <span className={o.ativa ? "" : "line-through opacity-60"}>{o.nome}</span>
                    <span className="opacity-70">
                      {o.adicional_centavos > 0
                        ? `+ ${formatarCentavos(o.adicional_centavos)}`
                        : "sem custo"}
                    </span>
                    {!ro && (
                      <span className="ml-auto flex gap-1">
                        <form action={alternarOpcao}>
                          <input type="hidden" name="produto_id" value={p.id} />
                          <input type="hidden" name="opcao_id" value={o.id} />
                          <input type="hidden" name="valor" value={String(!o.ativa)} />
                          <button className={mini}>{o.ativa ? "Pausar" : "Reativar"}</button>
                        </form>
                        <form action={excluirOpcao}>
                          <input type="hidden" name="produto_id" value={p.id} />
                          <input type="hidden" name="opcao_id" value={o.id} />
                          <button className={mini}>Excluir</button>
                        </form>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {!ro && (
                <form action={criarOpcao} className="flex flex-wrap gap-2">
                  <input type="hidden" name="produto_id" value={p.id} />
                  <input type="hidden" name="grupo_id" value={g.id} />
                  <input
                    name="nome"
                    placeholder="Nova opção"
                    required
                    maxLength={60}
                    aria-label="Nome da opção"
                    className={`${linha} min-w-0 flex-1`}
                  />
                  <input
                    name="adicional"
                    placeholder="+ R$ (0,00)"
                    inputMode="decimal"
                    aria-label="Valor adicional"
                    className={`${linha} w-28`}
                  />
                  <button className={classeBotao}>Adicionar</button>
                </form>
              )}
            </div>
          ),
        )}
        {!ro && (
          <form
            action={criarGrupo}
            className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-current/30 p-3"
          >
            <input type="hidden" name="produto_id" value={p.id} />
            <div className="flex min-w-40 flex-1 flex-col gap-1">
              <label htmlFor="g-nome" className="text-xs">
                Novo grupo (ex.: Tamanho, Adicionais)
              </label>
              <input id="g-nome" name="nome" required maxLength={60} className={linha} />
            </div>
            <div className="flex w-16 flex-col gap-1">
              <label htmlFor="g-min" className="text-xs">
                Mín.
              </label>
              <input
                id="g-min"
                name="minimo"
                type="number"
                min={0}
                max={50}
                defaultValue={0}
                className={linha}
              />
            </div>
            <div className="flex w-16 flex-col gap-1">
              <label htmlFor="g-max" className="text-xs">
                Máx.
              </label>
              <input
                id="g-max"
                name="maximo"
                type="number"
                min={1}
                max={50}
                defaultValue={1}
                className={linha}
              />
            </div>
            <label className="flex items-center gap-1 pb-2 text-sm">
              <input type="checkbox" name="obrigatorio" /> Obrigatório
            </label>
            <button className={classeBotao}>Criar grupo</button>
          </form>
        )}
      </section>

      {!ro && (
        <form action={excluirProduto} className="border-t border-current/15 pt-4">
          <input type="hidden" name="id" value={p.id} />
          <button className="text-sm text-red-700 underline">Excluir produto</button>
        </form>
      )}
    </div>
  );
}
