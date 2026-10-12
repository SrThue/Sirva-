"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Campo, classeBotao } from "@/components/campo";
import { entrar, type EstadoForm } from "../acoes";

export default function EntrarPage() {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(entrar, {});
  return (
    <form action={acao} className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Entrar</h1>
      <Campo rotulo="E-mail" id="email" type="email" autoComplete="email" required />
      <Campo rotulo="Senha" id="senha" type="password" autoComplete="current-password" required />
      {estado.erro && (
        <p role="alert" className="text-sm text-red-600">
          {estado.erro}
        </p>
      )}
      <button className={classeBotao} disabled={pendente}>
        {pendente ? "Entrando…" : "Entrar"}
      </button>
      <p className="text-sm">
        Ainda não tem conta?{" "}
        <Link href="/cadastrar" className="text-primaria underline">
          Cadastre sua loja
        </Link>
      </p>
    </form>
  );
}
