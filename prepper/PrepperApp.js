import { id as SCRIPT_ID, title } from "../module.json";
import { info, debug } from "./utilities/Utilities.js";

/**
* Application for managing spell lists
*/
export default class PrepperApp extends Application {
    /**
    * @param {Actor} actor - The actor to manage spell lists for
    * @param {Object} options - Application options
    */
    constructor(actor, options = {}) {
        super(options);
        this.actor = actor;
        this.activeTab = null;
    }
    
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: SCRIPT_ID,
            title: game.i18n.localize('SPELLLIST.Title'),
            template: `modules/${SCRIPT_ID}/templates/prepper.hbs`,
            width: 700,
            height: 700,
            resizable: true,
            classes: [title],
            tabs: [{ navSelector: '.prepper-tabs', contentSelector: '.prepper-tab-content', initial: 'current' }]
        });
    }
    
    /** @override */
    getData(options = {}) {
        // Get all spell lists for this actor
        const storage = game.modules.get(SCRIPT_ID).api.PrepperStorage;
        const spellLists = storage.getSpellLists(this.actor);
        const activeListId = storage.getActiveListId(this.actor);
        
        // Sort lists alphabetically
        const sortedLists = Object.values(spellLists).sort((a, b) => {
            return a.name.localeCompare(b.name);
        });
        
        // Get current spells
        const currentSpells = this._getCurrentSpellsDisplay();
        
        // Add display data to each list
        for (const list of sortedLists) {
            list.displayEntries = this._getSpellListDisplay(list);
        }
        
        return {
            actor: this.actor,
            spellLists: sortedLists,
            activeListId: activeListId,
            hasLists: sortedLists.length > 0,
            currentSpells: currentSpells
        };
    }
    
    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
        
        // Button handlers
        html.find('.prepper-new-list-btn').click(this._onNewList.bind(this));
        html.find('.prepper-load-list-btn').click(this._onLoadList.bind(this));
        html.find('.prepper-duplicate-list-btn').click(this._onDuplicateList.bind(this));
        html.find('.prepper-delete-list-btn').click(this._onDeleteList.bind(this));
        html.find('.prepper-rename-list-btn').click(this._onRenameList.bind(this));
        html.find('.prepper-reload-current-btn').click(this._onReloadCurrent.bind(this));
        
        // Tab change handler
        html.find('.prepper-tabs a').click(ev => {
            this.activeTab = ev.currentTarget.dataset.tab;
        });
    }
    
    /**
    * Get the current spells for display
    * @returns {Array} Array of spellcasting entries with their spells
    * @private
    */
    _getCurrentSpellsDisplay() {
        const result = []; // Initialize result array
        
        // Get all prepared spellcasting entries
        const preparedEntries = this.actor.items.filter(entry => 
            entry.system.prepared?.value === 'prepared');
            
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
                        //expended: preparedSpell.expended || false
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
            
            for (const entry of list.spellcastingEntries) {
                const entryData = {
                    id: entry.id,
                    name: entry.name,
                    levels: []
                };
                
                // For each spell level, get the prepared spells
                for (const [slotKey, spells] of Object.entries(entry.preparedSpells)) {
                    if (!spells || spells.length === 0) continue;
                    
                    // Extract level number from slotKey (e.g., "slot1" -> 1)
                    const level = parseInt(slotKey.replace('slot', ''));
                    if (isNaN(level)) continue;
                    
                    const levelData = {
                        level: level,
                        spells: []
                    };
                    
                    // Get spell data
                    for (const preparedSpell of spells) {
                        if (!preparedSpell.id) continue;
                        
                        // Find the spell item in the compendium or actor items
                        const spell = this.actor.items.get(preparedSpell.id);
                        if (!spell) {
                            // If spell not found on actor, try to get name from list metadata if available
                            if (preparedSpell.name) {
                                levelData.spells.push({
                                    id: preparedSpell.id,
                                    name: preparedSpell.name,
                                    expended: preparedSpell.expended || false
                                });
                            } else {
                                // Add unknown spell
                                levelData.spells.push({
                                    id: preparedSpell.id,
                                    name: game.i18n.localize("SPELLLIST.UnknownSpell"),
                                    expended: preparedSpell.expended || false
                                });
                            }
                            continue;
                        }
                        
                        levelData.spells.push({
                            id: spell.id,
                            name: spell.name,
                            expended: preparedSpell.expended || false
                        });
                    }
                    
                    if (levelData.spells.length > 0) {
                        entryData.levels.push(levelData);
                    }
                }
                
                // Sort levels
                entryData.levels.sort((a, b) => a.level - b.level);
                
                if (entryData.levels.length > 0) {
                    result.push(entryData);
                }
            }
            
            return result;
        }
        
        /**
        * Handle creating a new spell list
        * @param {Event} event - The triggering event
        * @private
        */
        async _onNewList(event) {
            event.preventDefault();
            
            // Prompt for name and description
            const dialog = new Dialog({
                title: game.i18n.localize('SPELLLIST.New'),
                content: `
                    <form class="$SCRIPT_ID-dialog">
                    <div class="form-group">
                    <label>${game.i18n.localize('SPELLLIST.NamePrompt')}</label>
                    <input type="text" name="name" value="" required>
                    </div>
                    <div class="form-group">
                    <label>${game.i18n.localize('SPELLLIST.DescriptionPrompt')}</label>
                    <textarea name="description"></textarea>
                    </div>
                    </form>
                    `,
                buttons: {
                    save: {
                        icon: '<i class="fas fa-save"></i>',
                        label: game.i18n.localize('SPELLLIST.Save'),
                        callback: async (html) => {
                            const form = html.find('form')[0];
                            const name = form.name.value;
                            const description = form.description.value;
                            
                            if (!name) return;
                            
                            // Save the current preparation as a new list
                            const storage = game.modules.get(SCRIPT_ID).api.PrepperStorage;
                            await storage.saveCurrentAsNewList(this.actor, name, description);
                            
                            // Refresh the app
                            this.render(true);
                            
                            // Show success notification
                            ui.notifications.info(game.i18n.localize('SPELLLIST.SaveSuccess'));
                        }
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: game.i18n.localize('Cancel')
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
        async _onDuplicateList(event) {
            event.preventDefault();
            
            const listId = event.currentTarget.dataset.listId;
            if (!listId) return;
            
            // Get the list to duplicate
            const storage = game.modules.get(SCRIPT_ID).api.PrepperStorage;
            const list = storage.getSpellList(this.actor, listId);
            if (!list) return;
            
            // Prompt for name and description
            const dialog = new Dialog({
                title: game.i18n.localize('SPELLLIST.Duplicate'),
                content: `
                    <form class="pf2e-prepper-dialog">
                    <div class="form-group">
                    <label>${game.i18n.localize('SPELLLIST.NamePrompt')}</label>
                    <input type="text" name="name" value="${list.name} (Copy)" required>
                    </div>
                    <div class="form-group">
                    <label>${game.i18n.localize('SPELLLIST.DescriptionPrompt')}</label>
                    <textarea name="description">${list.description || ''}</textarea>
                    </div>
                    </form>
                    `,
                buttons: {
                    save: {
                        icon: '<i class="fas fa-save"></i>',
                        label: game.i18n.localize('SPELLLIST.Save'),
                        callback: async (html) => {
                            const form = html.find('form')[0];
                            const name = form.name.value;
                            const description = form.description.value;
                            
                            if (!name) return;
                            
                            // Duplicate the list
                            await storage.duplicateSpellList(this.actor, listId, name, description);
                            
                            // Refresh the app
                            this.render(true);
                            
                            // Show success notification
                            ui.notifications.info(game.i18n.localize('SPELLLIST.SaveSuccess'));
                        }
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: game.i18n.localize('Cancel')
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
        async _onLoadList(event) {
            event.preventDefault();
            
            const listId = event.currentTarget.dataset.listId;
            if (!listId) return;
            
            // Confirm before loading
            const confirm = await Dialog.confirm({
                title: game.i18n.localize('SPELLLIST.Load'),
                content: game.i18n.localize('SPELLLIST.LoadConfirm'),
                defaultYes: false
            });
            
            if (!confirm) return;
            
            // Load the selected list
            const storage = game.modules.get(SCRIPT_ID).api.PrepperStorage;
            const success = await storage.loadSpellList(this.actor, listId);
            
            if (success) {
                ui.notifications.info(game.i18n.localize('SPELLLIST.LoadSuccess'));
                this.render(true);
            }
        }
        
        /**
        * Handle reloading the current preparation display
        * @param {Event} event - The triggering event
        * @private
        */
        async _onReloadCurrent(event) {
            event.preventDefault();
            this.render(true);
        }
        
        /**
        * Handle deleting a spell list
        * @param {Event} event - The triggering event
        * @private
        */
        async _onDeleteList(event) {
            event.preventDefault();
            
            const listId = event.currentTarget.dataset.listId;
            if (!listId) return;
            
            // Confirm before deleting
            const confirm = await Dialog.confirm({
                title: game.i18n.localize('SPELLLIST.Delete'),
                content: game.i18n.localize('SPELLLIST.ConfirmDelete'),
                defaultYes: false
            });
            
            if (!confirm) return;
            
            // Delete the selected list
            const storage = game.modules.get(SCRIPT_ID).api.PrepperStorage;
            const success = await storage.deleteSpellList(this.actor, listId);
            
            if (success) {
                ui.notifications.info(game.i18n.localize('SPELLLIST.DeleteSuccess'));
                this.activeTab = 'current';
                this.render(true);
            }
        }
        
        /**
        * Handle renaming a spell list
        * @param {Event} event - The triggering event
        * @private
        */
        async _onRenameList(event) {
            event.preventDefault();
            
            const listId = event.currentTarget.dataset.listId;
            if (!listId) return;
            
            // Get the current list
            const storage = game.modules.get(SCRIPT_ID).api.PrepperStorage;
            const list = storage.getSpellList(this.actor, listId);
            
            if (!list) return;
            
            // Prompt for new name and description
            const dialog = new Dialog({
                title: game.i18n.localize('SPELLLIST.Rename'),
                content: `
                    <form class="pf2e-prepper-dialog">
                    <div class="form-group">
                    <label>${game.i18n.localize('SPELLLIST.NamePrompt')}</label>
                    <input type="text" name="name" value="${list.name}" required>
                    </div>
                    <div class="form-group">
                    <label>${game.i18n.localize('SPELLLIST.DescriptionPrompt')}</label>
                    <textarea name="description">${list.description || ''}</textarea>
                    </div>
                    </form>
                    `,
                buttons: {
                    save: {
                        icon: '<i class="fas fa-save"></i>',
                        label: game.i18n.localize('SPELLLIST.Save'),
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
                        label: game.i18n.localize('Cancel')
                    }
                },
                default: 'save'
            });
            
            dialog.render(true);
        }
    }
