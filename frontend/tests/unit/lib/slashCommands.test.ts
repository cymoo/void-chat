import { describe, it, expect, vi } from "vitest";
import { filterCommands, SLASH_COMMANDS } from "@/lib/slashCommands";

vi.mock("@/api/client", () => ({
  getRoomExportMessages: vi.fn(),
  getDmExportMessages: vi.fn(),
}));

describe("filterCommands", () => {
  it("returns all room-scoped commands for empty query in room scope", () => {
    const results = filterCommands("", "room");
    expect(results.length).toBe(SLASH_COMMANDS.length); // all 6 commands available in room
    expect(results.map((c) => c.name)).toContain("clear");
    expect(results.map((c) => c.name)).toContain("snow");
  });

  it("excludes broadcast commands in dm scope", () => {
    const results = filterCommands("", "dm");
    const names = results.map((c) => c.name);
    expect(names).toContain("clear");
    expect(names).toContain("export");
    expect(names).not.toContain("snow");
    expect(names).not.toContain("confetti");
    expect(names).not.toContain("fireworks");
    expect(names).not.toContain("rain");
  });

  it("filters by prefix match (case-insensitive)", () => {
    const results = filterCommands("sn", "room");
    expect(results.length).toBe(1);
    expect(results[0]!.name).toBe("snow");
  });

  it("returns empty array when no commands match the prefix", () => {
    const results = filterCommands("xyz", "room");
    expect(results).toHaveLength(0);
  });

  it("returns all room commands that start with 'c'", () => {
    const results = filterCommands("c", "room");
    const names = results.map((r) => r.name);
    expect(names).toContain("clear");
    expect(names).toContain("confetti");
  });

  it("exact match returns single command", () => {
    const results = filterCommands("export", "room");
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe("export");
  });
});

describe("SLASH_COMMANDS registry", () => {
  it("has clear command available in both room and dm", () => {
    const cmd = SLASH_COMMANDS.find((c) => c.name === "clear")!;
    expect(cmd.availableIn).toContain("room");
    expect(cmd.availableIn).toContain("dm");
    expect(cmd.category).toBe("local");
  });

  it("has export command available in both room and dm", () => {
    const cmd = SLASH_COMMANDS.find((c) => c.name === "export")!;
    expect(cmd.availableIn).toContain("room");
    expect(cmd.availableIn).toContain("dm");
    expect(cmd.category).toBe("rest");
  });

  it("has broadcast commands with effectName set", () => {
    const broadcastCmds = SLASH_COMMANDS.filter((c) => c.category === "broadcast");
    expect(broadcastCmds.length).toBe(4);
    for (const cmd of broadcastCmds) {
      expect(cmd.effectName).toBe(cmd.name);
      expect(cmd.availableIn).toEqual(["room"]);
    }
  });
});
