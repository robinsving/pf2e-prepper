import { describe, it, expect, vi } from "vitest";
import PrepperStorage from "../prepper/PrepperStorage.js";

describe("PrepperStorage", () => {
    let mockActor;

    beforeEach(() => {
        mockActor = {
            flags: { "pf2e-prepper": { spellLists: {} } },
            getFlag: vi.fn((module, key) => {
                if (module === "pf2e-prepper" && key === "spellLists") {
                    return mockActor.flags["pf2e-prepper"].spellLists || {};
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

    it("should save a new spell list using saveCurrentAsNewList", async () => {
        const entryId = "QWWZSn4R4BCnDIQM";
        const currentSpells = {
            id: entryId,
            name: "Primal Prepared Spells",
            levels: [{ level: 1, spells: [{ id: "tIonH8VxLUBgK5O2", name: "Alarm" }] }]
        };

        const newListId = await PrepperStorage.saveCurrentAsNewList(
            mockActor,
            entryId,
            currentSpells,
            "Test List",
            "A test description"
        );

        expect(newListId).toBeDefined();
        expect(mockActor.setFlag).toHaveBeenCalledWith(
            "pf2e-prepper",
            "spellLists",
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

    it("should store spells correctly in the saved spell list", async () => {
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

        const newListId = await PrepperStorage.saveCurrentAsNewList(
            mockActor,
            entryId,
            currentSpells,
            "Spell Storage Test",
            "Testing spell storage"
        );

        const savedLists = mockActor.flags["pf2e-prepper"].spellLists[entryId];
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

    it("should retrieve all spell lists using getSpellLists", () => {
        mockActor.getFlag.mockReturnValueOnce({
            entryA: {
                list1: { id: "list1", name: "List 1" },
                list2: { id: "list2", name: "List 2" },
            }
        });

        const spellLists = PrepperStorage.getSpellLists(mockActor, "entryA");
        expect(spellLists).toEqual({
            list1: { id: "list1", name: "List 1" },
            list2: { id: "list2", name: "List 2" },
        });
    });

    it("should retrieve a specific spell list using getSpellList", () => {
        mockActor.getFlag.mockReturnValueOnce({
            entryA: {
                list1: { id: "list1", name: "List 1" },
            }
        });

        const spellList = PrepperStorage.getSpellList(mockActor, "entryA", "list1");
        expect(spellList).toEqual({ id: "list1", name: "List 1" });
    });

    it("should delete a spell list successfully", async () => {
        // Setup: Create lists with known data
        const lists = {
            entryA: {
                list1: { id: "list1", name: "List 1" },
                list2: { id: "list2", name: "List 2" },
            }
        };
        mockActor.flags["pf2e-prepper"].spellLists = lists;

        // Delete list1
        const success = await PrepperStorage.deleteSpellList(mockActor, "entryA", "list1");

        // Verify deletion was successful
        expect(success).toBe(true);

        // Verify the list was removed from flags
        const savedLists = mockActor.flags["pf2e-prepper"].spellLists.entryA;
        expect(savedLists).not.toHaveProperty("list1");
        expect(savedLists).toHaveProperty("list2");

        // Verify setFlag was called with updated lists
        expect(mockActor.setFlag).toHaveBeenCalledWith(
            "pf2e-prepper",
            "spellLists",
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
        mockActor.flags["pf2e-prepper"].spellLists = lists;

        // Try to delete a non-existent list
        const success = await PrepperStorage.deleteSpellList(mockActor, "entryA", "nonexistent");

        // Verify it returned false
        expect(success).toBe(false);

        // Verify setFlag was NOT called
        expect(mockActor.setFlag).not.toHaveBeenCalled();

        // Verify lists remain unchanged
        expect(mockActor.flags["pf2e-prepper"].spellLists).toEqual(lists);
    });
});
