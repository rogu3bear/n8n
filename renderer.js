// Renderer process script
class AppRenderer {
    constructor() {
        this.initialized = false;
        this.eventListeners = new Map();
        this.init();
    }

    async init() {
        try {
            await this.initializeTheme();
            this.setupEventListeners();
            this.setupN8nStatusHandling();
            this.setupWorkflowManagement();
            this.initialized = true;
            console.log('App renderer initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app renderer:', error);
            this.handleError(error);
        }
    }

    async initializeTheme() {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.classList.toggle('dark', prefersDark);

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            document.body.classList.toggle('dark', e.matches);
            this.updateThemeIcon(e.matches);
        });
    }

    setupEventListeners() {
        // Theme toggle
        const themeToggle = document.getElementById('theme-toggle');
        const themeIcon = document.getElementById('theme-icon');
        if (themeToggle) {
            this.addEventListener(themeToggle, 'click', () => {
                document.body.classList.toggle('dark');
                this.updateThemeIcon(document.body.classList.contains('dark'));
            });
        }

        // Navigation
        const navLinks = document.querySelectorAll('.nav-link');
        const sections = document.querySelectorAll('.content-section');
        const sectionTitle = document.getElementById('section-title');

        navLinks.forEach(link => {
            this.addEventListener(link, 'click', (e) => {
                e.preventDefault();
                const targetSection = link.getAttribute('data-section');
                
                sections.forEach(section => {
                    section.style.display = section.id === `${targetSection}-section` ? 'block' : 'none';
                });
                
                if (sectionTitle) {
                    sectionTitle.textContent = targetSection.charAt(0).toUpperCase() + targetSection.slice(1);
                }
                
                navLinks.forEach(l => l.classList.remove('bg-gray-200', 'dark:bg-gray-700'));
                link.classList.add('bg-gray-200', 'dark:bg-gray-700');
            });
        });

        // Quick actions
        const quickActions = document.querySelectorAll('.quick-action');
        quickActions.forEach(action => {
            this.addEventListener(action, 'click', () => {
                const actionType = action.getAttribute('data-action');
                this.handleQuickAction(actionType);
            });
        });

        // Setup modal
        window.api.showOptionalSetupPrompt(() => {
            const setupModal = document.getElementById('setup-modal');
            if (setupModal) {
                setupModal.classList.remove('hidden');
            }
        });

        // Refresh button
        const refreshButton = document.getElementById('refresh-executions');
        if (refreshButton) {
            this.addEventListener(refreshButton, 'click', () => this.updateWorkflowsList());
        }
    }

    setupN8nStatusHandling() {
        const launchEditorBtn = document.getElementById('launch-editor');
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-text');

        window.api.onN8nStatusUpdate((status) => {
            // Status update with stage information
            const { stage, code, port } = status;
            console.log(`n8n Status Update: ${stage}${port ? ` (Port: ${port})` : ''}${code ? ` (Code: ${code})` : ''}`);
            
            switch(stage) {
                case 'port_check':
                    statusDot?.classList.remove('bg-green-500', 'bg-red-500');
                    statusDot?.classList.add('bg-yellow-500', 'animate-pulse');
                    statusText.textContent = 'Checking ports...';
                    launchEditorBtn.disabled = true;
                    break;
                case 'spawning':
                    statusDot?.classList.remove('bg-green-500', 'bg-red-500');
                    statusDot?.classList.add('bg-yellow-500', 'animate-pulse');
                    statusText.textContent = `Starting n8n on port ${port}...`;
                    launchEditorBtn.disabled = true;
                    break;
                case 'running':
                    statusDot?.classList.remove('bg-yellow-500', 'bg-red-500', 'animate-pulse');
                    statusDot?.classList.add('bg-green-500');
                    statusText.textContent = `Running on port ${port}`;
                    launchEditorBtn.disabled = false;
                    break;
                case 'stopped':
                    statusDot?.classList.remove('bg-green-500', 'bg-yellow-500', 'animate-pulse');
                    statusDot?.classList.add('bg-red-500');
                    statusText.textContent = `Stopped (Code: ${code || 'unknown'})`;
                    launchEditorBtn.disabled = true;
                    break;
                default:
                    statusDot?.classList.remove('bg-green-500', 'bg-red-500');
                    statusDot?.classList.add('bg-yellow-500', 'animate-pulse');
                    statusText.textContent = 'Initializing...';
                    launchEditorBtn.disabled = true;
            }
        });

        window.api.onN8nInitInfo((info) => {
            const { port, alreadyRunning } = info;
            console.log(`n8n Init Info: Port ${port}, Already running: ${alreadyRunning}`);
            
            statusDot?.classList.remove('bg-yellow-500', 'bg-red-500', 'animate-pulse');
            statusDot?.classList.add('bg-green-500');
            statusText.textContent = `Running on port ${port}`;
            launchEditorBtn.disabled = false;
        });

        window.api.onN8nInitError((error) => {
            console.error('n8n initialization error:', error);
            
            statusDot?.classList.remove('bg-yellow-500', 'bg-green-500', 'animate-pulse');
            statusDot?.classList.add('bg-red-500');
            statusText.textContent = `Error: ${error.message || 'Unknown error'}`;
            launchEditorBtn.disabled = true;
            
            this.handleError(error);
        });
    }

    setupWorkflowManagement() {
        window.api.onWorkflowsReceived((event, workflows) => {
            const activeWorkflowsCount = document.getElementById('active-workflows-count');
            if (activeWorkflowsCount) {
                activeWorkflowsCount.textContent = workflows.filter(w => w.active).length;
            }
            this.updateWorkflowsList(workflows);
        });

        // Initial data load
        this.updateWorkflowsList();
    }

    handleQuickAction(actionType) {
        switch(actionType) {
            case 'create-workflow':
                window.api.runWorkflow('new');
                break;
            case 'import-workflow':
                window.api.importWorkflow();
                break;
            case 'browse-templates':
                document.querySelector('[data-section="agents"]')?.click();
                break;
            case 'view-logs':
                document.querySelector('[data-section="logs"]')?.click();
                break;
            default:
                console.warn(`Unknown quick action: ${actionType}`);
        }
    }

    updateWorkflowsList(workflows = null) {
        if (!workflows) {
            window.api.getWorkflows();
        }
    }

    updateThemeIcon(isDark) {
        const themeIcon = document.getElementById('theme-icon');
        if (themeIcon) {
            themeIcon.textContent = isDark ? '☀️' : '🌙';
        }
    }

    addEventListener(element, event, handler) {
        if (!this.eventListeners.has(element)) {
            this.eventListeners.set(element, new Map());
        }
        const elementListeners = this.eventListeners.get(element);
        if (!elementListeners.has(event)) {
            elementListeners.set(event, handler);
            element.addEventListener(event, handler);
        }
    }

    handleError(error) {
        console.error('Application error:', error);
        // You could add error reporting or user notification here
    }
}

// Initialize the app when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.appRenderer = new AppRenderer();
}); 