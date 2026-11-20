// The chapters in reading order: first how to start, then the Loyiha's way from sale to delivery, then each module.
import type { GuideSection } from "../types";

import { CHAPTERS as accounting } from "./accounting";
import { CHAPTERS as clients } from "./clients";
import { CHAPTERS as crm } from "./crm";
import { CHAPTERS as employees } from "./employees";
import { CHAPTERS as inventory } from "./inventory";
import { CHAPTERS as kassa } from "./kassa";
import { CHAPTERS as konstruktor } from "./konstruktor";
import { CHAPTERS as procurement } from "./procurement";
import { CHAPTERS as production } from "./production";
import { CHAPTERS as projects } from "./projects";
import { CHAPTERS as service } from "./service";
import { CHAPTERS as settings } from "./settings";
import { CHAPTERS as start } from "./start";

export const CHAPTERS: GuideSection[] = [
  ...start,
  ...projects,
  ...konstruktor,
  ...clients,
  ...crm,
  ...service,
  ...procurement,
  ...production,
  ...inventory,
  ...kassa,
  ...accounting,
  ...employees,
  ...settings,
];
