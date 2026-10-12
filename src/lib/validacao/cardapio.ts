import { z } from "zod";
import { reaisParaCentavos } from "@/lib/utils/dinheiro";

export const SELOS = [
  "vegano",
  "vegetariano",
  "sem_gluten",
  "sem_lactose",
  "picante",
  "fit",
] as const;
export const SELOS_ROTULO: Record<(typeof SELOS)[number], string> = {
  vegano: "Vegano",
  vegetariano: "Vegetariano",
  sem_gluten: "Sem glúten",
  sem_lactose: "Sem lactose",
  picante: "Picante",
  fit: "Fit",
};

export const reais = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const c = reaisParaCentavos(v);
    if (c === null) ctx.addIssue({ code: "custom", message: "Valor inválido. Ex.: 45,90" });
    return c ?? 0;
  });

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

const idOpcional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.uuid().nullable());

export const categoriaSchema = z.strictObject({
  nome: z.string().trim().min(1, "Informe o nome.").max(60),
});

export const produtoSchema = z.strictObject({
  nome: z.string().trim().min(1, "Informe o nome.").max(80),
  descricao: textoOpcional(500),
  preco: reais,
  categoria_id: idOpcional,
  selos: z.array(z.enum(SELOS)).max(SELOS.length),
  destaque: z.boolean(),
  estoque: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number().int().min(0).max(100000).nullable()),
});

export const grupoSchema = z
  .strictObject({
    nome: z.string().trim().min(1, "Informe o nome do grupo.").max(60),
    minimo: z.coerce.number().int().min(0).max(50),
    maximo: z.coerce.number().int().min(1).max(50),
    obrigatorio: z.boolean(),
  })
  .refine((g) => g.minimo <= g.maximo, { message: "O mínimo não pode passar do máximo." });

export const opcaoSchema = z.strictObject({
  nome: z.string().trim().min(1, "Informe o nome da opção.").max(60),
  adicional: z
    .string()
    .trim()
    .transform((v) => (v === "" ? "0" : v))
    .pipe(reais),
});

export const idSchema = z.uuid();
