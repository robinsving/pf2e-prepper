import { MODULE_ID, MODULE_TITLE, API } from "./prepper";
import { debug, info, popup } from "./utilities/Utilities";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

/**
* Application for managing spell lists
*/
export default class PrepperApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: MODULE_ID,

        actions: {
            changeTab: PrepperApp._onChangeTab,

            // Current preparation actions
            new: PrepperApp._onNewList,
            reload: PrepperApp._onReloadCurrent,

            // Stored list actions
            load: PrepperApp._onLoadList,
            duplicate: PrepperApp._onDuplicateList,
            delete: PrepperApp._onDeleteList,
            rename: PrepperApp._onRenameList,
            reset: PrepperApp._onResetList,
        },

        position: {
            width: 700,
            height: 700
        },

        tag: "div",

        classes: [MODULE_ID],
        window: {
            title: game.i18n.localize('PREPPER.Title'),
            icon: 'fas fa-scroll',
            frame: true,
            resizable: true
        }
    };

    static PARTS = {
        page: {
            template: `modules/${MODULE_ID}/templates/prepper.hbs`,
            scrollable: [''],
        }
    }

    /**
    * @param {Actor} actor - The actor to manage spell lists for
    * @param {Object} options - Application options
    */
    constructor(actor, options = {}) {
        super(options);
        this.actor = actor;
        this.activeTab = 'current';
    };

    async _preparePartContext() {
        // Get all spell lists for this actor
        const storage = API.PrepperStorage;
        const spellLists = storage.getSpellLists(this.actor);
        
        // Sort lists alphabetically
        const sortedLists = Object.values(spellLists).sort((a, b) => {
            return a.name.localeCompare(b.name);
        });
        
        // Process each list to add displayEntries for the template
        for (const list of sortedLists) {
            list.displayEntries = this._getSpellListDisplay(list);
        }
        
        // Get current spells
        const currentSpells = this._getCurrentSpellsDisplay();

        return {
            actor: this.actor,
            spellLists: sortedLists,
            hasLists: sortedLists.length > 0,
            currentSpells: currentSpells,
            activeTab: this.activeTab || 'current'
        };
    }
    
    /**
    * Get the current spells for display
    * @returns {Array} Array of spellcasting entries with their spells
    * @private
    */
    _getCurrentSpellsDisplay() {
        const result = []; // Initialize result array
        
        // Get all prepared spellcasting entries
        const preparedEntries = this.actor.items.filter(entry => entry.system.prepared?.value === 'prepared');
            
        debug(`Found ${preparedEntries.length} prepared spellcasting entries.`);
        
        for (const entry of preparedEntries) {
            info(`Processing spellcasting entry\nName: ${entry.name}\nID: ${entry.id}`);
            const entryData = {
                id: entry.id,
                flexible: entry.system.prepared.flexible,
                name: entry.name,
                levels: []
            };
            debug(`Entry data:`, entryData);
            
            let spells;
            if (entryData.flexible) {
                // Handle flexible spellcasting
                spells = this._getCurrentSpellsDisplayFlexible(entryData, entry);
            } else {
                // Handle prepared spellcasting
                spells = this._getCurrentSpellsDisplayPrepared(entryData, entry);
            }
            
            if (spells.length > 0) {
                result.push(...spells); // Add processed spells to result
            }
        }
        
        debug(`Final spells data:`, result);
        return result; // Return the result array
    }
    
    _getCurrentSpellsDisplayPrepared(entryData, entry) {
        const result = [];
        
        // Get all prepared spells for this entry
        const slots = entry.system.slots || {};
        debug(`Slots for entry ${entry.name}:`, slots);
        
        // For each spell level, get the prepared spells
        for (let level = 1; level <= 10; level++) {
            const slotKey = `slot${level}`;
            if (!slots[slotKey]) {
                debug(`No slot data for level ${level} in entry ${entry.name}.`);
                continue;
            }
            
            debug(`Processing slot ${slotKey} for level ${level}`);
            const prepared = slots[slotKey].prepared || [];
            debug(`Prepared spells for slot ${slotKey}:`, prepared);
            
            if (prepared.length === 0) continue;
            
            const levelData = {
                level: level,
                spells: []
            };
            
            // Get spell data
            for (const preparedSpell of prepared) {
                if (!preparedSpell.id) {
                    debug(`Prepared spell missing ID in slot ${slotKey}.`, preparedSpell);
                    continue;
                }
                
                // Find the spell item
                const spell = this.actor.items.find(s => s.id === preparedSpell.id);
                if (!spell) {
                    debug(`Spell with ID ${preparedSpell.id} not found in actor items.`);
                    continue;
                }
                
                debug(`Found spell: ${spell.name} (ID: ${spell.id})`);
                levelData.spells.push({
                    id: spell.id,
                    name: spell.name,
                });
            }
            
            if (levelData.spells.length > 0) {
                entryData.levels.push(levelData);
            }
        }
        
        if (entryData.levels.length > 0) {
            result.push(entryData);
        }
        return result;
    }
    
    _getCurrentSpellsDisplayFlexible(entryData, entry) {
        const result = [];
        
        // Get all spells associated with this entry via "location"
        const spells = this.actor.items.filter(spell => 
            spell.type === 'spell' && spell.system.location?.value === entry.id && spell.system.location?.signature === true
        );
        
        debug(`Found ${spells.length} spells for entry ${entry.name}.`);
        
        // Group spells by level
        const spellsByLevel = {};
        for (const spell of spells) {
            const level = spell.system.level.value || 0;
            if (!spellsByLevel[level]) {
                spellsByLevel[level] = [];
            }
            spellsByLevel[level].push({
                id: spell.id,
                name: spell.name,
                // Add additional spell properties if needed
            });
        }
        
        // Add spells to entry data
        for (const [level, spells] of Object.entries(spellsByLevel)) {
            entryData.levels.push({
                level: parseInt(level),
                spells: spells
            });
        }
        
        // Sort levels numerically
        entryData.levels.sort((a, b) => a.level - b.level);
        
        if (entryData.levels.length > 0) {
            result.push(entryData);
        }
        return result;
    }
    
    /**
    * Get the spells from a saved list for display
    * @param {Object} list - The saved spell list
    * @returns {Array} Array of spellcasting entries with their spells
    * @private
    */
    _getSpellListDisplay(list) {
        const result = [];
        
        if (!list.spellcastingEntries || list.spellcastingEntries.length === 0) {
            return result;
        }
        
        for (const entry of list.spellcastingEntries) {
            const entryData = {
                id: entry.id,
                name: entry.name,
                levels: []
            };
            
            // Entry already has levels array from when it was saved
            if (entry.levels && entry.levels.length > 0) {
                for (const levelObj of entry.levels) {
                    const levelData = {
                        level: levelObj.level,
                        spells: []
                    };
                    
                    // Get spell data
                    for (const spellInfo of (levelObj.spells || [])) {
                        if (!spellInfo.id) continue;
                        
                        // Try to find spell on actor, but use stored name if not found
                        const spell = this.actor.items.get(spellInfo.id);
                        levelData.spells.push({
                            id: spellInfo.id,
                            name: spell?.name || spellInfo.name || game.i18n.localize("PREPPER.spellList.unknownSpell"),
                        });
                    }
                    
                    if (levelData.spells.length > 0) {
                        entryData.levels.push(levelData);
                    }
                }
            }
            
            if (entryData.levels.length > 0) {
                result.push(entryData);
            }
        }
        
        return result;
    }

    static async _onChangeTab(_, button) {
        this.activeTab  = button.dataset.tab;
        this.render();
    }
    
    /**
    * Handle creating a new spell list
    * @param {Event} event - The triggering event
    * @private
    */
    static async _onNewList(event) {
        event.preventDefault();
        
        // Prompt for name and description
        //extends HandlebarsApplicationMixin(ApplicationV2) {
        const dialog = new Dialog({
            title: game.i18n.localize('PREPPER.spellListButton.new'),
            content: `
                <form class="$SCRIPT_ID-dialog">
                <div class="form-group">
                <label>${game.i18n.localize('PREPPER.popup.namePrompt')}</label>
                <input type="text" name="name" value="" required>
                </div>
                <div class="form-group">
                <label>${game.i18n.localize('PREPPER.popup.descriptionPrompt')}</label>
                <textarea name="description"></textarea>
                </div>
                </form>
                `,
            buttons: {
                save: {
                    icon: '<i class="fas fa-save"></i>',
                    label: game.i18n.localize('PREPPER.popup.save'),
                    callback: async (html) => {
                        const form = html.find('form')[0];
                        const name = form.name.value;
                        const description = form.description.value;
                        
                        if (!name) return;
                        
                        // Save the current preparation as a new list
                        const storage = API.PrepperStorage;
                        const currentSpells = this._getCurrentSpellsDisplay();
                        const newListId = await storage.saveCurrentAsNewList(this.actor, currentSpells, name, description);
                        
                        // Switch to the new list tab
                        this.activeTab = newListId;

                        // Refresh the app
                        this.render(true);
                        
                        // Show success notification
                        popup(game.i18n.localize('PREPPER.spellList.saveSuccess'));
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize('PREPPER.popup.cancel')
                }
            },
            default: 'save'
        });
        
        dialog.render(true);
    }
    
    /**
    * Handle duplicating a spell list
    * @param {Event} event - The triggering event
    * @private
    */
    static async _onDuplicateList(event, target) {
        event.preventDefault();
        
        const listId = target.dataset.listId;
        if (!listId) return;
        
        // Get the list to duplicate
        const storage = API.PrepperStorage;
        const list = storage.getSpellList(this.actor, listId);
        if (!list) return;
        
        // Prompt for name and description
        const dialog = new Dialog({
            title: game.i18n.localize('PREPPER.spellListButton.duplicate'),
            content: `
                <form class="pf2e-prepper-dialog">
                <div class="form-group">
                <label>${game.i18n.localize('PREPPER.popup.namePrompt')}</label>
                <input type="text" name="name" value="${list.name} (Copy)" required>
                </div>
                <div class="form-group">
                <label>${game.i18n.localize('PREPPER.popup.descriptionPrompt')}</label>
                <textarea name="description">${list.description || ''}</textarea>
                </div>
                </form>
                `,
            buttons: {
                save: {
                    icon: '<i class="fas fa-save"></i>',
                    label: game.i18n.localize('PREPPER.popup.save'),
                    callback: async (html) => {
                        const form = html.find('form')[0];
                        const name = form.name.value;
                        const description = form.description.value;
                        
                        if (!name) return;
                        
                        // Duplicate the list
                        const newListId = await storage.duplicateSpellList(this.actor, listId, name, description);
                        
                         // Switch to the new list tab
                        this.activeTab = newListId;

                        // Refresh the app
                        this.render(true);
                        
                        // Show success notification
                        popup(game.i18n.localize('PREPPER.spellList.saveSuccess'));
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize('PREPPER.popup.cancel')
                }
            },
            default: 'save'
        });
        
        dialog.render(true);
    }
    
    /**
    * Handle loading a spell list
    * @param {Event} event - The triggering event
    * @private
    */
    static async _onLoadList(event, target) {
        event.preventDefault();
        
        const listId = target.dataset.listId;
        if (!listId) return;
        
        // Confirm before loading
        const confirm = await Dialog.confirm({
            title: game.i18n.localize('PREPPER.spellListButton.load'),
            content: game.i18n.localize('PREPPER.popup.loadConfirm'),
            defaultYes: false
        });
        
        if (!confirm) return;
        
        // Load the selected list
        const storage = API.PrepperStorage;
        const success = await storage.loadSpellList(this.actor, listId);
        
        if (success) {
            popup(game.i18n.localize('PREPPER.spellList.loadSuccess'));
        }
    }
    
    /**
    * Handle reloading the current preparation display
    * @param {Event} event - The triggering event
    * @private
    */
    static _onReloadCurrent(event) {
        event.preventDefault();
        this.render(true);
    }

    /**
     * Handle updating a spell list
     * @param {Event} event - The triggering event
     * @private
     */
    static async _onResetList(event, target) {
        event.preventDefault();

        const listId = target.dataset.listId;
        if (!listId) return;

        // Confirm before updating
        const confirm = await Dialog.confirm({
            title: game.i18n.localize('PREPPER.popup.reset'),
            content: game.i18n.localize('PREPPER.popup.resetConfirm'),
            defaultYes: false
        });

        if (!confirm) return;

        // Update the selected list
        const storage = API.PrepperStorage;
        const currentSpells = this._getCurrentSpellsDisplay();
        const newListId = await storage.resetSpellList(this.actor, currentSpells, listId);

        if (newListId) {
            this.activeTab = newListId;
            popup(game.i18n.localize('PREPPER.spellList.updateSuccess'));
            this.render(false);
        }
    }
    
    /**
    * Handle deleting a spell list
    * @param {Event} event - The triggering event
    * @private
    */
    static async _onDeleteList(event, target) {
        event.preventDefault();
        
        const listId = target.dataset.listId;
        if (!listId) return;
        
        // Confirm before deleting
        const confirm = await Dialog.confirm({
            title: game.i18n.localize('PREPPER.spellListButton.delete'),
            content: game.i18n.localize('PREPPER.popup.deleteConfirm'),
            defaultYes: false
        });
        
        if (!confirm) return;
        
        // Delete the selected list
        const storage = API.PrepperStorage;
        const success = await storage.deleteSpellList(this.actor, listId);
        
        if (success) {
            debug(game.i18n.localize('PREPPER.spellList.deleteSuccess'));
            this.activeTab = 'current';
            this.render(true);
        }
    }
    
    /**
    * Handle renaming a spell list
    * @param {Event} event - The triggering event
    * @private
    */
    static async _onRenameList(event, target) {
        event.preventDefault();
        
        const listId = target.dataset.listId;
        if (!listId) return;
        
        // Get the current list
        const storage = API.PrepperStorage;
        const list = storage.getSpellList(this.actor, listId);
        
        if (!list) return;
        
        // Prompt for new name and description
        const dialog = new Dialog({
            title: game.i18n.localize('PREPPER.spellListButton.rename'),
            content: `
                <form class="pf2e-prepper-dialog">
                <div class="form-group">
                <label>${game.i18n.localize('PREPPER.popup.namePrompt')}</label>
                <input type="text" name="name" value="${list.name}" required>
                </div>
                <div class="form-group">
                <label>${game.i18n.localize('PREPPER.popup.descriptionPrompt')}</label>
                <textarea name="description">${list.description || ''}</textarea>
                </div>
                </form>
                `,
            buttons: {
                save: {
                    icon: '<i class="fas fa-save"></i>',
                    label: game.i18n.localize('PREPPER.popup.save'),
                    callback: async (html) => {
                        const form = html.find('form')[0];
                        const name = form.name.value;
                        const description = form.description.value;
                        
                        if (!name) return;
                        
                        // Rename the list
                        await storage.renameSpellList(this.actor, listId, name, description);
                        
                        // Refresh the app
                        this.render(true);
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize('PREPPER.popup.cancel')
                }
            },
            default: 'save'
        });
        
        dialog.render(true);
    }
}
