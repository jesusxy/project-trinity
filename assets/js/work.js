/* Optional Work-index enhancement. Project links always retain native navigation. */
(() => {
  const index = document.querySelector('.work-index');
  if (!index) return;
  const preview = index.querySelector('.work-preview');
  const rest = index.querySelector('.work-preview-rest');
  const label = index.querySelector('[data-preview-label]');
  const close = index.querySelector('.work-preview-close');
  const entries = [...index.querySelectorAll('[data-preview]')];
  const panels = [...index.querySelectorAll('.work-preview-panel')];
  const compact = window.matchMedia('(max-width: 900px)');
  const hover = window.matchMedia('(hover: hover)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let active = null;
  let restoringFocus = false;

  function show(entry) {
    if (restoringFocus || active === entry) return;
    const panel = document.getElementById(entry.dataset.preview);
    if (!panel) return;
    active = entry;
    for (const candidate of panels) candidate.hidden = candidate !== panel;
    for (const candidate of entries) {
      candidate.classList.toggle('is-previewed', candidate === entry);
      candidate.querySelector('button').setAttribute('aria-expanded', String(candidate === entry));
    }
    label.textContent = panel.dataset.label;
    rest.hidden = true;
    close.hidden = false;
    preview.classList.add('is-open');
  }

  function hide() {
    if (!active) return;
    // Keep focus on a visible control when closing from within the preview.
    if (preview.contains(document.activeElement)) {
      restoringFocus = true;
      active.querySelector('button').focus({preventScroll: true});
      restoringFocus = false;
    }
    active = null;
    for (const panel of panels) panel.hidden = true;
    for (const entry of entries) {
      entry.classList.remove('is-previewed');
      entry.querySelector('button').setAttribute('aria-expanded', 'false');
    }
    label.textContent = '';
    close.hidden = true;
    rest.hidden = false;
    preview.classList.remove('is-open');
  }

  for (const entry of entries) {
    entry.addEventListener('pointerenter', event => {
      if (hover.matches && !compact.matches && event.pointerType !== 'touch') show(entry);
    });
    entry.addEventListener('focusin', event => {
      // On narrow screens, an explicit press opens the preview below the list.
      if (!compact.matches && event.target.matches('a')) show(entry);
    });
    const button = entry.querySelector('button');
    button.addEventListener('click', () => {
      show(entry);
      if (compact.matches) preview.scrollIntoView({block: 'nearest', behavior: reducedMotion.matches ? 'instant' : 'smooth'});
    });
    button.hidden = false;
  }
  close.addEventListener('click', hide);
  index.addEventListener('keydown', event => {
    if (event.key === 'Escape' && active) {
      event.preventDefault();
      hide();
    }
  });
  // Retain the last preview across pointer movement so it can be examined or dismissed.
  preview.hidden = false;
  index.classList.add('has-preview');
})();
