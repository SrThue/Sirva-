import { MODELO_CSV } from "@/lib/importacao-cardapio";

export function GET() {
  return new Response("﻿" + MODELO_CSV, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="modelo-cardapio-sirvai.csv"',
    },
  });
}
