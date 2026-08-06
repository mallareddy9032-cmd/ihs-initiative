/**
 * Working Alert for Chrome / react-native-web (RNW's Alert.alert is a no-op).
 */

type AlertButton = {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

const STYLE_ID = 'ihs-web-alert-styles';

function ensureStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .ihs-alert-root {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(28, 28, 30, 0.35);
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif;
    }
    .ihs-alert-card {
      width: min(360px, 100%);
      background: #ffffff;
      border-radius: 28px;
      border: 1px solid rgba(0, 0, 0, 0.05);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.03);
      overflow: hidden;
    }
    .ihs-alert-body {
      padding: 22px 20px 16px;
    }
    .ihs-alert-title {
      margin: 0 0 8px;
      font-size: 18px;
      font-weight: 800;
      color: #1c1c1e;
    }
    .ihs-alert-message {
      margin: 0;
      font-size: 14px;
      line-height: 1.45;
      color: #8e8e93;
      white-space: pre-wrap;
    }
    .ihs-alert-actions {
      display: flex;
      flex-direction: column;
      border-top: 1px solid rgba(0, 0, 0, 0.05);
    }
    .ihs-alert-btn {
      appearance: none;
      border: 0;
      background: #fff;
      padding: 14px 16px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      color: #007aff;
      border-top: 1px solid rgba(0, 0, 0, 0.05);
      transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .ihs-alert-btn:first-child {
      border-top: 0;
    }
    .ihs-alert-btn:hover {
      background: #f2f2f7;
    }
    .ihs-alert-btn:active {
      transform: scale(0.96);
    }
    .ihs-alert-btn.cancel {
      color: #8e8e93;
      font-weight: 600;
    }
    .ihs-alert-btn.destructive {
      color: #ff2d55;
    }
  `;
  document.head.appendChild(style);
}

function dismiss(root: HTMLElement): void {
  root.remove();
}

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]): void {
    if (typeof document === 'undefined') {
      // eslint-disable-next-line no-console
      console.log('[Alert]', title, message);
      return;
    }

    ensureStyles();
    document.getElementById('ihs-web-alert')?.remove();

    const actions: AlertButton[] =
      buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }];

    const root = document.createElement('div');
    root.id = 'ihs-web-alert';
    root.className = 'ihs-alert-root';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');

    const card = document.createElement('div');
    card.className = 'ihs-alert-card';

    const body = document.createElement('div');
    body.className = 'ihs-alert-body';

    const titleEl = document.createElement('h2');
    titleEl.className = 'ihs-alert-title';
    titleEl.textContent = title || 'IHS';
    body.appendChild(titleEl);

    if (message) {
      const msgEl = document.createElement('p');
      msgEl.className = 'ihs-alert-message';
      msgEl.textContent = message;
      body.appendChild(msgEl);
    }

    const actionsEl = document.createElement('div');
    actionsEl.className = 'ihs-alert-actions';

    actions.forEach((action) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `ihs-alert-btn ${action.style === 'cancel' ? 'cancel' : ''} ${
        action.style === 'destructive' ? 'destructive' : ''
      }`.trim();
      btn.textContent = action.text || 'OK';
      btn.addEventListener('click', () => {
        dismiss(root);
        action.onPress?.();
      });
      actionsEl.appendChild(btn);
    });

    card.appendChild(body);
    card.appendChild(actionsEl);
    root.appendChild(card);
    root.addEventListener('click', (event) => {
      if (event.target === root) {
        const cancel = actions.find((a) => a.style === 'cancel') || actions[actions.length - 1];
        dismiss(root);
        cancel?.onPress?.();
      }
    });

    document.body.appendChild(root);
  },
};

export default Alert;
