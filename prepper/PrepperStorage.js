import { id as SCRIPT_ID } from '../module.json';
import { settings } from "./utilities/Utilities";

/**
 * Class for handling spell list storage and management
 */
export default class PrepperStorage {
    /**
     * Get all saved spell lists for an actor
     * @param {Actor} actor - The actor to get spell lists for
     * @returns {Object} - Object containing all saved spell lists
     */
    static getSpellLists(actor) {
      if (!actor) return {};
      return actor.getFlag(SCRIPT_ID, 'spellLists') || {};
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
     * Get the currently active spell list ID
     * @param {Actor} actor - The actor to get the active list for
     * @returns {string|null} - The ID of the active spell list or null if none
     */
    static getActiveListId(actor) {
      return actor.getFlag(SCRIPT_ID, 'activeListId') || null;
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

      await actor.setFlag(SCRIPT_ID, 'spellLists', lists);

      // Set this as the active list
      await actor.setFlag(SCRIPT_ID, 'activeListId', listId);

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

        // Only support the levels array format (flexible-actor.json style)
        const updateData = {};
        if (savedEntry.levels) {
          for (const levelObj of savedEntry.levels) {
            if (!levelObj.spells || levelObj.spells.length === 0) continue;
            updateData[`system.slots.slot${levelObj.level}.prepared`] = levelObj.spells;
          }
        }

        if (Object.keys(updateData).length > 0) {
          await entry.update(updateData);
        }
      }
      
      // Set this as the active list
      await actor.setFlag(SCRIPT_ID, settings.flagNames.activeList, listId);
      
      // Update the lastUsed timestamp
      const lists = this.getSpellLists(actor);
      lists[listId].lastUsed = Date.now();
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
      
      await actor.setFlag(SCRIPT_ID, 'spellLists', lists);
      
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
      
      // Delete the spell list
      delete lists[listId];
      
      // Update the actor's flags
      await actor.setFlag(SCRIPT_ID, 'spellLists', lists);
      
      // If this was the active list, clear the active list ID
      const activeListId = this.getActiveListId(actor);
      if (activeListId === listId) {
        await actor.setFlag(SCRIPT_ID, 'activeListId', null);
      }
      
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
      
      // Update the name
      lists[listId].name = newName;
      
      // Update the description if provided
      if (newDescription !== null) {
        lists[listId].description = newDescription;
      }
      
      // Update the actor's flags
      await actor.setFlag(SCRIPT_ID, 'spellLists', lists);
      
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
      const newList = foundry.utils.deepClone(list);
      
      // Update the new list properties
      newList.id = newListId;
      newList.name = newName;
      if (newDescription !== null) {
        newList.description = newDescription;
      }
      newList.lastUsed = Date.now();
      
      // Save the new list
      const lists = this.getSpellLists(actor);
      lists[newListId] = newList;
      
      await actor.setFlag(SCRIPT_ID, 'spellLists', lists);
      
      return newListId;
    }
  }
  