"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { ORDER_STATUSES, STATUS_LABELS, type OrderStatus } from "@/lib/orders";
import { updateOrderStatus } from "./actions";

const MENU_HEIGHT = 220;

// Menú propio en vez de <select>: usa la Popover API para quedar por encima del contenedor con scroll de la tabla.
export function StatusMenu({ orderId, number, status }: { orderId: string; number: number; status: OrderStatus }) {
  const [shown, setShown] = useOptimistic(status);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // El menú es fixed: si la página o la tabla se desplazan, se cierra en vez de quedar flotando lejos del botón.
  useEffect(() => {
    if (!open) return;
    const close = () => menuRef.current?.hidePopover();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function show() {
    const menu = menuRef.current;
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!menu || !rect) return;
    const below = window.innerHeight - rect.bottom > MENU_HEIGHT;
    menu.style.left = `${rect.left}px`;
    menu.style.top = below ? `${rect.bottom + 4}px` : "auto";
    menu.style.bottom = below ? "auto" : `${window.innerHeight - rect.top + 4}px`;
    menu.dataset.side = below ? "bottom" : "top";
    menu.showPopover();
    menu.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
  }

  function choose(next: OrderStatus) {
    menuRef.current?.hidePopover();
    buttonRef.current?.focus();
    if (next === shown) return;
    setError(null);
    startTransition(async () => {
      setShown(next);
      // Si la acción falla o la red se corta, el estado optimista vuelve solo al terminar la transición; acá se avisa.
      try {
        const result = await updateOrderStatus(orderId, next);
        if (result.error) setError(result.error);
      } catch {
        setError("No se pudo guardar: revisá la conexión y probá de nuevo.");
      }
    });
  }

  function onMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    items[(current + step + items.length) % items.length]?.focus();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        ref={buttonRef}
        type="button"
        onClick={show}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Estado del pedido ${number}: ${STATUS_LABELS[shown]}. Cambiar`}
        className={`badge badge-${shown} status-trigger ${pending ? "opacity-60" : ""}`}
      >
        {STATUS_LABELS[shown]}
        <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3">
          <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {error && (
        <p role="alert" className="text-xs text-[var(--danger)]">
          {error}
        </p>
      )}
      <div
        ref={menuRef}
        popover="auto"
        role="menu"
        aria-label={`Cambiar estado del pedido ${number}`}
        className="status-menu"
        onKeyDown={onMenuKeyDown}
        onToggle={(event) => setOpen((event.nativeEvent as ToggleEvent).newState === "open")}
      >
        {ORDER_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            role="menuitemradio"
            aria-checked={s === shown}
            onClick={() => choose(s)}
            className="status-option"
          >
            <span className={`size-2 rounded-full dot-${s}`} aria-hidden="true" />
            {STATUS_LABELS[s]}
            {s === shown && (
              <svg aria-hidden="true" viewBox="0 0 12 12" className="ml-auto size-3">
                <path d="M2.5 6.5 5 9l4.5-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
