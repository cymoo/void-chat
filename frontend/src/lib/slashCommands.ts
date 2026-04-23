import { getRoomExportMessages, getDmExportMessages } from "@/api/client";
import type { ChatMessage, PrivateMessage } from "@/api/types";

export type CommandCategory = "local" | "rest" | "broadcast";
export type CommandScope = "room" | "dm";

export interface SlashCommand {
  name: string;
  description: string;
  category: CommandCategory;
  availableIn: CommandScope[];
  effectName?: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: "clear",
    description: "Clear the chat view (messages remain in database)",
    category: "local",
    availableIn: ["room", "dm"],
  },
  {
    name: "export",
    description: "Export all messages as an HTML file",
    category: "rest",
    availableIn: ["room", "dm"],
  },
  {
    name: "snow",
    description: "❄️ Trigger a snowfall effect for everyone",
    category: "broadcast",
    availableIn: ["room"],
    effectName: "snow",
  },
  {
    name: "confetti",
    description: "🎊 Burst confetti across the room",
    category: "broadcast",
    availableIn: ["room"],
    effectName: "confetti",
  },
  {
    name: "fireworks",
    description: "🎆 Launch fireworks for everyone",
    category: "broadcast",
    availableIn: ["room"],
    effectName: "fireworks",
  },
  {
    name: "rain",
    description: "🌧️ Summon a rain effect",
    category: "broadcast",
    availableIn: ["room"],
    effectName: "rain",
  },
];

/** Filter commands by scope and optional query prefix. */
export function filterCommands(
  query: string,
  scope: CommandScope,
): SlashCommand[] {
  const q = query.toLowerCase();
  return SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.availableIn.includes(scope) &&
      (q === "" || cmd.name.startsWith(q)),
  );
}

/** Fetch all room messages for export (capped at 10k server-side). */
export async function fetchRoomExportMessages(
  roomId: number,
): Promise<ChatMessage[]> {
  return getRoomExportMessages(roomId);
}

/** Fetch all DM messages for export (capped at 10k server-side). */
export async function fetchDmExportMessages(
  userId: number,
): Promise<PrivateMessage[]> {
  return getDmExportMessages(userId);
}
