import "server-only";
import { redirect } from "next/navigation";
import { listarMinhasLojas, lojaAtiva } from "@/lib/loja-ativa";
import { criarClienteServidor } from "@/lib/supabase/server";

const PAPEIS_ESCRITA = ["dono", "gerente"];

/** Sessão + loja ativa. Sempre derive o loja_id daqui, nunca do formulário. */
export async function contextoPainel() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");
  const loja = await lojaAtiva(await listarMinhasLojas());
  if (!loja) redirect("/painel");
  return { supabase, user, loja, podeEditar: PAPEIS_ESCRITA.includes(loja.papel) };
}

/** Falha amigável: volta para a página com a mensagem (erros lançados são mascarados em produção). */
export function falhar(caminho: string, mensagem: string): never {
  redirect(`${caminho}${caminho.includes("?") ? "&" : "?"}erro=${encodeURIComponent(mensagem)}`);
}

export async function contextoEscrita(caminho: string) {
  const ctx = await contextoPainel();
  if (!ctx.podeEditar) falhar(caminho, "Você não tem permissão para alterar isso.");
  return ctx;
}
