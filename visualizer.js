class FilterBubbleSimulator {
  constructor() {
    this.feedStream = document.getElementById('feed-stream');
    this.biasFill = document.getElementById('bias-gauge-fill');
    this.biasStatus = document.getElementById('bias-status-desc');
    this.slider = document.getElementById('personalization-slider');
    this.sliderVal = document.getElementById('personalization-value');
    this.bubbleStatusEl = document.getElementById('stat-lockin');

    if (!this.feedStream) return;

    this.weights = { read: 1, like: 2, dislike: -2, repost: 4 };
    this.userWeights = { nature: 5, cities: 5 };
    this.personalization = 0.7;
    this.stats = { reads: 0, likes: 0, dislikes: 0, reposts: 0 };
    this.postIdCounter = 0;
    this.postsState = {};
    this.autoplayTimer = null;
    this.isAutoplay = false;
    this.biasHistory = [];
    this.engagementCount = 0;
    this.bubbleLockedAt = null;
    this.simTimeOffset = 0;
    this.scrollObserver = null;
    this.lastObservedCard = null;
    this.charts = { drift: null, split: null, engagement: null };

    this.articlesPool = {
      nature: [
        { title: "NZ Native Forest Preservation Projects Expand", summary: "A new conservation initiative aims to restore over 10,000 hectares of native podocarp forest in the Southern Alps, using satellite seed mapping.", author: "EcoAnalytics NZ", tag: "Conservation" },
        { title: "Saving the Kiwi: Visual Conservation Pipelines", summary: "Researchers use trail cameras and cloud classification models to monitor kiwi populations across Aotearoa in real-time.", author: "DataWild Foundation", tag: "Forestry" },
        { title: "The Mathematical Models Protecting Coastal Ecosystems", summary: "Marine researchers model wave dynamics to design non-intrusive coastal barriers, visualising results in open dashboards.", author: "Dr. Clara Hens", tag: "Ecology" },
        { title: "Rewilding New Zealand Forests: An Open Data Study", summary: "Analysis of tree planting distributions shows native species significantly improve soil moisture retention across alpine regions.", author: "Forestry Review", tag: "Open Science" },
        { title: "Why Wetlands Matter: Translating Conservation Data", summary: "Wetlands act as natural water filters. Visual charts show how restoring them reduces agricultural runoff by up to 40%.", author: "CleanWater NZ", tag: "Wetlands" },
        { title: "New Zealand's Blue Carbon Strategy: Seagrass Mapping", summary: "A coastal monitoring programme charts seagrass distribution around Aotearoa to quantify ocean carbon capture capacity.", author: "Te Ara Moana Institute", tag: "Ocean Science" },
        { title: "Visualizing Bird Migration Data Across the Pacific", summary: "Tagging datasets reveal surprisingly complex migratory routes, now published as open geodata dashboards anyone can explore.", author: "DataWild Foundation", tag: "Ornithology" },
        { title: "Open-Source Biodiversity Atlas for Aotearoa", summary: "Community-contributed species sightings form a living biodiversity map updated in real time across all 16 New Zealand regions.", author: "iNaturalist NZ", tag: "Open Science" },
        { title: "How Sensor Networks Monitor Alpine Snow Levels", summary: "IoT snow sensors feed live data into regional dashboards, improving flood forecasting accuracy by up to 30%.", author: "NIWA Data", tag: "Climate" },
        { title: "Restoring the Hauraki Gulf: A Data-Driven Approach", summary: "Marine biologists pair diver surveys with satellite imagery to track reef habitat recovery over a 10-year baseline.", author: "Gulf Restoration Trust", tag: "Ecology" }
      ],
      cities: [
        { title: "Smart City Infrastructure Re-invents Public Transit", summary: "Auckland test fleets use real-time traffic models to adjust bus routing dynamically, reducing average wait times by 20%.", author: "Urban Dynamics", tag: "Transit" },
        { title: "Autonomous Delivery Networks Pilot in Auckland", summary: "Electric delivery carts navigate custom spatial networks across urban footpaths, cutting last-mile carbon footprints significantly.", author: "TechLogistics NZ", tag: "Automation" },
        { title: "Visualizing Electrical Grid Efficiencies in Real-Time", summary: "An interactive dashboard charts power usage across key sectors, exposing waste hot-spots and enabling smart load balancing.", author: "PowerMetrics", tag: "Smart Grid" },
        { title: "Data-Driven Urban Planning: Smart City Pipelines", summary: "Planners analyze pedestrian traffic sensors to optimize park layouts and crosswalk signal timing for improved public safety.", author: "Civic Planner", tag: "Urban Dev" },
        { title: "Grid Automation Models Minimize Urban Energy Waste", summary: "Smart sub-stations automatically redirect excess energy to high-demand suburbs, preventing brownouts during peak periods.", author: "Energy Grid Labs", tag: "Automation" },
        { title: "Digital Twin Cities: Wellington's 3D Urban Model", summary: "A photogrammetry-derived 3D model of central Wellington lets planners simulate sunlight, wind, and flood scenarios in real time.", author: "Civic Planner", tag: "Digital Twin" },
        { title: "Open Transport APIs Powering Civic Apps Across NZ", summary: "GTFS real-time feeds are driving a wave of community apps tracking ferries, trains, and buses in one unified live view.", author: "Urban Dynamics", tag: "Open Data" },
        { title: "Mapping Night-Time Light Pollution in Urban Centres", summary: "Satellite data reveals sprawling light corridors — key findings now reshaping street-light policy across three New Zealand cities.", author: "LightMap NZ", tag: "Environment" },
        { title: "Predictive Traffic Flow Models in Christchurch CBD", summary: "ML models trained on post-earthquake sensor data now forecast downtown congestion 45 minutes in advance with 88% accuracy.", author: "Transport Analytics", tag: "Smart Grid" },
        { title: "Smart Metering and the Future of Energy Transparency", summary: "Half-hourly smart meter reads, published as open data, empower households to identify and cut peak-hour consumption.", author: "PowerMetrics", tag: "Open Data" }
      ]
    };

    this.init();
  }

  init() {
    this.reset();
    this.initCharts();
    this.slider.addEventListener('input', (e) => {
      this.personalization = e.target.value / 100;
      this.sliderVal.innerText = `${e.target.value}%`;
    });
    document.addEventListener('theme-change', () => this.updateChartTheme());
  }

  reset() {
    this.stopAutoplay();
    if (this.scrollObserver) this.scrollObserver.disconnect();

    this.userWeights = { nature: 5, cities: 5 };
    this.stats = { reads: 0, likes: 0, dislikes: 0, reposts: 0 };
    this.postIdCounter = 0;
    this.postsState = {};
    this.biasHistory = [];
    this.engagementCount = 0;
    this.bubbleLockedAt = null;
    this.simTimeOffset = 20 + Math.floor(Math.random() * 10);
    this.feedStream.innerHTML = '';

    this.updateStatsDOM();
    this.updateGaugeDOM();
    this.resetVizPanel();

    const initial = ['nature','cities','nature','cities','nature','cities','nature','cities'];
    initial.forEach(t => this.injectPost(t));
    this.setupInfiniteScroll();
    this.updateFeedCounter();
  }

  setupInfiniteScroll() {
    this.scrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.injectPost(this.recommendNextTopic());
          this.injectPost(this.recommendNextTopic());
          this.observeLastCard();
        }
      });
    }, { root: this.feedStream, rootMargin: '0px 0px 80px 0px', threshold: 0.1 });
    this.observeLastCard();
  }

  observeLastCard() {
    if (this.lastObservedCard) this.scrollObserver.unobserve(this.lastObservedCard);
    const cards = this.feedStream.querySelectorAll('.feed-post');
    if (cards.length > 0) {
      this.lastObservedCard = cards[cards.length - 1];
      this.scrollObserver.observe(this.lastObservedCard);
    }
  }

  nextTimestamp() {
    const m = this.simTimeOffset;
    this.simTimeOffset = Math.max(0, this.simTimeOffset - Math.floor(Math.random() * 3 + 1));
    if (m <= 0) return 'just now';
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
  }

  injectPost(topic, isIntervention = false) {
    const pool = this.articlesPool[topic];
    const article = pool[Math.floor(Math.random() * pool.length)];
    this.postIdCounter++;
    const id = this.postIdCounter;
    const initials = article.author.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const timestamp = this.nextTimestamp();

    this.postsState[id] = { isRead: false, likeState: 'none', isReposted: false };

    const card = document.createElement('div');
    card.className = `feed-post topic-${topic}${isIntervention ? ' post-intervention' : ''}`;
    card.id = `post-${id}`;
    card.dataset.topic = topic;

    card.innerHTML = `
      ${isIntervention ? `<div class="intervention-banner"><svg class="icon" aria-hidden="true" width="1em" height="1em"><use href="icons/sprite.svg#info"></use></svg> Recommended to broaden your perspective</div>` : ''}
      <div class="post-body">
        <div class="post-avatar-col">
          <div class="post-avatar">${initials}</div>
        </div>
        <div class="post-content">
          <div class="post-header">
            <div class="post-meta">
              <span class="post-author">${article.author}</span>
              <span class="post-sep">·</span>
              <span class="post-time">${timestamp}</span>
            </div>
            <span class="post-tag">${article.tag}</span>
          </div>
          <h4 class="post-title">${article.title}</h4>
          <p class="post-summary">${article.summary}</p>
          <div class="post-actions">
            <button class="btn-post-action btn-read" onclick="window.simulator.toggleRead('${topic}',${id},this)" aria-label="Mark as read">
              <svg class="icon" aria-hidden="true" width="1em" height="1em"><use href="icons/sprite.svg#book-open"></use></svg> Read
            </button>
            <button class="btn-post-action btn-like" onclick="window.simulator.setLikeState('like','${topic}',${id},this)" aria-label="Like">
              <svg class="icon" aria-hidden="true" width="1em" height="1em"><use href="icons/sprite.svg#thumbs-up"></use></svg> Like
            </button>
            <button class="btn-post-action btn-dislike" onclick="window.simulator.setLikeState('dislike','${topic}',${id},this)" aria-label="Dislike">
              <svg class="icon" aria-hidden="true" width="1em" height="1em"><use href="icons/sprite.svg#thumbs-down"></use></svg>
            </button>
            <button class="btn-post-action btn-repost" onclick="window.simulator.toggleRepost('${topic}',${id},this)" aria-label="Repost">
              <svg class="icon" aria-hidden="true" width="1em" height="1em"><use href="icons/sprite.svg#repeat-2"></use></svg> Repost
            </button>
          </div>
        </div>
      </div>`;

    this.feedStream.appendChild(card);
    this.updateFeedCounter();
  }

  playReadAnimation(card) {
    const existing = card.querySelector('.read-scanner');
    if (existing) existing.remove();
    const scanner = document.createElement('div');
    scanner.className = 'read-scanner';
    card.appendChild(scanner);
    setTimeout(() => { if (scanner.parentNode) scanner.remove(); }, 1050);
  }

  flashCard(card) {
    card.classList.remove('flash-engage');
    // Force reflow so removing and re-adding the class triggers the animation
    void card.offsetWidth;
    card.classList.add('flash-engage');
    card.addEventListener('animationend', () => card.classList.remove('flash-engage'), { once: true });
  }

  toggleRead(topic, id, btn) {
    const state = this.postsState[id];
    if (!state) return;
    state.isRead = !state.isRead;
    if (state.isRead) {
      this.stats.reads++;
      this.userWeights[topic] += this.weights.read;
      btn.classList.add('active-read');
      const card = btn.closest('.feed-post');
      if (card) this.playReadAnimation(card);
    } else {
      this.stats.reads--;
      this.userWeights[topic] -= this.weights.read;
      btn.classList.remove('active-read');
    }
    this.processPostEngagement(topic);
  }

  setLikeState(clickState, topic, id, btn) {
    const state = this.postsState[id];
    if (!state) return;
    const container = btn.parentElement;
    const likeBtn = container.querySelector('.btn-like');
    const dislikeBtn = container.querySelector('.btn-dislike');
    const prev = state.likeState;

    if (clickState === 'like') {
      if (prev === 'like') {
        state.likeState = 'none';
        likeBtn.classList.remove('active-like');
        this.stats.likes--;
        this.userWeights[topic] -= this.weights.like;
      } else {
        if (prev === 'dislike') {
          dislikeBtn.classList.remove('active-dislike');
          this.stats.dislikes--;
          this.userWeights[topic] -= this.weights.dislike;
        }
        state.likeState = 'like';
        likeBtn.classList.add('active-like');
        this.stats.likes++;
        this.userWeights[topic] += this.weights.like;
      }
    } else {
      if (prev === 'dislike') {
        state.likeState = 'none';
        dislikeBtn.classList.remove('active-dislike');
        this.stats.dislikes--;
        this.userWeights[topic] -= this.weights.dislike;
      } else {
        if (prev === 'like') {
          likeBtn.classList.remove('active-like');
          this.stats.likes--;
          this.userWeights[topic] -= this.weights.like;
        }
        state.likeState = 'dislike';
        dislikeBtn.classList.add('active-dislike');
        this.stats.dislikes++;
        this.userWeights[topic] += this.weights.dislike;
      }
    }
    this.processPostEngagement(topic);
  }

  toggleRepost(topic, id, btn) {
    const state = this.postsState[id];
    if (!state) return;
    state.isReposted = !state.isReposted;
    if (state.isReposted) {
      this.stats.reposts++;
      this.userWeights[topic] += this.weights.repost;
      btn.classList.add('active-repost');
    } else {
      this.stats.reposts--;
      this.userWeights[topic] -= this.weights.repost;
      btn.classList.remove('active-repost');
    }
    this.processPostEngagement(topic);
  }

  processPostEngagement(topic) {
    this.userWeights.nature = Math.max(1, this.userWeights.nature);
    this.userWeights.cities = Math.max(1, this.userWeights.cities);
    this.engagementCount++;

    const total = this.userWeights.nature + this.userWeights.cities;
    const naturePct = (this.userWeights.nature / total) * 100;
    this.biasHistory.push({ n: this.engagementCount, pct: naturePct });

    if (!this.bubbleLockedAt && (naturePct > 65 || naturePct < 35)) {
      this.bubbleLockedAt = this.engagementCount;
    }

    this.updateStatsDOM();
    this.updateGaugeDOM();
    this.updateVizPanel();
  }

  recommendNextTopic() {
    const total = this.userWeights.nature + this.userWeights.cities;
    const pNature = this.userWeights.nature / total;
    return Math.random() < this.personalization
      ? (Math.random() < pNature ? 'nature' : 'cities')
      : (Math.random() < 0.5 ? 'nature' : 'cities');
  }

  updateGaugeDOM() {
    const total = this.userWeights.nature + this.userWeights.cities;
    const pct = (this.userWeights.cities / total) * 100;
    this.biasFill.style.left = `${pct}%`;
    if (pct > 65) {
      this.biasStatus.innerHTML = 'Feed state: <strong>Cities Echo Chamber (Strong Bias)</strong>';
      this.biasStatus.style.color = 'var(--accent)';
      this.bubbleStatusEl.innerText = 'Locked-In';
      this.bubbleStatusEl.className = 'stat-num text-danger';
    } else if (pct < 35) {
      this.biasStatus.innerHTML = 'Feed state: <strong>Nature Echo Chamber (Strong Bias)</strong>';
      this.biasStatus.style.color = 'var(--success)';
      this.bubbleStatusEl.innerText = 'Locked-In';
      this.bubbleStatusEl.className = 'stat-num text-danger';
    } else {
      this.biasStatus.innerHTML = 'Feed state: <strong>Balanced Representation</strong>';
      this.biasStatus.style.color = 'var(--text-main)';
      this.bubbleStatusEl.innerText = 'Balanced';
      this.bubbleStatusEl.className = 'stat-num text-success';
    }
  }

  breakBubble() {
    this.userWeights = { nature: 5, cities: 5 };
    this.updateGaugeDOM();
    ['nature','cities','nature','cities'].forEach(t => this.injectPost(t, true));
    setTimeout(() => this.feedStream.scrollTo({ top: this.feedStream.scrollHeight, behavior: 'smooth' }), 100);
    this.observeLastCard();
  }

  updateStatsDOM() {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    set('stat-reads', this.stats.reads);
    set('stat-likes', this.stats.likes);
    set('stat-dislikes', this.stats.dislikes);
    set('stat-reposts', this.stats.reposts);
  }

  updateFeedCounter() {
    const count = this.feedStream.querySelectorAll('.feed-post').length;
    const el = document.getElementById('feed-items-count');
    if (el) el.innerText = `${count} cards in stream`;
  }

  toggleAutoplay() {
    this.isAutoplay ? this.stopAutoplay() : this.startAutoplay();
  }

  startAutoplay() {
    const btn = document.getElementById('btn-sim-auto');
    if (!btn) return;
    this.isAutoplay = true;
    btn.innerHTML = '<svg class="icon" aria-hidden="true" width="1em" height="1em"><use href="icons/sprite.svg#pause"></use></svg> Pause Autoplay';
    btn.classList.remove('btn-accent');
    btn.classList.add('btn-secondary');

    const loop = () => {
      if (!this.isAutoplay) return;
      this.autoEngageOnce();
      this.autoplayTimer = setTimeout(loop, 950);
    };
    loop();
  }

  autoEngageOnce() {
    const cards = Array.from(this.feedStream.querySelectorAll('.feed-post'));
    const unread = cards.filter(c => {
      const id = parseInt(c.id.replace('post-', ''), 10);
      return this.postsState[id] && !this.postsState[id].isRead;
    });
    // Prefer newest unread; fall back to newest cards
    const pool = unread.length > 0 ? unread.slice(-3) : cards.slice(-3);
    if (!pool.length) return;

    const card = pool[Math.floor(Math.random() * pool.length)];
    const id = parseInt(card.id.replace('post-', ''), 10);
    const topic = card.dataset.topic;
    const state = this.postsState[id];
    if (!state) return;

    this.flashCard(card);

    const r = Math.random();
    if (r < 0.50 && !state.isRead) {
      this.toggleRead(topic, id, card.querySelector('.btn-read'));
    } else if (r < 0.78 && state.likeState !== 'like') {
      this.setLikeState('like', topic, id, card.querySelector('.btn-like'));
    } else if (r < 0.90 && !state.isReposted) {
      this.toggleRepost(topic, id, card.querySelector('.btn-repost'));
    }
    // remaining ~10%: skip (passive scroll simulation)
  }

  stopAutoplay() {
    this.isAutoplay = false;
    if (this.autoplayTimer) { clearTimeout(this.autoplayTimer); this.autoplayTimer = null; }
    const btn = document.getElementById('btn-sim-auto');
    if (btn) {
      btn.innerHTML = '<svg class="icon" aria-hidden="true" width="1em" height="1em"><use href="icons/sprite.svg#play"></use></svg> Auto Engager';
      btn.classList.remove('btn-secondary');
      btn.classList.add('btn-accent');
    }
  }

  // --- Charts ---

  chartTextColor() {
    return getComputedStyle(document.body).getPropertyValue('--text-muted').trim() || '#64748b';
  }

  initCharts() {
    if (typeof Chart === 'undefined') return;
    const c = this.chartTextColor();
    Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.color = c;

    const driftEl = document.getElementById('chart-drift');
    if (driftEl) {
      this.charts.drift = new Chart(driftEl, {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            {
              label: 'Nature %',
              data: [],
              borderColor: '#15803d',
              borderWidth: 2.5,
              pointRadius: 0,
              pointHoverRadius: 5,
              tension: 0.4,
              fill: { target: { value: 50 }, above: 'rgba(21,128,61,0.1)', below: 'rgba(2,132,199,0.1)' }
            },
            {
              label: '50% Balance',
              data: [],
              borderColor: 'rgba(100,116,139,0.3)',
              borderDash: [5, 4],
              borderWidth: 1.5,
              pointRadius: 0,
              fill: false,
              tension: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 200 },
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: {
              title: { display: true, text: 'Engagement #', color: c },
              grid: { display: false },
              ticks: { color: c, maxTicksLimit: 10 }
            },
            y: {
              min: 0,
              max: 100,
              title: { display: true, text: 'Nature %', color: c },
              ticks: { color: c, callback: v => `${v}%` },
              grid: { color: 'rgba(100,116,139,0.07)' }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: items => `Engagement #${items[0].label}`,
                label: ctx => ctx.datasetIndex === 0
                  ? `Nature ${Number(ctx.raw).toFixed(1)}%  /  Cities ${(100 - ctx.raw).toFixed(1)}%`
                  : null
              }
            }
          }
        }
      });
    }

    const splitEl = document.getElementById('chart-split');
    if (splitEl) {
      this.charts.split = new Chart(splitEl, {
        type: 'doughnut',
        data: {
          labels: ['Nature', 'Cities'],
          datasets: [{
            data: [50, 50],
            backgroundColor: ['rgba(21,128,61,0.82)', 'rgba(2,132,199,0.82)'],
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '60%',
          plugins: {
            legend: { position: 'bottom', labels: { padding: 12, color: c, boxWidth: 11, borderRadius: 3 } },
            tooltip: { callbacks: { label: ctx => `${ctx.label}: ${Number(ctx.raw).toFixed(1)}%` } }
          }
        }
      });
    }

    const engEl = document.getElementById('chart-engagement');
    if (engEl) {
      this.charts.engagement = new Chart(engEl, {
        type: 'bar',
        data: {
          labels: ['Reads', 'Likes', 'Reposts', 'Dislikes'],
          datasets: [{
            data: [0, 0, 0, 0],
            backgroundColor: [
              'rgba(79,70,229,0.75)',
              'rgba(217,119,6,0.75)',
              'rgba(21,128,61,0.75)',
              'rgba(185,28,28,0.75)'
            ],
            borderRadius: 5,
            borderSkipped: false
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { precision: 0, color: c } },
            y: { grid: { display: false }, ticks: { color: c } }
          },
          animation: { duration: 200 }
        }
      });
    }
  }

  updateVizPanel() {
    if (typeof Chart === 'undefined') return;

    const total = this.userWeights.nature + this.userWeights.cities;
    const naturePct = (this.userWeights.nature / total) * 100;
    const citiesPct = 100 - naturePct;

    // Reveal panel after 5 engagements
    if (this.engagementCount === 5) {
      const empty = document.getElementById('viz-empty-state');
      const content = document.getElementById('viz-content');
      const badge = document.getElementById('viz-live-badge');
      if (empty) empty.style.display = 'none';
      if (content) content.style.display = 'flex';
      if (badge) badge.style.display = 'flex';
    }

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('viz-total', this.engagementCount);
    set('viz-dominant', naturePct >= 50 ? `Nature ${naturePct.toFixed(0)}%` : `Cities ${citiesPct.toFixed(0)}%`);
    set('viz-lockin', this.bubbleLockedAt ? `#${this.bubbleLockedAt}` : '—');
    set('viz-bias-pct', `${naturePct.toFixed(0)} / ${citiesPct.toFixed(0)}`);

    if (this.charts.drift) {
      const labels = this.biasHistory.map(d => d.n);
      const vals = this.biasHistory.map(d => d.pct);
      this.charts.drift.data.labels = labels;
      this.charts.drift.data.datasets[0].data = vals;
      this.charts.drift.data.datasets[1].data = labels.map(() => 50);
      this.charts.drift.update('none');
    }

    if (this.charts.split) {
      this.charts.split.data.datasets[0].data = [naturePct, citiesPct];
      this.charts.split.update('none');
    }

    if (this.charts.engagement) {
      this.charts.engagement.data.datasets[0].data = [
        this.stats.reads,
        this.stats.likes,
        this.stats.reposts,
        this.stats.dislikes
      ];
      this.charts.engagement.update('none');
    }
  }

  resetVizPanel() {
    const el = id => document.getElementById(id);
    if (el('viz-empty-state')) el('viz-empty-state').style.display = 'flex';
    if (el('viz-content')) el('viz-content').style.display = 'none';
    if (el('viz-live-badge')) el('viz-live-badge').style.display = 'none';

    const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    set('viz-total', '0');
    set('viz-dominant', '—');
    set('viz-lockin', '—');
    set('viz-bias-pct', '50 / 50');

    if (this.charts.drift) {
      this.charts.drift.data.labels = [];
      this.charts.drift.data.datasets.forEach(d => { d.data = []; });
      this.charts.drift.update('none');
    }
    if (this.charts.split) {
      this.charts.split.data.datasets[0].data = [50, 50];
      this.charts.split.update('none');
    }
    if (this.charts.engagement) {
      this.charts.engagement.data.datasets[0].data = [0, 0, 0, 0];
      this.charts.engagement.update('none');
    }
  }

  updateChartTheme() {
    if (typeof Chart === 'undefined') return;
    const c = this.chartTextColor();
    Chart.defaults.color = c;
    Object.values(this.charts).forEach(chart => {
      if (!chart) return;
      if (chart.options.scales) {
        Object.values(chart.options.scales).forEach(scale => {
          if (scale.ticks) scale.ticks.color = c;
          if (scale.title) scale.title.color = c;
        });
      }
      if (chart.options.plugins && chart.options.plugins.legend && chart.options.plugins.legend.labels) {
        chart.options.plugins.legend.labels.color = c;
      }
      chart.update('none');
    });
  }
}
