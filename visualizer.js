/**
 * Shane Turner Portfolio - Algorithmic Filter Bubble Simulator
 * Logic for mock feed generation, interaction weights (Read=+1, Like=+2, Dislike=-2, Repost=+4),
 * personalization feedback loops, and auto-engage simulation routines.
 */

class FilterBubbleSimulator {
  constructor() {
    // DOM bindings
    this.feedStream = document.getElementById('feed-stream');
    this.biasFill = document.getElementById('bias-gauge-fill');
    this.biasStatus = document.getElementById('bias-status-desc');
    this.slider = document.getElementById('personalization-slider');
    this.sliderVal = document.getElementById('personalization-value');
    
    // Stats elements
    this.readsCountEl = document.getElementById('stat-reads');
    this.likesCountEl = document.getElementById('stat-likes');
    this.dislikesCountEl = document.getElementById('stat-dislikes');
    this.repostsCountEl = document.getElementById('stat-reposts');
    this.bubbleStatusEl = document.getElementById('stat-lockin');
    
    if (!this.feedStream) return;

    // Simulation weights
    this.weights = { read: 1, like: 2, dislike: -2, repost: 4 };
    
    // User profile state
    this.userWeights = { nature: 5, cities: 5 }; // Starts perfectly balanced
    this.personalization = 0.7; // Defaults to 70% personalization
    
    // Iteration stats
    this.stats = { reads: 0, likes: 0, dislikes: 0, reposts: 0 };
    this.postIdCounter = 0;
    this.postsState = {}; // Maps postId -> { isRead: false, likeState: 'none', isReposted: false, everEngaged: false }
    this.autoplayTimer = null;
    this.isAutoplay = false;

    // Mock Article Templates
    this.articlesPool = {
      nature: [
        {
          title: "NZ Native Forest Preservation Projects Expand",
          summary: "A new conservation initiative aims to restore over 10,000 hectares of native podocarp forest in the Southern Alps, utilizing seed visual mapping.",
          author: "EcoAnalytics NZ",
          tag: "Conservation"
        },
        {
          title: "Saving the Kiwi: Visual Conservation Pipelines",
          summary: "Exploring how researchers use trail cameras and cloud classification models to monitor kiwi populations in real-time.",
          author: "DataWild Foundation",
          tag: "Forestry"
        },
        {
          title: "The Mathematical Models Protecting Coastal Ecosystems",
          summary: "Coastal erosion is a growing concern. Check out how marine researchers model wave dynamics to design non-intrusive barriers.",
          author: "Dr. Clara Hens",
          tag: "Ecology"
        },
        {
          title: "Rewilding New Zealand Forests: An Open Data Study",
          summary: "A non-partisan analysis of tree planting distributions shows native species significantly improve soil moisture retention.",
          author: "Forestry Review",
          tag: "Open Science"
        },
        {
          title: "Why Wetlands Matter: Translating Conservation Data",
          summary: "Wetlands act as natural water filters. Visual charts illustrate how restoring them reduces agricultural runoff by 40%.",
          author: "CleanWater NZ",
          tag: "Wetlands"
        }
      ],
      cities: [
        {
          title: "Smart City Infrastructure Re-invents Public Transit",
          summary: "Auckland test fleets utilize real-time traffic visual models to adjust bus routing dynamically, reducing wait times by 20%.",
          author: "Urban Dynamics",
          tag: "Smart Grid"
        },
        {
          title: "Autonomous Delivery Networks Pilot in Auckland",
          summary: "Electric delivery carts run on custom spatial networks to safely navigate urban footpaths and reduce carbon footprints.",
          author: "TechLogistics",
          tag: "Automation"
        },
        {
          title: "Visualizing Electrical Grid Efficiencies in Real-Time",
          summary: "An interactive dashboard charts power usage across key sectors, exposing waste and enabling smart distribution points.",
          author: "PowerMetrics",
          tag: "Smart Grid"
        },
        {
          title: "Data-Driven Urban Planning: Smart City Pipelines",
          summary: "Planners analyze pedestrian traffic sensors to optimize park designs and crosswalk signals for public safety.",
          author: "Civic Planner",
          tag: "Urban Dev"
        },
        {
          title: "Grid Automation Models Minimize Urban Energy Waste",
          summary: "Smart sub-stations automatically redirect excess energy to high-demand suburbs, preventing regional brownouts.",
          author: "Energy Grid Labs",
          tag: "Automation"
        }
      ]
    };

    this.init();
  }

  init() {
    this.reset();
    
    // Bind slider input
    this.slider.addEventListener('input', (e) => {
      this.personalization = e.target.value / 100;
      this.sliderVal.innerText = `${e.target.value}%`;
    });
  }

  // Reset the feed to start state
  reset() {
    this.stopAutoplay();
    this.userWeights = { nature: 5, cities: 5 };
    this.stats = { reads: 0, likes: 0, dislikes: 0, reposts: 0 };
    this.postIdCounter = 0;
    this.postsState = {};
    this.feedStream.innerHTML = '';
    
    this.updateStatsDOM();
    this.updateGaugeDOM();
    
    // Add 4 initial balanced posts
    this.injectPost('nature');
    this.injectPost('cities');
    this.injectPost('nature');
    this.injectPost('cities');

    this.updateFeedCounter();
  }

  // Injects a single post card into the scroll stream
  injectPost(topic) {
    const pool = this.articlesPool[topic];
    const randArticle = pool[Math.floor(Math.random() * pool.length)];
    this.postIdCounter++;
    
    // Register initial state for this post
    this.postsState[this.postIdCounter] = {
      isRead: false,
      likeState: 'none',
      isReposted: false,
      everEngaged: false
    };

    const card = document.createElement('div');
    card.className = `feed-post topic-${topic}`;
    card.id = `post-${this.postIdCounter}`;
    card.setAttribute('data-topic', topic);
    
    card.innerHTML = `
      <div class="post-header">
        <span class="post-author">${randArticle.author}</span>
        <span class="post-tag">${randArticle.tag}</span>
      </div>
      <h4 class="post-title">${randArticle.title}</h4>
      <p class="post-summary">${randArticle.summary}</p>
      <div class="post-actions">
        <button class="btn-post-action btn-read" onclick="window.simulator.toggleRead('${topic}', ${this.postIdCounter}, this)" aria-label="Read article: ${randArticle.title}">
          <i class="fa-solid fa-book-open"></i> Read
        </button>
        <button class="btn-post-action btn-like" onclick="window.simulator.setLikeState('like', '${topic}', ${this.postIdCounter}, this)" aria-label="Like article">
          <i class="fa-solid fa-thumbs-up"></i> Like
        </button>
        <button class="btn-post-action btn-dislike" onclick="window.simulator.setLikeState('dislike', '${topic}', ${this.postIdCounter}, this)" aria-label="Dislike article">
          <i class="fa-solid fa-thumbs-down"></i> Dislike
        </button>
        <button class="btn-post-action btn-repost" onclick="window.simulator.toggleRepost('${topic}', ${this.postIdCounter}, this)" aria-label="Repost article">
          <i class="fa-solid fa-retweet"></i> Repost
        </button>
      </div>
    `;
    
    this.feedStream.appendChild(card);
    this.updateFeedCounter();
  }

  // Action Toggles
  toggleRead(topic, id, btn) {
    const state = this.postsState[id];
    if (!state) return;

    state.isRead = !state.isRead;
    if (state.isRead) {
      this.stats.reads++;
      this.userWeights[topic] += this.weights.read;
      btn.classList.add('active-read');
    } else {
      this.stats.reads--;
      this.userWeights[topic] -= this.weights.read;
      btn.classList.remove('active-read');
    }

    this.processPostEngagement(state, topic);
  }

  setLikeState(clickState, topic, id, btn) {
    const state = this.postsState[id];
    if (!state) return;

    const container = btn.parentElement;
    const likeBtn = container.querySelector('.btn-like');
    const dislikeBtn = container.querySelector('.btn-dislike');

    const prevLikeState = state.likeState;

    if (clickState === 'like') {
      if (prevLikeState === 'like') {
        // Deselect Like
        state.likeState = 'none';
        likeBtn.classList.remove('active-like');
        this.stats.likes--;
        this.userWeights[topic] -= this.weights.like;
      } else {
        if (prevLikeState === 'dislike') {
          // Cancel Dislike
          dislikeBtn.classList.remove('active-dislike');
          this.stats.dislikes--;
          // revert dislike weight change: topic interest goes back up (+2)
          this.userWeights[topic] -= this.weights.dislike; 
        }
        // Set Like
        state.likeState = 'like';
        likeBtn.classList.add('active-like');
        this.stats.likes++;
        this.userWeights[topic] += this.weights.like;
      }
    } else if (clickState === 'dislike') {
      if (prevLikeState === 'dislike') {
        // Deselect Dislike
        state.likeState = 'none';
        dislikeBtn.classList.remove('active-dislike');
        this.stats.dislikes--;
        this.userWeights[topic] -= this.weights.dislike;
      } else {
        if (prevLikeState === 'like') {
          // Cancel Like
          likeBtn.classList.remove('active-like');
          this.stats.likes--;
          this.userWeights[topic] -= this.weights.like;
        }
        // Set Dislike
        state.likeState = 'dislike';
        dislikeBtn.classList.add('active-dislike');
        this.stats.dislikes++;
        this.userWeights[topic] += this.weights.dislike; // Adds -2
      }
    }

    this.processPostEngagement(state, topic);
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

    this.processPostEngagement(state, topic);
  }

  // Completes engagement actions, updates layout weights, and injects next post card
  processPostEngagement(state, topic) {
    // Clamp weights to prevent negative division values
    this.userWeights.nature = Math.max(1, this.userWeights.nature);
    this.userWeights.cities = Math.max(1, this.userWeights.cities);

    this.updateStatsDOM();
    this.updateGaugeDOM();

    // Trigger one card injection only on first interaction with this card
    if (!state.everEngaged) {
      state.everEngaged = true;
      const nextTopic = this.recommendNextTopic();
      this.injectPost(nextTopic);

      // Auto-scroll stream window down to new recommendations
      setTimeout(() => {
        this.feedStream.scrollTo({
          top: this.feedStream.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  }

  // Personalization logic: picks Nature vs Cities based on weights & slider personalization percentage
  recommendNextTopic() {
    const totalWeight = this.userWeights.nature + this.userWeights.cities;
    const pNature = this.userWeights.nature / totalWeight;
    
    const r = Math.random();
    // With probability 'personalization', we use the user's preference model
    if (r < this.personalization) {
      const selectRandom = Math.random();
      return selectRandom < pNature ? 'nature' : 'cities';
    } else {
      // With remaining probability, we inject a neutral 50/50 randomized post
      return Math.random() < 0.5 ? 'nature' : 'cities';
    }
  }

  // Recalculates bias split and updates gauge and text
  updateGaugeDOM() {
    const total = this.userWeights.nature + this.userWeights.cities;
    const percentCities = (this.userWeights.cities / total) * 100;
    
    // Update gauge fill position
    this.biasFill.style.left = `${percentCities}%`;
    
    // Update text
    let stateStr = "";
    if (percentCities > 65) {
      stateStr = "Feed state: **Cities Echo Chamber (Strong Bias)**";
      this.biasStatus.style.color = "var(--accent)";
      this.bubbleStatusEl.innerText = "Locked-In";
      this.bubbleStatusEl.className = "stat-num text-danger";
    } else if (percentCities < 35) {
      stateStr = "Feed state: **Nature Echo Chamber (Strong Bias)**";
      this.biasStatus.style.color = "var(--success)";
      this.bubbleStatusEl.innerText = "Locked-In";
      this.bubbleStatusEl.className = "stat-num text-danger";
    } else {
      stateStr = "Feed state: **Balanced Representation**";
      this.biasStatus.style.color = "var(--text-main)";
      this.bubbleStatusEl.innerText = "Balanced";
      this.bubbleStatusEl.className = "stat-num text-success";
    }
    
    this.biasStatus.innerHTML = stateStr;
  }

  // Breaks the bubble by resetting bias state and force-injecting balanced items
  breakBubble() {
    this.userWeights = { nature: 5, cities: 5 };
    this.updateGaugeDOM();
    
    // Inject counter-weight posts
    this.injectPost('nature');
    this.injectPost('cities');
    this.injectPost('nature');
    this.injectPost('cities');
    
    // Scroll down to bottom
    setTimeout(() => {
      this.feedStream.scrollTo({
        top: this.feedStream.scrollHeight,
        behavior: 'smooth'
      });
    }, 100);
  }

  // Updates counts in UI dashboard
  updateStatsDOM() {
    if (this.readsCountEl) this.readsCountEl.innerText = this.stats.reads;
    if (this.likesCountEl) this.likesCountEl.innerText = this.stats.likes;
    
    const dislikesEl = document.getElementById('stat-dislikes');
    if (dislikesEl) dislikesEl.innerText = this.stats.dislikes;

    const repostsEl = document.getElementById('stat-reposts');
    if (repostsEl) repostsEl.innerText = this.stats.reposts;
  }

  updateFeedCounter() {
    const count = this.feedStream.querySelectorAll('.feed-post').length;
    const itemsCountEl = document.getElementById('feed-items-count');
    if (itemsCountEl) {
      itemsCountEl.innerText = `${count} cards in stream`;
    }
  }

  // Autoplay Simulator loop
  toggleAutoplay() {
    if (this.isAutoplay) {
      this.stopAutoplay();
    } else {
      this.startAutoplay();
    }
  }

  startAutoplay() {
    const autoBtn = document.getElementById('btn-sim-auto');
    if (!autoBtn) return;
    
    this.isAutoplay = true;
    autoBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause Autoplay';
    autoBtn.classList.remove('btn-accent');
    autoBtn.classList.add('btn-secondary');

    const loop = () => {
      if (!this.isAutoplay) return;

      // Find all cards inside stream
      const cards = Array.from(this.feedStream.querySelectorAll('.feed-post'));

      if (cards.length > 0) {
        // Pick one card randomly
        const randCard = cards[Math.floor(Math.random() * cards.length)];
        const actions = ['read', 'like', 'dislike', 'repost'];
        const action = actions[Math.floor(Math.random() * actions.length)];
        
        let btn;
        if (action === 'read') {
          btn = randCard.querySelector('.btn-read');
        } else if (action === 'like') {
          btn = randCard.querySelector('.btn-like');
        } else if (action === 'dislike') {
          btn = randCard.querySelector('.btn-dislike');
        } else if (action === 'repost') {
          btn = randCard.querySelector('.btn-repost');
        }

        if (btn) {
          btn.click();
        }
      }

      this.autoplayTimer = setTimeout(loop, 1000);
    };

    loop();
  }

  stopAutoplay() {
    this.isAutoplay = false;
    if (this.autoplayTimer) {
      clearTimeout(this.autoplayTimer);
      this.autoplayTimer = null;
    }
    const autoBtn = document.getElementById('btn-sim-auto');
    if (autoBtn) {
      autoBtn.innerHTML = '<i class="fa-solid fa-play"></i> Auto Engager';
      autoBtn.classList.remove('btn-secondary');
      autoBtn.classList.add('btn-accent');
    }
  }
}
