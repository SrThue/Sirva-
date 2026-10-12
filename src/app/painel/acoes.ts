"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { COOKIE_LOJA_ATIVA, listarMinhasLojas } from "@/lib/loja-ativa";

export async function trocarLoja(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("loja"));
  if (id.success) {
    const minhas = await listarMinhasLojas(); // só aceita lojas das quais o usuário é membro
    if (minhas.some((l) => l.id === id.data)) {
      (await cookies()).set(COOKIE_LOJA_ATIVA, id.data, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });
    }
  }
  redirect("/painel");
}
