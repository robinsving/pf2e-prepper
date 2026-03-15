import { describe, it, expect, vi } from "vitest";
import PrepperStorage from "../prepper/PrepperStorage.js";

describe("PrepperStorage", () => {
    let mockActor;

    beforeEach(() => {
        mockActor = {
            flags: { "pf2e-prepper": { loadouts: {} } },
            getFlag: vi.fn((module, key) => {
                if (module === "pf2e-prepper" && key === "loadouts") {
                    return mockActor.flags["pf2e-prepper"].loadouts || {};
                }
                return null;
            }),
            unsetFlag: vi.fn(async (module, key) => {
                if (module === "pf2e-prepper") {
                    if (mockActor.flags["pf2e-prepper"]) {
                        delete mockActor.flags["pf2e-prepper"][key];
                    }
                }
            }),
            setFlag: vi.fn(async (module, key, value) => {
                if (module === "pf2e-prepper") {
                    if (!mockActor.flags["pf2e-prepper"]) {
                        mockActor.flags["pf2e-prepper"] = {};
                    }
                    mockActor.flags["pf2e-prepper"][key] = value;
                }
            }),
        };
    });

    it("should save a new spell loadout using saveCurrentAsNewLoadout", async () => {
        const entryId = "QWWZSn4R4BCnDIQM";
        const currentSpells = {
            id: entryId,
            name: "Primal Prepared Spells",
            levels: [{ level: 1, spells: [{ id: "tIonH8VxLUBgK5O2", name: "Alarm" }] }]
        };

        const newListId = await PrepperStorage.saveCurrentAsNewLoadout(
            mockActor,
            entryId,
            currentSpells,
            "Test List",
            "A test description"
        );

        expect(newListId).toBeDefined();
        expect(mockActor.setFlag).toHaveBeenCalledWith(
            "pf2e-prepper",
            "loadouts",
            expect.objectContaining({
                [entryId]: expect.objectContaining({
                    [newListId]: expect.objectContaining({
                        name: "Test List",
                        description: "A test description",
                    }),
                })
            })
        );
    });

    it("should store spells correctly in the saved spell loadout", async () => {
        const entryId = "QWWZSn4R4BCnDIQM";
        const currentSpells = {
            id: entryId,
            name: "Primal Prepared Spells",
            levels: [
                {
                    level: 1,
                    spells: [
                        { id: "tIonH8VxLUBgK5O2", name: "Alarm" },
                        { id: "LwMKucF3R1VUswV3", name: "Shocking Grasp" },
                    ]
                },
                {
                    level: 2,
                    spells: [{ id: "fNSukTeHDwtRv4XN", name: "Loose Time's Arrow" }]
                }
            ]
        };

        const newListId = await PrepperStorage.saveCurrentAsNewLoadout(
            mockActor,
            entryId,
            currentSpells,
            "Spell Storage Test",
            "Testing spell storage"
        );

        const savedLists = mockActor.flags["pf2e-prepper"].loadouts[entryId];
        const savedList = savedLists[newListId];

        expect(savedList).toBeDefined();
        expect(savedList.spellcastingEntry.levels).toHaveLength(2);

        const level1Spells = savedList.spellcastingEntry.levels[0].spells;
        expect(level1Spells).toEqual([
            { id: "tIonH8VxLUBgK5O2", name: "Alarm" },
            { id: "LwMKucF3R1VUswV3", name: "Shocking Grasp" },
        ]);

        const level2Spells = savedList.spellcastingEntry.levels[1].spells;
        expect(level2Spells).toEqual([
            { id: "fNSukTeHDwtRv4XN", name: "Loose Time's Arrow" },
        ]);
    });

    it("should retrieve all spell loadouts using getSpellLoadouts", () => {
        mockActor.getFlag.mockReturnValueOnce({
            entryA: {
                list1: { id: "list1", name: "List 1" },
                list2: { id: "list2", name: "List 2" },
            }
        });

        const loadouts = PrepperStorage.getSpellLoadouts(mockActor, "entryA");
        expect(loadouts).toEqual({
            list1: { id: "list1", name: "List 1" },
            list2: { id: "list2", name: "List 2" },
        });
    });

    it("should retrieve a specific spell loadout using getLoadout", () => {
        mockActor.getFlag.mockReturnValueOnce({
            entryA: {
                list1: { id: "list1", name: "List 1" },
            }
        });

        const spellList = PrepperStorage.getLoadout(mockActor, "entryA", "list1");
        expect(spellList).toEqual({ id: "list1", name: "List 1" });
    });

    it("should return prepared spellcasting entries using getPreparedSpellcastingEntries", () => {
        mockActor.flags["pf2e-prepper"].loadouts = {
            entryB: {
                loadout1: { id: "loadout1", name: "Loadout 1" }
            }
        };

        mockActor.itemTypes = {
            spellcastingEntry: [
                {
                    id: "entryA",
                    name: "Prepared Entry",
                    system: { prepared: { value: "prepared", flexible: false } }
                },
                {
                    id: "entryB",
                    name: "Flexible Entry",
                    system: { prepared: { value: "prepared", flexible: true } }
                },
                {
                    id: "entryC",
                    name: "Spontaneous Entry",
                    system: { prepared: { value: "spontaneous", flexible: false } }
                }
            ]
        };

        const entries = PrepperStorage.getPreparedSpellcastingEntries(mockActor);
        expect(entries).toEqual([
            { id: "entryA", name: "Prepared Entry", flexible: false, hasLoadouts: false },
            { id: "entryB", name: "Flexible Entry", flexible: true, hasLoadouts: true },
        ]);
    });

    it("should delete a spell loadout successfully", async () => {
        // Setup: Create lists with known data
        const lists = {
            entryA: {
                list1: { id: "list1", name: "List 1" },
                list2: { id: "list2", name: "List 2" },
            }
        };
        mockActor.flags["pf2e-prepper"].loadouts = lists;

        // Delete list1
        const success = await PrepperStorage.deleteLoadout(mockActor, "entryA", "list1");

        // Verify deletion was successful
        expect(success).toBe(true);

        // Verify the list was removed from flags
        const savedLists = mockActor.flags["pf2e-prepper"].loadouts.entryA;
        expect(savedLists).not.toHaveProperty("list1");
        expect(savedLists).toHaveProperty("list2");

        // Verify setFlag was called with updated lists
        expect(mockActor.setFlag).toHaveBeenCalledWith(
            "pf2e-prepper",
            "loadouts",
            expect.objectContaining({
                entryA: expect.objectContaining({
                    list2: { id: "list2", name: "List 2" },
                })
            })
        );
    });

    it("should return false when deleting a non-existent list", async () => {
        // Setup: Create a list
        const lists = {
            entryA: {
                list1: { id: "list1", name: "List 1" },
            }
        };
        mockActor.flags["pf2e-prepper"].loadouts = lists;

        // Try to delete a non-existent list
        const success = await PrepperStorage.deleteLoadout(mockActor, "entryA", "nonexistent");

        // Verify it returned false
        expect(success).toBe(false);

        // Verify setFlag was NOT called
        expect(mockActor.setFlag).not.toHaveBeenCalled();

        // Verify lists remain unchanged
        expect(mockActor.flags["pf2e-prepper"].loadouts).toEqual(lists);
    });

    it("should clear all spell loadouts for an actor", async () => {
        mockActor.flags["pf2e-prepper"].loadouts = {
            entryA: { list1: { id: "list1", name: "List 1" } },
            entryB: { list2: { id: "list2", name: "List 2" } },
        };

        const success = await PrepperStorage.clearAllSpellLoadouts(mockActor);

        expect(success).toBe(true);
        expect(mockActor.unsetFlag).toHaveBeenCalledWith("pf2e-prepper", "loadouts");
        expect(mockActor.flags["pf2e-prepper"].loadouts).toBeUndefined;
    });
});
