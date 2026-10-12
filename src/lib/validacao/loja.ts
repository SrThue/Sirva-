import { z } from "zod";
import { reais } from "@/lib/validacao/cardapio";

export const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido (use HH:MM).");

export const horariosSchema = z
  .array(z.strictObject({ aberto: z.boolean(), abre: hora, fecha: hora }))
  .length(7);

export type Horarios = z.infer<typeof horariosSchema>;

export const lojaSchema = z.strictObject({
  nome: z.string().trim().min(2, "Informe o nome da loja.").max(80),
  telefone: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().regex(/^(\d{10,13})?$/, "Telefone inválido. Use DDD + número."))
    .transform((v) => (v === "" ? null : v)),
});

const base = {
  nome: z.string().trim().max(60).optional(),
  taxa: reais,
  minimo: z
    .string()
    .trim()
    .transform((v) => (v === "" ? "0" : v))
    .pipe(reais),
  prazo: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number().int().min(1).max(600).nullable()),
};

export const areaSchema = z.discriminatedUnion("tipo", [
  z.strictObject({
    ...base,
    tipo: z.literal("bairro"),
    bairros: z
      .string()
      .transform((v) =>
        v
          .split(/[,\n;]/)
          .map((b) => b.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.string().max(60)).min(1, "Informe ao menos um bairro.").max(100)),
  }),
  z.strictObject({
    ...base,
    tipo: z.literal("raio"),
    raio_km: z.coerce.number().positive("Informe o raio em km.").max(100),
  }),
  z.strictObject({
    ...base,
    tipo: z.literal("poligono"),
    pontos: z.string().transform((v, ctx) => {
      const pts = v
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => l.split(/[,;]/).map((n) => Number(n.trim())));
      const ok =
        pts.length >= 3 &&
        pts.length <= 200 &&
        pts.every(
          ([lat, lng, ...r]) => r.length === 0 && Math.abs(lat) <= 90 && Math.abs(lng) <= 180,
        );
      if (!ok)
        ctx.addIssue({
          code: "custom",
          message: "Informe 3+ pontos, um por linha: latitude,longitude.",
        });
      return pts;
    }),
  }),
]);

/** Converte o resultado validado no formato gravado em areas_entrega.definicao. */
export function definicaoDaArea(a: z.infer<typeof areaSchema>) {
  if (a.tipo === "bairro") return { bairros: a.bairros };
  if (a.tipo === "raio") return { raio_km: a.raio_km };
  return { pontos: a.pontos };
}
