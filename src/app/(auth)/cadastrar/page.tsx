"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Campo, classeBotao } from "@/components/campo";
import { slugDoNome } from "@/lib/validacao/auth";
import { cadastrar, type EstadoForm } from "../acoes";

export default function CadastrarPage() {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(cadastrar, {});
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);

  return (
    <form action={acao} className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Cadastre sua loja</h1>
      <Campo
        rotulo="Nome da loja"
        id="nomeLoja"
        required
        maxLength={80}
        onChange={(e) => !slugManual && setSlug(slugDoNome(e.target.value))}
      />
      <Campo
        rotulo="Endereço do cardápio (sirvai.menu/…)"
        id="slug"
        required
        value={slug}
        onChange={(e) => {
          setSlugManual(true);
          setSlug(e.target.value.toLowerCase());
        }}
      />
      <Campo rotulo="E-mail" id="email" type="email" autoComplete="email" required />
      <Campo
        rotulo="Senha (mínimo 10 caracteres)"
        id="senha"
        type="password"
        autoComplete="new-password"
        minLength={10}
        required
      />
      {estado.erro && (
        <p role="alert" className="text-sm text-red-600">
          {estado.erro}
        </p>
      )}
      {estado.aviso && (
        <p role="status" className="text-sm">
          {estado.aviso}
        </p>
      )}
      <button className={classeBotao} disabled={pendente}>
        {pendente ? "Criando…" : "Criar conta"}
      </button>
      <p className="text-sm">
        Já tem conta?{" "}
        <Link href="/entrar" className="text-primaria underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
