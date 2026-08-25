import { describe, it, expect, vi } from "vitest";
import PrepperApp from "../prepper/PrepperApp.js";
import PrepperStorage from "../prepper/PrepperStorage.js";
import preparedActor from "./data/prepared-actor.json";

describe("_getCurrentSpellsDisplay on multi-spell-actor", () => {

    beforeEach(() => {
        global.ui = {
            notifications: {
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
            }
        };
    });

    it("should save and load a spell loadout without crashing", async () => {
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
        
        // Verify that system.slots is empty after loading the empty list
        const emptySlots = prepperApp._getCurrentSpellsDisplay(spellcastingEntryId);
        expect(emptySlots.levels).toStrictEqual([]);

        // 5. Load the original list back
        const restoreResult = await PrepperStorage.loadSpellLoadout(actor, spellcastingEntryId, listId);
        expect(restoreResult).toBe(true);

        // Verify that system.slots is restored with the original spell objects
        const restoredSpells = prepperApp._getCurrentSpellsDisplay(spellcastingEntryId);
        expect(currentSpells.levels.length).toBe(1);
        
        // Extract the spell objects from level 1 for later comparison
        expect(restoredSpells.levels[0].spells).toEqual([
            { id: "9csscbuv7MrMXsqE", name: "Animate Rope" }
        ]);
    });

    it("should warn on loading in spells, when a saved spell no longer exists on the actor", async () => {
        const actor = JSON.parse(JSON.stringify(preparedActor));

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

        actor.items = {
            filter: (...args) => Array.prototype.filter.apply(preparedActor.items, args),
            find: (...args) => Array.prototype.find.apply(preparedActor.items, args),
            get: (id) => preparedActor.items.find(i => i.id === id),
            ...preparedActor.items
        };

        actor.spellcasting = {
            collections: preparedActor.items.filter(i => i.type === "spellcastingEntry").map(entry => ({
                ...entry,
                prepareSpell: vi.fn(async function (spell, level, slotIndex) {
                    if (!this.system.slots) this.system.slots = {};
                    if (spell) {
                        const slotKey = `slot${level}`;
                        this.system.slots[slotKey] = this.system.slots[slotKey] || {};
                        this.system.slots[slotKey].prepared[slotIndex] = {
                            "id": spell.id,
                            "expended": false
                        };
                    }
                })
            }))
        };

        actor.itemTypes = {
            spellcastingEntry: preparedActor.items.filter(i => i.type === "spellcastingEntry").map(entry => ({
                ...entry
            }))
        };

        const spellcastingEntryId = actor.itemTypes.spellcastingEntry[0].id;
        const prepperApp = new PrepperApp(actor, { spellcastingEntryId });
        const currentSpells = prepperApp._getCurrentSpellsDisplay(spellcastingEntryId);
        const listId = await PrepperStorage.saveCurrentAsNewLoadout(actor, spellcastingEntryId, currentSpells, "Missing spell test", "");

        const missingSpellId = currentSpells.levels[0].spells[0].id;
        actor.items.get = (id) => {
            if (id === missingSpellId) return undefined;
            return preparedActor.items.find(i => i.id === id);
        };

        const result = await PrepperStorage.loadSpellLoadout(actor, spellcastingEntryId, listId);

        expect(result).toBe(true);
        expect(global.ui.notifications.warn).toHaveBeenCalledTimes(1);
        expect(global.ui.notifications.warn.mock.calls[0][0]).toContain("Animate Rope");
        expect(global.ui.notifications.warn.mock.calls[0][0]).toContain("PREPPER.loadout.loadWarning.reasonNotOnActor");
    });

    it("should save, clear, and restore prepared cantrips in slot0", async () => {
        const cantrip = {
            id: "cantrip-id",
            name: "Detect Magic",
            type: "spell",
            system: { level: { value: 0 } }
        };
        const entry = {
            id: "prepared-entry-id",
            name: "Prepared Spells",
            type: "spellcastingEntry",
            system: {
                prepared: { value: "prepared", flexible: false },
                slots: {
                    slot0: {
                        prepared: [{ id: cantrip.id, expended: false }],
                        value: 1,
                        max: 1
                    }
                }
            }
        };
        const items = [entry, cantrip];
        items.get = (id) => items.find(item => item.id === id);

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
        actor.spellcasting = { collections: [{ id: entry.id, prepareSpell }] };

        const prepperApp = new PrepperApp(actor, { spellcastingEntryId: entry.id });
        const savedSpells = prepperApp._getCurrentSpellsDisplay(entry.id);
        expect(savedSpells.levels).toEqual([
            { level: 0, spells: [{ id: cantrip.id, name: cantrip.name }] }
        ]);

        const loadoutId = await PrepperStorage.saveCurrentAsNewLoadout(actor, entry.id, savedSpells, "Cantrip loadout");
        const emptyLoadoutId = await PrepperStorage.saveCurrentAsNewLoadout(actor, entry.id, {
            ...savedSpells,
            levels: [{ level: 0, spells: [] }]
        }, "Empty cantrip loadout");

        await PrepperStorage.loadSpellLoadout(actor, entry.id, emptyLoadoutId);
        expect(prepareSpell).toHaveBeenCalledWith(null, "cantrips", 0);
        expect(prepperApp._getCurrentSpellsDisplay(entry.id).levels).toEqual([]);

        await PrepperStorage.loadSpellLoadout(actor, entry.id, loadoutId);
        expect(prepareSpell).toHaveBeenCalledWith(cantrip, "cantrips", 0);
        expect(prepperApp._getCurrentSpellsDisplay(entry.id).levels).toEqual([
            { level: 0, spells: [{ id: cantrip.id, name: cantrip.name }] }
        ]);
    });

    it("should clear a stale extra cantrip slot when a loadout has fewer cantrips than are currently prepared", async () => {
        const cantripA = { id: "cantrip-a", name: "Detect Magic", type: "spell", system: { level: { value: 0 } } };
        const cantripB = { id: "cantrip-b", name: "Daze", type: "spell", system: { level: { value: 0 } } };
        const entry = {
            id: "prepared-entry-id",
            name: "Prepared Spells",
            type: "spellcastingEntry",
            system: {
                prepared: { value: "prepared", flexible: false },
                slots: {
                    slot0: {
                        prepared: [
                            { id: cantripA.id, expended: false },
                            { id: cantripB.id, expended: false }
                        ],
                        value: 2,
                        max: 2
                    }
                }
            }
        };
        const items = [entry, cantripA, cantripB];
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
        actor.spellcasting = { collections: [{ id: entry.id, prepareSpell }] };

        // Loadout only remembers the first cantrip slot; the actor currently has both prepared.
        const reducedLoadoutId = await PrepperStorage.saveCurrentAsNewLoadout(actor, entry.id, {
            levels: [{ level: 0, spells: [{ id: cantripA.id, name: cantripA.name }] }]
        }, "One cantrip");

        await PrepperStorage.loadSpellLoadout(actor, entry.id, reducedLoadoutId);

        // Both slots get cleared (in reverse), then only index 0 is refilled — index 1 stays empty.
        expect(prepareSpell).toHaveBeenCalledWith(null, "cantrips", 1);
        expect(prepareSpell).toHaveBeenCalledWith(null, "cantrips", 0);
        expect(prepareSpell).toHaveBeenCalledWith(cantripA, "cantrips", 0);
        expect(entry.system.slots.slot0.prepared).toEqual([{ id: cantripA.id, expended: false }]);
    });

    it("should warn with reasonNoSlot when a loadout has more cantrips than the entry has slots for", async () => {
        const cantripA = { id: "cantrip-a", name: "Detect Magic", type: "spell", system: { level: { value: 0 } } };
        const cantripB = { id: "cantrip-b", name: "Daze", type: "spell", system: { level: { value: 0 } } };
        const entry = {
            id: "prepared-entry-id",
            name: "Prepared Spells",
            type: "spellcastingEntry",
            system: {
                prepared: { value: "prepared", flexible: false },
                slots: {
                    slot0: { prepared: [], value: 1, max: 1 }
                }
            }
        };
        const items = [entry, cantripA, cantripB];
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
        actor.spellcasting = { collections: [{ id: entry.id, prepareSpell }] };

        const overfilledLoadoutId = await PrepperStorage.saveCurrentAsNewLoadout(actor, entry.id, {
            levels: [{
                level: 0,
                spells: [
                    { id: cantripA.id, name: cantripA.name },
                    { id: cantripB.id, name: cantripB.name }
                ]
            }]
        }, "Two cantrips, one slot");

        const result = await PrepperStorage.loadSpellLoadout(actor, entry.id, overfilledLoadoutId);

        expect(result).toBe(true);
        expect(entry.system.slots.slot0.prepared).toEqual([{ id: cantripA.id, expended: false }]);
        expect(global.ui.notifications.warn).toHaveBeenCalledTimes(1);
        expect(global.ui.notifications.warn.mock.calls[0][0]).toContain("Daze");
        expect(global.ui.notifications.warn.mock.calls[0][0]).toContain("PREPPER.loadout.loadWarning.reasonNoSlot");
    });
});
