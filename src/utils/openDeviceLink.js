import { toast } from 'react-toastify';

/**
 * Opens a device IP in a new tab and copies the password to clipboard.
 * Browsers block "user:pass@host" URLs, so we open the plain URL and
 * pre-copy the password so the user can paste it into the auth dialog.
 */
export function openDeviceLink(ip, user = 'admin', pass = 'admin') {
  if (!ip) return;
  window.open(`http://${ip}`, '_blank', 'noopener');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(pass).then(() => {
      toast.info(
        `Opening ${ip} — login: ${user} / password copied to clipboard`,
        { autoClose: 4000, icon: '🔗' }
      );
    }).catch(() => {
      toast.info(
        `Opening ${ip} — login: ${user} / ${pass}`,
        { autoClose: 4000, icon: '🔗' }
      );
    });
  } else {
    toast.info(
      `Opening ${ip} — login: ${user} / ${pass}`,
      { autoClose: 4000, icon: '🔗' }
    );
  }
}
