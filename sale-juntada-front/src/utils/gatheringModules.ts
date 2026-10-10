import {
  CalendarDays,
  ClipboardCheck,
  Dices,
  Home,
  LayoutGrid,
  ListChecks,
  Salad,
  ShoppingBasket,
  Users,
  Wallet,
} from "lucide-react";
import type {
  Gathering,
  GatheringServiceKey,
} from "../services/gatheringService";

export const optionalGatheringServices: GatheringServiceKey[] = [
  "compra",
  "pendientes",
  "alimentacion",
  "cuentas",
  "juegos",
];

export function isGatheringServiceEnabled(
  gathering: Pick<Gathering, "disabledServices">,
  path: string,
) {
  return !gathering.disabledServices?.includes(
    path.split("/")[0] as GatheringServiceKey,
  );
}

export const gatheringModules = [
  {
    path: "invitados",
    title: "Invitados",
    detail: "Quién viene y quién falta responder",
    icon: Users,
  },
  {
    path: "fecha",
    title: "Fecha y lugar",
    detail: "Horarios, coincidencias y ubicación",
    icon: CalendarDays,
  },
  {
    path: "compra",
    title: "Compra y aportes",
    detail: "Productos y cantidades que lleva cada uno",
    icon: ShoppingBasket,
  },
  {
    path: "pendientes",
    title: "Pendientes y útiles",
    detail: "Todo lo que hace falta resolver",
    icon: ClipboardCheck,
  },
  {
    path: "alimentacion",
    title: "Alimentación",
    detail: "Necesidades y opciones para el menú",
    icon: Salad,
  },
  {
    path: "cuentas",
    title: "Gastos y cuentas",
    detail: "Dividir gastos y calcular transferencias",
    icon: Wallet,
  },
  {
    path: "juegos",
    title: "Juegos",
    detail: "Una ronda para compartir el teléfono",
    icon: Dices,
  },
] as const;

export const gatheringNavigation = [
  { path: "", title: "Inicio", icon: Home },
  { path: "invitados", title: "Invitados", icon: Users },
  { path: "servicios", title: "Servicios", icon: LayoutGrid },
  { path: "mi-parte", title: "Mi parte", icon: ListChecks },
] as const;

export function gatheringModuleTitle(path: string) {
  return (
    gatheringModules.find(
      (module) =>
        module.path === (path === "cuentas/transferencias" ? "cuentas" : path),
    )?.title ??
    gatheringNavigation.find((module) => module.path === path)?.title
  );
}
