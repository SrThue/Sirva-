export function Aviso({ erro, ok }: { erro?: string; ok?: string }) {
  if (erro)
    return (
      <p role="alert" className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800">
        {erro}
      </p>
    );
  if (ok)
    return (
      <p role="status" className="rounded-lg bg-green-100 px-3 py-2 text-sm text-green-800">
        {ok}
      </p>
    );
  return null;
}

/** Texto vindo da URL: limita tamanho (é renderizado como texto, nunca como HTML). */
export const param = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.slice(0, 300);
