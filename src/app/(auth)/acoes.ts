"use server";

import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { cadastroSchema, loginSchema } from "@/lib/validacao/auth";

export type EstadoForm = { erro?: string; aviso?: string };

const MSG_LOGIN = "E-mail ou senha incorretos."; // igual para usuário inexistente e senha errada

export async function entrar(_: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const dados = loginSchema.safeParse({
    email: formData.get("email"),
    senha: formData.get("senha"),
  });
  if (!dados.success) return { erro: MSG_LOGIN };

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email: dados.data.email,
    password: dados.data.senha,
  });
  if (error) return { erro: MSG_LOGIN };
  redirect("/painel");
}

export async function cadastrar(_: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const dados = cadastroSchema.safeParse({
    nomeLoja: formData.get("nomeLoja"),
    slug: formData.get("slug"),
    email: formData.get("email"),
    senha: formData.get("senha"),
  });
  if (!dados.success) return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.auth.signUp({
    email: dados.data.email,
    password: dados.data.senha,
    // Se a confirmação de e-mail estiver ligada, a loja é criada no primeiro acesso ao painel.
    options: { data: { loja_pendente: { nome: dados.data.nomeLoja, slug: dados.data.slug } } },
  });
  if (error) return { erro: "Não foi possível concluir o cadastro. Tente novamente." };

  if (!data.session) {
    return { aviso: "Enviamos um link de confirmação para o seu e-mail." };
  }
  const { error: erroLoja } = await supabase.rpc("criar_loja", {
    p_nome: dados.data.nomeLoja,
    p_slug: dados.data.slug,
  });
  if (erroLoja) {
    return {
      erro:
        erroLoja.code === "23505"
          ? "Esse endereço de loja já está em uso. Escolha outro."
          : "Conta criada, mas não foi possível criar a loja. Entre e tente de novo.",
    };
  }
  redirect("/painel");
}

export async function sair() {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/entrar");
}
