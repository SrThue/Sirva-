export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <p className="text-primaria text-3xl font-bold">sirvaí</p>
      {children}
    </main>
  );
}
