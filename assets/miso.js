const misoToggle = document.querySelector('.miso-toggle');

if (misoToggle) {
  let pinned = false;
  let hovered = false;
  const update = () => {
    misoToggle.classList.toggle('is-showing-photo', pinned || hovered);
    misoToggle.setAttribute('aria-pressed', String(pinned));
    misoToggle.setAttribute('aria-label', pinned ? 'Show illustration of the Miso bar' : 'Show photo of the Miso bar');
  };
  misoToggle.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'mouse') return;
    hovered = true;
    update();
  });
  misoToggle.addEventListener('pointerleave', () => {
    hovered = false;
    update();
  });
  misoToggle.addEventListener('click', () => {
    pinned = !pinned;
    hovered = false;
    update();
  });
}
