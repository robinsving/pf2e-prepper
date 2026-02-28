import { id as SCRIPT_ID } from '../module.json'
import PrepperStorage from "./PrepperStorage.js";
import PrepperApp from "./PrepperApp.js";
import { info, error, popup } from "./utilities/Utilities.js";

// Create API for other modules to use
const API = {
    PrepperStorage: PrepperStorage,
    PrepperApp: (actor) => new PrepperApp(actor).render(true)
};

// Initialize the module when Foundry is ready
Hooks.once('init', () => {
    info('Initializing PF2e Multiple Spell Lists module');
    
    // Register module settings
    game.settings.register(SCRIPT_ID, 'debugMode', {
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
    game.modules.get(SCRIPT_ID).api = API;
    
    info('PF2e Multiple Spell Lists module initialized');
});

// Add button to character sheet
Hooks.on('renderActorSheet', (app, html, _) => {
    try {
        // Check if the module is enabled
        if (!game.modules.get(SCRIPT_ID)) return;

        // Only add to PF2e character sheets
        if (app.actor.type !== 'character') return;
        
        // Check if the actor has spellcasting entries
        const spellcastingEntries = app.actor.itemTypes.spellcastingEntry || [];
        const hasPreparedCaster = spellcastingEntries.some(entry => 
            entry.system.prepared?.value === 'prepared');
            
            if (!hasPreparedCaster) return;
            
            // Log for debugging
            info('Found prepared caster, adding button');
            
            // Find the spellcasting tab content
            const spellcastingTab = html.find('.tab[data-tab="spellcasting"]');
            if (spellcastingTab.length === 0) {
                info('Spellcasting tab not found');
                return;
            }
            
            // Try multiple selectors to find a good place for the button
            let buttonContainer = spellcastingTab.find('.tab-header').first();
            if (buttonContainer.length === 0) {
                buttonContainer = spellcastingTab.find('.spellcasting-header').first();
            }
            if (buttonContainer.length === 0) {
                buttonContainer = spellcastingTab.find('header').first();
            }
            if (buttonContainer.length === 0) {
                // If no suitable container found, add to the top of the tab
                buttonContainer = spellcastingTab;
            }
            
            // Add the button to manage spell lists
            const buttonHtml = `
                <button type="button" class="spell-lists-manager" style="background: #782e22; color: white; border: none; border-radius: 4px; padding: 4px 8px; margin: 5px; cursor: pointer;">
                    <i class="fas fa-book-spells"></i> ${game.i18n.localize('PREPPER.ManageSpellLists')}
                </button>
                `;
            
            // Add the button to the container
            buttonContainer.prepend(buttonHtml);
            
            // Log for debugging
            info('Button added to', buttonContainer);
            
            // Add click handler
            html.find('.spell-lists-manager').click(ev => {
                ev.preventDefault();
                new PrepperApp(app.actor).render(true);
            });
        } catch (e) {
            error('Error adding button to character sheet', e);
        }
    });
