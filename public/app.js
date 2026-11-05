document.querySelectorAll('[data-copy]').forEach(button => {
  button.addEventListener('click', async () => {
    const input = document.getElementById(button.dataset.copy);
    if (!input) return;
    const value = input.value;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        input.focus();
        input.select();
        document.execCommand('copy');
      }
      const original = button.textContent;
      button.textContent = 'تم النسخ';
      setTimeout(() => { button.textContent = original; }, 1600);
    } catch {
      input.focus();
      input.select();
    }
  });
});
