import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { listarMinhasLojas, lojaAtiva } from "@/lib/loja-ativa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { sair } from "../(auth)/acoes";
import { trocarLoja } from "./acoes";

async function Casca({ children }: { children: ReactNode }) {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  let lojas = await listarMinhasLojas();

  // Cadastro com confirmação de e-mail: cria a loja guardada no cadastro no primeiro acesso.
  const pendente = user.user_metadata?.loja_pendente as
    { nome?: string; slug?: string } | undefined;
  if (lojas.length === 0 && pendente?.nome && pendente?.slug) {
    await supabase.rpc("criar_loja", { p_nome: pendente.nome, p_slug: pendente.slug });
    lojas = await listarMinhasLojas();
  }
  const ativa = await lojaAtiva(lojas);

  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-primaria text-primaria-fg flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="font-bold">sirvaí</span>
        {lojas.length > 1 ? (
          <form action={trocarLoja} className="flex items-center gap-2">
            <label htmlFor="loja" className="sr-only">
              Trocar de loja
            </label>
            <select
              id="loja"
              name="loja"
              defaultValue={ativa?.id}
              className="rounded bg-white/15 px-2 py-1"
            >
              {lojas.map((l) => (
                <option key={l.id} value={l.id} className="text-black">
                  {l.nome}
                </option>
              ))}
            </select>
            <button className="rounded bg-white/20 px-2 py-1 text-sm">Trocar</button>
          </form>
        ) : (
          <span>{ativa?.nome}</span>
        )}
        <form action={sair} className="ml-auto">
          <button className="text-sm underline">Sair</button>
        </form>
      </header>
      <div className="flex-1 p-4">{children}</div>
    </div>
  );
}

export default function PainelLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<p className="p-4">Carregando…</p>}>
      <Casca>{children}</Casca>
    </Suspense>
  );
}
