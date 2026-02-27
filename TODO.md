# TODO for pf2e-prepper

## Core Features
- [x] Save current prepared spells to a named list
- [x] Load a saved spell list onto the character
- [x] Support multiple stored spell lists per character
- [x] Update an existing spell list with current preparation
- [x] Delete a spell list
- [x] Rename a spell list
- [x] Duplicate a spell list
- [ ] Handle flexible spellcasters: spell information is not same as prepared, but instead information of preparation exists in the spells themselves: entry.spells.{key is Id}.value.system.location.signature = true name. Perhaps investigate docs to see if there are quick functions to add spells faster.

## UI/UX
- [x] Add an interface to create a new list
- [x] Add an interface to load a list to current
- [ ] Add an interface to update a list to current
- [ ] Add an interface to delete a list
- [x] Add an interface to rename a list
- [x] Add an interface to inspect a list
- [-] Add buttons or controls to quickly save/load lists from the character sheet
- [x] Display list metadata (name, description, last used) in the UI
- [ ] Confirmation dialogs for destructive actions (delete, overwrite)
- [ ] foundry.applications.api.ApplicationV2. Deprecated since Version 13

## Integration
- [ ] Ensure compatibility with all PF2e spellcasting entry types (prepared, flexible, etc.)
- [-] Handle edge cases for multiclass
- [-] Support for Foundry VTT updates and PF2e system changes

## Data & Storage
- [x] Store lists using actor flags
- [-] Add migration logic for older list formats if needed
- [-] Allow import/export of spell lists (JSON or clipboard)

## Testing
- [x] Unit tests for PrepperStorage core logic
- [x] Unit tests for spell list deletion
- [ ] UI tests for spell list management
- [ ] Manual testing in Foundry VTT environment

## Documentation
- [ ] Update README with usage instructions and screenshots
- [ ] Document API for module developers

## Stretch Goals
- [ ] Allow sharing spell lists between actors or users
- [ ] Add sorting/filtering/search for lists
- [ ] Integrate with macros or hotbar for one-click loading

---
*Update this file as features are completed or new tasks are identified.*
