/* ==========================================================================
   모바일 결연서 — main.js
   아코디언 UI + 단계 잠금 + 폼 유형별 필드 노출
   ========================================================================== */
(function () {
  'use strict';

  /* ── 상수 ───────────────────────────────────────────── */
  const FORM_TYPE_LABEL = {
    standard: '스탠다드',
    consign_manual: '컨사인-직접입력용',
    consign_assigned: '컨사인-지정용',
    church_reg: '교회·기금정기',
    church_both: '교회·기금정기일시',
    corp: '기업후원',
    corp_child: '기업 1:1 어린이양육 후원',
    corp_child_emp: '기업 1:1 어린이양육 후원_임직원용'
  };
  /** 회원정보에서 기업 필드를 쓰는 유형 (임직원용은 개인 필드를 사용) */
  const CORP_INFO_FORMS = ['corp', 'corp_child'];
  /** 설정 패널에서 적용 유형을 짧게 표기 */
  const FORM_TYPE_SHORT = {
    standard: '스탠다드', consign_manual: '컨사인-직접', consign_assigned: '컨사인-지정',
    church_reg: '교회정기', church_both: '교회정기일시', corp: '기업',
    corp_child: '기업 1:1양육', corp_child_emp: '기업 1:1양육-임직원'
  };

  const GROUP_TITLES = {
    1: '1. 후원회원 정보',
    2: '2. 후원 방법',
    3: '3. 후원금 결제방법',
    4: '4. 동의 및 서명'
  };
  const GROUP_COUNT = 4;
  const EMAIL_REQUIRED_FORMS = ['church_reg', 'church_both'];
  const MINOR_AGE = 14; // 만 14세 미만이면 법정대리인 항목 노출
  const CHILD_FEE = 50000; // 1:1 어린이결연 월 후원금

  /* ── 상태 ───────────────────────────────────────────── */
  let currentFormType = 'standard';
  // 조건부 노출 플래그 (data-cond 속성과 매칭)
  const conditions = {
    minor: false,
    babyMomEtc: false,
    corpProgramEtc: false,
    corpAmount: false   // 기업 후원방법을 고른 뒤에만 금액칸 노출
  };
  const manualVisibility = {}; // 필드별 수동 노출/숨김 (기본 true = 노출)
  const values = {};           // 필드 입력 완료 여부
  const unlocked = { 1: true, 2: false, 3: false, 4: false };

  /* ── DOM 헬퍼 ───────────────────────────────────────── */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const groupEl = (n) => document.getElementById('group' + n);

  /* ══════════════════════════════════════════════════════
     단계 노출 — 한 번에 현재 단계 하나만 화면에 보인다
     ══════════════════════════════════════════════════════ */
  function isOpen(n) {
    return groupEl(n).classList.contains('open');
  }

  function setOpen(n, open) {
    const g = groupEl(n);
    if (!g) return;
    if (open && !unlocked[n]) return; // 잠긴 단계는 열 수 없음
    g.classList.toggle('open', open);
  }

  function closeAll() {
    for (let i = 1; i <= GROUP_COUNT; i++) setOpen(i, false);
  }

  /** 화면에 열려 있는 단계 */
  function openStepNo() {
    for (let i = 1; i <= GROUP_COUNT; i++) if (isOpen(i)) return i;
    return 1;
  }

  /** 특정 단계로 이동. 해금된 단계만 가능 */
  function goToStep(n) {
    if (!unlocked[n] || isOpen(n)) return;
    closeAll();
    setOpen(n, true);
    updateProgress();
    setTimeout(() => scrollToGroup(n), 60);
  }

  function unlock(n) {
    if (n > GROUP_COUNT) return;
    unlocked[n] = true;
    groupEl(n).classList.remove('locked');
  }

  /** 기본 선택값(후원기간 10년 이상 / 편지 영어) 적용 */
  function applyDefaults() {
    const recommend = $('.period-btn-recommend');
    if (recommend) {
      recommend.classList.add('active');
      recommend.setAttribute('aria-pressed', 'true');
      const hintEl = document.getElementById('periodHint');
      if (hintEl && recommend.dataset.hint) hintEl.textContent = recommend.dataset.hint;
    }
    const letterEn = $('[data-choice="letter"] .choice-btn[data-val="영어"]');
    if (letterEn) letterEn.classList.add('active');

    values.period = true;
    values.periodValue = '10년 이상';
    values.letter = true;
    values.letterValue = '영어';
  }

  /** 입력값·선택 상태를 모두 처음 상태로 되돌린다 */
  function resetForm() {
    Object.keys(values).forEach((k) => { delete values[k]; });
    Object.keys(conditions).forEach((k) => { conditions[k] = false; });

    // 입력 요소
    $$('.page input').forEach((el) => {
      if (el.type === 'checkbox' || el.type === 'radio') { el.checked = false; return; }
      if (el.type === 'range') { el.value = el.getAttribute('value') || el.min || 0; return; }
      el.value = '';
    });

    // 셀렉트박스
    $$('select[data-input]').forEach((sel) => {
      sel.value = '';
      sel.classList.add('placeholder');
    });

    // 선택 버튼 / 지역 카드
    $$('.choice-btn, .period-btn').forEach((b) => {
      b.classList.remove('active');
      if (b.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', 'false');
    });
    $$('.region-card').forEach((c) => {
      c.classList.remove('selected');
      c.setAttribute('aria-pressed', 'false');
    });

    // 선물금 토글 (생일=기본 켜짐, 크리스마스=기본 꺼짐)
    [
      { id: 'giftBdToggle', panel: 'giftBdSlider', on: true },
      { id: 'giftXmasToggle', panel: 'giftXmasSlider', on: false }
    ].forEach((g) => {
      const toggle = document.getElementById(g.id);
      const panel = document.getElementById(g.panel);
      if (toggle) {
        toggle.classList.toggle('on', g.on);
        toggle.setAttribute('aria-checked', String(g.on));
      }
      if (panel) panel.hidden = !g.on;
    });
    $$('[data-slider-target]').forEach(handleSlider);

    // 결제수단 / 인증 상태
    $$('.payment-method-box').forEach((b) => b.classList.remove('active-method'));
    $$('.radio-dot').forEach((d) => d.classList.remove('checked'));
    phoneVerifier.reset();
    accountVerifier.reset();
    clearBizLicense();
    setMsg(document.getElementById('cardMsg'), '', '');

    // 펼침 영역 / 기업 금액 문구
    const wrap = document.getElementById('corpProgramEtcWrap');
    if (wrap) wrap.classList.remove('open');
    const trigger = $('[aria-controls="corpProgramEtcWrap"]');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');

    const amtInput = document.getElementById('corpAmountInput');
    const amtUnit = document.getElementById('corpAmountUnit');
    const amtField = $('[data-field="corpAmount"]');
    if (amtInput) { amtInput.placeholder = '금액 입력'; amtInput.setAttribute('aria-label', '후원금액'); }
    if (amtUnit) amtUnit.textContent = '원';
    if (amtField) amtField.dataset.label = '후원금액';

    $$('.field.invalid').forEach((el) => el.classList.remove('invalid'));

    applyDefaults();
  }

  /** 단계 진행 상태를 처음(회원정보)으로 되돌린다 */
  function resetSteps() {
    for (let i = 1; i <= GROUP_COUNT; i++) {
      unlocked[i] = i === 1;
      const g = groupEl(i);
      if (!g) continue;
      g.classList.toggle('locked', i !== 1);
      g.classList.remove('completed');
    }
    closeAll();
    setOpen(1, true);
    updateProgress();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function scrollToGroup(n) {
    const g = groupEl(n);
    if (!g) return;
    const top = g.getBoundingClientRect().top + window.pageYOffset;
    const barH = ($('.top-bar') ? $('.top-bar').offsetHeight : 0) + 10;
    window.scrollTo({ top: Math.max(top - barH, 0), behavior: 'smooth' });
  }

  /**
   * 이체일·결제일을 고르지 않았으면 25일을 기본값으로 저장한다.
   * (안내 문구: *미선택 시 25일 이체)
   */
  const PAY_DATE_DEFAULT = '25일';
  function applyPayDateDefault() {
    ['payDate', 'payDateCard'].forEach((key) => {
      const group = $('[data-choice="' + key + '"]');
      if (!group) return;
      const field = group.closest('[data-field]');
      if (!field || !isFieldVisible(field)) return;
      if ($('.choice-btn.active', group)) return;

      const btn = $('.choice-btn[data-val="' + PAY_DATE_DEFAULT + '"]', group);
      if (btn) handleChoiceClick(btn);
    });
  }

  /** '다음' 버튼: 현재 단계 닫고 다음 단계 해금 + 열기 */
  function goNext(fromGroup) {
    applyPayDateDefault();
    if (!validateGroup(fromGroup)) return; // 필수값 미입력 시 얼럿
    const next = fromGroup + 1;
    if (next > GROUP_COUNT) return;
    unlock(fromGroup); // 지나온 단계는 항상 해금 상태로 유지
    unlock(next);
    setOpen(fromGroup, false);
    setOpen(next, true);
    updateProgress();
    setTimeout(() => scrollToGroup(next), 180);
  }

  /* ══════════════════════════════════════════════════════
     폼 유형별 필드 노출
     ══════════════════════════════════════════════════════ */
  function applyVisibility() {
    $$('[data-field]').forEach((el) => {
      const id = el.dataset.field;
      const forms = (el.dataset.forms || '').split(',').map((s) => s.trim());
      const matchesForm = forms.includes(currentFormType);
      const manualOn = manualVisibility[id] !== false;
      // data-cond 가 있으면 해당 조건까지 충족해야 노출
      const cond = el.dataset.cond;
      const condOn = !cond || conditions[cond] === true;
      el.classList.toggle('field-hidden', !(matchesForm && manualOn && condOn));
    });

    // 입력 필드가 아닌 안내 문구 — 폼 유형만으로 노출 결정
    $$('[data-only-forms]').forEach((el) => {
      const forms = el.dataset.onlyForms.split(',').map((s) => s.trim());
      el.hidden = !forms.includes(currentFormType);
    });

    // 이메일 필수 표시는 폼 유형에 따라 달라짐
    const emailMark = $('.email-req-mark');
    if (emailMark) emailMark.hidden = !EMAIL_REQUIRED_FORMS.includes(currentFormType);

    // 컨사인-지정용: 어린이 정보 카드
    const card = document.getElementById('childInfoCard');
    if (card) card.hidden = currentFormType !== 'consign_assigned';

    // 개인 / 기업 필드 스위칭
    //  · 회원정보: 기업후원·기업 1:1 어린이양육은 기업 필드
    //  · 후원방법: 어린이 관련 항목이 필요한 기업 1:1 어린이양육은 개인용 블록을 함께 사용
    const isCorpInfo = CORP_INFO_FORMS.indexOf(currentFormType) !== -1;
    const isCorpSupport = currentFormType === 'corp';
    const toggleHidden = (sel, hide) => { const el = $(sel); if (el) el.hidden = hide; };
    toggleHidden('.personal-fields', isCorpInfo);
    toggleHidden('.corp-fields', !isCorpInfo);
    toggleHidden('.personal-support-fields', isCorpSupport);
    toggleHidden('.corp-support-fields', !isCorpSupport);

    // 폼 유형이 바뀌면 미입력 강조는 초기화
    $$('.field.invalid').forEach((el) => el.classList.remove('invalid'));

    updateGroupCompletion();
  }

  /* ══════════════════════════════════════════════════════
     입력 처리
     ══════════════════════════════════════════════════════ */
  function setValue(id, filled) {
    values[id] = !!filled;
    if (filled) {
      // 입력되면 미입력 강조 해제
      $$('[data-field="' + id + '"]').forEach((el) => el.classList.remove('invalid'));
      if (id === 'payMethod') $$('.payment-method-box.invalid').forEach((el) => el.classList.remove('invalid'));
    }
    updateGroupCompletion();
  }

  /* ══════════════════════════════════════════════════════
     생년월일 → 만 나이 / 14세 미만 판정
     ══════════════════════════════════════════════════════ */
  /** 'YYYYMMDD' / 'YYYY-MM-DD' / 'YYYY.MM.DD' 를 Date 로. 유효하지 않으면 null */
  function parseBirth(raw) {
    const s = String(raw || '').replace(/[^0-9]/g, '');
    if (s.length !== 8) return null;
    const y = +s.slice(0, 4), m = +s.slice(4, 6), d = +s.slice(6, 8);
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    if (y < 1900 || dt.getTime() > Date.now()) return null;
    return dt;
  }

  /** 만 나이 */
  function calcAge(dt) {
    const t = new Date();
    let age = t.getFullYear() - dt.getFullYear();
    const beforeBirthday = (t.getMonth() - dt.getMonth()) || (t.getDate() - dt.getDate());
    if (beforeBirthday < 0) age -= 1;
    return age;
  }

  /** 법정대리인 영역 노출 여부 갱신 */
  function updateMinorState(raw) {
    const dt = parseBirth(raw);
    const age = dt ? calcAge(dt) : null;
    const wasMinor = conditions.minor;
    conditions.minor = age !== null && age < MINOR_AGE;
    if (wasMinor === conditions.minor) return;

    // 14세 이상으로 바뀌면 숨겨질 법정대리인 입력값은 초기화
    if (wasMinor) clearMinorBox();
    applyVisibility();
  }

  function clearMinorBox() {
    const box = $('[data-field="minorGuardian"]');
    if (!box) return;
    $$('input', box).forEach((i) => { i.value = ''; });
    $$('.choice-btn.active', box).forEach((b) => b.classList.remove('active'));
    delete values.guardianConsent;
  }

  /** 셀렉트박스 선택 처리 (미선택이면 placeholder 색) */
  function handleSelectInput(el) {
    const id = el.dataset.input;
    const chosen = el.value.trim();
    el.classList.toggle('placeholder', chosen === '');
    values[id + 'Value'] = chosen;
    setValue(id, chosen !== '');
  }

  function handleChoiceClick(btn) {
    const group = btn.closest('.choice-group');
    if (!group) return;
    const multi = group.dataset.multi === 'true';
    if (multi) {
      btn.classList.toggle('active');
    } else {
      $$('.choice-btn', group).forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    }
    const active = $('.choice-btn.active', group);
    values[group.dataset.choice + 'Value'] = active ? active.dataset.val : '';
    setValue(group.dataset.choice, !!active);

    // 마케팅 수신 동의: 전체동의 → 채널 전체 체크 / 동의하지 않음 → 전체 해제
    if (group.dataset.choice === 'consentMkt') syncMktChannels(btn.dataset.val);

    // 아기와 엄마 살리기: '기타' 선택 시에만 금액 직접 입력칸 노출
    if (group.dataset.choice === 'babyMomAmount') {
      syncEtcInput('babyMomEtc', 'babyMomEtcInput', btn.dataset.val === '기타');
    }
    // 후원 프로그램: '기타지정목적' 선택 시 해당 항목 바로 아래로 펼침
    if (group.dataset.choice === 'corpProgram') {
      syncEtcInput('corpProgramEtc', 'corpProgramEtcInput', btn.dataset.val === '기타지정목적', 'corpProgramEtcWrap');
    }
    // 기업 후원방법: 일시 → 우측 금액칸 / 정기 → 후원금액(월)
    if (group.dataset.choice === 'corpMethod') syncCorpMethod(btn.dataset.val);
  }

  /** 후원방법을 고르면 금액칸을 우측에 노출하고, 일시/정기에 맞춰 문구를 바꾼다 */
  function syncCorpMethod(val) {
    const once = val === '일시후원';
    const wasHidden = !conditions.corpAmount;
    conditions.corpAmount = !!val;

    const input = document.getElementById('corpAmountInput');
    const unit = document.getElementById('corpAmountUnit');
    const field = $('[data-field="corpAmount"]');
    const label = once ? '일시후원 금액' : '월 후원금액';

    if (input) {
      input.placeholder = label;
      input.setAttribute('aria-label', label);
    }
    if (unit) unit.textContent = once ? '원' : '원 / 월';
    if (field) field.dataset.label = label;

    applyVisibility();
    if (wasHidden && input) input.focus();
  }

  /**
   * '기타' 계열 직접입력칸 노출/초기화.
   * wrapId를 주면 해당 영역을 펼침/접힘으로, 없으면 data-cond 노출로 처리한다.
   */
  function syncEtcInput(condKey, inputId, on, wrapId) {
    if (conditions[condKey] === on) return;
    conditions[condKey] = on;

    const input = document.getElementById(inputId);
    if (!on && input) {
      input.value = '';
      values[condKey] = false;
    }

    if (wrapId) {
      const wrap = document.getElementById(wrapId);
      if (wrap) wrap.classList.toggle('open', on);
      const trigger = $('[aria-controls="' + wrapId + '"]');
      if (trigger) trigger.setAttribute('aria-expanded', String(on));
      updateGroupCompletion();
    } else {
      applyVisibility();
    }

    if (on && input) input.focus();
  }

  /* ── 마케팅 수신 채널 ── */
  const mktBoxes = () => $$('.mkt-channels input[type="checkbox"]');

  function syncMktChannels(val) {
    const checked = val === '전체동의';
    mktBoxes().forEach((cb) => { cb.checked = checked; });
  }

  /** 채널을 직접 켜고 끌 때 전체동의/동의하지 않음 상태를 되맞춘다 */
  function onMktChannelChange() {
    const group = $('[data-choice="consentMkt"]');
    if (!group) return;
    const boxes = mktBoxes();
    const allOn = boxes.length > 0 && boxes.every((b) => b.checked);
    const allOff = boxes.every((b) => !b.checked);

    $$('.choice-btn', group).forEach((b) => b.classList.remove('active'));
    if (allOn) {
      const btn = $('.choice-btn[data-val="전체동의"]', group);
      if (btn) btn.classList.add('active');
    } else if (allOff) {
      const btn = $('.choice-btn[data-val="동의하지 않음"]', group);
      if (btn) btn.classList.add('active');
    }
    setValue('consentMkt', !!$('.choice-btn.active', group));
  }

  function handlePeriodClick(btn) {
    const wrap = btn.closest('.period-options');
    if (!wrap) return;
    $$('.period-btn', wrap).forEach((b) => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');

    // 선택한 기간에 맞는 안내 문구로 교체
    const hintEl = document.getElementById('periodHint');
    if (hintEl && btn.dataset.hint) {
      const changed = hintEl.textContent !== btn.dataset.hint;
      hintEl.textContent = btn.dataset.hint;
      if (changed) {
        hintEl.classList.remove('flash');
        void hintEl.offsetWidth; // 리플로우로 애니메이션 재시작
        hintEl.classList.add('flash');
      }
    }

    values.periodValue = btn.dataset.val || btn.textContent.trim();
    setValue('period', true);
  }

  function handleGiftToggle(el) {
    const on = el.classList.toggle('on');
    el.setAttribute('aria-checked', String(on));
    const panel = document.getElementById(el.dataset.giftPanel);
    if (panel) panel.hidden = !on;
    setValue(el.dataset.giftToggle, on);
  }

  function handleSlider(input) {
    const target = document.getElementById(input.dataset.sliderTarget);
    if (target) target.textContent = parseInt(input.value, 10).toLocaleString('ko-KR');
    renderTotal();
  }

  /* ══════════════════════════════════════════════════════
     지역 선택 (지도 UI)
     ══════════════════════════════════════════════════════ */
  function selectRegion(value) {
    $$('.region-card').forEach((card) => {
      const on = card.dataset.region === value;
      card.classList.toggle('selected', on);
      card.setAttribute('aria-pressed', String(on));
    });

    values.regionValue = value;
    setValue('region', true);
  }

  /* ══════════════════════════════════════════════════════
     어린이번호 QR 스캔
     ══════════════════════════════════════════════════════ */
  const JSQR_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js';
  let qrStream = null;
  let qrTimer = 0;
  let jsqrLoading = null;

  /** BarcodeDetector가 없는 브라우저용 폴백 디코더 */
  function loadJsQR() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    if (jsqrLoading) return jsqrLoading;
    jsqrLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = JSQR_SRC;
      s.onload = () => (window.jsQR ? resolve(window.jsQR) : reject(new Error('jsQR missing')));
      s.onerror = () => reject(new Error('jsQR load failed'));
      document.head.appendChild(s);
    });
    return jsqrLoading;
  }

  function qrMsg(text, isError) {
    const el = document.getElementById('qrMsg');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('error', !!isError);
  }

  function newDetector() {
    if (!('BarcodeDetector' in window)) return null;
    try { return new window.BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { return null; }
  }

  /** QR 원문에서 어린이번호만 추려낸다 (URL·파라미터 형태도 허용) */
  function parseChildNo(raw) {
    const text = String(raw || '').trim();
    if (!text) return '';
    const keyed = text.match(/(?:child(?:_?id|_?no)?|no|id)\s*[=:/]\s*([A-Za-z0-9-]{4,})/i);
    if (keyed) return keyed[1];
    const numeric = text.match(/\d[\d-]{5,}\d/);
    if (numeric) return numeric[0];
    const last = text.split(/[/?#]/).filter(Boolean).pop();
    return last || text;
  }

  function fillChildNo(raw) {
    const input = document.getElementById('childNoInput');
    if (!input) return;
    input.value = parseChildNo(raw);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function stopQrCamera() {
    if (qrTimer) { clearTimeout(qrTimer); qrTimer = 0; }
    if (qrStream) { qrStream.getTracks().forEach((t) => t.stop()); qrStream = null; }
    const video = document.getElementById('qrVideo');
    if (video) {
      try { video.pause(); } catch (e) { /* 일부 환경에서 미구현 */ }
      video.srcObject = null;
    }
  }

  function closeQrScanner() {
    stopQrCamera();
    const overlay = document.getElementById('qrOverlay');
    if (overlay) overlay.hidden = true;
  }

  async function openQrScanner() {
    const overlay = document.getElementById('qrOverlay');
    if (!overlay) return;
    overlay.hidden = false;
    qrMsg('카메라를 준비하고 있습니다…');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      qrMsg('이 브라우저에서는 카메라를 쓸 수 없습니다. QR 이미지 파일로 불러오거나 번호를 직접 입력해 주세요.', true);
      return;
    }

    try {
      qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
    } catch (err) {
      const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      qrMsg(denied
        ? '카메라 권한이 거부되었습니다. 브라우저 설정에서 허용하거나, QR 이미지 파일로 불러와 주세요.'
        : '카메라를 열 수 없습니다. QR 이미지 파일로 불러오거나 번호를 직접 입력해 주세요.', true);
      return;
    }

    const video = document.getElementById('qrVideo');
    video.srcObject = qrStream;
    try { await video.play(); } catch (e) { /* 자동재생 차단은 무시 */ }
    qrMsg('카메라를 어린이 카드의 QR코드에 맞춰 주세요.');
    runQrLoop(video);
  }

  async function runQrLoop(video) {
    const detector = newDetector();
    let decode;

    if (detector) {
      decode = async () => {
        const codes = await detector.detect(video);
        return codes && codes.length ? codes[0].rawValue : null;
      };
    } else {
      let jsQR;
      try {
        jsQR = await loadJsQR();
      } catch (e) {
        qrMsg('QR 인식 모듈을 불러오지 못했습니다. 번호를 직접 입력해 주세요.', true);
        return;
      }
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      decode = () => {
        if (!video.videoWidth) return null;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const found = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' });
        return found ? found.data : null;
      };
    }

    const tick = async () => {
      if (!qrStream) return;
      let raw = null;
      try { raw = await decode(); } catch (e) { /* 프레임 실패는 다음 프레임에서 재시도 */ }
      if (raw) {
        fillChildNo(raw);
        qrMsg('인식되었습니다.');
        setTimeout(closeQrScanner, 350);
        return;
      }
      qrTimer = setTimeout(tick, 180);
    };
    tick();
  }

  /** 카메라 대신 QR 이미지 파일로 인식 */
  async function decodeQrFile(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
      });

      const detector = newDetector();
      if (detector) {
        try {
          const codes = await detector.detect(img);
          if (codes && codes.length) return codes[0].rawValue;
        } catch (e) { /* 폴백으로 진행 */ }
      }

      const jsQR = await loadJsQR();
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      const frame = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      const found = jsQR(frame.data, frame.width, frame.height);
      return found ? found.data : null;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function handleQrFile(input) {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    qrMsg('이미지를 확인하고 있습니다…');
    let raw = null;
    try { raw = await decodeQrFile(file); } catch (e) { /* 아래에서 안내 */ }
    if (!raw) {
      qrMsg('QR코드를 찾지 못했습니다. 다른 이미지를 사용하거나 번호를 직접 입력해 주세요.', true);
      return;
    }
    fillChildNo(raw);
    qrMsg('인식되었습니다.');
    setTimeout(closeQrScanner, 350);
  }

  /* ══════════════════════════════════════════════════════
     사업자등록증사본 업로드
     ══════════════════════════════════════════════════════ */
  const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
  let bizLicenseUrl = null;

  function clearBizLicense() {
    const input = document.getElementById('bizLicenseInput');
    if (input) input.value = '';
    if (bizLicenseUrl) { URL.revokeObjectURL(bizLicenseUrl); bizLicenseUrl = null; }

    const preview = document.getElementById('bizLicensePreview');
    if (preview) preview.hidden = true;
    const thumb = document.getElementById('bizLicenseThumb');
    if (thumb) { thumb.hidden = true; thumb.removeAttribute('src'); }
    setMsg(document.getElementById('bizLicenseMsg'), '', '');

    setValue('bizLicense', false);
  }

  function handleBizLicense(input) {
    const msgEl = document.getElementById('bizLicenseMsg');
    const file = input.files && input.files[0];
    if (!file) { clearBizLicense(); return; }

    if (file.size > UPLOAD_MAX_BYTES) {
      clearBizLicense();
      setMsg(msgEl, '파일 용량이 10MB를 넘습니다. 더 작은 파일로 올려 주세요.', 'error');
      return;
    }
    const isImage = /^image\//.test(file.type);
    if (!isImage && file.type !== 'application/pdf') {
      clearBizLicense();
      setMsg(msgEl, '이미지(JPG·PNG) 또는 PDF 파일만 올릴 수 있습니다.', 'error');
      return;
    }

    if (bizLicenseUrl) URL.revokeObjectURL(bizLicenseUrl);
    const thumb = document.getElementById('bizLicenseThumb');
    if (isImage && thumb) {
      bizLicenseUrl = URL.createObjectURL(file);
      thumb.src = bizLicenseUrl;
      thumb.hidden = false;
    } else if (thumb) {
      bizLicenseUrl = null;
      thumb.hidden = true;
    }

    const nameEl = document.getElementById('bizLicenseName');
    if (nameEl) nameEl.textContent = file.name;
    const preview = document.getElementById('bizLicensePreview');
    if (preview) preview.hidden = false;

    setMsg(msgEl, '첨부되었습니다.', 'ok');
    setValue('bizLicense', true);
  }

  /* ══════════════════════════════════════════════════════
     주소찾기
     ══════════════════════════════════════════════════════ */
  function openAddressSearch(btn) {
    const row = btn.closest('.addr-row');
    const input = row && $('.text-input', row);
    if (!input) return;
    const detail = row.parentElement ? $('.addr-detail', row.parentElement) : null;

    const fill = (addr, zonecode) => {
      input.value = (zonecode ? '(' + zonecode + ') ' : '') + addr;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      if (detail) detail.focus();
    };

    // 카카오(다음) 우편번호 서비스가 로드된 경우
    if (window.daum && window.daum.Postcode) {
      new window.daum.Postcode({
        oncomplete: (data) => {
          let addr = data.roadAddress || data.jibunAddress || data.address || '';
          if (data.buildingName) addr += ' (' + data.buildingName + ')';
          fill(addr, data.zonecode);
        }
      }).open();
      return;
    }

    // 폴백: 직접 입력 안내
    alert('주소찾기 서비스를 불러올 수 없습니다.\n네트워크 연결을 확인하시거나, 주소를 직접 입력해 주세요.');
    input.focus();
  }

  /* ══════════════════════════════════════════════════════
     인증(휴대번호 문자 / 계좌 1원) — 동작이 같아 공통 모듈로 사용
     ══════════════════════════════════════════════════════ */
  const VERIFY_SEC = 180;

  function setMsg(el, text, kind) {
    if (!el) return;
    el.textContent = text || '';
    el.className = 'verify-msg' + (kind ? ' ' + kind : '');
  }
  const mmss = (sec) => String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
  const randomCode = (len) => {
    let out = '';
    for (let i = 0; i < len; i++) out += Math.floor(Math.random() * 10);
    return out.replace(/^0/, '1'); // 앞자리 0 방지
  };

  /**
   * 인증 위젯 생성. 서버가 없으므로 인증번호를 만들어 안내 문구에 노출하는 데모 방식입니다.
   * 실제 연동 시 request/confirm 내부만 API 호출로 바꾸면 됩니다.
   */
  function createVerifier(cfg) {
    let code = null;
    let timerId = 0;
    let left = 0;

    const el = (id) => document.getElementById(id);
    const msg = (text, kind) => setMsg(el(cfg.msgId), text, kind);

    function setVerified(ok) {
      values[cfg.valueKey] = !!ok;
      const badge = el(cfg.badgeId);
      if (badge) badge.hidden = !ok;
      const btn = el(cfg.requestBtnId);
      if (btn) btn.textContent = ok ? '재인증' : '인증요청';
    }

    function stop() { if (timerId) { clearInterval(timerId); timerId = 0; } }

    function start() {
      stop();
      left = VERIFY_SEC;
      const t = el(cfg.timerId);
      const render = () => { if (t) t.textContent = mmss(left); };
      render();
      timerId = setInterval(() => {
        left -= 1;
        render();
        if (left <= 0) {
          stop();
          code = null;
          msg('인증 시간이 만료되었습니다. 인증을 다시 요청해 주세요.', 'error');
        }
      }, 1000);
    }

    function request() {
      const target = el(cfg.targetId);
      if (onlyDigits(target && target.value).length < cfg.minTargetLen) {
        msg(cfg.invalidTargetMsg, 'error');
        if (target) target.focus();
        return;
      }

      code = randomCode(cfg.codeLen);
      setVerified(false);

      const box = el(cfg.boxId);
      if (box) box.hidden = false;
      const codeInput = el(cfg.codeId);
      if (codeInput) { codeInput.value = ''; codeInput.focus(); }

      msg(cfg.sentMsg + ' (데모 인증번호: ' + code + ')', 'info');
      start();
      updateGroupCompletion();
    }

    function confirm() {
      const entered = onlyDigits((el(cfg.codeId) || {}).value);

      if (!code) { msg('인증 시간이 만료되었습니다. 인증을 다시 요청해 주세요.', 'error'); return; }
      if (entered.length !== cfg.codeLen) { msg('인증번호 ' + cfg.codeLen + '자리를 입력해 주세요.', 'error'); return; }
      if (entered !== code) { msg('인증번호가 일치하지 않습니다.', 'error'); return; }

      stop();
      code = null;
      setVerified(true);
      const box = el(cfg.boxId);
      if (box) box.hidden = true;
      msg(cfg.doneMsg, 'ok');
      updateGroupCompletion();
    }

    /** 대상 번호가 바뀌면 인증을 다시 받아야 한다 */
    function reset() {
      stop();
      code = null;
      setVerified(false);
      const box = el(cfg.boxId);
      if (box) box.hidden = true;
      msg('', '');
    }

    return { request: request, confirm: confirm, reset: reset };
  }

  const phoneVerifier = createVerifier({
    valueKey: 'phoneVerified',
    targetId: 'phoneInput', minTargetLen: 10,
    requestBtnId: 'phoneVerifyBtn', boxId: 'phoneVerifyBox', codeId: 'phoneCodeInput',
    timerId: 'phoneTimer', msgId: 'phoneVerifyMsg', badgeId: 'phoneVerifiedBadge',
    codeLen: 6,
    invalidTargetMsg: '휴대번호를 정확히 입력한 뒤 인증을 요청해 주세요.',
    sentMsg: '입력하신 번호로 인증번호를 보냈습니다.',
    doneMsg: '휴대번호 인증이 완료되었습니다.'
  });

  const accountVerifier = createVerifier({
    valueKey: 'accountVerified',
    targetId: 'cmsAccountInput', minTargetLen: 8,
    requestBtnId: 'cmsVerifyBtn', boxId: 'cmsVerifyBox', codeId: 'cmsCodeInput',
    timerId: 'cmsTimer', msgId: 'cmsVerifyMsg', badgeId: 'cmsVerifiedBadge',
    codeLen: 4,
    invalidTargetMsg: '계좌번호를 정확히 입력한 뒤 인증을 요청해 주세요.',
    sentMsg: '입력하신 계좌로 1원을 보냈습니다.',
    doneMsg: '계좌 인증이 완료되었습니다.'
  });

  /** 010-0000-0000 형태로 정리 */
  function formatPhone(v) {
    const d = onlyDigits(v).slice(0, 11);
    if (d.length < 4) return d;
    if (d.length < 8) return d.slice(0, 3) + '-' + d.slice(3);
    return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
  }

  /* ══════════════════════════════════════════════════════
     카드번호 유효성 검사
     ══════════════════════════════════════════════════════ */
  /** Luhn 검사 */
  function luhnValid(num) {
    if (!num) return false;
    let sum = 0;
    let alt = false;
    for (let i = num.length - 1; i >= 0; i--) {
      let n = Number(num[i]);
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n;
      alt = !alt;
    }
    return sum % 10 === 0;
  }

  function cardBrand(num) {
    if (/^4/.test(num)) return 'VISA';
    if (/^(5[1-5]|2[2-7])/.test(num)) return 'Mastercard';
    if (/^3[47]/.test(num)) return 'AMEX';
    if (/^35/.test(num)) return 'JCB';
    return '';
  }

  function handleCardInput(el) {
    const raw = onlyDigits(el.value).slice(0, 19);
    el.value = raw.replace(/(\d{4})(?=\d)/g, '$1-');

    const msgEl = document.getElementById('cardMsg');
    values.cardValid = false;

    if (!raw) { setMsg(msgEl, '', ''); return; }
    if (raw.length < 13) { setMsg(msgEl, '카드번호 자리수를 확인해 주세요.', 'pending'); return; }
    if (!luhnValid(raw)) { setMsg(msgEl, '카드번호를 다시 확인해 주세요.', 'error'); return; }

    values.cardValid = true;
    const brand = cardBrand(raw);
    setMsg(msgEl, (brand ? brand + ' · ' : '') + '유효한 카드번호입니다.', 'ok');
  }

  function selectPayMethod(method) {
    const boxes = { account: document.getElementById('payAccountBox'), card: document.getElementById('payCardBox') };
    const dots = { account: document.getElementById('dotAccount'), card: document.getElementById('dotCard') };
    Object.keys(boxes).forEach((key) => {
      const active = key === method;
      if (boxes[key]) boxes[key].classList.toggle('active-method', active);
      if (dots[key]) dots[key].classList.toggle('checked', active);
    });
    values.payMethodValue = method;
    setValue('payMethod', true);
  }

  /* ══════════════════════════════════════════════════════
     완료 판정 / 진행바
     ══════════════════════════════════════════════════════ */
  const isFieldVisible = (el) =>
    !el.classList.contains('field-hidden')
    && !el.closest('[hidden]')
    && !el.closest('.field-hidden')
    && !el.closest('.option-expand:not(.open)')  // 접혀 있는 펼침 영역
    // 선택하지 않은 결제수단 안의 하위 필드 (결제수단 박스 자체는 검사 대상)
    && !(el.parentElement && el.parentElement.closest('.payment-method-box:not(.active-method)'));

  /** 라벨 요소를 찾지 못하는 필드의 표시명 */
  const FIELD_LABEL_FALLBACK = {
    payAccount: '계좌 자동이체(CMS)',
    payCard: '카드 자동결제',
    corpAmount: '후원금액',
    babyMomEtc: '아기와 엄마 살리기 — 금액 직접입력',
    corpProgramEtc: '기타지정목적 내용'
  };

  /** 필드의 표시용 라벨 텍스트 (data-label로 직접 지정 가능) */
  function fieldLabelText(el) {
    if (el.dataset.label) return el.dataset.label;

    // 라벨이 폼 유형별로 여러 개면 현재 보이는 것을 쓴다
    const candidates = $$('.field-label, .consent-title, .sign-label, .payment-method-head', el);
    const labelEl = candidates.find((n) => !n.hidden) || candidates[0];
    if (labelEl) {
      // 힌트·태그·필수표시는 라벨에서 제외
      const clone = labelEl.cloneNode(true);
      $$('.field-hint, .type-tag, .req-mark, .consent-req', clone).forEach((n) => n.remove());
      const text = clone.textContent.replace(/\*/g, '').replace(/\s+/g, ' ').trim();
      if (text) return text;
    }
    return FIELD_LABEL_FALLBACK[el.dataset.field] || el.dataset.field;
  }

  /**
   * 그룹 내 미입력 필수 항목 목록. [{ label, el }]
   * 결제방법(계좌/카드)은 둘 중 하나만 선택되면 충족.
   */
  function collectMissing(g) {
    const missing = [];
    let payChecked = false;

    $$('[data-field][data-req="true"]', g).filter(isFieldVisible).forEach((f) => {
      const id = f.dataset.field;

      // 결제방법은 계좌/카드 중 하나만 완료하면 되므로 한 번만 검사한다
      if (id === 'payAccount' || id === 'payCard') {
        if (payChecked) return;
        payChecked = true;

        if (!values.payMethod) {
          missing.push({ label: '결제방법 선택 (계좌 자동이체 또는 카드 자동결제)', el: f });
          return;
        }
        if (values.payMethodValue === 'account') {
          const box = document.getElementById('payAccountBox');
          if (!values.payAccount) missing.push({ label: '계좌번호', el: box || f });
          else if (!values.accountVerified) missing.push({ label: '계좌 인증(1원 인증)', el: box || f });
        } else {
          const box = document.getElementById('payCardBox');
          if (!values.payCard) missing.push({ label: '카드번호', el: box || f });
          else if (!values.cardValid) missing.push({ label: '카드번호 확인 (유효하지 않은 번호)', el: box || f });
        }
        return;
      }

      // 이체일·결제일은 미선택 시 25일이 자동 적용되므로 미입력으로 보지 않는다
      if (id === 'payDate' || id === 'payDateCard') return;

      // 필수 동의는 '동의함'을 선택해야 통과
      if (/^consent/.test(id)) {
        const picked = values[id + 'Value'];
        if (!picked) missing.push({ label: fieldLabelText(f), el: f });
        else if (picked !== '동의함' && picked !== '전체동의') {
          missing.push({ label: fieldLabelText(f) + ' — ‘동의함’을 선택해 주세요', el: f });
        }
        return;
      }

      // 휴대번호는 문자 인증까지 완료해야 한다
      if (id === 'phone') {
        if (!values.phone) missing.push({ label: '휴대번호', el: f });
        else if (!values.phoneVerified) missing.push({ label: '휴대번호 인증', el: f });
        return;
      }

      if (!values[id]) missing.push({ label: fieldLabelText(f), el: f });
    });
    return missing;
  }

  function groupRequiredComplete(g) {
    return collectMissing(g).length === 0;
  }

  /** 미입력 항목 얼럿 + 해당 필드 강조/포커스. 통과 시 true */
  function validateGroup(n, opts) {
    const silent = opts && opts.silent;
    const g = groupEl(n);
    if (!g) return true;

    $$('.field.invalid', g).forEach((el) => el.classList.remove('invalid'));
    const missing = collectMissing(g);
    if (missing.length === 0) return true;
    if (silent) return false;

    missing.forEach((m) => m.el.classList.add('invalid'));

    const title = $('.group-title', g).textContent.trim();
    alert('[' + n + '. ' + title + ']\n필수 항목이 입력되지 않았습니다.\n\n'
      + missing.map((m) => '• ' + m.label).join('\n')
      + '\n\n위 항목을 입력해 주세요.');

    if (!isOpen(n)) { unlock(n); goToStep(n); }
    const first = missing[0].el;
    setTimeout(() => {
      const focusable = $('input:not([type=hidden]), .choice-btn, .period-btn', first);
      if (focusable && focusable.focus) focusable.focus({ preventScroll: true });
      if (first.scrollIntoView) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
    return false;
  }

  /** 제출: 1~4 단계를 순서대로 검사 */
  function validateAll() {
    applyPayDateDefault();
    for (let n = 1; n <= GROUP_COUNT; n++) {
      if (!validateGroup(n)) return false;
    }
    return true;
  }

  function updateGroupCompletion() {
    for (let n = 1; n <= GROUP_COUNT; n++) {
      const g = groupEl(n);
      if (!g) continue;
      const complete = groupRequiredComplete(g);
      g.classList.toggle('completed', complete && unlocked[n]);
      const btn = document.getElementById('nextBtn' + n);
      if (btn) btn.classList.toggle('enabled', complete);
    }
    renderTotal();
    updateProgress();
  }

  /* ══════════════════════════════════════════════════════
     후원 합계 (TOTAL)
     ══════════════════════════════════════════════════════ */
  const won = (n) => n.toLocaleString('ko-KR');
  const onlyDigits = (v) => String(v == null ? '' : v).replace(/[^0-9]/g, '');
  const digits = (v) => { const n = parseInt(onlyDigits(v), 10); return isNaN(n) ? 0 : n; };
  const fieldOn = (id) => { const el = $('[data-field="' + id + '"]'); return !!el && isFieldVisible(el); };
  const inputOf = (id) => { const el = $('[data-input="' + id + '"]'); return el ? el.value : ''; };
  const activeVal = (choice) => {
    const btn = $('[data-choice="' + choice + '"] .choice-btn.active');
    return btn ? btn.dataset.val : '';
  };

  function computeTotal() {
    const items = [];
    let monthly = 0, yearly = 0, once = 0;

    // 임직원용은 직접 입력한 후원금액이 곧 월 후원금
    if (fieldOn('empAmount')) {
      const amount = digits(inputOf('empAmount'));
      if (amount > 0) {
        // 임직원용은 주기 표기 없이 금액만 노출
        items.push({ label: '임직원 후원', amount: amount, unit: '' });
        monthly += amount;
      }
      return { items: items, monthly: monthly, yearly: yearly, once: once };
    }

    // 1:1 어린이결연 — 인원수 입력이 없는 컨사인 폼은 지정 어린이 1명
    const count = fieldOn('childCount') ? digits(inputOf('childCount')) : 1;
    if (count > 0) {
      const amount = CHILD_FEE * count;
      items.push({ label: '1:1 어린이결연 · ' + count + '명', amount: amount, unit: '월' });
      monthly += amount;
    }

    // 선물금 — 항목별로 나열하지 않고 '연 1회 결제'로 합산만 한다
    [
      { field: 'giftBirthday', toggle: 'giftBdToggle', slider: 'giftBdVal' },
      { field: 'giftXmas', toggle: 'giftXmasToggle', slider: 'giftXmasVal' }
    ].forEach((gift) => {
      const toggle = document.getElementById(gift.toggle);
      if (!fieldOn(gift.field) || !toggle || !toggle.classList.contains('on')) return;
      const range = $('[data-slider-target="' + gift.slider + '"]');
      yearly += digits(range && range.value);
    });

    // 아기와 엄마 살리기
    if (fieldOn('babyMomAmount')) {
      const pick = activeVal('babyMomAmount');
      let amount = 0;
      if (pick === '기타') amount = digits(inputOf('babyMomEtc'));
      else if (pick) amount = digits(pick) * 10000;
      if (amount > 0) {
        if (fieldOn('babyMomCycle') && activeVal('babyMomCycle') === '1회(일시)') {
          once += amount;
        } else {
          items.push({ label: '아기와 엄마 살리기', amount: amount, unit: '월' });
          monthly += amount;
        }
      }
    }

    return { items: items, monthly: monthly, yearly: yearly, once: once };
  }

  function renderTotal() {
    const list = document.getElementById('totalList');
    if (!list) return;

    // 기업후원은 금액 구성이 달라 TOTAL 영역을 쓰지 않는다
    const hideTotal = currentFormType === 'corp';
    const box = $('.total-box');
    const divider = $('.section-divider');
    if (box) box.hidden = hideTotal;
    if (divider) divider.hidden = hideTotal;
    if (hideTotal) return;

    const t = computeTotal();

    list.textContent = '';
    t.items.forEach((it) => {
      const li = document.createElement('li');
      li.className = 'total-item';
      const name = document.createElement('span');
      name.className = 'total-item-label';
      name.textContent = it.label;
      const val = document.createElement('span');
      val.className = 'total-item-val';
      val.textContent = won(it.amount) + '원' + (it.unit ? ' / ' + it.unit : '');
      li.appendChild(name);
      li.appendChild(val);
      list.appendChild(li);
    });

    document.getElementById('totalEmpty').hidden = t.items.length > 0 || t.yearly > 0 || t.once > 0;
    document.getElementById('totalMonthly').textContent = won(t.monthly);

    // 임직원용은 '/ 매월' 표기를 쓰지 않는다
    const unitEl = $('.total-unit');
    if (unitEl) unitEl.hidden = currentFormType === 'corp_child_emp';

    const yRow = document.getElementById('totalYearlyRow');
    yRow.hidden = t.yearly <= 0;
    document.getElementById('totalYearly').textContent = won(t.yearly);

    const oRow = document.getElementById('totalOnceRow');
    oRow.hidden = t.once <= 0;
    document.getElementById('totalOnce').textContent = won(t.once);
  }

  function updateProgress() {
    const shown = openStepNo();
    for (let i = 1; i <= GROUP_COUNT; i++) {
      const seg = $('.progress-seg[data-seg="' + i + '"]');
      if (seg) seg.classList.toggle('done', !!unlocked[i]);

      const step = $('.progress-step[data-step="' + i + '"]');
      if (step) {
        step.classList.toggle('reachable', !!unlocked[i] && i !== shown);
        step.classList.toggle('current', i === shown);
        step.setAttribute('aria-current', i === shown ? 'step' : 'false');
        step.disabled = !unlocked[i];
      }
    }
  }

  /* ══════════════════════════════════════════════════════
     설정 패널
     ══════════════════════════════════════════════════════ */
  function buildSettingsPanel() {
    const body = document.getElementById('settingsBody');
    body.innerHTML = '';

    const note = document.createElement('div');
    note.className = 'settings-note';
    note.textContent = '항목을 개별적으로 켜고 끌 수 있습니다. 현재 선택된 폼 유형('
      + FORM_TYPE_LABEL[currentFormType] + ')에 해당하지 않는 항목은 목록에서 흐리게 표시됩니다.';
    body.appendChild(note);

    for (let gnum = 1; gnum <= GROUP_COUNT; gnum++) {
      const title = document.createElement('div');
      title.className = 'settings-group-title';
      title.textContent = GROUP_TITLES[gnum];
      body.appendChild(title);

      const seen = new Set();
      $$('[data-field]', groupEl(gnum)).forEach((fieldEl) => {
        const id = fieldEl.dataset.field;
        if (seen.has(id)) return;
        seen.add(id);

        const forms = (fieldEl.dataset.forms || '').split(',').map((s) => s.trim()).filter(Boolean);
        const applies = forms.includes(currentFormType);

        const item = document.createElement('div');
        item.className = 'settings-item';
        item.style.opacity = applies ? '1' : '.4';

        const text = document.createElement('div');
        text.className = 'settings-item-text';

        const label = document.createElement('span');
        label.className = 'settings-item-label';
        label.textContent = fieldLabelText(fieldEl);
        text.appendChild(label);

        // 같은 이름의 항목(개인용/기업용)을 구분할 수 있도록 적용 유형을 함께 표시
        const formsLine = document.createElement('span');
        formsLine.className = 'settings-item-forms';
        formsLine.textContent = forms.length === Object.keys(FORM_TYPE_LABEL).length
          ? '전체 유형'
          : forms.map((f) => FORM_TYPE_SHORT[f] || f).join(' · ');
        text.appendChild(formsLine);

        const toggle = document.createElement('div');
        toggle.className = 'toggle' + (manualVisibility[id] !== false ? ' on' : '');
        toggle.setAttribute('role', 'switch');
        toggle.setAttribute('aria-label', fieldLabelText(fieldEl) + ' 노출');
        toggle.addEventListener('click', () => {
          manualVisibility[id] = toggle.classList.toggle('on');
          applyVisibility();
        });

        item.appendChild(text);
        item.appendChild(toggle);
        body.appendChild(item);
      });
    }
  }

  function openSettings() {
    buildSettingsPanel();
    document.getElementById('settingsOverlay').classList.add('open');
    document.getElementById('settingsPanel').classList.add('open');
  }
  function closeSettings() {
    document.getElementById('settingsOverlay').classList.remove('open');
    document.getElementById('settingsPanel').classList.remove('open');
  }

  /* ══════════════════════════════════════════════════════
     이벤트 바인딩 (위임)
     ══════════════════════════════════════════════════════ */
  function bindEvents() {
    document.addEventListener('click', (e) => {
      const t = e.target;

      const stepBtn = t.closest('[data-step]');
      if (stepBtn) { goToStep(Number(stepBtn.dataset.step)); return; }

      const nextBtn = t.closest('[data-next]');
      if (nextBtn) { goNext(Number(nextBtn.dataset.next)); return; }

      const prevBtn = t.closest('[data-prev]');
      if (prevBtn) { goToStep(Number(prevBtn.dataset.prev) - 1); return; }

      const region = t.closest('[data-region]');
      if (region) { selectRegion(region.dataset.region); return; }

      const choice = t.closest('.choice-btn');
      if (choice) { handleChoiceClick(choice); return; }

      const period = t.closest('.period-btn');
      if (period) { handlePeriodClick(period); return; }

      const gift = t.closest('[data-gift-toggle]');
      if (gift) { handleGiftToggle(gift); return; }

      const pay = t.closest('[data-pay-method]');
      if (pay) { selectPayMethod(pay.dataset.payMethod); return; }

      const addr = t.closest('[data-addr-search]');
      if (addr) { openAddressSearch(addr); return; }

      if (t.closest('#bizLicenseRemove')) { clearBizLicense(); return; }

      if (t.closest('#phoneVerifyBtn')) { phoneVerifier.request(); return; }
      if (t.closest('#phoneConfirmBtn')) { phoneVerifier.confirm(); return; }
      if (t.closest('#cmsVerifyBtn')) { accountVerifier.request(); return; }
      if (t.closest('#cmsConfirmBtn')) { accountVerifier.confirm(); return; }

      if (t.closest('#qrScanBtn')) { openQrScanner(); return; }
      if (t.closest('#qrCloseBtn') || t.id === 'qrOverlay') { closeQrScanner(); return; }

      if (t.closest('#settingsOpenBtn')) { openSettings(); return; }
      if (t.closest('#settingsCloseBtn') || t.id === 'settingsOverlay') { closeSettings(); return; }
      if (t.closest('#submitBtn')) {
        if (!validateAll()) return;
        alert('제출 로직은 실제 연동 시 구현합니다.');
      }
    });

    // 키보드 접근성
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeSettings(); closeQrScanner(); return; }
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (!e.target.closest) return;
      const gift = e.target.closest('[data-gift-toggle]');
      if (gift) { e.preventDefault(); handleGiftToggle(gift); }
    });

    document.addEventListener('change', (e) => {
      const t = e.target;
      if (!t.matches) return;
      if (t.matches('.mkt-channels input[type="checkbox"]')) onMktChannelChange();
      if (t.id === 'qrFile') handleQrFile(t);
      if (t.id === 'bizLicenseInput') handleBizLicense(t);
      if (t.matches('select[data-input]')) handleSelectInput(t);
    });

    document.addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset && t.dataset.input) {
        if (t.dataset.input === 'birth') updateMinorState(t.value);
        if (t.dataset.input === 'babyMomEtc' || t.dataset.input === 'corpAmount' || t.dataset.input === 'empAmount') {
          const n = digits(t.value);
          t.value = n ? n.toLocaleString('ko-KR') : '';
        }
        if (t.dataset.input === 'phone') { t.value = formatPhone(t.value); phoneVerifier.reset(); }
        if (t.dataset.input === 'payAccount') accountVerifier.reset();
        if (t.dataset.input === 'payCard') handleCardInput(t);
        setValue(t.dataset.input, t.value.trim().length > 0);
        return;
      }
      if (t.dataset && t.dataset.sliderTarget) handleSlider(t);
    });

    const select = document.getElementById('formTypeSelect');
    select.addEventListener('change', () => {
      currentFormType = select.value;
      // 폼 유형이 바뀌면 입력 항목 구성이 달라지므로 값·단계를 모두 초기화
      resetForm();
      resetSteps();
      applyVisibility();
    });
  }

  /* ── 초기화 ─────────────────────────────────────────── */
  function init() {
    bindEvents();
    applyDefaults();
    applyVisibility();
    updateProgress();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
