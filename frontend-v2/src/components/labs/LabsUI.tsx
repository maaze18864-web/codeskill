"use client";

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { Combobox } from "@base-ui/react/combobox";
import { Dialog } from "@base-ui/react/dialog";
import {
  Check,
  ChevronsUpDown,
  ChevronLeft,
  FlaskConical,
  Search,
  X,
} from "lucide-react";

export const labsPage =
  "mx-auto w-full max-w-[1400px] space-y-6 px-4 py-6 text-foreground sm:px-6 md:py-8";
// Student pages sit below the floating site navigation; portals have their own shell.
export const labsPageWithNavigation = `${labsPage} mt-[68px]`;
export const labsPanel =
  "min-w-0 overflow-hidden rounded-xl border border-border bg-card";
export const labsControl =
  "h-10 min-w-0 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/15 disabled:opacity-50";
const actionBase =
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
export const labsAction = `${actionBase} border-border bg-card text-foreground hover:bg-muted`;
export const labsPrimary = `${actionBase} border-primary bg-primary text-primary-foreground hover:bg-primary/90`;

export function labsList<T>(body: unknown): T[] {
  if (Array.isArray(body)) return body;
  if (
    body &&
    typeof body === "object" &&
    "data" in body &&
    Array.isArray(body.data)
  )
    return body.data;
  return [];
}
export function labsError(error: unknown, fallback: string) {
  const message = (
    error as { response?: { data?: { message?: string | string[] } } }
  )?.response?.data?.message;
  return Array.isArray(message) ? message.join(". ") : message || fallback;
}
export function LabsHeader({
  title,
  description,
  backHref,
  children,
}: {
  title: string;
  description?: string;
  backHref?: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {backHref && (
          <Link
            href={backHref}
            className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <ChevronLeft className="size-3.5" />
            Labs
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {children}
        </div>
      )}
    </header>
  );
}
export function LabsNotice({
  children,
  success = false,
}: {
  children: ReactNode;
  success?: boolean;
}) {
  return (
    <div
      role={success ? "status" : "alert"}
      className={`rounded-lg border px-4 py-3 text-sm leading-6 ${success ? "border-primary/25 bg-primary/5 text-primary" : "border-destructive/25 bg-destructive/5 text-destructive"}`}
    >
      {children}
    </div>
  );
}
export function LabsEmpty({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
      <div className="mb-2 rounded-xl border border-border bg-muted/40 p-3 text-muted-foreground">
        <FlaskConical className="size-5" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="max-w-sm text-xs leading-6 text-muted-foreground">
          {description}
        </p>
      )}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
export function LabsTable({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={labsPanel}>
      <div className="overflow-x-auto">
        <table
          aria-label={label}
          className="w-full text-left text-sm [&_th]:whitespace-nowrap [&_th]:px-4 [&_th]:py-3 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground [&_td]:px-4 [&_td]:py-4 [&_td]:align-middle [&_thead]:border-b [&_thead]:border-border [&_thead]:bg-muted/35 [&_tbody_tr]:border-b [&_tbody_tr]:border-border/70 [&_tbody_tr:last-child]:border-0 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-muted/25"
        >
          {children}
        </table>
      </div>
    </div>
  );
}
export function LabsProgress({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  const percent = Math.min(100, Math.max(0, value || 0));
  return (
    <div className="flex min-w-28 items-center gap-3">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
        {percent}%
      </span>
    </div>
  );
}
export function LabsBadge({
  children,
  active = false,
}: {
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-medium capitalize ${active ? "border-primary/20 bg-primary/5 text-primary" : "border-border bg-muted/40 text-muted-foreground"}`}
    >
      {children}
    </span>
  );
}
export interface LabsOption {
  id: string;
  label: string;
  description?: string;
}
export function LabsPicker({
  label,
  options,
  value,
  onChange,
  placeholder = "Search and select…",
  disabled = false,
  empty = "No matching options.",
}: {
  label: string;
  options: LabsOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  empty?: string;
}) {
  const id = useId();
  const selected = options.find((option) => option.id === value) || null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  return (
    <div className="min-w-0 flex-1">
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-medium text-muted-foreground"
      >
        {label}
      </label>
      <Combobox.Root
        modal={false}
        open={open}
        onOpenChange={setOpen}
        openOnInputClick
        items={options}
        value={selected}
        inputValue={query ?? selected?.label ?? ""}
        onInputValueChange={(text, details) => {
          if (
            ["input-change", "input-clear", "clear-press"].includes(
              details.reason,
            )
          ) {
            setQuery(text);
            setOpen(true);
            if (value) onChange("");
          }
        }}
        onValueChange={(option) => {
          onChange(option?.id || "");
          setQuery(null);
          setOpen(false);
        }}
        itemToStringLabel={(option) => option.label}
        itemToStringValue={(option) => option.id}
        isItemEqualToValue={(option, current) => option.id === current.id}
        filter={(option, query) =>
          `${option.label} ${option.description || ""}`
            .toLowerCase()
            .includes(query.toLowerCase())
        }
        autoHighlight
        disabled={disabled}
      >
        <Combobox.InputGroup className="flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <Combobox.Input
            id={id}
            aria-label={label}
            placeholder={placeholder}
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50"
          />
          <Combobox.Trigger
            aria-label={`Show ${label.toLowerCase()}`}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <ChevronsUpDown className="size-3.5" />
          </Combobox.Trigger>
        </Combobox.InputGroup>
        <Combobox.Portal>
          <Combobox.Positioner align="start" sideOffset={6} className="z-[70]">
            <Combobox.Popup className="w-[var(--anchor-width)] min-w-60 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg">
              <Combobox.Empty className="px-4 py-5 text-sm text-muted-foreground">
                {empty}
              </Combobox.Empty>
              <Combobox.List className="max-h-64 overflow-y-auto p-1.5">
                {(option: LabsOption) => (
                  <Combobox.Item
                    key={option.id}
                    value={option}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 outline-none data-highlighted:bg-primary/10 data-highlighted:text-primary"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {option.label}
                      </p>
                      {option.description && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {option.description}
                        </p>
                      )}
                    </div>
                    <Combobox.ItemIndicator>
                      <Check className="size-4 text-primary" />
                    </Combobox.ItemIndicator>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </div>
  );
}
export function LabsModal({
  open,
  onClose,
  title,
  description,
  children,
  busy = false,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  busy?: boolean;
  wide?: boolean;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm" />
        <Dialog.Popup
          className={`fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%_-_2rem)] ${wide ? "max-w-5xl" : "max-w-xl"} -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-card p-6 text-foreground shadow-xl focus:outline-none`}
        >
          <div className="mb-5 pr-8">
            <Dialog.Title className="text-lg font-semibold tracking-tight">
              {title}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm leading-6 text-muted-foreground">
              {description || ""}
            </Dialog.Description>
          </div>
          <Dialog.Close
            disabled={busy}
            aria-label="Close dialog"
            className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </Dialog.Close>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
