import { z } from "zod";

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/,
    "Use 3 a 40 letras minúsculas, números ou hífen.",
  );

export const loginSchema = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido.")),
  senha: z.string().min(1, "Informe a senha."),
});

export const cadastroSchema = z.strictObject({
  nomeLoja: z.string().trim().min(2, "Informe o nome da loja.").max(80),
  slug: slugSchema,
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido.")),
  senha: z.string().min(10, "A senha precisa ter ao menos 10 caracteres.").max(128),
});

/** Gera um slug sugerido a partir do nome da loja. */
export function slugDoNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
