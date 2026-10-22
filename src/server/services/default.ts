// Singleton cho route: một PrismaClient cho mỗi process (giữ qua hot reload của next dev).
import { PrismaClient } from "@prisma/client";
import { loadRoster } from "../roster";
import { createServices, type Services } from "./index";

const holder = globalThis as unknown as { __voicevaultServices?: Services; __voicevaultPrisma?: PrismaClient };

export function getServices(): Services {
  if (!holder.__voicevaultServices) {
    holder.__voicevaultPrisma ??= new PrismaClient();
    holder.__voicevaultServices = createServices({ prisma: holder.__voicevaultPrisma, roster: loadRoster() });
  }
  return holder.__voicevaultServices;
}
