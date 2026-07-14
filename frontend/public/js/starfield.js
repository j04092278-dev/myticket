function createStarField() {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '0';
  document.body.appendChild(container);

  for (let i = 0; i < 200; i++) {
    const star = document.createElement('div');
    const size = Math.random() * 3 + 1;
    star.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      background: white;
      border-radius: 50%;
      top: ${Math.random() * 100}%;
      left: ${Math.random() * 100}%;
      box-shadow: 0 0 ${Math.random() * 6 + 2}px rgba(255,0,0,0.5);
      animation: twinkle ${Math.random() * 3 + 1}s infinite alternate;
    `;
    container.appendChild(star);
  }

  const style = document.createElement('style');
  style.textContent = `
    @keyframes twinkle {
      0% { opacity: 0.3; transform: scale(0.8); }
      100% { opacity: 1; transform: scale(1.2); }
    }
  `;
  document.head.appendChild(style);
}