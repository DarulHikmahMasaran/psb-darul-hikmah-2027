export const showToastNotification = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('psb-toast-event', {
        detail: { message: String(message || ''), type },
      })
    );
  }
};

export const confirmAction = (message: string): boolean => {
  showToastNotification(message, 'info');
  return true;
};
