import type { InputHTMLAttributes } from "react";

export function Campo({
  rotulo,
  id,
  ...props
}: { rotulo: string; id: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {rotulo}
      </label>
      <input
        id={id}
        name={id}
        className="focus-visible:outline-primaria rounded-lg border border-current/30 bg-transparent px-3 py-2 text-base focus-visible:outline-2"
        {...props}
      />
    </div>
  );
}

export const classeBotao =
  "bg-primaria text-primaria-fg rounded-lg px-4 py-2.5 font-semibold disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2";
