import "server-only";
import { cookies } from "next/headers";
import { criarClienteServidor } from "@/lib/supabase/server";

export type LojaMembro = { id: string; nome: string; slug: string; papel: string };

const COOKIE = "loja_ativa";

/** Lojas do usuário logado (RLS garante que só vêm as dele). */
export async function listarMinhasLojas(): Promise<LojaMembro[]> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("membros_loja")
    .select("papel, lojas(id, nome, slug)")
    .order("loja_id");
  return (data ?? []).flatMap((m) => {
    const loja = Array.isArray(m.lojas) ? m.lojas[0] : m.lojas;
    return loja ? [{ ...loja, papel: m.papel }] : [];
  });
}

/** Loja ativa = cookie, se o usuário ainda for membro; senão a primeira. */
export async function lojaAtiva(lojas: LojaMembro[]): Promise<LojaMembro | undefined> {
  const id = (await cookies()).get(COOKIE)?.value;
  return lojas.find((l) => l.id === id) ?? lojas[0];
}

export { COOKIE as COOKIE_LOJA_ATIVA };
