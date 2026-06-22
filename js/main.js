document.addEventListener('DOMContentLoaded', function () {
  const BACKEND_BASE_URL = 'https://competition-backend-1-zd68.onrender.com';

  let tempCertificate = null;
  let tempReport = null;
  let tempStudent = null;
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

  function titleCaseName(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .replace(/(^|[\s\-',])([a-z])/g, (_, sep, char) => sep + char.toUpperCase());
  }

  function capitalize(name) {
    return titleCaseName(name);
  }

  function formatDisplayName(student) {
    if (student.fullName) return titleCaseName(student.fullName);
    if (student.name) return titleCaseName(student.name);
    const parts = [student.firstName, student.lastName]
      .filter(Boolean)
      .map((part) => titleCaseName(part));
    return parts.length ? parts.join(' ') : '—';
  }

  function formatGrade(grade) {
    if (grade == null || grade === '') return '—';
    const value = String(grade).trim();
    const shortMatch = value.match(/^([Kk]|P|S)(\d+)?$/i);
    if (shortMatch) {
      return shortMatch[2] ? shortMatch[1].toUpperCase() + shortMatch[2] : shortMatch[1].toUpperCase();
    }
    const gradeWordMatch = value.match(/^grade\s+(\d+)$/i);
    if (gradeWordMatch) return `Grade ${gradeWordMatch[1]}`;
    if (/^kindergarten$/i.test(value)) return 'Kindergarten';
    return titleCaseName(value);
  }

  function formatAward(award) {
    if (award == null || award === '') return '—';
    return titleCaseName(String(award).trim().replace(/_/g, ' '));
  }

  function formatScore(value) {
    if (value == null || value === '') return '—';

    if (typeof value === 'number' && !Number.isNaN(value)) {
      return `${value} / 100`;
    }

    const text = String(value).trim();
    const outOf100Match = text.match(/^(\d+(?:\.\d+)?)\s*(?:\/|out of)\s*100$/i);
    if (outOf100Match) return `${outOf100Match[1]} / 100`;

    if (/^\d+(?:\.\d+)?$/.test(text)) {
      return `${text} / 100`;
    }

    const fractionMatch = text.match(/^(\d+(?:\.\d+)?)\s*\/\s*\d+(?:\.\d+)?$/);
    if (fractionMatch) {
      return `${fractionMatch[1]} / 100`;
    }

    return text;
  }

  function formatTotalScore(student) {
    const rawScore =
      student.score ??
      student.totalScore ??
      student.total ??
      null;

    let value = rawScore;
    if (value == null || value === '') {
      const scoreA = student.scoreA ?? student.sectionA ?? student.section1 ?? student.sectionAScore;
      const scoreB = student.scoreB ?? student.sectionB ?? student.section2 ?? student.sectionBScore;
      if (scoreA != null && scoreA !== '' && scoreB != null && scoreB !== '') {
        const a = Number(scoreA);
        const b = Number(scoreB);
        if (!Number.isNaN(a) && !Number.isNaN(b)) value = a + b;
      }
    }

    if (value == null || value === '') return '—';
    if (typeof value === 'number' && !Number.isNaN(value)) return `${value} / 200`;

    const text = String(value).trim();
    const outOf200Match = text.match(/^(\d+(?:\.\d+)?)\s*(?:\/|out of)\s*200$/i);
    if (outOf200Match) return `${outOf200Match[1]} / 200`;
    if (/^\d+(?:\.\d+)?$/.test(text)) return `${text} / 200`;

    return text;
  }

  function formatRanking(value) {
    if (value == null || value === '') return '—';
    const parsed = parseInt(String(value).trim(), 10);
    return Number.isNaN(parsed) ? '—' : String(parsed);
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

  function showSpinner(overModal) {
    loadingOverlay.style.display = 'flex';
    loadingOverlay.classList.toggle('over-modal', !!overModal);
    const spinner = loadingOverlay.querySelector('.spinner');
    if (spinner) spinner.style.display = 'flex';
    requestAnimationFrame(() => loadingOverlay.classList.add('active'));
  }

  function hideSpinnerKeepBackground() {
    const spinner = loadingOverlay.querySelector('.spinner');
    if (spinner) spinner.style.display = 'none';
  }

  function resetSpinner() {
    loadingOverlay.classList.remove('active', 'over-modal');
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
    const certOpen = document.getElementById('certModal')?.classList.contains('open');
    showSpinner(certOpen);
    setTimeout(() => {
      hideSpinnerKeepBackground();
      loadingOverlay.style.display = 'none';
      loadingOverlay.classList.remove('over-modal');
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

  async function checkWMIResult(firstName, lastName, dob, grade) {
    serverErrorFlag = false;
    tempCertificate = null;
    tempReport = null;
    tempStudent = null;
    lookupSuccess = false;
    lookupMessage = '';

    try {
      const response = await fetchWithTimeout(
        `${BACKEND_BASE_URL}/check-wmi-result`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firstName, lastName, dob, grade })
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
        tempStudent = result.student;
        tempCertificate = result.student.certificate || '';
        tempReport =
          result.student.report ||
          result.student.reportUrl ||
          result.student.resultReport ||
          '';
      } else {
        lookupMessage = result.message || 'Unable to find contestant.';
      }
    } catch (err) {
      serverErrorFlag = true;
    }
  }

  function runDownloadProgress(labelEl, barEl, certificateUrl, onDone) {
    labelEl.textContent = 'Downloading certificate…';
    barEl.style.width = '0%';

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 5;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        barEl.style.width = '100%';

        setTimeout(() => {
          labelEl.textContent = 'Download complete!';
        }, 300);

        const directLink = getDirectDriveLink(certificateUrl);
        const link = document.createElement('a');
        link.href = directLink;
        link.download = 'WMI_Certificate.pdf';
        link.click();

        setTimeout(() => {
          if (onDone) onDone();
        }, 1500);
      } else {
        barEl.style.width = progress + '%';
      }
    }, 200);
  }

  function triggerDownload(url, filename) {
    if (!url) return;
    const link = document.createElement('a');
    link.href = getDirectDriveLink(url);
    link.download = filename;
    link.click();
  }

  const resultModal = document.getElementById('resultModal');
  const downloadCertBtn = document.getElementById('download-cert-btn');
  const downloadReportBtn = document.getElementById('download-report-btn');
  const toastEl = document.getElementById('toast');
  let toastTimer = null;

  function showToast(message, duration = 2600) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
    }, duration);
  }

  function resetDownloadButton(btn, labelText) {
    btn.classList.remove('loading');
    const label = btn.querySelector('.btn-label');
    if (label) label.textContent = labelText;
  }

  function handleDownload(btn, type) {
    const isCertificate = type === 'certificate';
    const url = isCertificate ? tempCertificate : tempReport;
    const defaultLabel = isCertificate ? 'Certificate' : 'Report';
    const filename = isCertificate ? 'WMI_Certificate.pdf' : 'WMI_Report.pdf';
    const label = btn.querySelector('.btn-label');

    if (!url) {
      showToast(
        isCertificate ? 'Certificate has not been released yet.' : 'Report has not been released yet.'
      );
      return;
    }

    if (btn.classList.contains('loading')) return;

    btn.classList.add('loading');
    if (label) label.textContent = 'Downloading…';

    setTimeout(() => {
      triggerDownload(url, filename);
      resetDownloadButton(btn, defaultLabel);
      showToast(isCertificate ? 'Certificate downloaded' : 'Report downloaded', 3500);
    }, 3500);
  }

  function playResultConfetti() {
    if (typeof confetti !== 'function') return;

    setTimeout(() => {
      confetti({
        particleCount: 250,
        spread: 300,
        origin: { y: 0.55 },
        ticks: 350,
        zIndex: 220
      });
    });
  }

  function getAwardClass(text) {
    const lower = (text || '').toLowerCase();
    if (lower.includes('gold')) return 'award-gold';
    if (lower.includes('silver')) return 'award-silver';
    if (lower.includes('bronze')) return 'award-bronze';
    if (lower.includes('merit')) return 'award-merit';
    if (lower.includes('participation')) return 'award-participation';
    return '';
  }

  function showResultModal(student) {
    const name = formatDisplayName(student);
    const sectionA = formatScore(
      student.scoreA ?? student.sectionA ?? student.section1 ?? student.sectionAScore
    );
    const sectionB = formatScore(
      student.scoreB ?? student.sectionB ?? student.section2 ?? student.sectionBScore
    );
    const totalScore = formatTotalScore(student);
    const ranking = formatRanking(
      student.globalRanking ??
        student.globalRank ??
        student.ranking ??
        student.rank ??
        student.overallRanking
    );
    const award = formatAward(student.result || student.award);

    document.getElementById('rs-name').textContent = name;
    document.getElementById('rs-section-a').textContent = sectionA;
    document.getElementById('rs-section-b').textContent = sectionB;
    document.getElementById('rs-total').textContent = totalScore;
    document.getElementById('rs-ranking').textContent = ranking;

    const awardEl = document.getElementById('rs-award');
    awardEl.textContent = award;
    awardEl.className = 'result-stat-value ' + getAwardClass(award);

    resultModal.classList.add('open');
    playResultConfetti();

    downloadCertBtn.disabled = !tempCertificate;
    downloadReportBtn.disabled = !tempReport;
    resetDownloadButton(downloadCertBtn, 'Certificate');
    resetDownloadButton(downloadReportBtn, 'Report');
  }

  function closeResultModal() {
    resultModal.classList.remove('open');
    resetDownloadButton(downloadCertBtn, 'Certificate');
    resetDownloadButton(downloadReportBtn, 'Report');
    if (toastEl) toastEl.classList.remove('show');
    clearTimeout(toastTimer);
  }

  downloadCertBtn.addEventListener('click', () => handleDownload(downloadCertBtn, 'certificate'));
  downloadReportBtn.addEventListener('click', () => handleDownload(downloadReportBtn, 'report'));

  document.getElementById('close-result-modal').addEventListener('click', closeResultModal);

  async function lookupResult() {
    const firstName = capitalize(document.getElementById('first-name').value.trim());
    const lastName = capitalize(document.getElementById('last-name').value.trim());
    const dob = document.getElementById('dob').value;
    const grade = gradeSelect.value;
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
    if (!grade) {
      showValidationError('Please select your grade.');
      return;
    }

    lookupBtn.disabled = true;
    resetSpinner();
    showSpinner(certModal.classList.contains('open'));

    await checkWMIResult(firstName, lastName, dob, grade);

    if (serverErrorFlag) {
      setTimeout(() => {
        hideSpinnerKeepBackground();
        loadingOverlay.style.display = 'none';
        loadingOverlay.classList.remove('over-modal');
        showErrorModal('Server not responding. Please refresh the page.');
        lookupBtn.disabled = false;
      }, 2000);
      return;
    }

    if (!lookupSuccess) {
      setTimeout(() => {
        hideSpinnerKeepBackground();
        loadingOverlay.style.display = 'none';
        loadingOverlay.classList.remove('over-modal');
        showErrorModal(lookupMessage || 'Unable to find contestant.');
        lookupBtn.disabled = false;
      }, 2000);
      return;
    }

    if (!tempCertificate) {
      setTimeout(() => {
        hideSpinnerKeepBackground();
        loadingOverlay.style.display = 'none';
        loadingOverlay.classList.remove('over-modal');
        showErrorModal('Certificate has not been released yet.');
        lookupBtn.disabled = false;
      }, 2000);
      return;
    }

    setTimeout(() => {
      hideSpinnerKeepBackground();
      loadingOverlay.style.display = 'none';
      loadingOverlay.classList.remove('over-modal');
      closeCertModal();
      showResultModal(tempStudent);
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

  // ── Nav scroll + active state ──

  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a:not(.nav-contact)');

  function scrollSectionToCenter(section) {
    const sectionTop = section.offsetTop;
    const sectionHeight = section.offsetHeight;
    const viewportHeight = window.innerHeight;
    const target = sectionTop - (viewportHeight - sectionHeight) / 2;
    const maxScroll = document.documentElement.scrollHeight - viewportHeight;
    window.scrollTo({
      top: Math.max(0, Math.min(target, maxScroll)),
      behavior: 'smooth'
    });
  }

  navLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      const section = document.getElementById(href.slice(1));
      if (!section) return;
      e.preventDefault();
      scrollSectionToCenter(section);
      history.pushState(null, '', href);
    });
  });

  window.addEventListener('scroll', () => {
    const viewportCenter = window.scrollY + window.innerHeight / 2;
    let current = '';
    let minDistance = Infinity;

    sections.forEach((s) => {
      const sectionCenter = s.offsetTop + s.offsetHeight / 2;
      const distance = Math.abs(sectionCenter - viewportCenter);
      if (distance < minDistance) {
        minDistance = distance;
        current = s.id;
      }
    });

    navLinks.forEach((a) => {
      a.style.color = a.getAttribute('href') === `#${current}` ? 'var(--accent)' : '';
    });
  });

  // ── Winners carousel ──

  const winnerImages = [
    { src: 'winner-images/rank_1.png', alt: 'WMI 2026 Gold and Silver winners' },
    { src: 'winner-images/rank_2.png', alt: 'WMI 2026 Silver winners' },
    { src: 'winner-images/rank_3.png', alt: 'WMI 2026 Bronze and Merit winners' },
    { src: 'winner-images/rank_4.png', alt: 'WMI 2026 Merit and Participation winners' },
    { src: 'winner-images/rank_5.png', alt: 'WMI 2026 Participation winners' }
  ];

  let carouselIndex = 0;
  let carouselAnimating = false;
  const carouselEl = document.getElementById('winners-carousel');
  const carouselViewport = carouselEl.querySelector('.carousel-viewport');
  const imgLeft = document.getElementById('carousel-img-left');
  const imgActive = document.getElementById('carousel-img-active');
  const imgRight = document.getElementById('carousel-img-right');
  const peekLeft = document.getElementById('carousel-peek-left');
  const peekRight = document.getElementById('carousel-peek-right');
  const enterSlide = document.getElementById('carousel-enter');
  const imgEnter = document.getElementById('carousel-img-enter');
  const SLIDE_MS = 320;

  function mod(n, m) {
    return ((n % m) + m) % m;
  }

  function prepEnterSlide(direction) {
    const incomingIdx = mod(carouselIndex + (direction > 0 ? 2 : -2), winnerImages.length);
    const incoming = winnerImages[incomingIdx];
    imgEnter.src = incoming.src;
    imgEnter.alt = incoming.alt;
    enterSlide.className =
      'carousel-slide peek-enter ' + (direction > 0 ? 'peek-enter-right' : 'peek-enter-left');
  }

  function resetEnterSlide() {
    enterSlide.className = 'carousel-slide peek-enter';
  }

  function renderCarousel() {
    const prevIdx = mod(carouselIndex - 1, winnerImages.length);
    const nextIdx = mod(carouselIndex + 1, winnerImages.length);
    const current = winnerImages[carouselIndex];
    const prev = winnerImages[prevIdx];
    const next = winnerImages[nextIdx];

    imgActive.src = current.src;
    imgActive.alt = current.alt;
    imgLeft.src = prev.src;
    imgLeft.alt = prev.alt;
    imgRight.src = next.src;
    imgRight.alt = next.alt;
  }

  function finishCarouselSlide(direction) {
    carouselIndex = mod(carouselIndex + direction, winnerImages.length);
    carouselViewport.classList.add('no-transition');
    carouselViewport.classList.remove('slide-next', 'slide-prev');
    resetEnterSlide();
    renderCarousel();

    requestAnimationFrame(() => {
      carouselViewport.classList.remove('no-transition');
    });

    setTimeout(() => {
      carouselAnimating = false;
    }, SLIDE_MS + 30);
  }

  function moveCarousel(direction) {
    if (carouselAnimating) return;
    carouselAnimating = true;

    prepEnterSlide(direction);
    carouselViewport.classList.remove('slide-next', 'slide-prev');
    void carouselViewport.offsetWidth;
    carouselViewport.classList.add(direction > 0 ? 'slide-next' : 'slide-prev');

    setTimeout(() => finishCarouselSlide(direction), SLIDE_MS);
  }

  renderCarousel();

  document.getElementById('carousel-prev').addEventListener('click', () => moveCarousel(-1));
  document.getElementById('carousel-next').addEventListener('click', () => moveCarousel(1));
  peekLeft.addEventListener('click', () => moveCarousel(-1));
  peekRight.addEventListener('click', () => moveCarousel(1));

  carouselEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      moveCarousel(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      moveCarousel(1);
    }
  });

  document.addEventListener('keydown', (e) => {
    const modalOpen =
      certModal.classList.contains('open') ||
      resultModal.classList.contains('open') ||
      errorModal.style.display === 'flex';
    if (modalOpen) return;

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const rect = carouselEl.getBoundingClientRect();
      const inView = rect.top < window.innerHeight && rect.bottom > 0;
      if (!inView) return;
      e.preventDefault();
      moveCarousel(e.key === 'ArrowLeft' ? -1 : 1);
    }
  });
});
