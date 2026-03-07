import { API } from '../prepper.js';
import { id as MODULE_ID } from '../../module.json';
import PrepperApp from "../PrepperApp.js";
import { info, error, popup } from "../utilities/Utilities.js";

// Initialize the module when Foundry is ready
Hooks.once('init', () => {
    info('Initializing PF2e Multiple Spell Lists module');
    
    // Register module settings
    game.settings.register(MODULE_ID, 'debugMode', {
        name: 'Debug Mode',
        hint: 'Enable debug logging for this module',
        scope: 'client',
        config: true,
        type: Boolean,
        default: false
    });
    
    // Register Handlebars helper for date formatting
    Handlebars.registerHelper('formatDate', function(timestamp) {
        if (!timestamp) return '';
        return new Date(timestamp).toLocaleString();
    });
});

// Set up hooks when Foundry is ready
Hooks.once('ready', () => {
    if (game.system.id != 'pf2e') {
        popup('This module is designed for PF2e only. Please disable it for other systems.');
        return;
    }
    
    // Register the API
    game.modules.get(MODULE_ID).api = API;
    
    info('PF2e Multiple Spell Lists module initialized');
});

// Add button to character sheet
Hooks.on('renderActorSheet', (app, html, _) => {
    try {
        // Only add to PF2e character sheets
        if (app.actor.type !== 'character') return;
        
        // Check if the actor has spellcasting entries
        const spellcastingEntries = app.actor.itemTypes.spellcastingEntry || [];
        const hasPreparedCaster = spellcastingEntries.some(entry => 
            entry.system.prepared?.value === 'prepared');
            
            if (!hasPreparedCaster) return;
            
            // Find the spellcasting tab content
            const spellcastingTab = html.find('.tab[data-tab="spellcasting"]');
            if (spellcastingTab.length === 0) {
                return;
            }

            // Remove stale buttons before re-inserting
            spellcastingTab.find('.pf2e-prepper-spell-lists-manager').remove();

            const preparedEntries = spellcastingEntries.filter(entry => entry.system.prepared?.value === 'prepared');
            for (const entry of preparedEntries) {
                const row = spellcastingTab.find(`.item[data-item-id="${entry.id}"], .spellcasting-entry[data-item-id="${entry.id}"]`).first();
                if (row.length === 0) continue;

                let controls = row.find('.item-controls').first();
                if (controls.length === 0) {
                    controls = row.find('header').first();
                }
                if (controls.length === 0) {
                    controls = row;
                }

                const buttonHtml = `
                    <a class="pf2e-prepper-spell-lists-manager" data-entry-id="${entry.id}" data-tooltip="${game.i18n.localize('PREPPER.ManageSpellLists')}">
                        <i class="fas fa-scroll"></i>
                    </a>
                `;
                controls.prepend(buttonHtml);
            }

            spellcastingTab.find('.pf2e-prepper-spell-lists-manager').off('click').on('click', ev => {
                ev.preventDefault();
                const entryId = ev.currentTarget?.dataset?.entryId;
                if (!entryId) return;
                new PrepperApp(app.actor, { spellcastingEntryId: entryId }).render(true);
            });
        } catch (e) {
            error('Error adding button to character sheet', e);
        }
   
});
