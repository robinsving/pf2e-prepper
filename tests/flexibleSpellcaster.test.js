import { describe, it, expect, vi } from "vitest";
import PrepperApp from "../prepper/PrepperApp.js";
import PrepperStorage from "../prepper/PrepperStorage.js";
import flexibleActor from "./data/flexible-actor.json";

describe("_getCurrentSpellsDisplay on multi-spell-actor", () => {

    it("should save and load a spell list without crashing", async () => {
        // Setup: Deep clone the actor to avoid mutation
        const actor = JSON.parse(JSON.stringify(flexibleActor));

        // Mock getFlag/setFlag for actor
        actor.getFlag = vi.fn((module, key) => {
            if (!actor.flags) actor.flags = {};
            return actor.flags[module]?.[key];
        });
        actor.setFlag = vi.fn(async (module, key, value) => {
            if (!actor.flags) actor.flags = {};
            if (!actor.flags[module]) actor.flags[module] = {};
            actor.flags[module][key] = value;
        });

        // Add .items as a Map-like for compatibility
        actor.items = {
            filter: (...args) => Array.prototype.filter.apply(flexibleActor.items, args),
            find: (...args) => Array.prototype.find.apply(flexibleActor.items, args),
            get: (id) => flexibleActor.items.find(i => i.id === id),
            ...flexibleActor.items
        };

        // Add itemTypes.spellcastingEntry for PrepperStorage compatibility
        actor.itemTypes = {
            spellcastingEntry: flexibleActor.items.filter(i => i.type === "spellcastingEntry").map(entry => ({
                ...entry,
                update: vi.fn(async function (updateData) {
                    // Simulate updating the entry's system.slots
                    if (!this.system.slots) this.system.slots = {};
                    // Clear all prepared arrays for all slots
                    for (let i = 1; i <= 10; i++) {
                        const slotKey = `slot${i}`;
                        if (!this.system.slots[slotKey]) this.system.slots[slotKey] = {};
                        this.system.slots[slotKey].prepared = [];
                    }
                    // Apply updateData
                    for (const key in updateData) {
                        const match = key.match(/^system\.slots\.(slot\d+)\.prepared$/);
                        if (match) {
                            const slotKey = match[1];
                            this.system.slots[slotKey] = this.system.slots[slotKey] || {};
                            this.system.slots[slotKey].prepared = updateData[key];
                        }
                    }
                })
            }))
        };

        const prepperApp = new PrepperApp(actor);

        // 1. Get current spells
        const currentSpells = prepperApp._getCurrentSpellsDisplay();
        expect(currentSpells.length).toBeGreaterThan(0);
        
        // Extract the spell objects from level 1 for later comparison
        const level1Spells = currentSpells[0].levels[0].spells;
        expect(level1Spells).toEqual([
            { id: "tIonH8VxLUBgK5O2", name: "Alarm" },
            { id: "LwMKucF3R1VUswV3", name: "Shocking Grasp" },
        ]);

        // 2. Save as new list
        const listId = await PrepperStorage.saveCurrentAsNewList(actor, currentSpells, "Test List", "Round-trip test");
        expect(listId).toBeDefined();

        // 3. Save an empty spell list  
        const emptySpells = currentSpells.map(entry => ({
            ...entry,
            levels: Array.from({ length: 10 }, (_, i) => ({
                level: i + 1,
                spells: []
            }))
        }));
        const emptyListId = await PrepperStorage.saveCurrentAsNewList(actor, emptySpells, "Empty List", "Cleared spells");
        expect(emptyListId).toBeDefined();

        // 4. Load the empty list
        const emptyLoadResult = await PrepperStorage.loadSpellList(actor, emptyListId);
        expect(emptyLoadResult).toBe(true);
        
        // Verify that system.slots is empty after loading the empty list
        const emptySlots = actor.itemTypes.spellcastingEntry[0].system.slots.slot1.prepared;
        expect(emptySlots).toStrictEqual([]);

        // 5. Load the original list back
        const restoreResult = await PrepperStorage.loadSpellList(actor, listId);
        expect(restoreResult).toBe(true);

        // Verify that system.slots is restored with the original spell objects
        const restoredSlots = actor.itemTypes.spellcastingEntry[0].system.slots.slot1.prepared;
        expect(restoredSlots).toStrictEqual(level1Spells);
    });
});
