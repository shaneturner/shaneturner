/**
 * Shane Turner Portfolio - Main Application Controller
 * Manages global accessibility preferences (contrast, text scales, theme modes),
 * implements HTML node parsers for Bionic Reading, lines focus overlays,
 * and initializes the Filter Bubble Simulator connections.
 */

document.addEventListener('DOMContentLoaded', () => {

  // ----------------------------------------------------
  // 1. Theme and Preferences Initialization
  // ----------------------------------------------------
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const body = document.body;

  // Theme Toggler
  btnThemeToggle.addEventListener('click', () => {
    if (body.classList.contains('light-theme')) {
      body.classList.remove('light-theme');
      body.classList.add('dark-theme');
      btnThemeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
      localStorage.setItem('theme-preference', 'dark');
    } else {
      body.classList.remove('dark-theme');
      body.classList.add('light-theme');
      btnThemeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
      localStorage.setItem('theme-preference', 'light');
    }
  });

  // Load theme preference
  const savedTheme = localStorage.getItem('theme-preference');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    body.classList.remove('light-theme');
    body.classList.add('dark-theme');
    btnThemeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
  } else {
    body.classList.remove('dark-theme');
    body.classList.add('light-theme');
    btnThemeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
  }


  // ----------------------------------------------------
  // 2. Global Accessibility Drawer Controls
  // ----------------------------------------------------
  const btnA11yToggle = document.getElementById('btn-a11y-menu');
  const a11yDrawer = document.getElementById('a11y-drawer');
  const btnHighContrast = document.getElementById('btn-high-contrast');
  const btnDyslexic = document.getElementById('btn-dyslexic');
  const btnScaleDown = document.getElementById('btn-scale-down');
  const btnScaleUp = document.getElementById('btn-scale-up');
  const textScaleValue = document.getElementById('text-scale-value');
  
  const btnGlobalRuler = document.getElementById('btn-global-ruler');
  const btnGlobalBionic = document.getElementById('btn-global-bionic');

  let textScaleIndex = 0; // 0 = 100%, 1 = 115%, 2 = 130%
  const textScales = ['100%', '115%', '130%'];

  // Toggle A11y Drawer
  btnA11yToggle.addEventListener('click', () => {
    const isExpanded = btnA11yToggle.getAttribute('aria-expanded') === 'true';
    btnA11yToggle.setAttribute('aria-expanded', !isExpanded);
    a11yDrawer.classList.toggle('active');
  });

  // Toggle Contrast Mode
  btnHighContrast.addEventListener('click', () => {
    const isPressed = btnHighContrast.getAttribute('aria-pressed') === 'true';
    btnHighContrast.setAttribute('aria-pressed', !isPressed);
    body.classList.toggle('high-contrast');
    localStorage.setItem('a11y-contrast', !isPressed);
  });

  // Toggle Dyslexic Font Style
  btnDyslexic.addEventListener('click', () => {
    const isPressed = btnDyslexic.getAttribute('aria-pressed') === 'true';
    btnDyslexic.setAttribute('aria-pressed', !isPressed);
    body.classList.toggle('dyslexic-font');
    localStorage.setItem('a11y-dyslexic', !isPressed);
  });

  // Text Scaling Handlers
  btnScaleUp.addEventListener('click', () => {
    if (textScaleIndex < 2) {
      body.classList.remove('text-lg', 'text-xl');
      textScaleIndex++;
      textScaleValue.innerText = textScales[textScaleIndex];
      if (textScaleIndex === 1) body.classList.add('text-lg');
      if (textScaleIndex === 2) body.classList.add('text-xl');
      localStorage.setItem('a11y-scale-idx', textScaleIndex);
    }
  });

  btnScaleDown.addEventListener('click', () => {
    if (textScaleIndex > 0) {
      body.classList.remove('text-lg', 'text-xl');
      textScaleIndex--;
      textScaleValue.innerText = textScales[textScaleIndex];
      if (textScaleIndex === 1) body.classList.add('text-lg');
      localStorage.setItem('a11y-scale-idx', textScaleIndex);
    }
  });

  // Global Overlay Listeners (Triggers equivalent Local Sandbox toolbar states for consistency)
  btnGlobalRuler.addEventListener('click', () => {
    const isPressed = btnGlobalRuler.getAttribute('aria-pressed') === 'true';
    btnGlobalRuler.setAttribute('aria-pressed', !isPressed);
    
    const localRulerBtn = document.getElementById('btn-read-ruler');
    if (localRulerBtn) {
      localRulerBtn.setAttribute('aria-pressed', !isPressed);
      toggleRulerOverlay(!isPressed);
    }
  });

  btnGlobalBionic.addEventListener('click', () => {
    const isPressed = btnGlobalBionic.getAttribute('aria-pressed') === 'true';
    btnGlobalBionic.setAttribute('aria-pressed', !isPressed);
    
    const localBionicBtn = document.getElementById('btn-read-bionic');
    if (localBionicBtn) {
      localBionicBtn.setAttribute('aria-pressed', !isPressed);
      toggleBionicParser(!isPressed);
    }
  });

  // Load Saved Preferences
  if (localStorage.getItem('a11y-contrast') === 'true') {
    btnHighContrast.setAttribute('aria-pressed', 'true');
    body.classList.add('high-contrast');
  }
  if (localStorage.getItem('a11y-dyslexic') === 'true') {
    btnDyslexic.setAttribute('aria-pressed', 'true');
    body.classList.add('dyslexic-font');
  }
  const savedScaleIdx = parseInt(localStorage.getItem('a11y-scale-idx'), 10);
  if (!isNaN(savedScaleIdx) && savedScaleIdx >= 0 && savedScaleIdx <= 2) {
    textScaleIndex = savedScaleIdx;
    textScaleValue.innerText = textScales[textScaleIndex];
    if (textScaleIndex === 1) body.classList.add('text-lg');
    if (textScaleIndex === 2) body.classList.add('text-xl');
  }


  // ----------------------------------------------------
  // 3. Educational Text Reading Aids (Integrated Sandbox)
  // ----------------------------------------------------
  const textBlock = document.getElementById('explanation-text-block');
  const btnReadBionic = document.getElementById('btn-read-bionic');
  const btnReadRuler = document.getElementById('btn-read-ruler');
  const btnReadTldr = document.getElementById('btn-read-tldr');
  
  const textStandardView = document.getElementById('text-standard-view');
  const textSimplifiedView = document.getElementById('text-simplified-view');
  const focusRulerOverlay = document.getElementById('focus-ruler');

  // Cache original HTML structures to prevent layout corruption during parsing
  const cacheOriginalHtml = {
    standard: textStandardView.innerHTML,
    simplified: textSimplifiedView.innerHTML
  };

  // ADHD Focus Ruler Overlay Coordinate Tracking
  function toggleRulerOverlay(isActive) {
    if (isActive) {
      focusRulerOverlay.classList.add('active');
      document.addEventListener('mousemove', updateRulerPosition);
    } else {
      focusRulerOverlay.classList.remove('active');
      document.removeEventListener('mousemove', updateRulerPosition);
    }
  }

  function updateRulerPosition(e) {
    // Offset vertically to sit aligned with line under cursor
    focusRulerOverlay.style.top = `${e.clientY}px`;
  }

  // Bionic Reading Bold Prefix Parsing Engine
  function toggleBionicParser(isActive) {
    if (isActive) {
      textStandardView.innerHTML = applyBionicFormat(cacheOriginalHtml.standard);
      textSimplifiedView.innerHTML = applyBionicFormat(cacheOriginalHtml.simplified);
    } else {
      textStandardView.innerHTML = cacheOriginalHtml.standard;
      textSimplifiedView.innerHTML = cacheOriginalHtml.simplified;
    }
  }

  function applyBionicFormat(htmlStr) {
    const div = document.createElement('div');
    div.innerHTML = htmlStr;

    // Helper text node recursive processor
    const processNodes = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const textVal = node.nodeValue;
        // Split text by space boundaries, preserving whitespace characters
        const words = textVal.split(/(\s+)/);
        const processed = words.map(word => {
          // Format alphanumeric words
          if (/^[a-zA-Z0-9]+$/.test(word)) {
            const length = word.length;
            const prefixLen = length <= 3 ? 1 : Math.ceil(length * 0.4);
            return `<strong class="bionic-bold" style="font-weight: 800; color: var(--text-bionic);">${word.substring(0, prefixLen)}</strong>${word.substring(prefixLen)}`;
          }
          return word;
        });
        
        const wrapper = document.createElement('span');
        wrapper.className = 'bionic-word';
        wrapper.innerHTML = processed.join('');
        node.parentNode.replaceChild(wrapper, node);
      } else {
        const children = Array.from(node.childNodes);
        children.forEach(processNodes);
      }
    };

    Array.from(div.childNodes).forEach(processNodes);
    return div.innerHTML;
  }

  // Bind Sandbox Accessibility Panel events
  btnReadBionic.addEventListener('click', () => {
    const isPressed = btnReadBionic.getAttribute('aria-pressed') === 'true';
    btnReadBionic.setAttribute('aria-pressed', !isPressed);
    btnGlobalBionic.setAttribute('aria-pressed', !isPressed);
    toggleBionicParser(!isPressed);
  });

  btnReadRuler.addEventListener('click', () => {
    const isPressed = btnReadRuler.getAttribute('aria-pressed') === 'true';
    btnReadRuler.setAttribute('aria-pressed', !isPressed);
    btnGlobalRuler.setAttribute('aria-pressed', !isPressed);
    toggleRulerOverlay(!isPressed);
  });

  btnReadTldr.addEventListener('click', () => {
    const isPressed = btnReadTldr.getAttribute('aria-pressed') === 'true';
    btnReadTldr.setAttribute('aria-pressed', !isPressed);

    if (!isPressed) {
      // Transition to simplified TL;DR view
      textStandardView.style.display = 'none';
      textStandardView.classList.remove('active');
      textSimplifiedView.style.display = 'block';
      setTimeout(() => textSimplifiedView.classList.add('active'), 50);
    } else {
      // Transition to standard paragraphs
      textSimplifiedView.style.display = 'none';
      textSimplifiedView.classList.remove('active');
      textStandardView.style.display = 'block';
      setTimeout(() => textStandardView.classList.add('active'), 50);
    }
  });


  // ----------------------------------------------------
  // 4. Initialize Feed Simulator Engine
  // ----------------------------------------------------
  if (document.getElementById('feed-stream')) {
    window.simulator = new FilterBubbleSimulator();

    // Controls
    const btnSimAuto = document.getElementById('btn-sim-auto');
    const btnSimBreak = document.getElementById('btn-sim-break');
    const btnSimReset = document.getElementById('btn-sim-reset');

    btnSimAuto.addEventListener('click', () => {
      window.simulator.toggleAutoplay();
    });

    btnSimBreak.addEventListener('click', () => {
      window.simulator.breakBubble();
    });

    btnSimReset.addEventListener('click', () => {
      window.simulator.reset();
    });
  }


  // ----------------------------------------------------
  // 5. Scroll Section Highlighters & Mobile Nav Slider
  // ----------------------------------------------------
  const navMenu = document.getElementById('nav-menu');
  const btnMobileNav = document.getElementById('btn-mobile-nav');
  const navLinks = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('section');

  // Mobile navigation drawer toggle
  btnMobileNav.addEventListener('click', () => {
    const isExpanded = btnMobileNav.getAttribute('aria-expanded') === 'true';
    btnMobileNav.setAttribute('aria-expanded', !isExpanded);
    navMenu.classList.toggle('active');
    btnMobileNav.classList.toggle('active');
  });

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      btnMobileNav.setAttribute('aria-expanded', 'false');
      navMenu.classList.remove('active');
      btnMobileNav.classList.remove('active');
    });
  });

  // Intersection Observer for Scroll tracking navigation items highlight
  const observerOptions = {
    root: null,
    rootMargin: '-40% 0px -60% 0px',
    threshold: 0
  };

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${id}`) {
            link.classList.add('active');
          }
        });
      }
    });
  }, observerOptions);

  sections.forEach(sec => sectionObserver.observe(sec));


  // ----------------------------------------------------
  // 6. Accessible Contact Form Handling
  // ----------------------------------------------------
  const contactForm = document.getElementById('contact-form');
  const formStatus = document.getElementById('form-status');

  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const submitBtn = contactForm.querySelector('.btn-submit');
      const submitText = submitBtn.querySelector('.btn-text');
      const name = document.getElementById('form-name').value.trim();
      const email = document.getElementById('form-email').value.trim();
      const message = document.getElementById('form-message').value.trim();

      if (!name || !email || !message) {
        formStatus.innerText = "Please complete all mandatory fields (*).";
        formStatus.className = "form-status error";
        return;
      }

      // Enter loading state
      submitBtn.disabled = true;
      submitText.innerText = "Sending Message...";
      formStatus.style.display = "none";

      // Mock network latency of 1.2s
      setTimeout(() => {
        submitBtn.disabled = false;
        submitText.innerText = "Send Message";
        
        // Show success status
        formStatus.innerText = `Thank you, ${name}! Your collaboration query has been received.`;
        formStatus.className = "form-status success";
        
        // Wipe fields
        contactForm.reset();
      }, 1200);
    });
  }

});
