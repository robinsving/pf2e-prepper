import { API } from '../prepper.js';
import { id as MODULE_ID } from '../../module.json';
import { info, error, popup, settings, registerSettings, getSettings } from "../utilities/Utilities.js";
import { registerDailiesIntegration } from "./DailiesIntegration.js";
import { bindActorSheetHandlers } from "./Handlers.js";

// Initialize the module when Foundry is ready
Hooks.once('init', () => {
    info('Initializing PF2e Spell Loadouts module');
    
    // Register module settings
    registerSettings(settings.debug);
    registerSettings(settings.quickLoadVisible);
    
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
    
    // Register PF2e Dailies integration (custom daily)
    registerDailiesIntegration();

    info('PF2e Spell Loadouts module initialized');
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
            spellcastingTab.find('.pf2e-prepper-spell-loadouts-manager').remove();
            spellcastingTab.find('.pf2e-prepper-quick-load').remove();

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

                const showQuickLoad = getSettings(settings.quickLoadVisible);
                const quickLoadHtml = showQuickLoad
                    ? `
                        <a class="pf2e-prepper-quick-load" data-entry-id="${entry.id}" data-entry-name="${entry.name}" data-tooltip="${game.i18n.localize('PREPPER.QuickLoad')}">
                            <i class="fas fa-bolt"></i>
                        </a>
                    `
                    : "";

                const buttonHtml = `
                    ${quickLoadHtml}
                    <a class="pf2e-prepper-spell-loadouts-manager" data-entry-id="${entry.id}" data-tooltip="${game.i18n.localize('PREPPER.ManageSpellLoadouts')}">
                        <i class="fas fa-scroll"></i>
                    </a>
                `;
                controls.prepend(buttonHtml);
            }

            bindActorSheetHandlers(spellcastingTab, app.actor);
        } catch (e) {
            error('Error adding button to character sheet', e);
        }
   
});
