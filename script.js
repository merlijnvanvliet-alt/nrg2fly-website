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
    if (!header.contains(e.target) && !navLinks.contains(e.target) && navLinks.classList.contains('open')) {
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

    const els = contactForm.elements;
    const { error } = await supabase.from('contact_submissions').insert({
      name:         els['name'].value.trim(),
      email:        els['email'].value.trim(),
      organisation: els['organisation'].value.trim() || null,
      subject:      els['subject'].value,
      message:      els['message'].value.trim(),
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

/* ===== SITE SEARCH ===== */
const SEARCH_INDEX = [
  // Home
  { title: 'Home', page: 'Home', url: 'index.html', body: 'electric aviation infrastructure Europe 4200 airports charging mission' },
  { title: 'Our Mission', page: 'Home', url: 'index.html#mission', body: 'airports prepare electric traffic energy hubs transition climate infrastructure' },
  { title: 'Project Eurocharge', page: 'Home', url: 'index.html', body: 'pan-European charging standards interoperability Elaad OEM manufacturers standardisation' },
  { title: 'Infrastructure Assessment', page: 'Home', url: 'index.html', body: 'audit airport infrastructure electric aircraft charging scale assessment' },
  { title: 'Energy Hub Development', page: 'Home', url: 'index.html', body: 'grid connections renewable energy contracts battery storage self-sufficient energy hubs' },
  { title: 'Regulatory & Operational Support', page: 'Home', url: 'index.html', body: 'regulatory landscape electric aviation guidance experts operational frameworks' },
  { title: 'Network & Partnerships', page: 'Home', url: 'index.html', body: 'airports manufacturers airlines energy providers ecosystem regional electric aviation' },
  { title: 'Partners & Investors', page: 'Home', url: 'index.html', body: 'Fastned Horizon Maxem Future Friendly Fund Electric Flying Connection partners investors' },
  { title: 'ChangeInc Transition Award 2025', page: 'Home', url: 'index.html', body: 'ChangeInc award 2025 sustainability Netherlands innovator energy transition recognition' },
  // About
  { title: 'About & Team', page: 'About', url: 'about.html', body: 'multidisciplinary team aviation energy technology experts electric aviation Europe people' },
  { title: 'Jacco Bink — Consulting Director', page: 'About', url: 'about.html', body: 'KLM Alliander aviation energy systems consulting director charging infrastructure Netherlands' },
  { title: 'Merlijn van Vliet — Partnerships Director', page: 'About', url: 'about.html', body: 'E-Flight Academy Electric Flying Connection brand strategy partnerships director pilot' },
  { title: 'Tristan Oppeneer — Charging Infra Consultant', page: 'About', url: 'about.html', body: 'charging infrastructure standardisation open protocols interoperability standards pilot consultant' },
  { title: 'Giel Jan Koek — E-Aviation Consultant', page: 'About', url: 'about.html', body: 'aviation consultant operational processes Commercial Pilot License Teuge Airport electric' },
  { title: 'Ed Meijer — Technical Consultant', page: 'About', url: 'about.html', body: 'IT infrastructure project management energy installations technical consultant airports' },
  { title: 'Tessa Jongerius — Intern', page: 'About', url: 'about.html', body: 'intern sustainable transformation aviation pilot emerging professional' },
  { title: 'Jurjen de Jong — Founder', page: 'About', url: 'about.html', body: 'GreenFlux eMobility 150 million charging sessions co-founded NRG2fly 2022 Electric Flying Connection Accenture' },
  { title: 'Maarten Steinbuch — Founder', page: 'About', url: 'about.html', body: 'TU/e professor scientist e-mobility sustainability keynote speaker Eindhoven Engine serial entrepreneur' },
  { title: 'Jeroen Kroonen — Founder', page: 'About', url: 'about.html', body: 'sustainable mobility airport energy systems grid solar Noord-Brabant co-founder Provincie' },
  // News
  { title: 'News', page: 'News', url: 'news.html', body: 'nieuws updates milestones partnerships awards press events NRG2fly electric aviation' },
  // Network
  { title: 'Join the Network', page: 'Network', url: 'network.html', body: 'NRG2fly network airports energy providers aviation experts electric aviation infrastructure join' },
  { title: 'Network Benefits', page: 'Network', url: 'network.html', body: 'expertise partnerships funding opportunities electric aviation sector member access benefits' },
  // Jobs
  { title: 'Job Openings', page: 'Jobs', url: 'jobs.html', body: 'careers team NRG2fly electric aviation Europe Lelystad Teuge Airport vacatures' },
  { title: 'Regional Director — Belgium & France', page: 'Jobs', url: 'jobs.html#regional-director-belgium-france', body: 'Belgium France market strategy airport operators DGAC French Dutch full-time remote' },
  { title: 'Regional Director — Scandinavia', page: 'Jobs', url: 'jobs.html#regional-director-scandinavia', body: 'Denmark Norway Sweden Finland Nordic Avinor Swedavia Finavia electric aviation full-time remote' },
  { title: 'Regional Director — DACH', page: 'Jobs', url: 'jobs.html#regional-director-dach', body: 'Germany Austria Switzerland DACH airports ADV DFS renewable energy infrastructure full-time remote' },
  { title: 'Aviation Energy Consultant', page: 'Jobs', url: 'jobs.html#aviation-energy-consultant', body: 'Lelystad Teuge Airport energy infrastructure assessment charging electric aircraft grid full-time' },
  // Contact
  { title: 'Contact', page: 'Contact', url: 'contact.html', body: 'get in touch question network job opening partnership message jacco@nrg2fly.com Lelystad Teuge' },
];

(function initSearch() {
  const toggleBtn = document.getElementById('search-toggle');
  const overlay = document.getElementById('search-overlay');
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  const closeBtn = document.getElementById('search-close');

  if (!toggleBtn || !overlay) return;

  const hint = '<p class="search-hint">Type to search pages, sections, and team members…</p>';

  function openSearch() {
    overlay.classList.add('open');
    results.innerHTML = hint;
    input.focus();
    document.body.style.overflow = 'hidden';
  }

  function closeSearch() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    input.value = '';
    results.innerHTML = '';
  }

  toggleBtn.addEventListener('click', openSearch);
  closeBtn.addEventListener('click', closeSearch);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeSearch();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) {
      closeSearch();
    }
    if ((e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key === 'k')) && !overlay.classList.contains('open')) {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      openSearch();
    }
  });

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { results.innerHTML = hint; return; }

    const matches = SEARCH_INDEX.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.body.toLowerCase().includes(q) ||
      item.page.toLowerCase().includes(q)
    );

    if (matches.length === 0) {
      results.innerHTML = '<p class="search-no-results">No results found.</p>';
      return;
    }

    results.innerHTML = matches.map(item =>
      `<a class="search-result-item" href="${item.url}">
        <p class="search-result-page">${item.page}</p>
        <p class="search-result-title">${item.title}</p>
      </a>`
    ).join('');
  });
})();

/* ===== HOMEPAGE LATEST NEWS ===== */
(function () {
  const grid = document.getElementById('homepage-news');
  if (!grid) return;

  const CATEGORY_ICONS = { Award:'🏆', Partnership:'🤝', Product:'⚡', Event:'📅', Press:'📰', Update:'🔔' };

  function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  fetch('news-data.json')
    .then(r => r.json())
    .then(articles => {
      if (!articles.length) { grid.parentElement.parentElement.style.display = 'none'; return; }
      grid.innerHTML = articles.slice(0, 3).map(a => `
        <a class="news-card" href="news/${a.slug}.html">
          ${a.image ? `<img class="news-card-img" src="${a.image}" alt="${a.title}" loading="lazy" />` : `<div class="news-card-img-placeholder">${CATEGORY_ICONS[a.category] || '📰'}</div>`}
          <div class="news-card-body">
            <div class="news-card-meta">
              ${a.category ? `<span class="news-badge news-badge--${a.category}">${a.category}</span>` : ''}
              <span class="news-card-date">${formatDate(a.date)}</span>
            </div>
            <h3 class="news-card-title">${a.title}</h3>
            ${a.intro ? `<p class="news-card-intro">${a.intro}</p>` : ''}
          </div>
        </a>`).join('');
    })
    .catch(() => { grid.parentElement.parentElement.style.display = 'none'; });
})();

/* ===== NEWS SEARCH INTEGRATION ===== */
(function () {
  // Fetch news-data.json and add articles to the search index
  const newsDataUrl = location.pathname.includes('/news/') ? '../news-data.json' : 'news-data.json';
  fetch(newsDataUrl)
    .then(r => r.json())
    .then(articles => {
      articles.forEach(a => {
        SEARCH_INDEX.push({
          title: a.title,
          page: 'News',
          url: `news/${a.slug}.html`,
          body: [a.category, a.intro, a.body].filter(Boolean).join(' '),
        });
      });
    })
    .catch(() => {});
})();
