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

    it("should save, clear, and restore flexible caster cantrips from slot0", async () => {
        const entry = {
            id: "flexible-entry-id",
            name: "Flexible Spells",
            type: "spellcastingEntry",
            system: {
                prepared: { value: "prepared", flexible: true },
                slots: {
                    slot0: {
                        prepared: [{ id: "cantrip-id", expended: false }],
                        value: 1,
                        max: 1
                    }
                }
            }
        };
        const cantrip = {
            id: "cantrip-id",
            name: "Detect Magic",
            type: "spell",
            system: {
                level: { value: 0 },
                location: { value: entry.id, signature: false }
            },
            update: vi.fn(async data => {
                cantrip.system.location.signature = data["system.location.signature"];
            })
        };
        const signatureSpell = {
            id: "signature-spell-id",
            name: "Magic Missile",
            type: "spell",
            system: {
                level: { value: 1 },
                location: { value: entry.id, signature: true }
            },
            update: vi.fn(async data => {
                signatureSpell.system.location.signature = data["system.location.signature"];
            })
        };
        const items = [entry, cantrip, signatureSpell];
        items.get = id => items.find(item => item.id === id);

        const actor = {
            items,
            itemTypes: { spellcastingEntry: [entry] },
            flags: {},
            getFlag: vi.fn((module, key) => actor.flags[module]?.[key]),
            unsetFlag: vi.fn(async (module, key) => {
                delete actor.flags[module]?.[key];
            }),
            setFlag: vi.fn(async (module, key, value) => {
                actor.flags[module] ??= {};
                actor.flags[module][key] = value;
            })
        };
        const prepareSpell = vi.fn(async (spell, level, slotIndex) => {
            const slotKey = level === "cantrips" ? "slot0" : `slot${level}`;
            const prepared = entry.system.slots[slotKey].prepared;
            if (spell) {
                prepared[slotIndex] = { id: spell.id, expended: false };
            } else {
                prepared.splice(slotIndex, 1);
            }
        });
        actor.spellcasting = {
            collections: [{
                id: entry.id,
                size: 2,
                contents: [cantrip, signatureSpell],
                prepareSpell
            }]
        };

        const prepperApp = new PrepperApp(actor, { spellcastingEntryId: entry.id });
        const savedSpells = prepperApp._getCurrentSpellsDisplay(entry.id);
        expect(savedSpells.levels).toEqual([
            { level: 0, spells: [{ id: cantrip.id, name: cantrip.name }] },
            { level: 1, spells: [{ id: signatureSpell.id, name: signatureSpell.name }] }
        ]);

        const loadoutId = await PrepperStorage.saveCurrentAsNewLoadout(actor, entry.id, savedSpells, "Cantrip loadout");
        const emptyLoadoutId = await PrepperStorage.saveCurrentAsNewLoadout(actor, entry.id, {
            ...savedSpells,
            levels: [{ level: 0, spells: [] }]
        }, "Empty cantrip loadout");

        await PrepperStorage.loadSpellLoadout(actor, entry.id, emptyLoadoutId);
        expect(prepareSpell).toHaveBeenCalledWith(null, "cantrips", 0);
        expect(signatureSpell.system.location.signature).toBe(false);
        expect(cantrip.update).not.toHaveBeenCalled();

        await PrepperStorage.loadSpellLoadout(actor, entry.id, loadoutId);
        expect(prepareSpell).toHaveBeenCalledWith(cantrip, "cantrips", 0);
        expect(signatureSpell.system.location.signature).toBe(true);
        expect(prepperApp._getCurrentSpellsDisplay(entry.id).levels).toEqual(savedSpells.levels);
    });
});
