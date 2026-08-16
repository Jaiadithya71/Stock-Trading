// ============================================================================
// FILE: frontend/js/components/ToastNotification.js
// Modern Dark Glassmorphism Toast Notification & Confirm Modal System
// Replaces blocking browser alert() and confirm() dialogs
// ============================================================================

const ToastNotification = {
  show(message, type = 'info', duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
      `;
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    
    let icon = 'ℹ️';
    let borderColor = '#3b82f6';
    if (type === 'success') { icon = '✅'; borderColor = '#10b981'; }
    if (type === 'error') { icon = '❌'; borderColor = '#ef4444'; }
    if (type === 'warning' || type === 'danger') { icon = '🚨'; borderColor = '#f59e0b'; }

    toast.style.cssText = `
      pointer-events: auto;
      min-width: 280px;
      max-width: 420px;
      background: rgba(15, 23, 42, 0.92);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid ${borderColor};
      border-left: 4px solid ${borderColor};
      border-radius: 12px;
      padding: 14px 18px;
      color: #f8fafc;
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      line-height: 1.4;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      gap: 12px;
      transform: translateX(120%);
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    toast.innerHTML = `
      <span style="font-size: 18px;">${icon}</span>
      <div style="flex: 1;">${message}</div>
    `;

    container.appendChild(toast);

    // Slide in
    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(0)';
    });

    // Auto dismiss
    setTimeout(() => {
      toast.style.transform = 'translateX(120%)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  confirm(message, onConfirm) {
    let overlay = document.getElementById('confirm-modal-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'confirm-modal-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    `;

    overlay.innerHTML = `
      <div style="
        background: rgba(30, 41, 59, 0.95);
        border: 1px solid rgba(239, 68, 68, 0.4);
        border-radius: 16px;
        padding: 24px;
        max-width: 440px;
        width: 100%;
        box-shadow: 0 20px 50px rgba(0,0,0,0.6);
        color: #f8fafc;
        font-family: 'Inter', sans-serif;
      ">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px;">
          <span style="font-size: 28px;">🚨</span>
          <h3 style="margin: 0; font-size: 18px; color: #ef4444;">Confirmation Required</h3>
        </div>
        <p style="font-size: 14px; color: #cbd5e1; margin-bottom: 20px; line-height: 1.5;">${message}</p>
        <div style="display: flex; justify-content: flex-end; gap: 12px;">
          <button id="modal-btn-cancel" style="
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.15);
            color: #f8fafc;
            padding: 8px 16px;
            border-radius: 8px;
            cursor: pointer;
          ">Cancel</button>
          <button id="modal-btn-confirm" style="
            background: #ef4444;
            border: none;
            color: #fff;
            padding: 8px 18px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4);
          ">Confirm Action</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('modal-btn-cancel').onclick = () => overlay.remove();
    document.getElementById('modal-btn-confirm').onclick = () => {
      overlay.remove();
      if (typeof onConfirm === 'function') onConfirm();
    };
  }
};
