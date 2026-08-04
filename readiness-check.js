(() => {
  'use strict';

  // ---- Question model -----------------------------------------------------
  // Each entry is one "step" shown to the visitor. `fields` holds one or two
  // form fields (Q2 and Q3 are two-part questions per the SV-BOSS spec).
  const STEPS = [
    {
      question: "What's your name?",
      fields: [
        { key: 'name', type: 'text', placeholder: 'Full name', required: true, autocomplete: 'name' }
      ]
    },
    {
      question: 'How can we reach you?',
      fields: [
        { key: 'email', type: 'email', label: 'Email', placeholder: 'you@company.com', required: true, autocomplete: 'email' },
        { key: 'phone', type: 'tel', label: 'Phone', placeholder: '(optional)', required: false, autocomplete: 'tel' }
      ]
    },
    {
      question: 'Tell us about your company.',
      fields: [
        { key: 'company', type: 'text', label: 'Company', placeholder: 'Company name', required: true, autocomplete: 'organization' },
        { key: 'website', type: 'url', label: 'Website', placeholder: '(optional)', required: false, autocomplete: 'url' }
      ]
    },
    {
      question: 'What does your business do?',
      fields: [ { key: 'businessDescription', type: 'textarea', required: true } ]
    },
    {
      question: 'What prompted you to explore SV-BOSS?',
      fields: [ { key: 'prompt', type: 'textarea', required: true } ]
    },
    {
      question: 'What is the biggest challenge you want to solve?',
      fields: [ { key: 'challenge', type: 'textarea', required: true } ]
    },
    {
      question: 'If that were improved, what would that make possible?',
      fields: [ { key: 'outcome', type: 'textarea', required: true } ]
    },
    {
      question: 'Why is this important now?',
      fields: [ { key: 'importance', type: 'textarea', required: true } ]
    },
    {
      question: 'Who is involved in making this decision?',
      fields: [ { key: 'decisionMakers', type: 'text', required: true } ]
    },
    {
      question: 'How soon would you like to address it?',
      fields: [
        {
          key: 'timeline',
          type: 'select',
          required: true,
          options: ['Immediately', 'Within 30 days', '1-3 months', '3-6 months', 'Just exploring']
        }
      ]
    },
    {
      question: 'Anything else Paul should know?',
      fields: [ { key: 'notes', type: 'textarea', required: false } ]
    }
  ];

  const TOTAL_QUESTION_STEPS = STEPS.length;
  const REVIEW_INDEX = STEPS.length; // review is the step right after the last question

  // ---- State ----------------------------------------------------------------
  const data = {};
  let current = 0;
  let submitting = false;

  // ---- DOM refs ---------------------------------------------------------
  const stepsContainer = document.getElementById('rc-steps');
  const statusArea = document.getElementById('rc-status-area');
  const form = document.getElementById('rc-form');
  const intro = document.getElementById('rc-intro');
  const progressTrack = document.getElementById('rc-progress-track');
  const progressFill = document.getElementById('rc-progress-fill');
  const progressLabel = document.getElementById('rc-progress-label');

  // ---- Build step markup -------------------------------------------------
  function fieldMarkup(field, stepIdx) {
    const id = `rc-field-${field.key}`;
    const commonAttrs = `id="${id}" name="${field.key}" ${field.required ? 'required' : ''} ${field.autocomplete ? `autocomplete="${field.autocomplete}"` : ''}`;

    let control;
    if (field.type === 'textarea') {
      control = `<textarea class="rc-field" ${commonAttrs} placeholder="${field.placeholder || 'Type your answer...'}"></textarea>`;
    } else if (field.type === 'select') {
      const opts = ['<option value="">Select one...</option>']
        .concat(field.options.map(o => `<option value="${o}">${o}</option>`))
        .join('');
      control = `<select class="rc-field" ${commonAttrs}>${opts}</select>`;
    } else {
      control = `<input class="rc-field" type="${field.type}" ${commonAttrs} placeholder="${field.placeholder || ''}">`;
    }

    if (field.label) {
      return `<div class="rc-subfield"><label for="${id}">${field.label}${field.required ? '' : ' (optional)'}</label>${control}</div>`;
    }
    return control;
  }

  function buildSteps() {
    let html = '';

    STEPS.forEach((step, idx) => {
      const isMulti = step.fields.length > 1;
      const fieldsHtml = step.fields.map(f => fieldMarkup(f, idx)).join('');
      html += `
        <div class="rc-step" data-step="${idx}">
          <p class="rc-question">${step.question}</p>
          ${isMulti ? `<div class="rc-two-col">${fieldsHtml}</div>` : fieldsHtml}
          <p class="rc-error" data-error-for="${idx}"></p>
          ${navMarkup(idx)}
        </div>`;
    });

    html += `
      <div class="rc-step" data-step="${REVIEW_INDEX}">
        <p class="rc-question">Review your answers</p>
        <p class="rc-help">Take a quick look before sending this to Paul.</p>
        <ul class="rc-review-list" id="rc-review-list"></ul>
        ${navMarkup(REVIEW_INDEX, true)}
      </div>`;

    stepsContainer.innerHTML = html;
  }

  function navMarkup(idx, isReview) {
    const backDisabled = idx === 0 ? 'disabled' : '';
    const nextLabel = isReview ? 'Submit' : (idx === TOTAL_QUESTION_STEPS - 1 ? 'Review' : 'Next');
    return `
      <div class="rc-nav">
        <button type="button" class="rc-btn rc-btn-secondary" data-action="back" ${backDisabled}>Back</button>
        <button type="button" class="rc-btn rc-btn-primary" data-action="${isReview ? 'submit' : 'next'}">${nextLabel}</button>
      </div>`;
  }

  // ---- Navigation ---------------------------------------------------------
  function showStep(idx) {
    current = idx;
    document.querySelectorAll('.rc-step').forEach(el => {
      el.classList.toggle('active', Number(el.dataset.step) === idx);
    });

    intro.style.display = idx === 0 ? '' : 'none';

    if (idx <= TOTAL_QUESTION_STEPS - 1) {
      progressTrack.style.display = '';
      progressLabel.style.display = '';
      const pct = Math.round((idx / TOTAL_QUESTION_STEPS) * 100);
      progressFill.style.width = `${pct}%`;
      progressLabel.textContent = `Question ${idx + 1} of ${TOTAL_QUESTION_STEPS}`;
    } else {
      progressFill.style.width = '100%';
      progressLabel.textContent = 'Almost done';
    }

    if (idx === REVIEW_INDEX) renderReview();

    const firstField = document.querySelector(`.rc-step[data-step="${idx}"] .rc-field`);
    if (firstField) setTimeout(() => firstField.focus(), 50);
  }

  function validateStep(idx) {
    if (idx > TOTAL_QUESTION_STEPS - 1) return true;
    const step = STEPS[idx];
    const errorEl = document.querySelector(`[data-error-for="${idx}"]`);
    errorEl.textContent = '';

    for (const field of step.fields) {
      const el = document.getElementById(`rc-field-${field.key}`);
      const value = el.value.trim();
      data[field.key] = value;

      if (field.required && !value) {
        errorEl.textContent = 'This one\'s required — mind filling it in?';
        el.focus();
        return false;
      }
      if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errorEl.textContent = 'That email doesn\'t look quite right.';
        el.focus();
        return false;
      }
    }
    return true;
  }

  function renderReview() {
    const list = document.getElementById('rc-review-list');
    list.innerHTML = STEPS.map(step => {
      const answer = step.fields.map(f => data[f.key]).filter(Boolean).join(' — ');
      return `
        <li>
          <p class="rc-review-q">${step.question}</p>
          <p class="rc-review-a ${answer ? '' : 'rc-empty'}">${answer ? escapeHtml(answer) : 'Not answered'}</p>
        </li>`;
    }).join('');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Submit ---------------------------------------------------------------
  async function submitForm() {
    if (submitting) return;

    // Honeypot check — if a bot filled this hidden field, silently pretend success
    const honeypot = document.getElementById('rc-website-hp').value.trim();
    if (honeypot) {
      showSuccess();
      return;
    }

    submitting = true;
    const submitBtn = document.querySelector(`.rc-step[data-step="${REVIEW_INDEX}"] [data-action="submit"]`);
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    try {
      const res = await fetch('/.netlify/functions/submit-readiness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      showSuccess();
    } catch (err) {
      submitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit';
      statusArea.innerHTML = `
        <div class="rc-status rc-error-state">
          <p>Something didn't go through. Mind trying again in a moment?</p>
        </div>`;
    }
  }

  function showSuccess() {
    stepsContainer.style.display = 'none';
    progressTrack.style.display = 'none';
    progressLabel.style.display = 'none';
    intro.style.display = 'none';
    statusArea.innerHTML = `
      <div class="rc-status">
        <h2>Thank you.</h2>
        <p>Your readiness snapshot is on its way to Paul. He'll follow up personally with next steps.</p>
      </div>`;
  }

  // ---- Events ---------------------------------------------------------------
  form.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    e.preventDefault();

    if (btn.dataset.action === 'back') {
      showStep(Math.max(0, current - 1));
    } else if (btn.dataset.action === 'next') {
      if (validateStep(current)) showStep(Math.min(REVIEW_INDEX, current + 1));
    } else if (btn.dataset.action === 'submit') {
      submitForm();
    }
  });

  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      const btn = document.querySelector(`.rc-step[data-step="${current}"] [data-action="${current === REVIEW_INDEX ? 'submit' : 'next'}"]`);
      if (btn) btn.click();
    }
  });

  // ---- Init -----------------------------------------------------------------
  buildSteps();
  showStep(0);
})();
