const EXAMPLES = {
  mitochondria: 'Mitochondria are often called the powerhouses of the cell. These tiny organelles convert glucose and oxygen into ATP, the energy currency that fuels nearly every cellular process. Without mitochondria, a cell would quickly run out of energy and die.',
  cpu: 'A CPU, or central processing unit, is the brain of a computer. It fetches instructions from memory, decodes them, and executes billions of operations every second. Modern CPUs contain multiple cores that work in parallel, allowing your device to run many tasks at once.',
  photosynthesis: 'Photosynthesis is how plants turn sunlight into food. Using chlorophyll in their leaves, they combine carbon dioxide from the air and water from the soil to produce glucose and oxygen. This process not only feeds the plant, it also produces the oxygen we breathe.',
};

const els = {
  script: document.getElementById('script'),
  charCount: document.getElementById('charCount'),
  generateBtn: document.getElementById('generateBtn'),
  progressCard: document.getElementById('progressCard'),
  progressFill: document.getElementById('progressFill'),
  progressPct: document.getElementById('progressPct'),
  progressStep: document.getElementById('progressStep'),
  stepsList: document.getElementById('stepsList'),
  errorMsg: document.getElementById('errorMsg'),
  resultCard: document.getElementById('resultCard'),
  resultVideo: document.getElementById('resultVideo'),
  downloadLink: document.getElementById('downloadLink'),
  resultMeta: document.getElementById('resultMeta'),
  newJobBtn: document.getElementById('newJobBtn'),
  serverStatus: document.getElementById('serverStatus'),
  serverStatusText: document.getElementById('serverStatusText'),
};

let pollTimer = null;

els.script.addEventListener('input', () => {
  els.charCount.textContent = els.script.value.length;
});

document.querySelectorAll('.example-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const ex = EXAMPLES[btn.dataset.example];
    if (ex) {
      els.script.value = ex;
      els.charCount.textContent = ex.length;
      els.script.focus();
    }
  });
});

els.generateBtn.addEventListener('click', startJob);
els.newJobBtn.addEventListener('click', resetUI);

async function checkHealth() {
  try {
    const r = await fetch('/api/health');
    if (!r.ok) throw new Error();
    els.serverStatus.classList.add('ok');
    els.serverStatusText.textContent = 'online';
  } catch {
    els.serverStatus.classList.add('err');
    els.serverStatusText.textContent = 'offline';
  }
}

async function startJob() {
  const script = els.script.value.trim();
  if (!script) {
    alert('Please paste a script first.');
    return;
  }
  resetUI();
  els.generateBtn.disabled = true;
  els.progressCard.classList.remove('hidden');
  els.progressFill.style.width = '2%';
  els.progressPct.textContent = '0%';
  els.progressStep.textContent = 'submitting…';

  try {
    const r = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || 'Failed to start job');
    }
    const job = await r.json();
    poll(job.jobId);
  } catch (err) {
    showError(err.message);
    els.generateBtn.disabled = false;
  }
}

function poll(jobId) {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    try {
      const r = await fetch(`/api/jobs/${jobId}`);
      if (!r.ok) throw new Error('Job not found');
      const job = await r.json();
      updateProgress(job);
      if (job.status === 'done') {
        clearInterval(pollTimer);
        pollTimer = null;
        showResult(jobId, job);
      } else if (job.status === 'failed') {
        clearInterval(pollTimer);
        pollTimer = null;
        showError(job.error_msg || 'Job failed');
        els.generateBtn.disabled = false;
      }
    } catch (err) {
      console.warn('poll error', err);
    }
  }, 1500);
}

function updateProgress(job) {
  els.progressFill.style.width = Math.max(2, job.progress) + '%';
  els.progressPct.textContent = (job.progress || 0) + '%';
  els.progressStep.textContent = job.current_step || '…';

  const stepMap = {
    tts: 'tts',
    planning: 'planning',
    assets: 'assets',
    rendering: 'rendering',
    muxing: 'muxing',
    done: 'done',
    failed: 'failed',
  };
  const current = stepMap[job.current_step];
  const order = ['tts', 'planning', 'assets', 'rendering', 'muxing'];
  const currentIdx = current ? order.indexOf(current) : -1;
  els.stepsList.querySelectorAll('li').forEach(li => {
    const step = li.dataset.step;
    const idx = order.indexOf(step);
    li.classList.remove('active', 'done');
    if (current === 'done' || (currentIdx === -1 && job.progress === 100)) {
      li.classList.add('done');
    } else if (idx < currentIdx) {
      li.classList.add('done');
    } else if (idx === currentIdx) {
      li.classList.add('active');
    }
  });
}

function showError(msg) {
  els.errorMsg.textContent = msg;
  els.errorMsg.classList.remove('hidden');
}

function showResult(jobId, job) {
  els.resultCard.classList.remove('hidden');
  const url = `/api/video/${jobId}`;
  els.resultVideo.src = url;
  els.downloadLink.href = `/api/video/${jobId}/download`;
  els.resultMeta.textContent = `Job ${jobId} · ${(job.duration_ms / 1000).toFixed(1)}s · ready at ${new Date().toLocaleTimeString()}`;
  els.progressCard.classList.add('hidden');
  els.generateBtn.disabled = false;
  els.resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetUI() {
  els.progressCard.classList.add('hidden');
  els.resultCard.classList.add('hidden');
  els.errorMsg.classList.add('hidden');
  els.progressFill.style.width = '0';
  els.progressPct.textContent = '0%';
  els.progressStep.textContent = 'queued';
  els.stepsList.querySelectorAll('li').forEach(li => li.classList.remove('active', 'done'));
  els.resultVideo.removeAttribute('src');
  els.resultVideo.load();
}

checkHealth();
