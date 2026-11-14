(() => {
  let dialog, trigger;
  const english = () => document.documentElement.lang.startsWith('en');
  function openImage(target) {
    const source = target.dataset.imageSrc || target.getAttribute('src');
    let url;
    try { url = new URL(source, location.href); } catch { return; }
    if (url.protocol !== 'https:' && url.origin !== location.origin) return;
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'readingImageDialog';
      dialog.className = 'reading-image-dialog';
      dialog.setAttribute('aria-labelledby', 'readingImageTitle');
      dialog.innerHTML = '<div class="image-toolbar"><strong id="readingImageTitle"></strong><button type="button" class="image-size" aria-pressed="false"></button><button type="button" class="image-close"></button></div><div class="image-stage"><img alt=""></div><p class="image-caption"></p>';
      document.body.appendChild(dialog);
      dialog.querySelector('.image-close').onclick = () => dialog.close();
      dialog.querySelector('.image-size').onclick = event => {
        const original = dialog.querySelector('.image-stage').classList.toggle('original');
        event.currentTarget.setAttribute('aria-pressed', String(original));
        event.currentTarget.textContent = original ? (english() ? 'Fit to window' : '适应窗口') : (english() ? 'Original size' : '原尺寸查看');
      };
      dialog.onclick = event => { if (event.target === dialog) dialog.close(); };
      dialog.addEventListener('close', () => {
        document.documentElement.classList.remove('media-open');
        trigger?.focus({ preventScroll: true });
      });
    }
    trigger = target;
    const image = dialog.querySelector('img');
    image.src = url.href;
    image.alt = target.dataset.imageAlt || target.querySelector('img')?.alt || target.alt || '';
    dialog.querySelector('#readingImageTitle').textContent = english() ? 'Full source image' : '完整配图';
    dialog.querySelector('.image-caption').textContent = image.alt;
    dialog.querySelector('.image-stage').classList.remove('original');
    const size = dialog.querySelector('.image-size');
    size.setAttribute('aria-pressed', 'false');
    size.textContent = english() ? 'Original size' : '原尺寸查看';
    dialog.querySelector('.image-close').textContent = english() ? 'Close ×' : '关闭 ×';
    document.documentElement.classList.add('media-open');
    dialog.showModal();
  }
  document.addEventListener('click', event => {
    const target = event.target.closest('[data-image-viewer], .story .cover');
    if (!target) return;
    event.preventDefault();
    openImage(target);
  });
  document.addEventListener('keydown', event => {
    if (event.target.matches('.story .cover') && ['Enter', ' '].includes(event.key)) {
      event.preventDefault(); openImage(event.target);
    }
  });
  const enhance = () => document.querySelectorAll('.story .cover:not([role])').forEach(image => {
    image.tabIndex = 0; image.setAttribute('role', 'button');
    image.setAttribute('aria-label', english() ? 'View full source image' : '查看完整配图');
  });
  new MutationObserver(enhance).observe(document.body, { childList: true, subtree: true });
  enhance();
})();
