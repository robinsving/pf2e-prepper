import { describe, it, expect, vi } from "vitest";
import PrepperStorage from "../prepper/PrepperStorage.js";
import flexibleActor from "./data/flexible-actor.json";
import preparedActor from "./data/prepared-actor.json";

describe("PrepperStorage", () => {
    let mockActor;

    beforeEach(() => {
        mockActor = {
            getFlag: vi.fn((module, key) => {
                if (module === "pf2e-prepper" && key === "spellLists") {
                    return {};
                }
                return null;
            }),
            setFlag: vi.fn(async (module, key, value) => {
                if (module === "pf2e-prepper" && key === "spellLists") {
                    mockActor.flags = { "pf2e-prepper": { spellLists: value } };
                }
            }),
        };
    });

    it("should save a new spell list using saveCurrentAsNewList", async () => {
        const currentSpells = [
            {
                id: "QWWZSn4R4BCnDIQM",
                name: "Primal Prepared Spells",
                preparedSpells: {
                    1: [
                        { id: "tIonH8VxLUBgK5O2", name: "Alarm" },
                        { id: "LwMKucF3R1VUswV3", name: "Shocking Grasp" },
                    ]
                }
            }
        ];

        const newListId = await PrepperStorage.saveCurrentAsNewList(
            mockActor,
            currentSpells,
            "Test List",
            "A test description"
        );

        expect(newListId).toBeDefined();
        expect(mockActor.setFlag).toHaveBeenCalledWith(
            "pf2e-prepper",
            "spellLists",
            expect.objectContaining({
                [newListId]: expect.objectContaining({
                    name: "Test List",
                    description: "A test description",
                }),
            })
        );
    });

    it("should store spells correctly in the saved spell list", async () => {
        const currentSpells = [
            {
                id: "QWWZSn4R4BCnDIQM",
                name: "Primal Prepared Spells",
                preparedSpells: {
                    1: [
                        { id: "tIonH8VxLUBgK5O2", name: "Alarm" },
                        { id: "LwMKucF3R1VUswV3", name: "Shocking Grasp" },
                    ],
                    2: [
                        { id: "fNSukTeHDwtRv4XN", name: "Loose Time's Arrow" },
                    ]
                }
            }
        ];

        const newListId = await PrepperStorage.saveCurrentAsNewList(
            mockActor,
            currentSpells,
            "Spell Storage Test",
            "Testing spell storage"
        );

        const savedLists = mockActor.flags["pf2e-prepper"].spellLists;
        const savedList = savedLists[newListId];

        expect(savedList).toBeDefined();
        expect(savedList.spellcastingEntries).toHaveLength(1);
        expect(Object.keys(savedList.spellcastingEntries[0].preparedSpells)).toHaveLength(2);

        const level1Spells = savedList.spellcastingEntries[0].preparedSpells[1];
        expect(level1Spells).toEqual([
            { id: "tIonH8VxLUBgK5O2", name: "Alarm" },
            { id: "LwMKucF3R1VUswV3", name: "Shocking Grasp" },
        ]);

        const level2Spells = savedList.spellcastingEntries[0].preparedSpells[2];
        expect(level2Spells).toEqual([
            { id: "fNSukTeHDwtRv4XN", name: "Loose Time's Arrow" },
        ]);
    });

    it("should retrieve all spell lists using getSpellLists", () => {
        mockActor.getFlag.mockReturnValueOnce({
            list1: { id: "list1", name: "List 1" },
            list2: { id: "list2", name: "List 2" },
        });

        const spellLists = PrepperStorage.getSpellLists(mockActor);
        expect(spellLists).toEqual({
            list1: { id: "list1", name: "List 1" },
            list2: { id: "list2", name: "List 2" },
        });
    });

    it("should retrieve a specific spell list using getSpellList", () => {
        mockActor.getFlag.mockReturnValueOnce({
            list1: { id: "list1", name: "List 1" },
        });

        const spellList = PrepperStorage.getSpellList(mockActor, "list1");
        expect(spellList).toEqual({ id: "list1", name: "List 1" });
    });

    it("should retrieve the active spell list ID using getActiveListId", () => {
        mockActor.getFlag.mockReturnValueOnce("list1");

        const activeListId = PrepperStorage.getActiveListId(mockActor);
        expect(activeListId).toBe("list1");
    });
});
