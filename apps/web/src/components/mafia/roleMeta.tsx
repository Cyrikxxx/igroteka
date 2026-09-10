// Мета-данные ролей Мафии: подпись, иконка, цвет, команда, задача.
// Используется на экранах роли, ночи и финала.

import {
  VenetianMask,
  Crown,
  Search,
  HeartPulse,
  Skull,
  User,
  type LucideIcon,
} from "lucide-react";
import type { MafiaRole } from "@alias/shared/mafia";

export interface RoleMeta {
  label: string;
  Icon: LucideIcon;
  color: string;
  team: string;
  task: string;
}

export function RoleChip({ role }: { role: MafiaRole }) {
  const m = ROLE_META[role];
  const Icon = m.Icon;
  return (
    <span
      className="mf-chip"
      style={{ background: "rgba(255,255,255,0.06)", color: m.color, fontSize: 11.5, padding: "3px 9px" }}
    >
      <Icon size={12} /> {m.label}
    </span>
  );
}

export const ROLE_META: Record<MafiaRole, RoleMeta> = {
  mafia: {
    label: "Мафия",
    Icon: VenetianMask,
    color: "var(--role-mafia)",
    team: "Команда мафии",
    task: "Ночью убирайте город. Днём не выдай себя.",
  },
  don: {
    label: "Дон",
    Icon: Crown,
    // Красный, как вся мафия: золотой путался с Шерифом — цвет у них один.
    color: "var(--role-don)",
    team: "Команда мафии",
    task: "Твой голос решает, когда мафия не сошлась во мнении.",
  },
  sheriff: {
    label: "Шериф",
    Icon: Search,
    color: "var(--role-sheriff)",
    team: "Команда города",
    task: "Каждую ночь проверяй одного игрока.",
  },
  doctor: {
    label: "Доктор",
    Icon: HeartPulse,
    color: "var(--role-doctor)",
    team: "Команда города",
    task: "Каждую ночь спасай одного. Себя — один раз.",
  },
  maniac: {
    label: "Маньяк",
    Icon: Skull,
    color: "var(--role-maniac)",
    team: "Играет сам за себя",
    task: "Убивай по ночам. Останься последним.",
  },
  civilian: {
    label: "Мирный",
    Icon: User,
    color: "var(--role-civilian)",
    team: "Команда города",
    task: "Слушай, спорь, вычисляй мафию днём.",
  },
};
