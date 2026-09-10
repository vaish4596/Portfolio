document.addEventListener('DOMContentLoaded', () => {
  const editor = document.querySelector('.hero-code-window .code-editor');
  if (!editor) return;

  const lines = [...editor.querySelectorAll('.code-line .code-content')];
  if (!lines.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  lines.forEach(line => {
    line.style.clipPath = 'inset(0 100% 0 0)';
  });

  const typeLine = (line, duration) => new Promise(resolve => {
    const animation = line.animate(
      [
        { clipPath: 'inset(0 100% 0 0)' },
        { clipPath: 'inset(0 0% 0 0)' }
      ],
      {
        duration,
        easing: `steps(${Math.max(12, Math.ceil(line.textContent.trim().length / 1.5))}, end)`,
        fill: 'forwards'
      }
    );
    animation.onfinish = resolve;
  });

  const runTyping = async () => {
    while (true) {
      lines.forEach(line => {
        line.getAnimations().forEach(animation => animation.cancel());
        line.style.clipPath = 'inset(0 100% 0 0)';
      });

      for (const line of lines) {
        await typeLine(line, Math.min(1700, Math.max(500, line.textContent.trim().length * 28)));
        await new Promise(resolve => setTimeout(resolve, 180));
      }

      await new Promise(resolve => setTimeout(resolve, 2200));
    }
  };

  runTyping();
});
