# TODO for pf2e-prepper

## Core Features
- [x] Save current prepared spells to a named list
- [x] Load a saved spell list onto the character
- [x] Support multiple stored spell lists per character
- [x] Update an existing spell list with current preparation
- [x] Delete a spell list
- [x] Rename a spell list
- [x] Duplicate a spell list

## UI/UX
- [x] Add an interface to create a new list
- [x] Add an interface to load a list to current
- [x] Add an interface to update a list to current
- [x] Add an interface to delete a list
- [x] Add an interface to rename a list
- [x] Add an interface to inspect a list
- [-] Add buttons or controls to quickly save/load lists from the character sheet
- [x] Display list metadata (name, description, last used) in the UI
- [x] Confirmation dialogs for destructive actions (delete, overwrite)
- [x] Use foundry.applications.api.ApplicationV2. V1 is deprecated since Version 13
- [x] Use DialogV2 for Dialog windows
- [ ] Extract spell list dialog (for rename etc.) to be a (V2) templated file
- [ ] Tabs handling with proper built-ins (https://foundryvtt.wiki/en/development/guides/applicationV2-conversion-guide)

## Integration :: TI
- [x] 01 Ensure compatibility with all PF2e spellcasting entry types (prepared, flexible, etc.)
- [ ] 02 Make a missing spell send a warning
- [ ] 03 Improved support for readding a missing spell
        make a deleted spell reappear (requires store Compendium item instead of local copy)
- [-] Support for Foundry VTT updates and PF2e system changes

## Data & Storage
- [x] Store lists using actor flags
- [-] Add migration logic for older list formats if needed
- [-] Allow import/export of spell lists (JSON or clipboard)
- [ ] Make the spell lists be _per_ spellcasting entry (in case of multiple applicable spellcasting entry), and move UI button to the relevant entry

## Testing
- [x] Unit tests for PrepperStorage core logic
- [x] Unit tests for spell list deletion
- [ ] UI tests for spell list management

## Documentation
- [ ] Update README with usage instructions and screenshots
- [ ] Document API for module developers

## Stretch Goals
- [ ] Integrate with macros or hotbar for one-click loading

---
*Update this file as features are completed or new tasks are identified.*
