"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contextoEscrita, falhar } from "@/lib/painel";
import { idSchema } from "@/lib/validacao/cardapio";
import { areaSchema, definicaoDaArea, horariosSchema, lojaSchema } from "@/lib/validacao/loja";

const BASE = "/painel/configuracoes";
const texto = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function salvarLoja(f: FormData) {
  const { supabase, loja } = await contextoEscrita(BASE);
  const dados = lojaSchema.safeParse({ nome: texto(f, "nome"), telefone: texto(f, "telefone") });
  if (!dados.success) return falhar(BASE, dados.error.issues[0].message);
  const { error } = await supabase
    .from("lojas")
    .update({
      nome: dados.data.nome,
      telefone_whatsapp: dados.data.telefone,
      aberta: f.get("aberta") === "on",
    })
    .eq("id", loja.id);
  if (error) return falhar(BASE, "Não foi possível salvar.");
  revalidatePath("/painel", "layout");
  redirect(`${BASE}?ok=Dados salvos.`);
}

export async function salvarHorarios(f: FormData) {
  const { supabase, loja } = await contextoEscrita(BASE);
  const dias = Array.from({ length: 7 }, (_, i) => ({
    aberto: f.get(`aberto_${i}`) === "on",
    abre: texto(f, `abre_${i}`) || "00:00",
    fecha: texto(f, `fecha_${i}`) || "00:00",
  }));
  const dados = horariosSchema.safeParse(dias);
  if (!dados.success) return falhar(BASE, dados.error.issues[0].message);
  const { error } = await supabase.from("lojas").update({ horarios: dados.data }).eq("id", loja.id);
  if (error) return falhar(BASE, "Não foi possível salvar os horários.");
  revalidatePath(BASE);
  redirect(`${BASE}?ok=Horários salvos.`);
}

export async function criarArea(f: FormData) {
  const { supabase, loja } = await contextoEscrita(BASE);
  const tipo = texto(f, "tipo");
  const comum = {
    tipo,
    nome: texto(f, "nome"),
    taxa: texto(f, "taxa"),
    minimo: texto(f, "minimo"),
    prazo: texto(f, "prazo"),
  };
  const dados = areaSchema.safeParse(
    tipo === "bairro"
      ? { ...comum, bairros: texto(f, "bairros") }
      : tipo === "raio"
        ? { ...comum, raio_km: texto(f, "raio_km") }
        : { ...comum, pontos: texto(f, "pontos") },
  );
  if (!dados.success) return falhar(BASE, dados.error.issues[0].message);
  const a = dados.data;
  const { error } = await supabase.from("areas_entrega").insert({
    loja_id: loja.id,
    tipo: a.tipo,
    nome: a.nome || null,
    definicao: definicaoDaArea(a),
    taxa_centavos: a.taxa,
    pedido_minimo_centavos: a.minimo,
    prazo_minutos: a.prazo,
  });
  if (error) return falhar(BASE, "Não foi possível criar a área.");
  revalidatePath(BASE);
  redirect(`${BASE}?ok=Área criada.`);
}

export async function excluirArea(f: FormData) {
  const { supabase, loja } = await contextoEscrita(BASE);
  const aid = idSchema.safeParse(f.get("id"));
  if (!aid.success) return falhar(BASE, "Item inválido.");
  const { error } = await supabase
    .from("areas_entrega")
    .delete()
    .eq("id", aid.data)
    .eq("loja_id", loja.id);
  if (error) return falhar(BASE, "Não foi possível excluir a área.");
  revalidatePath(BASE);
}
