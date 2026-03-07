import { MODULE_ID } from './prepper';
import { settings, error, popup } from "./utilities/Utilities";

/**
 * Class for handling spell list storage and management
 */
export default class PrepperStorage {
  /**
   * 
   * @param {*} missingSpellsText 
   * @returns 
   */
  static _showMissingSpellsWarning(missingSpellsText) {
    if (!missingSpellsText?.size) return;

    const heading = game.i18n.localize("PREPPER.spellList.loadWarning.missingSpellsHeading");
    const details = Array.from(missingSpellsText).join("\n");

    popup(`${heading}\n${details}`, "warn");
  }

  /**
   * Deep clone an object using JSON serialization
   * @param {Object} obj - The object to clone
   * @returns {Object} - A deep copy of the object
   * @private
   */
  static _deepClone(obj) {
    // Try to use Foundry's deepClone if available, otherwise use JSON method
    if (typeof foundry !== 'undefined' && foundry.utils && foundry.utils.deepClone) {
      return foundry.utils.deepClone(obj);
    }
    // Fallback for testing environments
    return JSON.parse(JSON.stringify(obj));
  }
  
  /**
   * Get all saved spell lists for an actor
   * @param {Actor} actor - The actor to get spell lists for
   * @param {string} spellcastingEntryId - The spellcasting entry id
   * @returns {Object} - Object containing all saved spell lists
   */
  static getSpellLists(actor, spellcastingEntryId) {
    const allLists = this._getAllSpellLists(actor);
    return allLists[spellcastingEntryId] || {};
  }

  /**
   * Get all entry-grouped spell lists for an actor.
   * @param {Actor} actor
   * @returns {Object}
   * @private
   */
  static _getAllSpellLists(actor) {
    return actor.getFlag(MODULE_ID, settings.flagNames.spellLists) || {};
  }

  /**
   * Get a specific spell list by ID
   * @param {Actor} actor - The actor to get the spell list from
   * @param {string} listId - The ID of the spell list to get
   * @returns {Object|null} - The spell list object or null if not found
   */
  static getSpellList(actor, spellcastingEntryId, listId) {
    const lists = this.getSpellLists(actor, spellcastingEntryId);
    return lists[listId] || null;
  }

  /**
  * Save the current spell preparation as a new list
  * @param {Actor} actor - The actor to save the spell list for
  * @param {string} spellcastingEntryId - The spellcasting entry id to save lists for
  * @param {Object} currentEntrySpells - The spellcasting entry spells to save
  * @param {string} name - The name of the spell list
  * @param {string} description - Optional description of the spell list
  * @returns {Promise<string>} - The ID of the newly created spell list
  */
  static async saveCurrentAsNewList(actor, spellcastingEntryId, currentEntrySpells, name, description = '') {
    // Generate a unique ID for the new list
    const listId = foundry.utils.randomID();

    // Create the spell list data structure
    const spellListData = {
      id: listId,
      spellcastingEntryId: spellcastingEntryId,
      name: name,
      description: description,
      spellcastingEntry: currentEntrySpells,
      created: Date.now()
    };

    // Save the spell list to the actor's flags
    const allLists = this._deepClone(this._getAllSpellLists(actor));
    allLists[spellcastingEntryId] = allLists[spellcastingEntryId] || {};
    allLists[spellcastingEntryId][listId] = spellListData;

    await actor.unsetFlag(MODULE_ID, settings.flagNames.spellLists);
    await actor.setFlag(MODULE_ID, settings.flagNames.spellLists, allLists);

    return listId;
  }

  /**
   * Load a saved spell list into the current preparation
   * @param {Actor} actor - The actor to load the spell list for
   * @param {string} spellcastingEntryId - The spellcasting entry id to load into
   * @param {string} listId - The ID of the spell list to load
   * @returns {Promise<boolean>} - Whether the load was successful
   */
  static async loadSpellList(actor, spellcastingEntryId, listId) {
    const list = this.getSpellList(actor, spellcastingEntryId, listId);
    if (!list || !list.spellcastingEntry) return false;

    const success = await this._applySpellListToEntry(actor, spellcastingEntryId, list.spellcastingEntry);
    if (!success) return false;

    const lists = this._getAllSpellLists(actor);
    await actor.unsetFlag(MODULE_ID, settings.flagNames.spellLists);
    await actor.setFlag(MODULE_ID, settings.flagNames.spellLists, lists);
    
    return true;
  }

  /**
   * Update an existing spell list with the current preparation
   * @param {Actor} actor - The actor to update the spell list for
   * @param {string} spellcastingEntryId - The spellcasting entry id to update lists for
   * @param {Object} currentEntrySpells - The current spellcasting entry spells to save
   * @param {string} listId - The ID of the spell list to update
   * @returns {Promise<boolean>} - Whether the update was successful
   */
  static async resetSpellList(actor, spellcastingEntryId, currentEntrySpells, listId) {
    const list = this.getSpellList(actor, spellcastingEntryId, listId);
    if (!list) return false;

    // Since the structure of the spell list is quite complex and closely tied to the current preparation, it's simpler and more reliable to just save the current preparation as a new list with the same name & description, and then delete the current list
    const newListId = await this.saveCurrentAsNewList(actor, spellcastingEntryId, currentEntrySpells, list.name, list.description);
    await this.deleteSpellList(actor, spellcastingEntryId, listId);

    return newListId;
  }

  /**
   * Delete a spell list
   * @param {Actor} actor - The actor to delete the spell list from
   * @param {string} spellcastingEntryId - The spellcasting entry id where the list is stored
   * @param {string} listId - The ID of the spell list to delete
   * @returns {Promise<boolean>} - Whether the deletion was successful
   */
  static async deleteSpellList(actor, spellcastingEntryId, listId) {
    const lists = this.getSpellLists(actor, spellcastingEntryId);
    if (!lists[listId]) return false;
    
    const allLists = this._deepClone(this._getAllSpellLists(actor));
    const updatedLists = this._deepClone(allLists[spellcastingEntryId] || {});
    delete updatedLists[listId];
    allLists[spellcastingEntryId] = updatedLists;
    if (Object.keys(updatedLists).length === 0) {
      delete allLists[spellcastingEntryId];
    }
    
    // Update the actor's flags
    await actor.unsetFlag(MODULE_ID, settings.flagNames.spellLists);
    await actor.setFlag(MODULE_ID, settings.flagNames.spellLists, allLists);
    
    // Ensure the flag update is fully processed before returning
    // This gives Foundry's event system a chance to fully synchronize the data
    return true;
  }

  /**
   * Clear all module-related flags for this actor.
   * @param {Actor} actor
   * @returns {Promise<boolean>} - Whether anything was cleared
   */
  static async clearAllSpellLists(actor) {
    await actor.unsetFlag(MODULE_ID, settings.flagNames.spellLists);
    return true;
  }

  /**
   * Rename a spell list
   * @param {Actor} actor - The actor to rename the spell list for
   * @param {string} spellcastingEntryId - The spellcasting entry id where the list is stored
   * @param {string} listId - The ID of the spell list to rename
   * @param {string} newName - The new name for the spell list
   * @param {string} newDescription - Optional new description
   * @returns {Promise<boolean>} - Whether the rename was successful
   */
  static async renameSpellList(actor, spellcastingEntryId, listId, newName, newDescription = null) {
    const lists = this.getSpellLists(actor, spellcastingEntryId);
    if (!lists[listId]) return false;
    
    const allLists = this._deepClone(this._getAllSpellLists(actor));
    const updatedLists = this._deepClone(allLists[spellcastingEntryId] || {});
    
    // Update the name
    updatedLists[listId].name = newName;
    
    // Update the description if provided
    if (newDescription !== null) {
      updatedLists[listId].description = newDescription;
    }
    
    // Update the actor's flags
    allLists[spellcastingEntryId] = updatedLists;
    await actor.unsetFlag(MODULE_ID, settings.flagNames.spellLists);
    await actor.setFlag(MODULE_ID, settings.flagNames.spellLists, allLists);
    
    return true;
  }

  /**
   * Duplicate a spell list
   * @param {Actor} actor - The actor to duplicate the spell list for
   * @param {string} spellcastingEntryId - The spellcasting entry id where the list is stored
   * @param {string} listId - The ID of the spell list to duplicate
   * @param {string} newName - The name for the new spell list
   * @param {string} newDescription - Optional description for the new spell list
   * @returns {Promise<string>} - The ID of the newly created spell list
   */
  static async duplicateSpellList(actor, spellcastingEntryId, listId, newName, newDescription = null) {
    const list = this.getSpellList(actor, spellcastingEntryId, listId);
    if (!list) return null;
    
    // Generate a unique ID for the new list
    const newListId = foundry.utils.randomID();
    
    // Create a deep copy of the list
    const newList = this._deepClone(list);
    
    // Update the new list properties
    newList.id = newListId;
    newList.name = newName;
    if (newDescription !== null) {
      newList.description = newDescription;
    }
    newList.created = Date.now();
    
    // Save the new list with a deep clone to avoid reference issues
    const allLists = this._deepClone(this._getAllSpellLists(actor));
    const updatedLists = this._deepClone(allLists[spellcastingEntryId] || {});
    updatedLists[newListId] = newList;
    allLists[spellcastingEntryId] = updatedLists;
    
    await actor.unsetFlag(MODULE_ID, settings.flagNames.spellLists);
    await actor.setFlag(MODULE_ID, settings.flagNames.spellLists, allLists);
    
    return newListId;
  }

  /**
   * Apply one saved spell list to one spellcasting entry.
   * @param {Actor} actor
   * @param {string} spellcastingEntryId
   * @param {Object} savedEntry
   * @returns {Promise<boolean>}
   * @private
   */
  static async _applySpellListToEntry(actor, spellcastingEntryId, savedEntry) {
    if (!savedEntry) return false;

    const entry = (actor.itemTypes.spellcastingEntry || []).find(e => e.id === spellcastingEntryId);
    if (!entry || entry.system.prepared?.value !== "prepared") return false;

    const spellcasting = actor.spellcasting?.collections?.find(sc => sc.id === spellcastingEntryId);
    if (!spellcasting) return false;

    const isFlexible = entry.system.prepared?.flexible === true;
    const missingSpells = new Set();
    const addMissingSpell = (spellName, reasonKey) => {
      const name = spellName?.name || game.i18n.localize("PREPPER.spellList.unknownSpell");
      const id =  spellName?.id || "-";
      const reason = game.i18n.localize(reasonKey);
      missingSpells.add(`- ${name} (${id}): ${reason}`);
    };

    if (isFlexible) {
      try {
        const spellsToInclude = new Set();
        for (const levelObj of savedEntry.levels || []) {
          for (const spellData of (levelObj.spells || [])) {
            if (!spellData?.id) {
              addMissingSpell(spellData, "PREPPER.spellList.loadWarning.reasonBadSpell");
              continue;
            }

            const spell = actor.items.get(spellData.id);
            if (!spell) {
              addMissingSpell(spellData, "PREPPER.spellList.loadWarning.reasonNotOnActor");
              continue;
            }

            spellsToInclude.add(spellData.id);
          }
        }

        if (spellcasting.size > 0) {
          for (const spell of spellcasting.contents) {
            const shouldPrepare = spellsToInclude.has(spell.id);
            await spell.update({
              "system.location.signature": shouldPrepare
            });
          }
        }

        this._showMissingSpellsWarning(missingSpells);
        return true;
      } catch (e) {
        error(`Failed to update spell signature: ${e.message}`);
        return false;
      }
    }

    if (!spellcasting.prepareSpell) return false;

    try {
      const levels = Array.from({ length: 10 }, (_, i) => i + 1);
      const entrySlots = entry.system.slots || {};

      // Clear all currently prepared slots first, including levels not present in the saved list.
      for (const level of levels) {
        const slotKey = `slot${level}`;
        const slots = entrySlots[slotKey];
        if (!slots) continue;

        const prepared = slots.prepared || [];
        for (let slotIndex = prepared.length - 1; slotIndex >= 0; slotIndex--) {
          await spellcasting.prepareSpell(null, level, slotIndex);
        }
      }

      // Apply saved spells after clearing.
      for (const levelObj of (savedEntry.levels || [])) {
        const level = Number(levelObj.level);
        const slotKey = `slot${level}`;
        const slots = entrySlots[slotKey];
        if (!slots) continue;

        const savedSpellCount = levelObj.spells?.length || 0;
        for (let slotIndex = 0; slotIndex < savedSpellCount; slotIndex++) {
          const spellData = levelObj.spells[slotIndex];
          if (!spellData?.id) {
            addMissingSpell(spellData, "PREPPER.spellList.loadWarning.reasonBadSpell");
            continue;
          }

          if (slotIndex >= slots.max) {
            addMissingSpell(spellData, "PREPPER.spellList.loadWarning.reasonNoSlot");
            continue;
          }

          const spell = actor.items.get(spellData.id);
          if (!spell) {
            addMissingSpell(spellData, "PREPPER.spellList.loadWarning.reasonNotOnActor");
            continue;
          }

          if (spell.type !== "spell") {
            addMissingSpell(spellData, "PREPPER.spellList.loadWarning.reasonBadSpell");
            continue;
          }

          await spellcasting.prepareSpell(spell, level, slotIndex);
        }
      }

      this._showMissingSpellsWarning(missingSpells);
      return true;
    } catch (e) {
      error(`Failed to prepare spell via API: ${e.message}`);
      return false;
    }
  }
}
