import { describe, it, expect, vi } from "vitest";
import PrepperApp from "../prepper/PrepperApp.js";
import PrepperStorage from "../prepper/PrepperStorage.js";
import flexibleActor from "./data/flexible-actor.json";

describe("_getCurrentSpellsDisplay on multi-spell-actor", () => {

    it("should save and load a spell loadout without crashing", async () => {
        // Setup: Deep clone the actor to avoid mutation
        const actor = JSON.parse(JSON.stringify(flexibleActor));

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
            filter: (...args) => Array.prototype.filter.apply(flexibleActor.items, args),
            find: (...args) => Array.prototype.find.apply(flexibleActor.items, args),
            get: (id) => flexibleActor.items.find(i => i.id === id),
            ...flexibleActor.items
        };

        // Mock some
        actor.spellcasting = {
            collections: actor.items
                .filter(i => i.type === "spellcastingEntry")
                .map(entry => ({
                id: entry.id,
                size: 1,
                // add spells, and for each spell add the update function that allows setting a system.location.signature
                contents: flexibleActor.items.filter(i => i.type === "spell" && i.system.location.value === entry.id).map(spell => ({
                    ...spell,
                    update: async (data) => {
                        // change the signature of the spell in the original flexibleActor data to simulate the update that would happen in the real actor
                        spell.system.location.signature = data["system.location.signature"];
                    }
                }))
            }))
        };

        // Add itemTypes.spellcastingEntry for PrepperStorage compatibility
        actor.itemTypes = {
            spellcastingEntry: flexibleActor.items.filter(i => i.type === "spellcastingEntry").map(entry => ({
                ...entry
            }))
        };

        const spellcastingEntryId = actor.itemTypes.spellcastingEntry[0].id;
        const prepperApp = new PrepperApp(actor, { spellcastingEntryId });

        // 1. Get current spells
        const currentSpells = prepperApp._getCurrentSpellsDisplay(spellcastingEntryId);
        expect(currentSpells.levels.length).toBe(3);
        
        // Confirm that the spells are correctly extracted from the flexible signature
        expect(currentSpells.levels[0].spells).toEqual([
            { id: "tIonH8VxLUBgK5O2", name: "Alarm" },
            { id: "LwMKucF3R1VUswV3", name: "Shocking Grasp" }
        ]);

        // 2. Save as new list
        const listId = await PrepperStorage.saveCurrentAsNewLoadout(actor, spellcastingEntryId, currentSpells, "Test List", "Round-trip test");
        expect(listId).toBeDefined();

        // 3. Save an empty spell loadout  
        const emptySpells = {
            ...currentSpells,
            levels: Array.from({ length: 10 }, (_, i) => ({
                level: i + 1,
                spells: []
            }))
        };
        const emptyListId = await PrepperStorage.saveCurrentAsNewLoadout(actor, spellcastingEntryId, emptySpells, "Empty List", "Cleared spells");
        expect(emptyListId).toBeDefined();

        // 4. Load the empty list
        const emptyLoadResult = await PrepperStorage.loadSpellLoadout(actor, spellcastingEntryId, emptyListId);
        expect(emptyLoadResult).toBe(true);
        
        // Verify that flexible signature spells (the way to determine prepared spells for this actor) are cleared
        const clearedSpells = prepperApp._getCurrentSpellsDisplay(spellcastingEntryId);
        expect(clearedSpells.levels).toEqual([]);

        // 5. Load the original list back
        const restoreResult = await PrepperStorage.loadSpellLoadout(actor, spellcastingEntryId, listId);
        expect(restoreResult).toBe(true);

        // Verify that system.slots is restored with the original spell objects
        const restoredSpells = prepperApp._getCurrentSpellsDisplay(spellcastingEntryId);
        expect(currentSpells.levels.length).toBe(3);
        
        // Extract the spell objects from level 1 for later comparison
        expect(restoredSpells.levels[0].spells).toEqual([
            { id: "tIonH8VxLUBgK5O2", name: "Alarm" },
            { id: "LwMKucF3R1VUswV3", name: "Shocking Grasp" }
        ]);
    });
});
