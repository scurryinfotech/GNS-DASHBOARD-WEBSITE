// Toast Notification System
const Toast = {
    container: null,

    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    },

    show(options) {
        this.init();

        const {
            type = 'info',
            title = '',
            message = '',
            duration = 3000,
            closable = true
        } = options;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        toast.innerHTML = `
            <div class="toast-icon"></div>
            <div class="toast-content">
                ${title ? `<div class="toast-title">${title}</div>` : ''}
                <div class="toast-message">${message}</div>
            </div>
            ${closable ? '<button class="toast-close" aria-label="Close">×</button>' : ''}
            ${duration > 0 ? '<div class="toast-progress"></div>' : ''}
        `;

        this.container.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);

        if (closable) {
            const closeBtn = toast.querySelector('.toast-close');
            closeBtn.addEventListener('click', () => this.hide(toast));
        }

        if (duration > 0) {
            setTimeout(() => this.hide(toast), duration);
        }

        return toast;
    },

    hide(toast) {
        toast.classList.remove('show');
        toast.classList.add('hide');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.parentElement.removeChild(toast);
            }
        }, 300);
    },

    success(message, title = 'Success') {
        return this.show({ type: 'success', title, message });
    },

    error(message, title = 'Error') {
        return this.show({ type: 'error', title, message });
    },

    warning(message, title = 'Warning') {
        return this.show({ type: 'warning', title, message });
    },

    info(message, title = 'Info') {
        return this.show({ type: 'info', title, message });
    }
};