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
    color: "var(--mf-gold)",
    team: "Команда мафии",
    task: "Решающий голос мафии при выборе жертвы.",
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
