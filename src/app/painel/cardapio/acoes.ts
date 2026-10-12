"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { contextoEscrita, falhar } from "@/lib/painel";
import { interpretarCsvCardapio } from "@/lib/importacao-cardapio";
import {
  categoriaSchema,
  grupoSchema,
  idSchema,
  opcaoSchema,
  produtoSchema,
} from "@/lib/validacao/cardapio";

const BASE = "/painel/cardapio";
const FOTO_MAX_BYTES = 2 * 1024 * 1024;

type Supabase = Awaited<ReturnType<typeof contextoEscrita>>["supabase"];

const texto = (f: FormData, k: string) => String(f.get(k) ?? "");
const id = (f: FormData, k = "id") => {
  const r = idSchema.safeParse(f.get(k));
  return r.success ? r.data : falhar(BASE, "Item inválido.");
};

/* ───────── Categorias ───────── */
export async function criarCategoria(f: FormData) {
  const { supabase, loja } = await contextoEscrita(BASE);
  const dados = categoriaSchema.safeParse({ nome: texto(f, "nome") });
  if (!dados.success) return falhar(BASE, dados.error.issues[0].message);
  const { data: ultima } = await supabase
    .from("categorias")
    .select("ordem")
    .eq("loja_id", loja.id)
    .order("ordem", { ascending: false })
    .limit(1);
  const { error } = await supabase
    .from("categorias")
    .insert({ loja_id: loja.id, nome: dados.data.nome, ordem: (ultima?.[0]?.ordem ?? 0) + 1 });
  if (error) return falhar(BASE, "Não foi possível criar a categoria.");
  revalidatePath(BASE);
}

export async function alternarCategoria(f: FormData) {
  const { supabase, loja } = await contextoEscrita(BASE);
  const { error } = await supabase
    .from("categorias")
    .update({ ativa: texto(f, "valor") === "true" })
    .eq("id", id(f))
    .eq("loja_id", loja.id);
  if (error) return falhar(BASE, "Não foi possível atualizar a categoria.");
  revalidatePath(BASE);
}

export async function excluirCategoria(f: FormData) {
  const { supabase, loja } = await contextoEscrita(BASE);
  const { error } = await supabase
    .from("categorias")
    .delete()
    .eq("id", id(f))
    .eq("loja_id", loja.id);
  if (error) return falhar(BASE, "Não foi possível excluir a categoria.");
  revalidatePath(BASE);
}

/* ───────── Ordenação (subir/descer) ───────── */
async function mover(tabela: "categorias" | "produtos", f: FormData) {
  const { supabase, loja } = await contextoEscrita(BASE);
  const alvo = id(f);
  const delta = texto(f, "dir") === "sobe" ? -1 : 1;

  let consulta = supabase.from(tabela).select("id, ordem").eq("loja_id", loja.id);
  if (tabela === "produtos") {
    const { data: p } = await supabase
      .from("produtos")
      .select("categoria_id")
      .eq("id", alvo)
      .eq("loja_id", loja.id)
      .single();
    consulta = p?.categoria_id
      ? consulta.eq("categoria_id", p.categoria_id)
      : consulta.is("categoria_id", null);
  }
  const { data: lista } = await consulta.order("ordem").order("id");
  if (!lista) return;
  const i = lista.findIndex((x) => x.id === alvo);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= lista.length) return;
  [lista[i], lista[j]] = [lista[j], lista[i]];
  // reescreve 0..n-1 para ficar determinístico mesmo com ordens repetidas
  await Promise.all(
    lista.map((x, n) =>
      supabase.from(tabela).update({ ordem: n }).eq("id", x.id).eq("loja_id", loja.id),
    ),
  );
  revalidatePath(BASE);
}
export const moverCategoria = mover.bind(null, "categorias");
export const moverProduto = mover.bind(null, "produtos");

/* ───────── Produtos ───────── */
async function exigirCategoriaDaLoja(
  supabase: Supabase,
  lojaId: string,
  categoriaId: string | null,
  volta: string,
) {
  if (!categoriaId) return;
  const { data } = await supabase
    .from("categorias")
    .select("id")
    .eq("id", categoriaId)
    .eq("loja_id", lojaId)
    .maybeSingle();
  if (!data) falhar(volta, "Categoria inválida.");
}

export async function criarProduto(f: FormData) {
  const { supabase, loja } = await contextoEscrita(BASE);
  const dados = produtoSchema.safeParse({
    nome: texto(f, "nome"),
    descricao: "",
    preco: texto(f, "preco"),
    categoria_id: texto(f, "categoria_id"),
    selos: [],
    destaque: false,
    estoque: "",
  });
  if (!dados.success) return falhar(BASE, dados.error.issues[0].message);
  await exigirCategoriaDaLoja(supabase, loja.id, dados.data.categoria_id, BASE);
  const { data, error } = await supabase
    .from("produtos")
    .insert({
      loja_id: loja.id,
      categoria_id: dados.data.categoria_id,
      nome: dados.data.nome,
      preco_centavos: dados.data.preco,
      ordem: 9999,
    })
    .select("id")
    .single();
  if (error || !data) return falhar(BASE, "Não foi possível criar o produto.");
  redirect(`${BASE}/${data.id}`);
}

export async function salvarProduto(f: FormData) {
  const pid = id(f);
  const volta = `${BASE}/${pid}`;
  const { supabase, loja } = await contextoEscrita(volta);
  const dados = produtoSchema.safeParse({
    nome: texto(f, "nome"),
    descricao: texto(f, "descricao"),
    preco: texto(f, "preco"),
    categoria_id: texto(f, "categoria_id"),
    selos: f.getAll("selos").map(String),
    destaque: f.get("destaque") === "on",
    estoque: texto(f, "estoque"),
  });
  if (!dados.success) return falhar(volta, dados.error.issues[0].message);
  await exigirCategoriaDaLoja(supabase, loja.id, dados.data.categoria_id, volta);
  const { nome, descricao, preco, categoria_id, selos, destaque, estoque } = dados.data;
  const { error } = await supabase
    .from("produtos")
    .update({ nome, descricao, preco_centavos: preco, categoria_id, selos, destaque, estoque })
    .eq("id", pid)
    .eq("loja_id", loja.id);
  if (error) return falhar(volta, "Não foi possível salvar o produto.");
  revalidatePath(BASE);
  redirect(`${volta}?ok=1`);
}

export async function alternarProduto(f: FormData) {
  const { supabase, loja } = await contextoEscrita(BASE);
  const campo = texto(f, "campo");
  if (campo !== "ativo" && campo !== "destaque") return falhar(BASE, "Ação inválida.");
  const { error } = await supabase
    .from("produtos")
    .update({ [campo]: texto(f, "valor") === "true" })
    .eq("id", id(f))
    .eq("loja_id", loja.id);
  if (error) return falhar(BASE, "Não foi possível atualizar o produto.");
  revalidatePath(BASE);
}

export async function excluirProduto(f: FormData) {
  const { supabase, loja } = await contextoEscrita(BASE);
  const { error } = await supabase.from("produtos").delete().eq("id", id(f)).eq("loja_id", loja.id);
  // produtos já vendidos têm itens_pedido referenciando: pausar em vez de apagar
  if (error) return falhar(BASE, "Este produto já foi vendido; pause-o em vez de excluir.");
  revalidatePath(BASE);
  redirect(BASE);
}

/* ───────── Foto (validada e reprocessada no servidor) ───────── */
function caminhoDaFoto(url: string | null, lojaId: string) {
  const marca = "/produtos/";
  const i = url?.indexOf(marca) ?? -1;
  const caminho = url && i >= 0 ? url.slice(i + marca.length) : null;
  return caminho?.startsWith(`${lojaId}/`) ? caminho : null;
}

export async function enviarFoto(f: FormData) {
  const pid = id(f);
  const volta = `${BASE}/${pid}`;
  const { supabase, loja } = await contextoEscrita(volta);
  const arquivo = f.get("foto");
  if (!(arquivo instanceof File) || arquivo.size === 0) return falhar(volta, "Escolha uma imagem.");
  if (arquivo.size > FOTO_MAX_BYTES) return falhar(volta, "A imagem deve ter até 2 MB.");

  let webp: Buffer;
  try {
    const entrada = Buffer.from(await arquivo.arrayBuffer());
    const meta = await sharp(entrada).metadata(); // lê o conteúdo real, não o nome/MIME enviado
    if (!meta.format || !["jpeg", "png", "webp"].includes(meta.format)) throw new Error("formato");
    webp = await sharp(entrada)
      .rotate()
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer(); // reprocessa: remove metadados e payloads escondidos
  } catch {
    return falhar(volta, "Imagem inválida. Use JPG, PNG ou WebP.");
  }

  const { data: atual } = await supabase
    .from("produtos")
    .select("foto_url")
    .eq("id", pid)
    .eq("loja_id", loja.id)
    .single();
  if (!atual) return falhar(volta, "Produto não encontrado.");

  const caminho = `${loja.id}/${randomUUID()}.webp`;
  const { error } = await supabase.storage.from("produtos").upload(caminho, webp, {
    contentType: "image/webp",
    cacheControl: "31536000",
  });
  if (error) return falhar(volta, "Não foi possível enviar a imagem.");
  const { data: pub } = supabase.storage.from("produtos").getPublicUrl(caminho);
  await supabase
    .from("produtos")
    .update({ foto_url: pub.publicUrl })
    .eq("id", pid)
    .eq("loja_id", loja.id);

  const antigo = caminhoDaFoto(atual.foto_url, loja.id);
  if (antigo) await supabase.storage.from("produtos").remove([antigo]);
  revalidatePath(BASE);
  redirect(`${volta}?ok=1`);
}

export async function removerFoto(f: FormData) {
  const pid = id(f);
  const volta = `${BASE}/${pid}`;
  const { supabase, loja } = await contextoEscrita(volta);
  const { data: atual } = await supabase
    .from("produtos")
    .select("foto_url")
    .eq("id", pid)
    .eq("loja_id", loja.id)
    .single();
  const antigo = caminhoDaFoto(atual?.foto_url ?? null, loja.id);
  await supabase.from("produtos").update({ foto_url: null }).eq("id", pid).eq("loja_id", loja.id);
  if (antigo) await supabase.storage.from("produtos").remove([antigo]);
  revalidatePath(BASE);
  redirect(volta);
}

/* ───────── Grupos de opções e adicionais ───────── */
export async function criarGrupo(f: FormData) {
  const pid = id(f, "produto_id");
  const volta = `${BASE}/${pid}`;
  const { supabase, loja } = await contextoEscrita(volta);
  const dados = grupoSchema.safeParse({
    nome: texto(f, "nome"),
    minimo: texto(f, "minimo") || "0",
    maximo: texto(f, "maximo") || "1",
    obrigatorio: f.get("obrigatorio") === "on",
  });
  if (!dados.success) return falhar(volta, dados.error.issues[0].message);
  const { data: produto } = await supabase
    .from("produtos")
    .select("id")
    .eq("id", pid)
    .eq("loja_id", loja.id)
    .maybeSingle();
  if (!produto) return falhar(volta, "Produto não encontrado.");
  const { error } = await supabase.from("grupos_opcoes").insert({ produto_id: pid, ...dados.data });
  if (error) return falhar(volta, "Não foi possível criar o grupo.");
  revalidatePath(volta);
}

export async function excluirGrupo(f: FormData) {
  const pid = id(f, "produto_id");
  const volta = `${BASE}/${pid}`;
  const { supabase } = await contextoEscrita(volta);
  const { error } = await supabase
    .from("grupos_opcoes")
    .delete()
    .eq("id", id(f, "grupo_id"))
    .eq("produto_id", pid);
  if (error) return falhar(volta, "Não foi possível excluir o grupo.");
  revalidatePath(volta);
}

export async function criarOpcao(f: FormData) {
  const pid = id(f, "produto_id");
  const volta = `${BASE}/${pid}`;
  const { supabase } = await contextoEscrita(volta);
  const dados = opcaoSchema.safeParse({ nome: texto(f, "nome"), adicional: texto(f, "adicional") });
  if (!dados.success) return falhar(volta, dados.error.issues[0].message);
  const grupo = id(f, "grupo_id");
  const { data: g } = await supabase
    .from("grupos_opcoes")
    .select("id")
    .eq("id", grupo)
    .eq("produto_id", pid)
    .maybeSingle();
  if (!g) return falhar(volta, "Grupo não encontrado.");
  const { error } = await supabase
    .from("opcoes")
    .insert({ grupo_id: grupo, nome: dados.data.nome, adicional_centavos: dados.data.adicional });
  if (error) return falhar(volta, "Não foi possível criar a opção.");
  revalidatePath(volta);
}

export async function alternarOpcao(f: FormData) {
  const pid = id(f, "produto_id");
  const volta = `${BASE}/${pid}`;
  const { supabase } = await contextoEscrita(volta);
  const { error } = await supabase
    .from("opcoes")
    .update({ ativa: texto(f, "valor") === "true" })
    .eq("id", id(f, "opcao_id"));
  if (error) return falhar(volta, "Não foi possível atualizar a opção.");
  revalidatePath(volta);
}

export async function excluirOpcao(f: FormData) {
  const pid = id(f, "produto_id");
  const volta = `${BASE}/${pid}`;
  const { supabase } = await contextoEscrita(volta);
  const { error } = await supabase.from("opcoes").delete().eq("id", id(f, "opcao_id"));
  if (error) return falhar(volta, "Não foi possível excluir a opção.");
  revalidatePath(volta);
}

/* ───────── Importação por CSV ───────── */
export async function importarCsv(f: FormData) {
  const volta = `${BASE}/importar`;
  const { supabase, loja } = await contextoEscrita(volta);
  const arquivo = f.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0)
    return falhar(volta, "Escolha um arquivo CSV.");
  if (arquivo.size > 512 * 1024) return falhar(volta, "O arquivo deve ter até 512 KB.");

  const { linhas, erros } = interpretarCsvCardapio(await arquivo.text());
  if (erros.length) return falhar(volta, erros.slice(0, 5).join(" "));
  if (linhas.length === 0) return falhar(volta, "Nenhum produto encontrado.");

  const { data: existentes } = await supabase
    .from("categorias")
    .select("id, nome, ordem")
    .eq("loja_id", loja.id);
  const porNome = new Map((existentes ?? []).map((c) => [c.nome.toLowerCase(), c.id]));
  let ordem = Math.max(0, ...(existentes ?? []).map((c) => c.ordem));

  for (const nome of new Set(linhas.map((l) => l.categoria))) {
    if (porNome.has(nome.toLowerCase())) continue;
    const { data, error } = await supabase
      .from("categorias")
      .insert({ loja_id: loja.id, nome, ordem: ++ordem })
      .select("id")
      .single();
    if (error || !data) return falhar(volta, "Falha ao criar categorias. Nada foi importado.");
    porNome.set(nome.toLowerCase(), data.id);
  }
  const { error } = await supabase.from("produtos").insert(
    linhas.map((l, i) => ({
      loja_id: loja.id,
      categoria_id: porNome.get(l.categoria.toLowerCase()) ?? null,
      nome: l.nome,
      descricao: l.descricao,
      preco_centavos: l.preco_centavos,
      selos: l.selos,
      ordem: i,
    })),
  );
  if (error) return falhar(volta, "Falha ao importar os produtos.");
  revalidatePath(BASE);
  redirect(`${BASE}?importados=${linhas.length}`);
}
