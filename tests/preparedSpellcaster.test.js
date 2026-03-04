import { describe, it, expect, vi } from "vitest";
import PrepperApp from "../prepper/PrepperApp.js";
import PrepperStorage from "../prepper/PrepperStorage.js";
import preparedActor from "./data/prepared-actor.json";

describe("_getCurrentSpellsDisplay on multi-spell-actor", () => {

    it("should save and load a spell list without crashing", async () => {
        // Setup: Deep clone the actor to avoid mutation
        const actor = JSON.parse(JSON.stringify(preparedActor));

        // Mock getFlag/setFlag for actor
        actor.getFlag = vi.fn((module, key) => {
            if (!actor.flags) actor.flags = {};
            return actor.flags[module]?.[key];
        });
        actor.unsetFlag = vi.fn(async (module, key) => {
            if (actor.flags?.[module]) {
                delete actor.flags[module][key];
            }
        });
        actor.setFlag = vi.fn(async (module, key, value) => {
            if (!actor.flags) actor.flags = {};
            if (!actor.flags[module]) actor.flags[module] = {};
            actor.flags[module][key] = value;
        });

        // Add .items as a Map-like for compatibility
        actor.items = {
            filter: (...args) => Array.prototype.filter.apply(preparedActor.items, args),
            find: (...args) => Array.prototype.find.apply(preparedActor.items, args),
            get: (id) => preparedActor.items.find(i => i.id === id),
            ...preparedActor.items
        };

        // Add spellcasting to actor, and add prepareSpell to each entry, simulating the behavior of the SpellcastingEntry class
        actor.spellcasting = {
            collections: preparedActor.items.filter(i => i.type === "spellcastingEntry").map(entry => ({
                ...entry,
                prepareSpell: vi.fn(async function (spell, level, slotIndex) {
                    // Simulate updating the entry's system.slots
                    if (!this.system.slots) this.system.slots = {};

                    // Add the spell to the prepared array for this slot, unless spell is null (indicating delete)
                    if (spell) {
                        const slotKey = `slot${level}`;
                        this.system.slots[slotKey] = this.system.slots[slotKey] || {};
                        this.system.slots[slotKey].prepared[slotIndex] = {
                                "id": spell.id,
                                "expended": false
                            };
                    } else {
                        // If spell is null, clear the prepared value of slotIndex for this slot (in this test, we clear the entire prepared array for simplicity)
                        const slotKey = `slot${level}`;
                        if (this.system.slots[slotKey]) {
                            this.system.slots[slotKey].prepared = [];
                        }
                    }
                })
            }))
        };

        // Add itemTypes.spellcastingEntry for PrepperStorage compatibility
        actor.itemTypes = {
            spellcastingEntry: preparedActor.items.filter(i => i.type === "spellcastingEntry").map(entry => ({
                ...entry
            }))
        };

        const spellcastingEntryId = actor.itemTypes.spellcastingEntry[0].id;
        const prepperApp = new PrepperApp(actor, { spellcastingEntryId });

        // 1. Get current spells
        const currentSpells = prepperApp._getCurrentSpellsDisplay(spellcastingEntryId);
        expect(currentSpells.levels.length).toBe(1);
        
        // Extract the spell objects from level 1 for later comparison
        const level1Spells = currentSpells.levels[0].spells;
        expect(level1Spells).toEqual([
            { id: "9csscbuv7MrMXsqE", name: "Animate Rope" },
        ]);

        // 2. Save as new list
        const listId = await PrepperStorage.saveCurrentAsNewList(actor, spellcastingEntryId, currentSpells, "Test List", "Round-trip test");
        expect(listId).toBeDefined();

        // 3. Save an empty spell list  
        const emptySpells = {
            ...currentSpells,
            levels: Array.from({ length: 10 }, (_, i) => ({
                level: i + 1,
                spells: []
            }))
        };
        const emptyListId = await PrepperStorage.saveCurrentAsNewList(actor, spellcastingEntryId, emptySpells, "Empty List", "Cleared spells");
        expect(emptyListId).toBeDefined();

        // 4. Load the empty list
        const emptyLoadResult = await PrepperStorage.loadSpellList(actor, spellcastingEntryId, emptyListId);
        expect(emptyLoadResult).toBe(true);
        
        // Verify that system.slots is empty after loading the empty list
        const emptySlots = prepperApp._getCurrentSpellsDisplay(spellcastingEntryId);
        expect(emptySlots.levels).toStrictEqual([]);

        // 5. Load the original list back
        const restoreResult = await PrepperStorage.loadSpellList(actor, spellcastingEntryId, listId);
        expect(restoreResult).toBe(true);

        // Verify that system.slots is restored with the original spell objects
        const restoredSpells = prepperApp._getCurrentSpellsDisplay(spellcastingEntryId);
        expect(currentSpells.levels.length).toBe(1);
        
        // Extract the spell objects from level 1 for later comparison
        expect(restoredSpells.levels[0].spells).toEqual([
            { id: "9csscbuv7MrMXsqE", name: "Animate Rope" }
        ]);
    });
});
