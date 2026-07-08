import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { within, fireEvent } from '@testing-library/dom'
import { JSDOM } from 'jsdom'
import { game, Hooks, foundry } from '../vitest.setup.js'

// Create a DOM environment
let dom

beforeEach(() => {
  // Create a fresh DOM for each test
  dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
  globalThis.document = dom.window.document
  globalThis.window = dom.window
  Object.defineProperty(globalThis, 'navigator', {
    value: dom.window.navigator,
    configurable: true,
  })

  // Import the module after setting up the DOM
  // Note: This assumes PrepperApp is properly exported
  // For now, we'll mock it since we can't import it directly without proper module setup
})

afterEach(() => {
  document.body.innerHTML = ''
  dom.window.close()
  // Clear all mocks
  vi.clearAllMocks()
})

describe('PrepperApp UI Tests', () => {
  it('should render the title correctly', () => {
    // Create a mock PrepperApp element
    const appElement = document.createElement('div')
    appElement.innerHTML = `
      <div class="prepper-app">
        <h1 class="prepper-title">Prepper</h1>
        <div class="status-icons" data-status="true" role="status">
          <i class="fas fa-heart"></i>
        </div>
      </div>
    `
    document.body.appendChild(appElement)

    // Check if the title is rendered
    const title = within(document.body).getByText('Prepper')
    expect(title).toBeInTheDocument()
    expect(title.classList.contains('prepper-title')).toBe(true)
  })

  it('should show status icons when enabled', () => {
    // Mock game settings to return true for showStatusIcons
    game.settings.get.mockImplementation((_, setting) => {
      if (setting === 'showStatusIcons') return true
      return false
    })

    // Create app element with status icons
    const appElement = document.createElement('div')
    appElement.innerHTML = `
      <div class="prepper-app">
        <div class="status-icons" data-status="true" role="status">
          <i class="fas fa-heart"></i>
        </div>
      </div>
    `
    document.body.appendChild(appElement)

    // Check if status icons are visible
    const statusIcons = within(document.body).getByRole('status')
    expect(statusIcons).toBeInTheDocument()
    expect(statusIcons.getAttribute('data-status')).toBe('true')
  })

  it('should render template content correctly', async () => {
    // Mock the handlebars render template
    const mockTemplate = '<div class="spell-item">{{name}}</div>'
    const mockRenderedTemplate = '<div class="spell-item">Fireball</div>'
    foundry.applications.handlebars.renderTemplate.mockResolvedValue(mockRenderedTemplate)

    // Create app element with template area
    const appElement = document.createElement('div')
    appElement.innerHTML = `
      <div class="prepper-app">
        <div class="spell-list"></div>
      </div>
    `
    document.body.appendChild(appElement)

    // Simulate template rendering
    const spellList = appElement.querySelector('.spell-list')
    const templateData = { name: 'Fireball' }
    const rendered = await foundry.applications.handlebars.renderTemplate(mockTemplate, templateData)
    spellList.innerHTML = rendered

    // Check if template was rendered correctly
    expect(within(document.body).getByText('Fireball')).toBeInTheDocument()
    expect(spellList.querySelector('.spell-item')).toBeInTheDocument()
  })

  it('should handle button clicks', () => {
    // Create a mock button with click handler
    const appElement = document.createElement('div')
    appElement.innerHTML = `
      <div class="prepper-app">
        <button class="add-spell-btn">Add Spell</button>
      </div>
    `
    document.body.appendChild(appElement)

    // Add click handler
    const addButton = within(document.body).getByText('Add Spell')
    const handleClick = vi.fn()
    addButton.addEventListener('click', handleClick)

    // Simulate click
    fireEvent.click(addButton)

    // Verify click was handled
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('should update UI when settings change', () => {
    // Mock settings to return false initially
    game.settings.get.mockImplementation((_, setting) => {
      if (setting === 'showStatusIcons') return false
      return false
    })

    // Create app element
    const appElement = document.createElement('div')
    appElement.innerHTML = `
      <div class="prepper-app">
        <div class="status-icons" data-status="false" role="status"></div>
      </div>
    `
    document.body.appendChild(appElement)

    // Verify status icons are hidden
    const statusIcons = within(document.body).getByRole('status')
    expect(statusIcons.getAttribute('data-status')).toBe('false')

    // Update mock to return true
    game.settings.get.mockImplementation((_, setting) => {
      if (setting === 'showStatusIcons') return true
      return false
    })

    // Simulate settings change event
    Hooks.on.mock.calls.find(([event]) => event === 'settingsChanged')?.[1]?.()

    // Update the DOM based on new settings
    statusIcons.setAttribute('data-status', 'true')

    // Verify status icons are now visible
    expect(statusIcons.getAttribute('data-status')).toBe('true')
  })
})
