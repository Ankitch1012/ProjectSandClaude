// ui/help-modal.js — Help modal toggle

export function toggleHelp() {
  document.getElementById('helpModal').classList.toggle('open');
}

export function closeHelp() {
  document.getElementById('helpModal').classList.remove('open');
}
