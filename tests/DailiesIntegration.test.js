import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prepper/prepper.js", () => ({
    API: {
        PrepperStorage: {
            getPreparedSpellcastingEntries: vi.fn(),
            getLoadout: vi.fn(() => ({ name: "Morning" })),
        },
        getSpellLoadouts: vi.fn(),
        loadSpellLoadout: vi.fn()
    }
}));

vi.mock("../prepper/utilities/Utilities.js", () => ({
    getSettings: vi.fn(() => true),
    settings: {
        dailiesIntegration: { id: "enableDailiesIntegration" }
    },
    registerSettings: vi.fn()
}));

import { API } from "../prepper/prepper.js";
import { getSettings } from "../prepper/utilities/Utilities.js";
import { registerDailiesIntegration } from "../prepper/hooks/DailiesIntegration.js";

describe("Dailies integration", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.game.dailies = undefined;
    });

    it("does not crash when PF2e Dailies is missing", () => {
        expect(() => registerDailiesIntegration()).not.toThrow();
    });

    it("registers a custom daily when enabled", () => {
        getSettings.mockReturnValue(true);
        global.game.dailies = {
            api: { registerCustomDailies: vi.fn() }
        };

        registerDailiesIntegration();

        expect(global.game.dailies.api.registerCustomDailies).toHaveBeenCalledTimes(1);
        const [dailies] = global.game.dailies.api.registerCustomDailies.mock.calls[0];
        expect(Array.isArray(dailies)).toBe(true);
        expect(dailies.length).toBe(1);
        expect(dailies[0].key).toBe("pf2e-prepper");
    });

    it("builds rows and processes selections safely", async () => {
        getSettings.mockReturnValue(true);
        global.game.dailies = {
            api: { registerCustomDailies: vi.fn() }
        };

        API.PrepperStorage.getPreparedSpellcastingEntries.mockReturnValue([
            { id: "entry1", name: "Arcane", hasLoadouts: true }
        ]);
        API.getSpellLoadouts.mockReturnValue({
            loadout1: { id: "loadout1" }
        });
        API.loadSpellLoadout.mockResolvedValue(true);

        registerDailiesIntegration();
        const [dailies] = global.game.dailies.api.registerCustomDailies.mock.calls[0];
        const daily = dailies[0];

        const custom = { spellcastingEntries: [{ id: "entry1", name: "Arcane", hasLoadouts: true }] };
        const rows = daily.rows({}, null, custom);
        const selectRow = rows.find(r => r.type === "select");

        expect(selectRow).toBeTruthy();
        expect(selectRow.save).toBe(false);
        expect(selectRow.options[0]).toEqual({ value: "__none__", label: "Keep current" });

        const messages = { add: vi.fn(), addGroup: vi.fn() };

        await daily.process({ actor: {}, rows: { "prepper-loadout-entry1": "__none__" }, messages, custom });
        expect(API.loadSpellLoadout).not.toHaveBeenCalled();

        await daily.process({ actor: {}, rows: { "prepper-loadout-entry1": "loadout1" }, messages, custom });
        expect(API.loadSpellLoadout).toHaveBeenCalledTimes(1);
        expect(messages.add).toHaveBeenCalledTimes(1);
        const [messageArgs] = messages.add.mock.calls[0];
        expect(messageArgs).toBe("pf2e-prepper");
        expect(messages.add.mock.calls[0][1].label).toContain("Morning");
    });
});
