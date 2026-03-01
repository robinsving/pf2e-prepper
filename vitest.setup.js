// Mock the Application class
global.Application = class {
    constructor() {
        this.options = {};
    }
    render(force = false) {
        console.log("Mock render called with force:", force);
    }
    static get defaultOptions() {
        return {};
    }
};

// Mock the global game object
global.game = {
    settings: {
        get: vi.fn((module, setting) => {
            if (setting === "showStatusIcons") return true; // Enable status icons
            return false;
        }),
    },
    modules: {
        get: vi.fn(() => ({
            api: { },
        })),
    },
    combats: [
        {
            active: true,
            round: 3,
        },
    ],
    user: {
        isGM: true,
    },
};

// Mock the Hooks object
global.Hooks = {
    on: vi.fn(),
    once: vi.fn(),
    callAll: vi.fn(),
};

// Mock the foundry object
global.foundry = {
    utils: {
        randomID: vi.fn(() => `id_${Math.random().toString(36).substring(2, 9)}`), // Generate a random ID
    },
};

/*
// Mock the Handlebars object
global.Handlebars = {
    registerHelper: vi.fn((name, fn) => {
        console.log(`Mock Handlebars helper registered: ${name}`);
    }),
    compile: vi.fn((template) => {
        console.log("Mock Handlebars template compiled");
        return (context) => `Mock template output for context: ${JSON.stringify(context)}`;
    }),
};*/
