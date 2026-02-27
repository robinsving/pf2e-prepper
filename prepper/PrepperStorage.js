import { id as SCRIPT_ID } from '../module.json';
import { settings } from "./utilities/Utilities";

/**
 * Class for handling spell list storage and management
 */
export default class PrepperStorage {
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
   * @returns {Object} - Object containing all saved spell lists
   */
  static getSpellLists(actor) {
    if (!actor) return {};
    return actor.getFlag(SCRIPT_ID, settings.flagNames.spellLists) || {};
  }

  /**
   * Get a specific spell list by ID
   * @param {Actor} actor - The actor to get the spell list from
   * @param {string} listId - The ID of the spell list to get
   * @returns {Object|null} - The spell list object or null if not found
   */
  static getSpellList(actor, listId) {
    const lists = this.getSpellLists(actor);
    return lists[listId] || null;
  }

  /**
  * Save the current spell preparation as a new list
  * @param {Actor} actor - The actor to save the spell list for
  * @param {Array} currentSpells - The spellcastingEntries to save
  * @param {string} name - The name of the spell list
  * @param {string} description - Optional description of the spell list
  * @returns {Promise<string>} - The ID of the newly created spell list
  */
  static async saveCurrentAsNewList(actor, currentSpells, name, description = '') {
    // Generate a unique ID for the new list
    const listId = foundry.utils.randomID();

    // Create the spell list data structure
    const spellListData = {
      id: listId,
      name: name,
      description: description,
      spellcastingEntries: currentSpells, // currentSpells should already be in the correct format (with levels array)
      lastUsed: Date.now()
    };

    // Save the spell list to the actor's flags
    const lists = this.getSpellLists(actor);
    lists[listId] = spellListData;

    await actor.unsetFlag(SCRIPT_ID, settings.flagNames.spellLists);
    await actor.setFlag(SCRIPT_ID, settings.flagNames.spellLists, lists);

    return listId;
  }

  /**
   * Load a saved spell list into the current preparation
   * @param {Actor} actor - The actor to load the spell list for
   * @param {string} listId - The ID of the spell list to load
   * @returns {Promise<boolean>} - Whether the load was successful
   */
  static async loadSpellList(actor, listId) {
    const list = this.getSpellList(actor, listId);
    if (!list) return false;
    
    // Get the spellcasting entries
    const spellcastingEntries = actor.itemTypes.spellcastingEntry || [];
    
    // For each entry in the saved list, find the matching entry and update its prepared spells
    for (const savedEntry of list.spellcastingEntries) {
      const entry = spellcastingEntries.find(e => e.id === savedEntry.id);
      if (!entry || entry.system.prepared?.value !== 'prepared') continue;
      
      const isFlexible = entry.system.prepared?.flexible === true;
      
      if (!isFlexible && actor.spellcasting?.collections) {
        // Handle flexible spellcasters using the prepareSpell API (if available in Foundry)
        const spellcasting = actor.spellcasting.collections.find(sc => sc.id === entry.id);
        
        if (spellcasting && spellcasting.prepareSpell) {
          try {
            // For each spell level in the saved list
            for (const levelObj of savedEntry.levels) {
              const level = levelObj.level;
              const slotKey = `slot${level}`;
              const slots = entry.system.slots[slotKey];
              
              // Verify slots exist for this level
              if (!slots) continue;
              
              const savedSpellCount = levelObj.spells?.length || 0;
              
              // First, prepare the spells we want to load
              for (let slotIndex = 0; slotIndex < savedSpellCount; slotIndex++) {
                const spellData = levelObj.spells[slotIndex];
                const spell = actor.items.get(spellData.id);
                
                if (spell && spell.type === 'spell') {
                  // Verify slot index is valid before preparing
                  if (slotIndex < slots.max) {
                    await spellcasting.prepareSpell(spell, level, slotIndex);
                  }
                }
              }
              
              // Then, clear any spells in slots we don't have saved
              const prepared = slots.prepared || [];
              for (let slotIndex = prepared.length - 1; slotIndex >= savedSpellCount; slotIndex--) {
                if (slotIndex < prepared.length) {
                  await spellcasting.prepareSpell(null, level, slotIndex);
                }
              }
            }
          } catch (e) {
            // If prepareSpell API fails, fall back to slot updates
            error(`Failed to prepare spell via API: ${e.message}`);
          }
        }
      }
    }
    
    // Update the lastUsed timestamp
    const lists = this.getSpellLists(actor);
    lists[listId].lastUsed = Date.now();
    await actor.unsetFlag(SCRIPT_ID, settings.flagNames.spellLists);
    await actor.setFlag(SCRIPT_ID, settings.flagNames.spellLists, lists);
    
    return true;
  }

  /**
   * Update an existing spell list with the current preparation
   * @param {Actor} actor - The actor to update the spell list for
   * @param {string} listId - The ID of the spell list to update
   * @returns {Promise<boolean>} - Whether the update was successful
   */
  static async updateSpellList(actor, listId) {
    const list = this.getSpellList(actor, listId);
    if (!list) return false;
    
    // Get the current spell preparation
    const spellcastingEntries = actor.itemTypes.spellcastingEntry || [];
    const preparedEntries = spellcastingEntries.filter(entry => 
      entry.system.prepared?.value === 'prepared');
    
    if (preparedEntries.length === 0) {
      throw new Error("No prepared spellcasting entries found");
    }
    
    // Update the spell list data structure
    const updatedEntries = [];
    
    // For each prepared spellcasting entry, save its prepared spells
    for (const entry of preparedEntries) {
      const entryData = {
        id: entry.id,
        name: entry.name,
        preparedSpells: {}
      };
      
      // Get all prepared spells for this entry
      const preparedSpells = entry.system.slots || {};
      
      // For each spell level, save the prepared spells
      for (const [level, slotData] of Object.entries(preparedSpells)) {
        if (level === 'slot0') continue; // Skip cantrips
        
        // Get the prepared spells for this level
        const prepared = slotData.prepared || [];
        
        entryData.preparedSpells[level] = prepared.map(spell => {
          if (!spell.id) return null;
          
          // Get the spell name for better display
          const spellItem = actor.items.get(spell.id);
          return {
            id: spell.id,
            name: spellItem ? spellItem.name : null,
            castLevel: spell.castLevel,
            expended: spell.expended || false
          };
        }).filter(spell => spell !== null);
      }
      
      updatedEntries.push(entryData);
    }
    
    // Update the spell list
    const lists = this.getSpellLists(actor);
    lists[listId].spellcastingEntries = updatedEntries;
    lists[listId].lastUsed = Date.now();
    
    await actor.unsetFlag(SCRIPT_ID, settings.flagNames.spellLists);
    await actor.setFlag(SCRIPT_ID, settings.flagNames.spellLists, lists);
    
    return true;
  }

  /**
   * Delete a spell list
   * @param {Actor} actor - The actor to delete the spell list from
   * @param {string} listId - The ID of the spell list to delete
   * @returns {Promise<boolean>} - Whether the deletion was successful
   */
  static async deleteSpellList(actor, listId) {
    const lists = this.getSpellLists(actor);
    if (!lists[listId]) return false;
    
    // Create a new object without the deleted list (avoid reference issues)
    const updatedLists = this._deepClone(lists);
    delete updatedLists[listId];
    
    // Update the actor's flags
    await actor.unsetFlag(SCRIPT_ID, settings.flagNames.spellLists);
    await actor.setFlag(SCRIPT_ID, settings.flagNames.spellLists, updatedLists);
    
    // Ensure the flag update is fully processed before returning
    // This gives Foundry's event system a chance to fully synchronize the data
    return true;
  }

  /**
   * Rename a spell list
   * @param {Actor} actor - The actor to rename the spell list for
   * @param {string} listId - The ID of the spell list to rename
   * @param {string} newName - The new name for the spell list
   * @param {string} newDescription - Optional new description
   * @returns {Promise<boolean>} - Whether the rename was successful
   */
  static async renameSpellList(actor, listId, newName, newDescription = null) {
    const lists = this.getSpellLists(actor);
    if (!lists[listId]) return false;
    
    // Create a deep clone to avoid reference issues
    const updatedLists = this._deepClone(lists);
    
    // Update the name
    updatedLists[listId].name = newName;
    
    // Update the description if provided
    if (newDescription !== null) {
      updatedLists[listId].description = newDescription;
    }
    
    // Update the actor's flags
    await actor.unsetFlag(SCRIPT_ID, settings.flagNames.spellLists);
    await actor.setFlag(SCRIPT_ID, settings.flagNames.spellLists, updatedLists);
    
    return true;
  }

  /**
   * Duplicate a spell list
   * @param {Actor} actor - The actor to duplicate the spell list for
   * @param {string} listId - The ID of the spell list to duplicate
   * @param {string} newName - The name for the new spell list
   * @param {string} newDescription - Optional description for the new spell list
   * @returns {Promise<string>} - The ID of the newly created spell list
   */
  static async duplicateSpellList(actor, listId, newName, newDescription = null) {
    const list = this.getSpellList(actor, listId);
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
    newList.lastUsed = Date.now();
    
    // Save the new list with a deep clone to avoid reference issues
    const lists = this.getSpellLists(actor);
    const updatedLists = this._deepClone(lists);
    updatedLists[newListId] = newList;
    
    await actor.unsetFlag(SCRIPT_ID, settings.flagNames.spellLists);
    await actor.setFlag(SCRIPT_ID, settings.flagNames.spellLists, updatedLists);
    
    return newListId;
  }
}
