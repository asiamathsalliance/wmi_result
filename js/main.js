document.addEventListener('DOMContentLoaded', function () {
  const BACKEND_BASE_URL = 'https://competition-backend-1-zd68.onrender.com';

  let tempCertificate = null;
  let serverErrorFlag = false;
  let lookupSuccess = false;
  let lookupMessage = '';

  const loadingOverlay = document.getElementById('loadingOverlay2');
  const downloadOverlay = document.getElementById('downloadOverlay');
  const downloadContainer = document.getElementById('downloadContainer');
  const progressBar = document.getElementById('downloadBar');
  const errorModal = document.getElementById('errorModal');
  const errorText = document.getElementById('errorText');
  const closeErrorBtn = document.getElementById('closeError');

  downloadOverlay.style.display = 'none';
  downloadContainer.style.display = 'none';

  function capitalize(name) {
    if (!name) return '';
    return name.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function getDirectDriveLink(shareLink) {
    const match = shareLink.match(/\/d\/(.*?)\//);
    return match ? `https://drive.google.com/uc?export=download&id=${match[1]}` : shareLink;
  }

  function fetchWithTimeout(url, options = {}, timeout = 6000) {
    return Promise.race([
      fetch(url, options),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout))
    ]);
  }

  function showSpinner() {
    loadingOverlay.style.display = 'flex';
    const spinner = loadingOverlay.querySelector('.spinner');
    if (spinner) spinner.style.display = 'flex';
    requestAnimationFrame(() => loadingOverlay.classList.add('active'));
  }

  function hideSpinnerKeepBackground() {
    const spinner = loadingOverlay.querySelector('.spinner');
    if (spinner) spinner.style.display = 'none';
  }

  function resetSpinner() {
    loadingOverlay.classList.remove('active');
    loadingOverlay.style.display = 'none';
    const spinner = loadingOverlay.querySelector('.spinner');
    if (spinner) spinner.style.display = 'none';
    void loadingOverlay.offsetWidth;
  }

  function showErrorModal(message) {
    errorText.textContent = message;
    errorModal.style.display = 'flex';
  }

  function showValidationError(message) {
    showSpinner();
    setTimeout(() => {
      hideSpinnerKeepBackground();
      loadingOverlay.style.display = 'none';
      showErrorModal(message);
    }, 2000);
  }

  function keepBackendAwake() {
    setInterval(() => {
      fetch(`${BACKEND_BASE_URL}/health`)
        .then((res) => {
          if (res.ok) console.log('Backend ping successful');
        })
        .catch(() => {});
    }, 5 * 60 * 1000);
  }

  keepBackendAwake();

  const certModal = document.getElementById('certModal');

  function openCertModal() {
    certModal.classList.add('open');
    updateCertModalFieldStyles();
  }

  function closeCertModal() {
    certModal.classList.remove('open');
  }

  document.getElementById('open-cert-modal').addEventListener('click', openCertModal);
  document.getElementById('close-cert-modal').addEventListener('click', closeCertModal);

  certModal.addEventListener('click', (e) => {
    if (e.target === certModal) closeCertModal();
  });

  const gradeSelect = document.getElementById('grade');
  const dobInput = document.getElementById('dob');

  function updateCertModalFieldStyles() {
    gradeSelect.classList.toggle('is-empty', !gradeSelect.value);
    dobInput.classList.toggle('is-empty', !dobInput.value);
  }

  gradeSelect.addEventListener('change', updateCertModalFieldStyles);
  dobInput.addEventListener('change', updateCertModalFieldStyles);
  dobInput.addEventListener('input', updateCertModalFieldStyles);
  updateCertModalFieldStyles();

  async function checkWMIResult(firstName, lastName, dob) {
    serverErrorFlag = false;
    tempCertificate = null;
    lookupSuccess = false;
    lookupMessage = '';

    try {
      const response = await fetchWithTimeout(
        `${BACKEND_BASE_URL}/check-wmi-result`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firstName, lastName, dob })
        },
        6000
      );

      if (response.status === 429) {
        const data = await response.json().catch(() => ({}));
        lookupMessage = data.error || 'Too many attempts. Please try again later.';
        return;
      }

      const result = await response.json();

      if (result.success && result.student) {
        lookupSuccess = true;
        tempCertificate = result.student.certificate || '';
      } else {
        lookupMessage = result.message || 'Unable to find contestant.';
      }
    } catch (err) {
      serverErrorFlag = true;
    }
  }

  function downloadCertificate() {
    downloadOverlay.style.display = 'flex';
    downloadContainer.style.display = 'flex';
    const message = document.getElementById('downloadLabel');
    message.textContent = 'Downloading…';
    progressBar.style.width = '0%';

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 5;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        progressBar.style.width = '100%';

        setTimeout(() => {
          message.textContent = 'Download Complete!';
        }, 300);

        const directLink = getDirectDriveLink(tempCertificate);
        const link = document.createElement('a');
        link.href = directLink;
        link.download = 'WMI_Certificate.pdf';
        link.click();

        setTimeout(() => {
          downloadOverlay.style.display = 'none';
          downloadContainer.style.display = 'none';
          message.textContent = '';
          progressBar.style.width = '0%';
        }, 3800);
      } else {
        progressBar.style.width = progress + '%';
      }
    }, 200);
  }

  async function lookupResult() {
    const firstName = capitalize(document.getElementById('first-name').value.trim());
    const lastName = capitalize(document.getElementById('last-name').value.trim());
    const dob = document.getElementById('dob').value;
    const lookupBtn = document.getElementById('lookup-btn');

    if (!firstName) {
      showValidationError('Please enter your given first name.');
      return;
    }
    if (!lastName) {
      showValidationError('Please enter your given last name.');
      return;
    }
    if (!dob) {
      showValidationError('Please enter your birth date.');
      return;
    }

    closeCertModal();

    lookupBtn.disabled = true;
    resetSpinner();
    showSpinner();

    await checkWMIResult(firstName, lastName, dob);

    if (serverErrorFlag) {
      setTimeout(() => {
        hideSpinnerKeepBackground();
        loadingOverlay.style.display = 'none';
        showErrorModal('Server not responding. Please refresh the page.');
        lookupBtn.disabled = false;
      }, 2000);
      return;
    }

    if (!lookupSuccess) {
      setTimeout(() => {
        hideSpinnerKeepBackground();
        loadingOverlay.style.display = 'none';
        showErrorModal(lookupMessage || 'Unable to find contestant.');
        lookupBtn.disabled = false;
      }, 2000);
      return;
    }

    if (!tempCertificate) {
      setTimeout(() => {
        hideSpinnerKeepBackground();
        loadingOverlay.style.display = 'none';
        showErrorModal('Certificate has not been released yet.');
        lookupBtn.disabled = false;
      }, 2000);
      return;
    }

    setTimeout(() => {
      hideSpinnerKeepBackground();
      loadingOverlay.style.display = 'none';
      downloadCertificate();
      lookupBtn.disabled = false;
    }, 2000);
  }

  document.getElementById('lookup-btn').addEventListener('click', lookupResult);

  // ── Contact form (EmailJS) ──

  function sendEnquiryEmail() {
    const parms = {
      name: document.getElementById('c-name').value,
      email: document.getElementById('c-email').value,
      category: document.getElementById('c-category').value,
      message: document.getElementById('c-msg').value
    };
    return emailjs.send('service_8pruku7', 'template_hkzn2pc', parms);
  }

  function submitEnquiry() {
    sendEnquiryEmail();
    downloadOverlay.style.display = 'flex';
    downloadContainer.style.display = 'flex';
    const message = document.getElementById('downloadLabel');
    message.textContent = 'Submitting enquiry…';
    progressBar.style.width = '0%';

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 5;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        progressBar.style.width = '100%';

        setTimeout(() => {
          message.textContent = 'We have received your enquiry!';
        }, 300);

        setTimeout(() => {
          downloadOverlay.style.display = 'none';
          downloadContainer.style.display = 'none';
          message.textContent = '';
          progressBar.style.width = '0%';
          document.getElementById('contact-form').reset();
          updateCategorySelectStyle();
        }, 2000);
      } else {
        progressBar.style.width = progress + '%';
      }
    }, 200);
  }

  document.getElementById('contact-submit').addEventListener('click', function () {
    const form = document.getElementById('contact-form');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    submitEnquiry();
  });

  const categorySelect = document.getElementById('c-category');

  function updateCategorySelectStyle() {
    categorySelect.classList.toggle('is-empty', !categorySelect.value);
  }

  categorySelect.addEventListener('change', updateCategorySelectStyle);
  updateCategorySelectStyle();

  document.getElementById('contact-form').addEventListener('reset', () => {
    setTimeout(updateCategorySelectStyle, 0);
  });

  // ── Error modal ──

  closeErrorBtn.addEventListener('click', () => {
    errorModal.style.display = 'none';
    resetSpinner();
  });

  errorModal.addEventListener('click', (e) => {
    if (e.target === errorModal) {
      errorModal.style.display = 'none';
      resetSpinner();
    }
  });

  // ── Nav active state ──

  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a:not(.nav-contact)');

  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach((s) => {
      if (window.scrollY >= s.offsetTop - 100) current = s.id;
    });
    navLinks.forEach((a) => {
      a.style.color = a.getAttribute('href') === `#${current}` ? 'var(--accent)' : '';
    });
  });
});
