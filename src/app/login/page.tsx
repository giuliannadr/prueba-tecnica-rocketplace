import { LoginForm } from "./login-form";

// Usuarios creados por `pnpm db:seed`. Se muestran porque es una demo.
const DEMO_USERS = [
  { store: "Almacén Norte", email: "norte@example.com" },
  { store: "Librería Sur", email: "sur@example.com" },
  { store: "Vivero Oeste", email: "oeste@example.com" },
];

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-4 py-12">
      <div>
        <h1 className="text-2xl font-semibold">Pedidos</h1>
        <p className="mt-1 text-[var(--muted)]">Entrá con el usuario de tu tienda.</p>
      </div>
      <LoginForm />
      <section className="rounded-lg border border-[var(--line)] p-4 text-sm">
        <h2 className="font-medium">Usuarios de prueba</h2>
        <p className="mt-1 text-[var(--muted)]">
          Contraseña: <code>pedidos-demo-2026</code>
        </p>
        <ul className="mt-3 flex flex-col gap-1">
          {DEMO_USERS.map((u) => (
            <li key={u.email} className="flex justify-between gap-4">
              <span>{u.store}</span>
              <code className="text-[var(--muted)]">{u.email}</code>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
