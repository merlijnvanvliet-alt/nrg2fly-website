/* ===== HEADER SCROLL EFFECT ===== */
const header = document.querySelector('.site-header');
function handleScroll() {
  if (window.scrollY > 40) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
}
window.addEventListener('scroll', handleScroll, { passive: true });
handleScroll(); // run on load

/* ===== MOBILE MENU TOGGLE ===== */
const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');

if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    hamburger.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', isOpen);
  });

  // Close menu when a link is clicked
  navLinks.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    });
  });

  // Close menu on outside click
  document.addEventListener('click', (e) => {
    if (!header.contains(e.target) && navLinks.classList.contains('open')) {
      navLinks.classList.remove('open');
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    }
  });
}

/* ===== ANIMATED STAT COUNTERS ===== */
function animateCounter(el) {
  const raw = el.getAttribute('data-target');
  const isPercent = raw.includes('%');
  const isPlain = el.hasAttribute('data-format') && el.getAttribute('data-format') === 'plain';
  const target = parseFloat(raw);
  const duration = 1800;
  const start = performance.now();

  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(eased * target);
    const formatted = isPlain ? value.toString() : value.toLocaleString('en');
    el.textContent = formatted + (isPercent ? '%' : '');
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

const statEls = document.querySelectorAll('.stat-number[data-target]');
if (statEls.length > 0 && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  statEls.forEach(el => observer.observe(el));
} else {
  // Fallback: just set values
  statEls.forEach(el => {
    const raw = el.getAttribute('data-target');
    el.textContent = raw;
  });
}

/* ===== CONTACT FORM HANDLER ===== */
const contactForm = document.getElementById('contact-form');
if (contactForm) {
  const SUPABASE_URL = 'https://fygduixgwnrvzckyjmdo.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5Z2R1aXhnd25ydnpja3lqbWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MDYxMzMsImV4cCI6MjA4ODQ4MjEzM30.ZNcuzfHKpvWRJ2q5jJ-N7q8FubU7rm-sJvxixCPCdh8';
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const submitBtn = contactForm.querySelector('button[type="submit"]');

  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.textContent = 'Sending…';
    submitBtn.disabled = true;

    const { error } = await supabase.from('contact_submissions').insert({
      name:         contactForm.name.value.trim(),
      email:        contactForm.email.value.trim(),
      organisation: contactForm.organisation.value.trim() || null,
      subject:      contactForm.subject.value,
      message:      contactForm.message.value.trim(),
    });

    if (error) {
      submitBtn.textContent = 'Something went wrong — try again';
      submitBtn.disabled = false;
      console.error(error);
      return;
    }

    const success = document.getElementById('form-success');
    contactForm.style.display = 'none';
    if (success) success.style.display = 'block';
  });
}

/* ===== SCROLL REVEAL ANIMATIONS ===== */
(function initReveal() {
  if (!('IntersectionObserver' in window)) return;

  // Elements that fade up
  const fadeUp = [
    '.mission .container',
    '.europe-map-overlay',
    '.social-proof .section-label',
    '.social-proof h2',
    '.testimonial-card',
    '.cta-band .container',
    '.network-cta .container',
    '.network-benefits .container > .section-label',
    '.network-benefits .container > h2',
    '.network-benefits .container > p',
    '.network-in-action .container > .section-label',
    '.network-in-action .container > h2',
    '.network-in-action .container > p',
    '.map-image-wrap',
    '.network-how .container > .section-label',
    '.network-how .container > h2',
    '.network-how .container > p',
    '.platform-text',
    '.evolution-text',
    '.team-section .container > .section-label',
    '.team-section .container > h2',
    '.team-section .container > p',
    '.jobs-list .container > p',
    '.contact-info',
    '.contact-form-wrap',
    '.eurocharge-video-wrap',
    '.transition-award-section .section-label',
    '.transition-award-section h2',
    '.transition-award-section .section-intro',
  ];

  // Slide in from left
  const fadeLeft = [
    '.what-visual',
    '.evolution-grid > img',
    '.team-photo-wrap',
    '.team-text',
  ];

  // Slide in from right
  const fadeRight = [
    '.what-cards',
    '.platform-grid > img',
    '.evolution-text',
  ];

  // Scale + fade
  const scaleIn = [
    '.job-card',
    '.stat-item',
    '.award-item',
    '.step',
    '.transition-award-section .video-wrap',
  ];

  // Grid containers that stagger their children
  const staggerParents = [
    '.benefits-grid',
    '.award-strip',
    '.what-cards',
    '.stats-grid',
    '.steps-list',
  ];

  // Card children that get reveal inside stagger parents
  const cardReveal = [
    '.benefit-card',
    '.what-card',
  ];

  function mark(selectors, classes) {
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (!el.classList.contains('js-reveal')) {
          el.classList.add('js-reveal');
          classes.forEach(c => el.classList.add(c));
        }
      });
    });
  }

  mark(fadeUp,    []);
  mark(fadeLeft,  ['from-left']);
  mark(fadeRight, ['from-right']);
  mark(scaleIn,   ['scale-in']);
  mark(cardReveal, []);

  // Mark stagger parents + their direct children
  staggerParents.forEach(sel => {
    document.querySelectorAll(sel).forEach(parent => {
      parent.classList.add('js-stagger');
      Array.from(parent.children).forEach(child => {
        if (!child.classList.contains('js-reveal')) {
          child.classList.add('js-reveal');
        }
      });
    });
  });

  // Observe all .js-reveal elements
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -48px 0px' });

  document.querySelectorAll('.js-reveal').forEach(el => observer.observe(el));
})();

/* ===== VIDEO AUTOPLAY ON SCROLL ===== */
if ('IntersectionObserver' in window) {
  const autoplayVideos = document.querySelectorAll('#eurocharge-video, #award-video');
  if (autoplayVideos.length > 0) {
    const videoObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const video = entry.target;
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.4 });
    autoplayVideos.forEach(v => videoObserver.observe(v));
  }
}

/* ===== ACTIVE NAV LINK ===== */
(function () {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === page || (page === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
})();
