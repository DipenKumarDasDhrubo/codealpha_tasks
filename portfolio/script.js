const menuToggle = document.querySelector('.menu-toggle');
const themeToggle = document.querySelector('.theme-toggle');
const siteNav = document.querySelector('.site-nav');
const navLinks = document.querySelectorAll('.site-nav a');
const revealElements = document.querySelectorAll('.reveal');
const tiltTargets = document.querySelectorAll(
  '.project-card, .achievement-card, .skill-card, .resume-preview, .contact-info-panel, .contact-form-card'
);
const yearNode = document.querySelector('#year');
const storageKey = 'portfolio-tone';
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

const setThemeTone = (tone) => {
  document.body.dataset.tone = tone;
  themeToggle?.setAttribute('aria-pressed', String(tone === 'soft'));
};

const storedTone = window.localStorage.getItem(storageKey);
setThemeTone(storedTone === 'soft' ? 'soft' : 'noir');

if (yearNode) {
  yearNode.textContent = new Date().getFullYear();
}

const closeMenu = () => {
  document.body.classList.remove('menu-open');
  siteNav?.classList.remove('is-open');
  menuToggle?.setAttribute('aria-expanded', 'false');
};

menuToggle?.addEventListener('click', () => {
  const isOpen = siteNav?.classList.toggle('is-open') ?? false;
  document.body.classList.toggle('menu-open', isOpen);
  menuToggle.setAttribute('aria-expanded', String(isOpen));
});

navLinks.forEach((link) => {
  link.addEventListener('click', () => {
    closeMenu();
  });
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeMenu();
  }
});

themeToggle?.addEventListener('click', () => {
  const nextTone = document.body.dataset.tone === 'soft' ? 'noir' : 'soft';
  setThemeTone(nextTone);
  window.localStorage.setItem(storageKey, nextTone);
});

const applyTilt = (element) => {
  const maxRotation = 4;

  const resetTilt = () => {
    element.style.transform = '';
  };

  element.addEventListener('mousemove', (event) => {
    const rect = element.getBoundingClientRect();
    const x = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    const y = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1);
    const rotateX = ((0.5 - y) * maxRotation).toFixed(2);
    const rotateY = ((x - 0.5) * maxRotation).toFixed(2);

    element.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
  });

  element.addEventListener('mouseleave', resetTilt);
};

if (!reducedMotionQuery.matches) {
  tiltTargets.forEach((element) => applyTilt(element));
}

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.18,
    rootMargin: '0px 0px -8% 0px',
  }
);

revealElements.forEach((element) => revealObserver.observe(element));
