const EventHandler = {
    // Store registered handlers
    handlers: {},

    // Initialize event delegation on the root element
    init() {
        document.addEventListener('click', (e) => this.handleClick(e));
        document.addEventListener('change', (e) => this.handleChange(e));
        document.addEventListener('submit', (e) => this.handleSubmit(e));
    },

    // Handle click events
    handleClick(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const handler = this.handlers[action];

        if (handler) {
            e.preventDefault();
            handler(e, target);
        }
    },

    // Handle change events (for toggles, selects, etc.)
    handleChange(e) {
        const target = e.target;
        if (!target.dataset.changeAction) return;

        const action = target.dataset.changeAction;
        const handler = this.handlers[action];

        if (handler) {
            handler(e, target);
        }
    },

    // Handle form submissions
    handleSubmit(e) {
        const target = e.target;
        if (!target.dataset.submitAction) return;

        const action = target.dataset.submitAction;
        const handler = this.handlers[action];

        if (handler) {
            e.preventDefault();
            handler(e, target);
        }
    },

    // Register a handler
    on(action, handler) {
        this.handlers[action] = handler;
    },

    // Unregister a handler
    off(action) {
        delete this.handlers[action];
    },

    // Trigger a custom event
    trigger(eventName, detail = {}) {
        const event = new CustomEvent(eventName, { 
            detail,
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(event);
    }
};