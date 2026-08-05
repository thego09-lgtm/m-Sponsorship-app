const fs = require('fs');
const path = require('path');
const { JSDOM } = require('/tmp/t/node_modules/jsdom');

const DIR = '/sessions/epic-lucid-bohr/mnt/outputs';
const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond) => { cond ? (pass++, console.log('  PASS ' + name)) : (fail++, console.log('  FAIL ' + name)); };

const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
const { window } = dom;
const doc = window.document;
const alerts = [];
window.alert = (m) => alerts.push(m);
window.scrollTo = () => {};
window.Element.prototype.scrollIntoView = function () {};
const errs = [];
window.addEventListener('error', (e) => errs.push(e.message));
window.eval(fs.readFileSync(path.join(DIR, 'main.js'), 'utf8'));
// 브라우저에서는 body 끝의 <script src="main.js">가 DOMContentLoaded 전에 실행되므로
// 테스트에서도 DOMContentLoaded가 지나간 뒤 검증한다.
if (doc.readyState === 'loading') {
  doc.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
}

const $ = (s) => doc.querySelector(s);
const $$ = (s) => Array.from(doc.querySelectorAll(s));
const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const type = (el, v) => { el.value = v; el.dispatchEvent(new window.Event('input', { bubbles: true })); };
const g = (n) => doc.getElementById('group' + n);

const step = (n) => $('.progress-step[data-step="' + n + '"]');
const demoCodeFrom = (msgId) => (doc.getElementById(msgId).textContent.match(/데모 인증번호: (\d+)/) || [])[1];
const verifyPhone = () => {
  click(doc.getElementById('phoneVerifyBtn'));
  type(doc.getElementById('phoneCodeInput'), demoCodeFrom('phoneVerifyMsg'));
  click(doc.getElementById('phoneConfirmBtn'));
};
const fillGroup1 = () => {
  type($('[data-input="name"]'), '홍길동');
  type($('[data-input="birth"]'), '19900101');
  click($('[data-choice="gender"] .choice-btn[data-val="남자"]'));
  type($('[data-input="phone"]'), '01011112222');
  verifyPhone();
  type($('[data-input="email"]'), 'a@b.com');
  type($('[data-input="address"]'), '서울시');
};

console.log('\n[1] 초기 상태 — 1단계만 노출');
ok('no script errors', errs.length === 0);
ok('group1 open', g(1).classList.contains('open'));
ok('열린 섹션은 1개뿐', $$('.group.open').length === 1);
ok('groups 2-4 locked & closed', [2, 3, 4].every(n => g(n).classList.contains('locked') && !g(n).classList.contains('open')));
ok('progress seg1 done only', $('.progress-seg[data-seg="1"]').classList.contains('done') && !$('.progress-seg[data-seg="2"]').classList.contains('done'));
ok('1단계가 current', step(1).classList.contains('current'));
ok('미해금 단계 버튼 비활성', [2, 3, 4].every(n => step(n).disabled));

console.log('\n[2] 헤더는 토글이 아님');
ok('헤더 토글 버튼 제거됨', $$('[data-acc-toggle]').length === 0);
ok('chevron 제거됨', $$('.acc-chevron').length === 0);
ok('lock 아이콘 제거됨', $$('.lock-icon').length === 0);
ok('헤더는 div', $('#group1 .group-head').tagName.toLowerCase() === 'div');

console.log('\n[3] 진행바로 잠긴 단계 이동 불가');
click(step(3));
ok('group3 열리지 않음', !g(3).classList.contains('open'));
ok('group1 계속 노출', g(1).classList.contains('open'));

console.log('\n[3-b] 영문명 분리 / 주소찾기 버튼');
const enInputs = $$('[data-field="nameEn"] input');
ok('영문명 입력박스 2개', enInputs.length === 2);
ok('첫 박스=이름', /이름/.test(enInputs[0].placeholder));
ok('두번째 박스=성', /성/.test(enInputs[1].placeholder));
ok('주소찾기 버튼 3개(후원자/기업/납부자)', $$('[data-addr-search]').length === 3);
ok('주소 상세입력 존재', $$('.addr-detail').length === 3);
const addrBtn = $('[data-field="address"] [data-addr-search]');
ok('주소찾기 버튼 라벨', addrBtn.textContent.trim() === '주소찾기');
alerts.length = 0;
click(addrBtn);
ok('daum 미로드 시 폴백 얼럿', alerts.length === 1 && /주소찾기 서비스/.test(alerts[0]));

console.log('\n[3-b2] 생년월일 + 성별 한 줄 배치');
const fieldRow = $('.field-row');
ok('한 줄 래퍼 존재', fieldRow !== null);
ok('생년월일이 먼저', fieldRow.children[0].dataset.field === 'birth');
ok('성별이 우측', fieldRow.children[1].dataset.field === 'gender');
ok('한 줄에 동시 노출은 2개', Array.from(fieldRow.children).filter(c => !c.classList.contains('field-hidden')).length === 2);
ok('생년월일 얼럿 표시명 유지', $('[data-field="birth"]').dataset.label === '생년월일(또는 사업자번호)');
ok('사업자번호는 힌트로', /또는 사업자번호/.test($('[data-field="birth"] .field-hint').textContent));

console.log('\n[3-c] 필수값 미입력 얼럿');
alerts.length = 0;
click(doc.getElementById('nextBtn1'));
ok('얼럿 1회 노출', alerts.length === 1);
ok('그룹명 포함', /1\. 후원회원 정보/.test(alerts[0]));
ok('미입력 항목 나열: 이름', /• 이름/.test(alerts[0]));
ok('미입력 항목 나열: 생년월일', /생년월일/.test(alerts[0]));
ok('미입력 항목 나열: 성별', /• 성별/.test(alerts[0]));
ok('미입력 항목 나열: 주소', /• 주소/.test(alerts[0]));
ok('선택항목(영문명) 미포함', !/영문명/.test(alerts[0]));
ok('다른 그룹 필드 미포함', !/이체일/.test(alerts[0]));
ok('invalid 강조 적용', $('[data-field="name"]').classList.contains('invalid'));
ok('group2 아직 잠김', g(2).classList.contains('locked'));
type($('[data-input="name"]'), '홍길동');
ok('입력 시 invalid 해제', !$('[data-field="name"]').classList.contains('invalid'));
type($('[data-input="name"]'), '');

console.log('\n[3-d] 14세 미만일 때만 법정대리인 영역 노출');
const minorBox = $('[data-field="minorGuardian"]');
const birth = $('[data-input="birth"]');
const yr = (n) => { const d = new Date(); d.setFullYear(d.getFullYear() - n); d.setDate(d.getDate() - 1); return '' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); };

ok('초기 상태: 숨김', minorBox.classList.contains('field-hidden'));
ok('만 나이 표시 엘리먼트 없음', doc.getElementById('birthAgeNote') === null);
type(birth, '2020');
ok('불완전 입력 시 숨김 유지', minorBox.classList.contains('field-hidden'));
type(birth, yr(10));
ok('만 10세 → 노출', !minorBox.classList.contains('field-hidden'));
type(birth, yr(13));
ok('만 13세 → 노출 유지', !minorBox.classList.contains('field-hidden'));
type(birth, yr(14));
ok('만 14세 → 숨김', minorBox.classList.contains('field-hidden'));
type(birth, yr(40));
ok('만 40세 → 숨김', minorBox.classList.contains('field-hidden'));
// 미성년 입력 후 성년으로 변경하면 값 초기화
type(birth, yr(9));
const gInputs = $$('[data-field="minorGuardian"] input');
gInputs[0].value = '김보호';
click($('[data-choice="guardianConsent"] .choice-btn[data-val="동의함"]'));
ok('대리인 동의 선택됨', $('[data-choice="guardianConsent"] .choice-btn.active') !== null);
type(birth, yr(30));
ok('성년 전환 시 대리인 입력값 초기화', gInputs[0].value === '');
ok('성년 전환 시 대리인 선택 해제', $('[data-choice="guardianConsent"] .choice-btn.active') === null);
type(birth, '20991231');
ok('미래 일자는 미성년 판정 안 함', minorBox.classList.contains('field-hidden'));
type(birth, '19901301');
ok('잘못된 월(13월) 무시', minorBox.classList.contains('field-hidden'));
type(birth, yr(8).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));
ok('하이픈 포맷 허용 → 노출', !minorBox.classList.contains('field-hidden'));
type(birth, '');
ok('비우면 숨김', minorBox.classList.contains('field-hidden'));

console.log('\n[4] 필수 입력 → 다음 버튼 활성화');
const nb1 = doc.getElementById('nextBtn1');
ok('nextBtn1 disabled initially', !nb1.classList.contains('enabled'));
type($('[data-input="name"]'), '홍길동');
type($('[data-input="birth"]'), '19900101');
click($('[data-choice="gender"] .choice-btn[data-val="남자"]'));
ok('gender btn active', $('[data-choice="gender"] .choice-btn[data-val="남자"]').classList.contains('active'));
type($('[data-input="phone"]'), '01011112222');
ok('휴대번호 자동 하이픈', $('[data-input="phone"]').value === '010-1111-2222');
type($('[data-input="email"]'), 'a@b.com');
type($('[data-input="address"]'), '서울시');
ok('휴대번호 미인증이면 다음 비활성', !nb1.classList.contains('enabled'));
alerts.length = 0;
click(nb1);
ok('얼럿에 휴대번호 인증 표시', alerts.length === 1 && /휴대번호 인증/.test(alerts[0]));
verifyPhone();
ok('nextBtn1 enabled', nb1.classList.contains('enabled'));
ok('group1 completed badge', g(1).classList.contains('completed'));
ok('완료 후에도 단계 번호 유지', $('#group1 .group-num').textContent === '1');
ok('입력완료 뱃지 존재', $('#group1 .group-done-badge').textContent === '입력완료');
ok('번호에 체크 스타일 없음', !/content|✓/.test($('#group1 .group-num').getAttribute('style') || ''));

console.log('\n[5] 다음 → 단계 해금 + 아코디언 전환');
click(nb1);
ok('완료한 group1은 헤더까지 숨김', !g(1).classList.contains('open'));
ok('group2 unlocked', !g(2).classList.contains('locked'));
ok('group2 open', g(2).classList.contains('open'));
ok('화면에 보이는 단계는 1개', $$('.group.open').length === 1);
ok('progress seg2 done', $('.progress-seg[data-seg="2"]').classList.contains('done'));
ok('group3 still locked(숨김)', g(3).classList.contains('locked'));
ok('2단계가 current', step(2).classList.contains('current') && !step(1).classList.contains('current'));
ok('1단계는 되돌아갈 수 있음', step(1).classList.contains('reachable') && !step(1).disabled);

console.log('\n[4-b] 휴대번호 문자 인증');
const phoneInput = $('[data-input="phone"]');
const phoneBox = doc.getElementById('phoneVerifyBox');
const phoneBadge = doc.getElementById('phoneVerifiedBadge');
const phoneMsgEl = doc.getElementById('phoneVerifyMsg');
ok('인증 완료 배지 노출', phoneBadge.hidden === false);
ok('코드 입력창은 닫힘', phoneBox.hidden === true);
ok('버튼 라벨 재인증', doc.getElementById('phoneVerifyBtn').textContent === '재인증');
ok('완료 메시지', phoneMsgEl.classList.contains('ok'));
// 번호를 바꾸면 인증 해제
type(phoneInput, '01099998888');
ok('번호 수정 시 인증 해제', phoneBadge.hidden === true && doc.getElementById('phoneVerifyBtn').textContent === '인증요청');
// 짧은 번호는 요청 거부
type(phoneInput, '010');
click(doc.getElementById('phoneVerifyBtn'));
ok('번호가 짧으면 요청 거부', phoneBox.hidden === true && phoneMsgEl.classList.contains('error'));
type(phoneInput, '01011112222');
click(doc.getElementById('phoneVerifyBtn'));
ok('인증요청 → 코드 입력창 노출', phoneBox.hidden === false);
ok('타이머 03:00', doc.getElementById('phoneTimer').textContent === '03:00');
const pCode = demoCodeFrom('phoneVerifyMsg');
ok('인증번호 6자리 발급', !!pCode && pCode.length === 6);
type(doc.getElementById('phoneCodeInput'), '123');
click(doc.getElementById('phoneConfirmBtn'));
ok('자리수 부족 거부', /6자리/.test(phoneMsgEl.textContent) && phoneBadge.hidden === true);
type(doc.getElementById('phoneCodeInput'), '000000');
click(doc.getElementById('phoneConfirmBtn'));
ok('틀린 코드 거부', /일치하지 않습니다/.test(phoneMsgEl.textContent));
type(doc.getElementById('phoneCodeInput'), pCode);
click(doc.getElementById('phoneConfirmBtn'));
ok('정확한 코드 → 인증 완료', phoneBadge.hidden === false && phoneBox.hidden === true);
ok('계좌 인증과 별개 상태', doc.getElementById('cmsVerifiedBadge').hidden === true);

console.log('\n[5-b] 이전 버튼');
ok('1단계에는 이전 버튼 없음', $('#group1 .prev-btn') === null);
ok('2~4단계에 이전 버튼', [2, 3, 4].every(n => $('#group' + n + ' .prev-btn') !== null));
ok('이전이 다음 좌측에', (() => {
  const row = $('#group2 .step-actions');
  return row.children[0].classList.contains('prev-btn') && row.children[1].classList.contains('next-btn');
})());
ok('4단계는 제출 버튼과 한 줄', (() => {
  const row = $('#group4 .step-actions');
  return row.children[0].classList.contains('prev-btn') && row.children[1].id === 'submitBtn';
})());
click($('#group2 .prev-btn'));
ok('이전 → 1단계로', g(1).classList.contains('open') && !g(2).classList.contains('open'));
ok('보이는 단계는 여전히 1개', $$('.group.open').length === 1);
ok('current도 1단계', step(1).classList.contains('current'));
click(doc.getElementById('nextBtn1'));
ok('다시 2단계로 복귀', g(2).classList.contains('open'));

console.log('\n[6] 진행바로 완료 단계 재방문');
click(step(1));
ok('group1 다시 노출', g(1).classList.contains('open'));
ok('group2는 숨겨짐', !g(2).classList.contains('open'));
ok('여전히 1개만 노출', $$('.group.open').length === 1);
ok('current가 1단계로 이동', step(1).classList.contains('current'));
click(step(2));
ok('group2로 복귀', g(2).classList.contains('open') && !g(1).classList.contains('open'));

console.log('\n[7] 기간 선택 / 선물금 토글 / 슬라이더');
const periodBtns = $$('.period-btn');
const rec = $('.period-btn-recommend');
ok('기간 버튼 3개', periodBtns.length === 3);
ok('버튼 라벨 3년/5년/10년 이상', $$('.period-btn .period-btn-main').map(e => e.textContent.trim()).join('|') === '3년|5년|10년 이상');
ok('10년 이상 서브라벨', $('.period-btn-sub').textContent.trim() === '(졸업할 때까지)');
ok('추천 뱃지는 추천 버튼에만', $$('.period-badge').length === 1 && rec.contains($('.period-badge')));
ok('뱃지는 엄지척 svg 아이콘', $('.period-badge svg') !== null && $$('.period-fire').length === 0);
ok('기본 선택 = 10년 이상', rec.classList.contains('active'));
const hint = doc.getElementById('periodHint');
const HINT_SHORT = '선택한 기간 동안 어린이 후원이 유지돼요.';
const HINT_LONG = '어린이가 졸업할 때까지 함께해요 🎓';
ok('안내 문구 영역 존재', hint !== null);
ok('기본 안내 = 졸업까지', hint.textContent === HINT_LONG);
ok('3년/5년 data-hint', periodBtns[0].dataset.hint === HINT_SHORT && periodBtns[1].dataset.hint === HINT_SHORT);
ok('10년 이상 data-hint', rec.dataset.hint === HINT_LONG);
const p3 = periodBtns.find(b => b.textContent.trim().startsWith('3년'));
click(p3);
ok('3년 active', p3.classList.contains('active'));
ok('10년 deactivated', !rec.classList.contains('active'));
ok('aria-pressed 반영', p3.getAttribute('aria-pressed') === 'true' && rec.getAttribute('aria-pressed') === 'false');
ok('3년 선택 → 안내 문구 교체', hint.textContent === HINT_SHORT);
click(periodBtns[1]);
ok('5년도 같은 문구', hint.textContent === HINT_SHORT);
click(rec.querySelector('.period-btn-main'));
ok('내부 span 클릭도 동작', rec.classList.contains('active') && !p3.classList.contains('active'));
ok('10년 이상 → 졸업 문구 복귀', hint.textContent === HINT_LONG);
const xmasT = doc.getElementById('giftXmasToggle');
ok('xmas slider hidden', doc.getElementById('giftXmasSlider').hidden);
click(xmasT);
ok('xmas toggle on', xmasT.classList.contains('on'));
ok('xmas slider shown', !doc.getElementById('giftXmasSlider').hidden);
const range = $('[data-slider-target="giftXmasVal"]');
type(range, '55000');
ok('slider label formatted', doc.getElementById('giftXmasVal').textContent === '55,000');

console.log('\n[6-b] 어린이번호 QR 스캔');
const selEl = doc.getElementById('formTypeSelect');
const chType = (v) => { selEl.value = v; selEl.dispatchEvent(new window.Event('change', { bubbles: true })); };
chType('consign_manual');
const qrBtn = doc.getElementById('qrScanBtn');
const qrOverlay = doc.getElementById('qrOverlay');
const childNoInput = doc.getElementById('childNoInput');
ok('QR 버튼이 어린이번호 필드 안에', qrBtn !== null && qrBtn.closest('[data-field="childNo"]') !== null);
ok('QR 버튼 라벨', /QR 스캔/.test(qrBtn.textContent));
ok('아이콘 svg 포함', qrBtn.querySelector('svg') !== null);
ok('type=button (폼 제출 방지)', qrBtn.getAttribute('type') === 'button');
ok('모달 초기 숨김', qrOverlay.hidden === true);
ok('이미지 폴백 입력 존재', doc.getElementById('qrFile') !== null);
click(qrBtn);
ok('클릭 시 모달 열림', qrOverlay.hidden === false);
ok('카메라 미지원 환경 안내', /카메라/.test(doc.getElementById('qrMsg').textContent));
click(doc.getElementById('qrCloseBtn'));
ok('닫기 버튼으로 닫힘', qrOverlay.hidden === true);
click(qrBtn);
doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
ok('Esc로 닫힘', qrOverlay.hidden === true);
// QR 원문 파싱 (URL / 파라미터 / 숫자)
const setChildNo = (raw) => { childNoInput.value = raw; childNoInput.dispatchEvent(new window.Event('input', { bubbles: true })); };
ok('어린이번호 입력칸에 data-input 연결', childNoInput.dataset.input === 'childNo');
setChildNo('CH-882310');
ok('직접 입력도 유지', childNoInput.value === 'CH-882310');
chType('standard');
ok('폼 유형 변경 시 어린이번호도 초기화', childNoInput.value === '');
fillGroup1();

console.log('\n[6-c] 폼 유형 변경 시 단계 초기화');
// 다음 단계까지 진행해 둔 뒤 폼 유형을 바꾼다
click(doc.getElementById('nextBtn1'));
ok('사전 조건: 2단계 도달', g(2).classList.contains('open') && !g(2).classList.contains('locked'));
chType('church_reg');
ok('1단계로 복귀', g(1).classList.contains('open'));
ok('2~4단계 다시 잠김', [2, 3, 4].every(n => g(n).classList.contains('locked') && !g(n).classList.contains('open')));
ok('보이는 단계는 1개', $$('.group.open').length === 1);
ok('진행바 1단계만 done', $('.progress-seg[data-seg="1"]').classList.contains('done')
  && [2, 3, 4].every(n => !$('.progress-seg[data-seg="' + n + '"]').classList.contains('done')));
ok('진행바 current = 1단계', step(1).classList.contains('current'));
ok('지나온 단계 버튼도 비활성', [2, 3, 4].every(n => step(n).disabled));
// 입력값까지 초기화
ok('텍스트 입력 초기화', $('[data-input="name"]').value === '' && $('[data-input="address"]').value === '');
ok('선택 버튼 해제', $('[data-choice="gender"] .choice-btn.active') === null);
ok('다음 버튼 비활성 복귀', !doc.getElementById('nextBtn1').classList.contains('enabled'));
ok('기본 선택은 복원 — 기간 10년 이상', $('.period-btn-recommend').classList.contains('active'));
ok('기본 선택은 복원 — 편지 영어', $('[data-choice="letter"] .choice-btn[data-val="영어"]').classList.contains('active'));
ok('생일선물금 토글 기본 켜짐', doc.getElementById('giftBdToggle').classList.contains('on'));
ok('크리스마스 토글 기본 꺼짐', !doc.getElementById('giftXmasToggle').classList.contains('on'));
ok('슬라이더 기본값 복귀', $('[data-slider-target="giftBdVal"]').value === '30000');
ok('결제수단 선택 해제', $('.payment-method-box.active-method') === null);
ok('마케팅 채널 체크 해제', $$('.mkt-channels input[type="checkbox"]').every(c => !c.checked));
chType('standard');
ok('다시 바꿔도 1단계 유지', g(1).classList.contains('open') && g(2).classList.contains('locked'));
// 이후 테스트를 위해 재입력 후 2단계로
fillGroup1();
click(doc.getElementById('nextBtn1'));
ok('재입력 후 재진행 정상', g(2).classList.contains('open'));

console.log('\n[7-a] 편지 기본 선택 = 영어');
const letterBtns = $$('[data-choice="letter"] .choice-btn');
ok('영어가 기본 선택', letterBtns[0].dataset.val === '영어' && letterBtns[0].classList.contains('active'));
ok('한글은 미선택', !letterBtns[1].classList.contains('active'));
ok('활성 버튼은 1개', $$('[data-choice="letter"] .choice-btn.active').length === 1);
click(letterBtns[1]);
ok('한글 선택 시 영어 해제', letterBtns[1].classList.contains('active') && !letterBtns[0].classList.contains('active'));
click(letterBtns[0]);
ok('영어로 되돌리기', letterBtns[0].classList.contains('active'));

console.log('\n[7-b] 지역 선택 — 세계지도 카드');
ok('choice-group 방식 제거됨', $('[data-choice="region"]') === null);
ok('별도 상관없음 칩 제거됨', $('.region-any') === null && doc.getElementById('regionSelected') === null);
const regions = $$('.region-card');
ok('카드 4개', regions.length === 4);
ok('순서 = 아시아/중남미/아프리카/상관없음', regions.map(r => r.dataset.region).join('|') === '아시아|중남미|아프리카|상관없음');
ok('라벨이 data-region과 일치', regions.every(r => r.querySelector('.region-card-label').textContent === r.dataset.region));
ok('공용 심볼 1개만 정의', $$('symbol#worldOutline').length === 1);
ok('심볼에 대륙 6개', $$('#worldOutline .wm-land path').length === 6);
ok('아시아/아프리카/중남미는 CSS 변수로 채움', $$('#worldOutline path[style*="--f-"]').length === 3);
ok('카드마다 use로 동일 지도 참조', regions.every(r => { const u = r.querySelector('.region-card-map svg use'); return u && u.getAttribute('href') === '#worldOutline'; }));
ok('카드별 viewBox 동일', new Set($$('.region-card-map svg').map(s => s.getAttribute('viewBox'))).size === 1);
ok('type=button 지정', regions.every(r => r.getAttribute('type') === 'button'));
ok('초기 선택 없음', regions.every(r => !r.classList.contains('selected')));
const asia = regions.find(r => r.dataset.region === '아시아');
click(asia.querySelector('.region-card-label'));
ok('아시아 선택됨', asia.classList.contains('selected'));
ok('aria-pressed=true', asia.getAttribute('aria-pressed') === 'true');
const africa = regions.find(r => r.dataset.region === '아프리카');
click(africa.querySelector('.region-card-map'));
ok('아프리카로 교체 선택(지도 클릭)', africa.classList.contains('selected') && !asia.classList.contains('selected'));
ok('단일 선택 유지', $$('.region-card.selected').length === 1);
const anyCard = regions.find(r => r.dataset.region === '상관없음');
click(anyCard);
ok('상관없음도 카드로 선택', anyCard.classList.contains('selected') && $$('.region-card.selected').length === 1);
click(regions.find(r => r.dataset.region === '중남미'));
ok('중남미 선택 시 상관없음 해제', !anyCard.classList.contains('selected'));
ok('중남미 선택 반영', regions[1].classList.contains('selected'));

console.log('\n[7-c] TOTAL 합계');
const tMonthly = () => doc.getElementById('totalMonthly').textContent;
const tItems = () => $$('#totalList .total-item').map(li => li.querySelector('.total-item-label').textContent + '=' + li.querySelector('.total-item-val').textContent);
// 선물금 상태를 명시적으로 맞춘다 (생일 30,000 / 크리스마스 55,000)
if (!doc.getElementById('giftXmasToggle').classList.contains('on')) click(doc.getElementById('giftXmasToggle'));
type($('[data-slider-target="giftXmasVal"]'), '55000');
type($('[data-slider-target="giftBdVal"]'), '30000');
ok('TOTAL 박스 존재', doc.getElementById('totalMonthly') !== null);
ok('TOTAL 합계가 박스 맨 아래', (() => {
  const kids = Array.from($('.total-box').children);
  return kids.indexOf($('.total-head')) === kids.length - 1;
})());
ok('연 1회 행이 TOTAL 위에', (() => {
  const kids = Array.from($('.total-box').children);
  return kids.indexOf(doc.getElementById('totalYearlyRow')) < kids.indexOf($('.total-head'));
})());
type($('[data-input="childCount"]'), '');
ok('인원수 미입력 시 결연 항목 없음', !tItems().some(s => /어린이결연/.test(s)));
type($('[data-input="childCount"]'), '2');
ok('2명 → 100,000원/월', tItems().some(s => s === '1:1 어린이결연 · 2명=100,000원 / 월'));
ok('월 합계 100,000', tMonthly() === '100,000');
ok('개인 유형은 / 매월 표기 유지', $('.total-unit').hidden === false);
ok('빈 안내문 숨김', doc.getElementById('totalEmpty').hidden === true);
ok('생일선물금 개별 행 없음', !tItems().some(s => /생일선물금/.test(s)));
ok('크리스마스선물금 개별 행 없음', !tItems().some(s => /크리스마스/.test(s)));
ok('목록은 어린이결연 1줄만', tItems().length === 1);
ok('년 1회 합계 85,000', doc.getElementById('totalYearly').textContent === '85,000' && !doc.getElementById('totalYearlyRow').hidden);
ok('년 1회 라벨/단위 표기', (() => {
  const row = doc.getElementById('totalYearlyRow');
  return row.children[0].textContent === '년 1회 결제 (선물금)'
    && row.children[1].textContent.replace(/\s+/g, ' ') === '85,000원 / 년';
})());
ok('1회 결제 행은 숨김', doc.getElementById('totalOnceRow').hidden === true);
// 선물금 토글 끄면 즉시 반영
click(doc.getElementById('giftXmasToggle'));
ok('크리스마스 끄면 연 합계 30,000', doc.getElementById('totalYearly').textContent === '30,000');
click(doc.getElementById('giftBdToggle'));
ok('선물금 모두 끄면 연 1회 행 숨김', doc.getElementById('totalYearlyRow').hidden === true);
// 슬라이더 조작도 즉시 반영
click(doc.getElementById('giftBdToggle'));
type($('[data-slider-target="giftBdVal"]'), '120000');
ok('슬라이더 변경 즉시 반영', doc.getElementById('totalYearly').textContent === '120,000');

console.log('\n[8] 결제방법 라디오');
type($('[data-input="childCount"]'), '1');
ok('지역·성별 미선택이면 다음 비활성', !doc.getElementById('nextBtn2').classList.contains('enabled'));
alerts.length = 0;
click(doc.getElementById('nextBtn2'));
ok('필수 얼럿에 성별(어린이) 포함', alerts.length === 1 && /성별\(어린이\)/.test(alerts[0]));
click($('[data-choice="childGender"] .choice-btn[data-val="상관없음"]'));
ok('nextBtn2 enabled', doc.getElementById('nextBtn2').classList.contains('enabled'));
click(doc.getElementById('nextBtn2'));
ok('group3 open', g(3).classList.contains('open'));
click($('[data-pay-method="card"]'));
ok('card box active', doc.getElementById('payCardBox').classList.contains('active-method'));
ok('account box inactive', !doc.getElementById('payAccountBox').classList.contains('active-method'));
ok('dotCard checked', doc.getElementById('dotCard').classList.contains('checked'));
click($('[data-pay-method="account"]'));
ok('switch back to account', doc.getElementById('payAccountBox').classList.contains('active-method') && !doc.getElementById('dotCard').classList.contains('checked'));

console.log('\n[8-a] 결제수단 선택 시 이체일/결제일 펼침');
const payDateAcc = $('[data-field="payDate"]');
const payDateCard = $('[data-field="payDateCard"]');
ok('이체일은 계좌 박스 안에', payDateAcc.closest('#payAccountBox') !== null);
ok('결제일은 카드 박스 안에', payDateCard.closest('#payCardBox') !== null);
ok('계좌 라벨 = 이체일', payDateAcc.querySelector('.field-label').textContent.replace('*', '') === '이체일');
ok('카드 라벨 = 결제일', payDateCard.querySelector('.field-label').textContent.replace('*', '') === '결제일');
ok('결제일 안내 문구', payDateCard.querySelector('.field-note').textContent === '*미선택 시 25일 이체 (재결제일 20일, 27일)');
ok('이체일 안내 문구', payDateAcc.querySelector('.field-note').textContent === '*미선택 시 25일 이체 (재출금일 20일, 27일)');
// 미선택 상태로 다음 → 25일 자동 저장
click($('[data-pay-method="card"]'));
ok('카드 결제일 초기 미선택', $('[data-choice="payDateCard"] .choice-btn.active') === null);
alerts.length = 0;
click(doc.getElementById('nextBtn3'));
ok('결제일 미선택도 얼럿 없음', !alerts.some(m => /결제일|이체일/.test(m)));
ok('결제일 25일 자동 선택', $('[data-choice="payDateCard"] .choice-btn.active').dataset.val === '25일');
click($('[data-pay-method="account"]'));
ok('계좌 이체일 초기 미선택', $('[data-choice="payDate"] .choice-btn.active') === null);
alerts.length = 0;
click(doc.getElementById('nextBtn3'));
ok('이체일 미선택도 얼럿 없음', !alerts.some(m => /이체일/.test(m)));
ok('이체일 25일 자동 선택', $('[data-choice="payDate"] .choice-btn.active').dataset.val === '25일');
// 직접 고른 값은 덮어쓰지 않는다
click($('[data-choice="payDate"] .choice-btn[data-val="5일"]'));
click(doc.getElementById('nextBtn3'));
ok('직접 선택한 5일 유지', $('[data-choice="payDate"] .choice-btn.active').dataset.val === '5일');
click($('[data-choice="payDate"] .choice-btn[data-val="25일"]'));

console.log('\n[8-b] 카드번호 유효성 검사');
click($('[data-pay-method="card"]'));
const cardInput = doc.getElementById('cardNumberInput');
const cardMsg = doc.getElementById('cardMsg');
type(cardInput, '4111');
ok('자리수 부족 안내', /자리수/.test(cardMsg.textContent) && cardMsg.classList.contains('pending'));
type(cardInput, '4111111111111112');
ok('Luhn 실패 → 오류 표시', cardMsg.classList.contains('error') && /다시 확인/.test(cardMsg.textContent));
alerts.length = 0;
click(doc.getElementById('nextBtn3'));
ok('유효하지 않은 카드번호는 다음 차단', alerts.length === 1 && /카드번호 확인/.test(alerts[0]));
type(cardInput, '4111111111111111');
ok('4자리마다 하이픈 포맷', cardInput.value === '4111-1111-1111-1111');
ok('Luhn 통과 → 유효 표시', cardMsg.classList.contains('ok'));
ok('카드사 판별(VISA)', /VISA/.test(cardMsg.textContent));
type(cardInput, '5555555555554444');
ok('Mastercard 판별', /Mastercard/.test(cardMsg.textContent) && cardMsg.classList.contains('ok'));
type(cardInput, '378282246310005');
ok('AMEX 15자리도 통과', /AMEX/.test(cardMsg.textContent) && cardMsg.classList.contains('ok'));

console.log('\n[8-c] 계좌 1원 인증');
click($('[data-pay-method="account"]'));
const cmsAccount = doc.getElementById('cmsAccountInput');
const cmsBox = doc.getElementById('cmsVerifyBox');
const cmsMsgEl = doc.getElementById('cmsVerifyMsg');
const cmsBadge = doc.getElementById('cmsVerifiedBadge');
ok('인증 영역 초기 숨김', cmsBox.hidden === true && cmsBadge.hidden === true);
type(cmsAccount, '123');
click(doc.getElementById('cmsVerifyBtn'));
ok('계좌번호 짧으면 인증 거부', cmsBox.hidden === true && cmsMsgEl.classList.contains('error'));
type(cmsAccount, '110123456789');
click(doc.getElementById('cmsVerifyBtn'));
ok('인증요청 → 코드 입력창 노출', cmsBox.hidden === false);
ok('타이머 03:00 시작', doc.getElementById('cmsTimer').textContent === '03:00');
const demoCode = (cmsMsgEl.textContent.match(/데모 인증번호: (\d{4})/) || [])[1];
ok('데모 인증번호 안내', !!demoCode);
const cmsCodeInput = doc.getElementById('cmsCodeInput');
type(cmsCodeInput, '12');
click(doc.getElementById('cmsConfirmBtn'));
ok('4자리 미만 거부', cmsMsgEl.classList.contains('error') && cmsBadge.hidden === true);
type(cmsCodeInput, String((Number(demoCode) + 1) % 10000).padStart(4, '0'));
click(doc.getElementById('cmsConfirmBtn'));
ok('틀린 코드 거부', /일치하지 않습니다/.test(cmsMsgEl.textContent) && cmsBadge.hidden === true);
alerts.length = 0;
click(doc.getElementById('nextBtn3'));
ok('미인증 상태는 다음 차단', alerts.length === 1 && /계좌 인증/.test(alerts[0]));
type(cmsCodeInput, demoCode);
click(doc.getElementById('cmsConfirmBtn'));
ok('정확한 코드 → 인증 완료', cmsBadge.hidden === false && cmsBox.hidden === true);
ok('완료 메시지', cmsMsgEl.classList.contains('ok'));
ok('버튼 라벨 재인증으로 변경', doc.getElementById('cmsVerifyBtn').textContent === '재인증');
type(cmsAccount, '110123456780');
ok('계좌번호 수정 시 인증 해제', cmsBadge.hidden === true && doc.getElementById('cmsVerifyBtn').textContent === '인증요청');
// 다시 인증하고 진행
click(doc.getElementById('cmsVerifyBtn'));
const code2 = (cmsMsgEl.textContent.match(/데모 인증번호: (\d{4})/) || [])[1];
type(doc.getElementById('cmsCodeInput'), code2);
click(doc.getElementById('cmsConfirmBtn'));
ok('재인증 완료', cmsBadge.hidden === false);

console.log('\n[8-d] 3단계 통과');
ok('nextBtn3 enabled', doc.getElementById('nextBtn3').classList.contains('enabled'));
click(doc.getElementById('nextBtn3'));
ok('group4 open & unlocked', g(4).classList.contains('open') && !g(4).classList.contains('locked'));
ok('all progress segs done', $$('.progress-seg').every(s => s.classList.contains('done')));

console.log('\n[9] 폼 유형 전환');
const sel = doc.getElementById('formTypeSelect');
const setType = (v) => { sel.value = v; sel.dispatchEvent(new window.Event('change', { bubbles: true })); };
setType('corp');
ok('personal fields hidden', $('.personal-fields').hidden);
ok('corp fields shown', !$('.corp-fields').hidden);
ok('corp support shown', !$('.corp-support-fields').hidden);
ok('name field hidden (not in corp)', $('[data-field="name"]').classList.contains('field-hidden'));
ok('corpNameKo visible', !$('[data-field="corpNameKo"]').classList.contains('field-hidden'));
ok('childInfoCard hidden', doc.getElementById('childInfoCard').hidden);
ok('기업후원은 TOTAL 미노출', $('.total-box').hidden === true);
ok('TOTAL 위 구분선도 숨김', $('.section-divider').hidden === true);
// 후원방법 ↔ 우측 금액칸 연동 (일시/정기 공통)
const amtField = $('[data-field="corpAmount"]');
const amtInput = doc.getElementById('corpAmountInput');
const amtUnit = doc.getElementById('corpAmountUnit');
ok('금액칸이 후원방법 필드 안 우측', amtField.closest('[data-field="corpMethod"]') !== null);
ok('별도 후원금액(월) 필드 없음', $$('[data-field="corpAmount"]').length === 1);
ok('초기: 금액칸 숨김', amtField.classList.contains('field-hidden'));
click($('[data-choice="corpMethod"] .choice-btn[data-val="일시후원"]'));
ok('일시후원 → 금액칸 노출', !amtField.classList.contains('field-hidden'));
ok('일시후원 단위 = 원', amtUnit.textContent === '원');
ok('일시후원 placeholder', amtInput.placeholder === '일시후원 금액');
alerts.length = 0;
click(doc.getElementById('nextBtn2'));
ok('금액 미입력 → 얼럿', alerts.length === 1 && /일시후원 금액/.test(alerts[0]));
type(amtInput, '5000000');
ok('천단위 콤마 포맷', amtInput.value === '5,000,000');
click($('[data-choice="corpMethod"] .choice-btn[data-val="정기후원"]'));
ok('정기후원 → 금액칸 계속 노출', !amtField.classList.contains('field-hidden'));
ok('정기후원 단위 = 원 / 월', amtUnit.textContent === '원 / 월');
ok('정기후원 placeholder', amtInput.placeholder === '월 후원금액');
ok('입력한 금액은 유지', amtInput.value === '5,000,000');
alerts.length = 0;
click(doc.getElementById('nextBtn2'));
ok('금액 입력되어 있으면 통과', !alerts.some(m => /후원금액|일시후원 금액/.test(m)));
ok('기업후원 내내 TOTAL 숨김 유지', $('.total-box').hidden === true);

setType('consign_assigned');
ok('childInfoCard shown', !doc.getElementById('childInfoCard').hidden);
ok('personal fields back', !$('.personal-fields').hidden);
ok('childNo hidden (consign_manual only)', $('[data-field="childNo"]').classList.contains('field-hidden'));
ok('개인 폼으로 돌아오면 TOTAL 재노출', $('.total-box').hidden === false && $('.section-divider').hidden === false);
ok('TOTAL: 컨사인 지정 1명 → 월 50,000', tMonthly() === '50,000');

setType('church_both');
click($('[data-choice="babyMomAmount"] .choice-btn[data-val="3만원"]'));
click($('[data-choice="babyMomCycle"] .choice-btn[data-val="매월(정기)"]'));
ok('TOTAL: 아기와엄마 정기 3만원 합산', tItems().some(s => s === '아기와 엄마 살리기=30,000원 / 월'));
click($('[data-choice="babyMomCycle"] .choice-btn[data-val="1회(일시)"]'));
ok('TOTAL: 일시 선택 시 1회 결제로 분리', doc.getElementById('totalOnce').textContent === '30,000' && !tItems().some(s => /아기와 엄마/.test(s)));
click($('[data-choice="babyMomAmount"] .choice-btn[data-val="기타"]'));
const etcField = $('[data-field="babyMomEtc"]');
const etcInput = doc.getElementById('babyMomEtcInput');
ok('기타 선택 → 직접입력칸 노출', !etcField.classList.contains('field-hidden'));
ok('TOTAL: 금액 미입력이면 합계 제외', !tItems().some(s => /아기와 엄마/.test(s)));
type(etcInput, '70000');
ok('천단위 콤마 자동 포맷', etcInput.value === '70,000');
click($('[data-choice="babyMomCycle"] .choice-btn[data-val="매월(정기)"]'));
ok('TOTAL: 기타 직접입력 금액 합산', tItems().some(s => s === '아기와 엄마 살리기=70,000원 / 월'));
type(etcInput, '12만');
ok('숫자만 추출해 포맷', etcInput.value === '12');
type(etcInput, '120000');
ok('TOTAL: 재입력도 반영', tItems().some(s => s === '아기와 엄마 살리기=120,000원 / 월'));
click($('[data-choice="babyMomAmount"] .choice-btn[data-val="3만원"]'));
ok('다른 금액 선택 → 직접입력칸 숨김', etcField.classList.contains('field-hidden'));
ok('직접입력값 초기화', etcInput.value === '');
ok('TOTAL: 3만원으로 대체', tItems().some(s => s === '아기와 엄마 살리기=30,000원 / 월'));
click($('[data-choice="babyMomAmount"] .choice-btn[data-val="기타"]'));
ok('다시 기타 선택 시 빈 칸으로 노출', !etcField.classList.contains('field-hidden') && etcInput.value === '');

setType('church_reg');
ok('email req mark shown', !$('.email-req-mark').hidden);
ok('church field visible', !$('[data-field="church"]').classList.contains('field-hidden'));
ok('babyMomBox visible', !$('[data-field="babyMomBox"]').classList.contains('field-hidden'));
ok('babyMomCycle hidden (church_both only)', $('[data-field="babyMomCycle"]').classList.contains('field-hidden'));
setType('standard');
ok('email req mark hidden again', $('.email-req-mark').hidden);

console.log('\n[9-b] 기업 후원 프로그램 설명 / 기타지정목적');
setType('corp');
click($('[data-choice="corpMethod"] .choice-btn[data-val="정기후원"]'));
type(doc.getElementById('corpAmountInput'), '1000000');
const progCards = $$('[data-choice="corpProgram"] .option-card');
const progOf = (v) => progCards.find(c => c.dataset.val === v);
const descOf = (v) => { const d = progOf(v).querySelector('.option-desc'); return d ? d.textContent : null; };
ok('프로그램 선택지 5개', progCards.length === 5);
ok('제안 프로젝트 설명', descOf('제안 프로젝트') === '기업 사업분야 및 필요에 맞춘 제안서 내용대로 후원합니다.');
ok('아기와 엄마 살리기 설명', descOf('아기와 엄마 살리기') === '엄마와 0-만1세 아기를 돕습니다.');
ok('주제별 양육보완 설명', descOf('주제별 양육보완') === '어린이가 지속적, 효과적으로 양육 받을 수 있도록 돕습니다.');
ok('기타지정목적·목적 미지정은 설명 없음', descOf('기타지정목적') === null && descOf('목적 미지정') === null);
ok('설명은 항상 노출(선택 전에도)', $$('[data-choice="corpProgram"] .option-desc').length === 3);
const progEtcWrap = doc.getElementById('corpProgramEtcWrap');
const progEtcInput = doc.getElementById('corpProgramEtcInput');
ok('펼침 영역이 기타지정목적 바로 다음', progOf('기타지정목적').nextElementSibling === progEtcWrap);
ok('목적 미지정은 펼침 영역 다음', progEtcWrap.nextElementSibling === progOf('목적 미지정'));
ok('펼침 영역 초기 접힘', !progEtcWrap.classList.contains('open'));
ok('aria-expanded=false', progOf('기타지정목적').getAttribute('aria-expanded') === 'false');
click(progOf('제안 프로젝트'));
ok('제안 프로젝트 선택됨', progOf('제안 프로젝트').classList.contains('active'));
ok('다른 항목 선택 시 접힌 상태 유지', !progEtcWrap.classList.contains('open'));
click(progOf('기타지정목적'));
ok('기타지정목적 → 바로 아래 펼침', progEtcWrap.classList.contains('open'));
ok('aria-expanded=true', progOf('기타지정목적').getAttribute('aria-expanded') === 'true');
ok('단일 선택 유지', $$('[data-choice="corpProgram"] .option-card.active').length === 1);
// 미입력 시 얼럿에 포함
alerts.length = 0;
click(doc.getElementById('nextBtn2'));
ok('기타지정목적 내용 미입력 → 얼럿', alerts.length === 1 && /기타지정목적 내용/.test(alerts[0]));
type(progEtcInput, '지역아동센터 급식 지원');
alerts.length = 0;
click(doc.getElementById('nextBtn2'));
ok('내용 입력하면 통과', alerts.length === 0);
click(progOf('목적 미지정'));
ok('다른 항목 선택 → 접힘', !progEtcWrap.classList.contains('open'));
ok('입력값 초기화', progEtcInput.value === '');
alerts.length = 0;
click(doc.getElementById('nextBtn2'));
ok('접힌 입력칸은 필수 검사에서 제외', alerts.length === 0);
setType('standard');

console.log('\n[9-c] 기업 1:1 어린이양육 후원 유형');
ok('셀렉트에 유형 추가', Array.from(doc.getElementById('formTypeSelect').options).some(o => o.value === 'corp_child' && o.textContent === '기업 1:1 어린이양육 후원'));
setType('corp_child');
const vis = (f) => { const el = $('[data-field="' + f + '"]'); return el && !el.classList.contains('field-hidden') && !el.closest('[hidden]'); };
ok('회원정보는 기업 필드', $('.corp-fields').hidden === false && $('.personal-fields').hidden === true);
ok('기업명·사업자번호·담당자 노출', ['corpNameKo', 'corpBizNo', 'corpAddress', 'corpManager', 'corpContact', 'corpEmail'].every(vis));
ok('후원방법 블록은 개인용(어린이 항목 포함)', $('.personal-support-fields').hidden === false && $('.corp-support-fields').hidden === true);
ok('어린이 인원수 노출', vis('childCount'));
ok('인원수 라벨이 기업 문장으로', $$('[data-field="childCount"] .field-label').find(l => !l.hidden).textContent.includes('우리기업은'));
ok('지역·성별 노출', vis('region') && vis('childGender'));
ok('편지 = 직접작성/스마트레터', vis('letterService') && !vis('letter')
  && $$('[data-choice="letterService"] .choice-btn').map(b => b.dataset.val).join('|') === '직접작성|스마트레터 서비스(대필편지)');
ok('후원방법 = 기업약정/매칭그랜트', vis('corpChildMethod')
  && $$('[data-choice="corpChildMethod"] .option-card').map(b => b.dataset.val).join('|') === '기업약정후원|임직원 매칭그랜트');
ok('후원방법 설명 표기', /기업명의로 1:1 어린이결연을 약정하여 후원/.test($('[data-field="corpChildMethod"]').textContent));
ok('제출서류 = 사업자등록증사본 업로드만', vis('bizLicense') && $('.doc-list') === null
  && doc.getElementById('bizLicenseInput') !== null);
ok('업로드 필수 지정', $('[data-field="bizLicense"]').dataset.req === 'true');
ok('이미지·PDF 허용', doc.getElementById('bizLicenseInput').getAttribute('accept') === 'image/*,application/pdf');
ok('미리보기 초기 숨김', doc.getElementById('bizLicensePreview').hidden === true);
ok('후원기간·선물금은 미노출', !vis('period') && !vis('giftBirthday') && !vis('giftXmas'));
ok('기업 전용 필드(후원금액/프로그램)는 미노출', !vis('corpAmount') && !vis('corpProgram'));
ok('TOTAL은 노출', $('.total-box').hidden === false);
type($('[data-input="childCount"]'), '3');
ok('TOTAL 계산 = 50,000 × 3', tMonthly() === '150,000');
ok('동의는 기업용', vis('consentCollectCorp') && vis('consentEmployee3rd')
  && !vis('consentCollect') && !vis('consentThirdParty'));
ok('마케팅 제목도 기업용', $$('[data-field="consentMkt"] .consent-title').find(t => !t.hidden).textContent.trim() === '홍보·마케팅 이용 동의');
ok('하단 처리방침 줄 노출', $('.privacy-note').hidden === false);
setType('standard');
ok('스탠다드로 되돌리면 개인 필드 복귀', $('.personal-fields').hidden === false && !vis('corpChildMethod'));

console.log('\n[9-d] 기업 1:1 어린이양육 후원_임직원용');
ok('셀렉트에 유형 추가', Array.from(doc.getElementById('formTypeSelect').options).some(o => o.value === 'corp_child_emp' && o.textContent === '기업 1:1 어린이양육 후원_임직원용'));
setType('corp_child_emp');
ok('개인 필드 사용 (기업 필드 아님)', $('.personal-fields').hidden === false && $('.corp-fields').hidden === true);
ok('성명·생년월일·연락처·주소·이메일 노출', ['name', 'birth', 'phone', 'address', 'email'].every(vis));
ok('소득공제자 = 기업/임직원', vis('taxDeduction')
  && $$('[data-choice="taxDeduction"] .choice-btn').map(b => b.dataset.val).join('|') === '기업|임직원');
ok('자택전화 노출', vis('phoneHome'));
ok('재직 중인 회사 노출(필수)', vis('company') && $('[data-field="company"]').dataset.req === 'true');
ok('주민등록번호 안내문 노출', $$('[data-field="birth"] .field-note').some(n => !n.hidden && /연말정산/.test(n.textContent)));
ok('성별·출석교회는 미노출', !vis('gender') && !vis('church'));
ok('후원금액 직접입력', vis('empAmount'));
ok('임직원 후원금액에는 월 표시 없음', $('[data-field="empAmount"] .amount-suffix').textContent.trim() === '원');
ok('후원형태 = 매칭그랜트/편지후원', vis('empType')
  && $$('[data-choice="empType"] .choice-btn').map(b => b.dataset.val).join('|') === '임직원 매칭그랜트|임직원 편지후원');
ok('어린이 인원수·후원기간·선물금 미노출', !vis('childCount') && !vis('period') && !vis('giftBirthday'));
ok('기업 1:1양육 전용 필드 미노출', !vis('corpChildMethod') && !vis('bizLicense') && !vis('letterService'));
type(doc.getElementById('empAmountInput'), '70000');
ok('후원금액 천단위 콤마', doc.getElementById('empAmountInput').value === '70,000');
ok('TOTAL = 입력 금액', tMonthly() === '70,000');
ok('TOTAL 항목에 월 표시 없음', tItems().some(s => s === '임직원 후원=70,000원'));
ok('TOTAL 합계에 / 매월 표기 없음', $('.total-unit').hidden === true);
ok('동의는 임직원용 2종', vis('consentCollectEmp') && vis('consentThirdPartyEmp')
  && !vis('consentCollect') && !vis('consentCollectCorp') && !vis('consentThirdParty') && !vis('consentEmployee3rd'));
ok('임직원 수집항목', /성명, 생년월일, 소득공제자, 연락처, 주소, 이메일, 재직 중인 회사/.test($('[data-field="consentCollectEmp"]').textContent));
ok('임직원 제3자 제공회사', /재직 중인 회사의 후원 담당자/.test($('[data-field="consentThirdPartyEmp"]').textContent));
ok('제3자 제공은 선택 항목', $('[data-field="consentThirdPartyEmp"]').dataset.req === 'false');
ok('퇴사 안내 각주 노출', $$('.privacy-note').some(n => !n.hidden && /퇴사 시, 매칭된 어린이와 편지 결연이 종료/.test(n.textContent)));
setType('standard');
ok('되돌리면 임직원 전용 필드 숨김', !vis('company') && !vis('empAmount') && !vis('consentCollectEmp'));

console.log('\n[10] 설정 패널');
click(doc.getElementById('settingsOpenBtn'));
ok('panel open', doc.getElementById('settingsPanel').classList.contains('open'));
ok('overlay open', doc.getElementById('settingsOverlay').classList.contains('open'));
const items = $$('#settingsBody .settings-item');
const labelsOf = () => items.map(i => i.querySelector('.settings-item-label').textContent.trim());
ok('settings items rendered (' + items.length + ')', items.length > 20);
ok('원시 필드 id가 노출되지 않음', !labelsOf().some(t => /^[a-z][A-Za-z0-9]*$/.test(t)));
ok('힌트 문구가 라벨에 섞이지 않음', !labelsOf().some(t => /지도에서|다를 시 기재|다를 경우 기재/.test(t)));
ok('결제수단도 이름으로 표시', labelsOf().includes('계좌 자동이체(CMS)') && labelsOf().includes('카드 자동결제'));
ok('동의·서명 단계 항목 포함', ['개인정보 수집·이용 동의', '개인정보 제3자 제공 동의 확인', '마케팅 정보 수신 동의', '후원계기', '후원동기'].every(l => labelsOf().includes(l)));
ok('적용 유형 표기', items.every(i => (i.querySelector('.settings-item-forms').textContent || '').trim().length > 0));
ok('동명 항목은 적용 유형으로 구분', (() => {
  const dup = items.filter(i => i.querySelector('.settings-item-label').textContent.trim() === '개인정보 수집·이용 동의');
  const forms = dup.map(i => i.querySelector('.settings-item-forms').textContent);
  return dup.length >= 2 && new Set(forms).size === dup.length && forms.some(f => /기업/.test(f));
})());
const nameItem = items.find(i => i.querySelector('.settings-item-label').textContent.trim() === '이름');
ok('이름 item exists', !!nameItem);
click(nameItem.querySelector('.toggle'));
ok('name field hidden by manual toggle', $('[data-field="name"]').classList.contains('field-hidden'));
click(nameItem.querySelector('.toggle'));
ok('name field visible again', !$('[data-field="name"]').classList.contains('field-hidden'));
// 동의 항목도 설정에서 끌 수 있고, 끄면 필수 검증에서도 빠진다
const mktItem = items.find(i => i.querySelector('.settings-item-label').textContent.trim() === '마케팅 정보 수신 동의');
click(mktItem.querySelector('.toggle'));
ok('동의 항목 숨기기 동작', $('[data-field="consentMkt"]').classList.contains('field-hidden'));
click(mktItem.querySelector('.toggle'));
ok('동의 항목 되살리기', !$('[data-field="consentMkt"]').classList.contains('field-hidden'));
click(doc.getElementById('settingsCloseBtn'));
ok('panel closed', !doc.getElementById('settingsPanel').classList.contains('open'));

console.log('\n[10-b] 마케팅 수신 동의 — 전체동의 연동');
const mktBoxes = $$('.mkt-channels input[type="checkbox"]');
const mktAll = $('[data-choice="consentMkt"] .choice-btn[data-val="전체동의"]');
const mktNone = $('[data-choice="consentMkt"] .choice-btn[data-val="동의하지 않음"]');
const setCb = (cb, v) => { cb.checked = v; cb.dispatchEvent(new window.Event('change', { bubbles: true })); };
ok('채널 4개', mktBoxes.length === 4);
ok('채널 라벨', mktBoxes.map(b => b.value).join('|') === '카카오톡/문자|이메일|우편|전화');
ok('초기 전체 해제', mktBoxes.every(b => !b.checked));
click(mktAll);
ok('전체동의 → 4개 모두 체크', mktBoxes.every(b => b.checked));
ok('전체동의 버튼 활성', mktAll.classList.contains('active'));
click(mktNone);
ok('동의하지 않음 → 전체 해제', mktBoxes.every(b => !b.checked));
ok('동의하지 않음 버튼 활성', mktNone.classList.contains('active'));
click(mktAll);
setCb(mktBoxes[2], false);
ok('채널 하나 해제 시 전체동의 풀림', !mktAll.classList.contains('active'));
ok('나머지 체크는 유지', mktBoxes[0].checked && mktBoxes[1].checked && mktBoxes[3].checked);
ok('부분 선택은 동의하지 않음도 아님', !mktNone.classList.contains('active'));
setCb(mktBoxes[2], true);
ok('다시 모두 체크하면 전체동의 자동 활성', mktAll.classList.contains('active'));
[0, 1, 2, 3].forEach(i => setCb(mktBoxes[i], false));
ok('모두 해제하면 동의하지 않음 자동 활성', mktNone.classList.contains('active'));

console.log('\n[10-c] 폼 유형별 동의 내용');
const consentOf = (f) => $('[data-field="' + f + '"]');
const shown = (f) => !consentOf(f).classList.contains('field-hidden');
setType('standard');
ok('개인: 개인용 수집동의 노출', shown('consentCollect') && !shown('consentCollectCorp'));
ok('개인: 자동이체 제3자 동의 노출', shown('consentThirdParty') && !shown('consentEmployee3rd'));
// 스탠다드 마케팅 동의 — 캡쳐 기준
const mktBox = consentOf('consentMkt');
ok('스탠다드 제목 = 마케팅 정보 수신 동의',
  $$('[data-field="consentMkt"] .consent-title').find(t => !t.hidden).textContent.trim() === '마케팅 정보 수신 동의');
ok('스탠다드는 기업 본문 문장 숨김', $('[data-field="consentMkt"] .consent-detail').hidden === true);
ok('채널 앞 선택 라벨 제거됨', $('.mkt-row-label') === null && $('.mkt-row') === null);
ok('채널 4개 순서', $$('.mkt-channels input').map(i => i.value).join('|') === '카카오톡/문자|이메일|우편|전화');
ok('스탠다드 안내문 문구',
  $$('[data-field="consentMkt"] .consent-notes').find(n => !n.hidden).textContent
    .includes('상기 동의를 거부할 수 있으며 미동의 시 소식지, 이벤트, 행사안내가 어려울 수 있습니다'));
ok('전체동의/동의하지 않음 2지선다', $$('[data-choice="consentMkt"] .choice-btn').map(b => b.dataset.val).join('|') === '전체동의|동의하지 않음');

const collectTxt = consentOf('consentCollect').textContent;
ok('개인 수집항목 — 종교·출석교회 포함', /종교, 출석교회/.test(collectTxt));
ok('개인 수집항목 — 카드 상세 포함', /카드사명, 카드번호, 유효기간, 카드명의자/.test(collectTxt));
ok('개인 수집항목 — CMS 상세 포함', /은행명, 계좌번호, 예금주명, 예금주 생년월일/.test(collectTxt));
ok('개인 이용목적 — 국세청 등록 포함', /국세청에 후원내역 등록/.test(collectTxt));
ok('개인 안내문 3개 (소득세법·거부·처리방침)', $$('[data-field="consentCollect"] .consent-notes li').length === 3
  && /소득세법 제160조의3/.test(collectTxt) && /개인정보 처리방침/.test(collectTxt));
const thirdTxt = consentOf('consentThirdParty').textContent;
ok('자동이체 제공회사 — 사단법인 금융결제원', /사단법인 금융결제원, 효성FMS주식회사/.test(thirdTxt));
ok('자동이체 제공항목·보유기간 추가', /이름, 은행명, 계좌번호, 예금주 생년월일, 휴대번호/.test(thirdTxt)
  && /목적을 달성할 때까지/.test(thirdTxt));
ok('자동이체 거부 시 경고 강조', $('[data-field="consentThirdParty"] .consent-notes .warn') !== null);
setType('church_reg');
const churchTxt = consentOf('consentChurch').textContent;
ok('교회 제공항목 — 본 신청 후원 내역만', /본 신청을 통한 후원 내역만 제공/.test(churchTxt));
ok('교회 제공목적 — 후원 현황판', /후원 현황판 및 후원 내용/.test(churchTxt));
ok('교회 거부 시 안내문', /거부 시 서비스 제공에 불이익/.test(churchTxt));
ok('개인 유형에는 하단 처리방침 줄 숨김', $('.privacy-note').hidden === true);
setType('standard');
setType('corp');
ok('기업: 기업용 수집동의로 교체', shown('consentCollectCorp') && !shown('consentCollect'));
ok('기업: 임직원 제3자 제공 확인으로 교체', shown('consentEmployee3rd') && !shown('consentThirdParty'));
ok('기업 수집항목 = 담당자명/휴대폰/이메일', /담당자명, 휴대폰번호, 이메일/.test(consentOf('consentCollectCorp').textContent));
ok('기업 이용목적', /기업 후원 운영에 필요한 서비스 제공/.test(consentOf('consentCollectCorp').textContent));
ok('기업 보유기간에 퇴사 포함', /퇴사 시/.test(consentOf('consentCollectCorp').textContent));
ok('임직원 필수 뱃지', /임직원 후원신청시 필수/.test(consentOf('consentEmployee3rd').textContent));
ok('표가 아닌 라벨-값 배치', $$('.consent-terms').length >= 3 && $$('table').length === 0);
const mktTitles = $$('[data-field="consentMkt"] .consent-title');
const mktNotes = $$('[data-field="consentMkt"] .consent-notes');
ok('기업 제목 = 홍보·마케팅 이용 동의', mktTitles.find(t => !t.hidden).textContent.trim() === '홍보·마케팅 이용 동의');
ok('기업 본문 문장 노출', $('[data-field="consentMkt"] .consent-detail').hidden === false);
ok('기업 안내문 노출', mktNotes.find(n => !n.hidden).textContent.includes('귀사는 상기 동의를 거부할 수 있습니다'));
ok('필수/선택 뱃지 표기', consentOf('consentCollectCorp').querySelector('.consent-req').textContent === '필수'
  && consentOf('consentMkt').querySelector('.consent-req').classList.contains('optional'));
ok('기업 유형에 하단 처리방침 줄 노출', $('.privacy-note').hidden === false
  && $('.privacy-note a').getAttribute('href') === 'https://www.compassion.or.kr');
ok('기업은 자동이체 제3자 동의 미노출', consentOf('consentThirdParty').classList.contains('field-hidden'));
ok('기업은 교회 동의 미노출', consentOf('consentChurch').classList.contains('field-hidden'));
// 기업 1~3단계를 채운 뒤 동의 검증만 남긴다
type($('[data-input="corpNameKo"]'), '주식회사 컴패션');
type($('[data-input="corpBizNo"]'), '123-45-67890');
type($('[data-input="corpAddress"]'), '서울시 종로구');
type($('[data-input="corpManager"]'), '홍길동 / 대리');
type($('[data-input="corpContact"]'), '010-1111-2222');
type($('[data-input="corpEmail"]'), 'a@b.com');
click($('[data-choice="corpMethod"] .choice-btn[data-val="정기후원"]'));
type(doc.getElementById('corpAmountInput'), '1000000');
click($('[data-choice="corpProgram"] .option-card[data-val="목적 미지정"]'));
click($('[data-pay-method="account"]'));
type(doc.getElementById('cmsAccountInput'), '110123456789');
click(doc.getElementById('cmsVerifyBtn'));
type(doc.getElementById('cmsCodeInput'), demoCodeFrom('cmsVerifyMsg'));
click(doc.getElementById('cmsConfirmBtn'));
click($('[data-choice="payDate"] .choice-btn[data-val="25일"]'));
type($('[data-input="signApplicant"]'), '홍길동');
alerts.length = 0;
click(doc.getElementById('submitBtn'));
ok('기업 필수 동의 미선택 → 제출 차단', alerts.length === 1 && /4\. 개인정보 동의/.test(alerts[0]));
ok('얼럿에 기업용 수집동의', /개인정보 수집·이용 동의/.test(alerts[0]));
ok('얼럿에 임직원 제3자 확인', /개인정보 제3자 제공 동의 확인/.test(alerts[0]));
ok('개인용 자동이체 동의는 얼럿에 없음', !/자동이체/.test(alerts[0]));
click($('[data-choice="consentCollectCorp"] .choice-btn[data-val="동의함"]'));
click($('[data-choice="consentEmployee3rd"] .choice-btn[data-val="동의함"]'));
alerts.length = 0;
click(doc.getElementById('submitBtn'));
ok('기업 동의 완료 시 제출 진행', alerts.length === 1 && /제출 로직/.test(alerts[0]));
setType('standard');

console.log('\n[11] 제출 검증');
// 폼 유형 전환으로 초기화되었으므로 1~3단계를 다시 채운다
fillGroup1();
type($('[data-input="childCount"]'), '1');
click($('.region-card[data-region="상관없음"]'));
click($('[data-choice="childGender"] .choice-btn[data-val="상관없음"]'));
click($('[data-pay-method="account"]'));
type(doc.getElementById('cmsAccountInput'), '110123456789');
click(doc.getElementById('cmsVerifyBtn'));
const submitCode = (doc.getElementById('cmsVerifyMsg').textContent.match(/데모 인증번호: (\d{4})/) || [])[1];
type(doc.getElementById('cmsCodeInput'), submitCode);
click(doc.getElementById('cmsConfirmBtn'));
click($('[data-choice="payDate"] .choice-btn[data-val="25일"]'));
alerts.length = 0;
click(doc.getElementById('submitBtn'));
ok('동의/서명 미입력 시 제출 차단 얼럿', alerts.length === 1 && /개인정보/.test(alerts[0]));
ok('미입력 항목에 서명 포함', /신청인/.test(alerts[0]));
ok('제출 안내 얼럿 아님', !/제출 로직/.test(alerts[0]));
click($('[data-choice="consentCollect"] .choice-btn[data-val="동의함"]'));
click($('[data-choice="consentThirdParty"] .choice-btn[data-val="동의함"]'));
alerts.length = 0;
click(doc.getElementById('submitBtn'));
ok('서명만 남으면 서명 항목만 얼럿', alerts.length === 1 && /신청인/.test(alerts[0]) && !/개인정보 수집/.test(alerts[0]));
type($('[data-input="signApplicant"]'), '홍길동');
alerts.length = 0;
click(doc.getElementById('submitBtn'));
ok('모두 입력 시 제출 진행', alerts.length === 1 && /제출 로직/.test(alerts[0]));

console.log('\n[10-d] 필수 동의는 ‘동의함’만 통과');
click($('[data-choice="consentCollect"] .choice-btn[data-val="동의하지 않음"]'));
alerts.length = 0;
click(doc.getElementById('submitBtn'));
ok('동의하지 않음 선택 시 제출 차단', alerts.length === 1 && /개인정보 수집·이용 동의/.test(alerts[0]));
ok('안내에 동의함 선택 요청 포함', /‘동의함’을 선택해 주세요/.test(alerts[0]));
ok('이미 동의한 항목은 얼럿 제외', !/자동이체 동의/.test(alerts[0]));
click($('[data-choice="consentCollect"] .choice-btn[data-val="동의함"]'));
alerts.length = 0;
click(doc.getElementById('submitBtn'));
ok('동의함으로 바꾸면 통과', alerts.length === 1 && /제출 로직/.test(alerts[0]));
ok('선택 동의는 동의하지 않음도 통과', (() => {
  click($('[data-choice="consentMkt"] .choice-btn[data-val="동의하지 않음"]'));
  alerts.length = 0;
  click(doc.getElementById('submitBtn'));
  return alerts.length === 1 && /제출 로직/.test(alerts[0]);
})());

console.log('\n[11-b] 후원계기 · 후원동기 셀렉트박스');
const srcSel = doc.getElementById('motiveSourceSelect');
const reaSel = doc.getElementById('motiveReasonSelect');
const change = (el, v) => { el.value = v; el.dispatchEvent(new window.Event('change', { bubbles: true })); };
ok('4단계 안에 위치', srcSel.closest('#group4') !== null && reaSel.closest('#group4') !== null);
ok('납부자 서명 다음에 배치', $('[data-field="signPayer"]').compareDocumentPosition(srcSel) & 4);
ok('제출 버튼보다 앞', srcSel.compareDocumentPosition(doc.getElementById('submitBtn')) & 4);
ok('5번 머리 표시', $('.sub-num').textContent === '5' && /후원계기 및 후원동기/.test($('.sub-title').textContent));
ok('후원계기 항목 18개 + 안내', srcSel.options.length === 19 && srcSel.options[0].value === '');
ok('후원동기 항목 10개 + 안내', reaSel.options.length === 11 && reaSel.options[0].value === '');
ok('첫 항목: 다큐영화', srcSel.options[1].value === '다큐영화(아버지의 마음)');
ok('마지막 항목: TEST', srcSel.options[18].value === 'TEST');
ok('후원동기 첫 항목', reaSel.options[1].value === '어려움에 처한 어린이에 대한 안타까운 마음');
ok('후원동기 마지막 항목', reaSel.options[10].value === '기타');
ok('초기 미선택 = placeholder 색', srcSel.classList.contains('placeholder') && reaSel.classList.contains('placeholder'));
change(srcSel, '컴패션 비전트립');
ok('선택 시 placeholder 해제', !srcSel.classList.contains('placeholder'));
change(reaSel, '수입의 가치 있는 사용');
ok('두 번째도 정상 선택', reaSel.value === '수입의 가치 있는 사용' && !reaSel.classList.contains('placeholder'));
alerts.length = 0;
click(doc.getElementById('submitBtn'));
ok('선택 항목이라 제출 차단하지 않음', alerts.length === 1 && /제출 로직/.test(alerts[0]));
change(srcSel, '');
ok('다시 비우면 placeholder 복귀', srcSel.classList.contains('placeholder'));
alerts.length = 0;
click(doc.getElementById('submitBtn'));
ok('미선택도 제출 가능', alerts.length === 1 && /제출 로직/.test(alerts[0]));

console.log('\n[12] 런타임 에러 없음');
ok('no errors overall', errs.length === 0);
if (errs.length) console.log(errs);

console.log('\n────────────────────────');
console.log('PASS: ' + pass + '   FAIL: ' + fail);
process.exit(fail ? 1 : 0);
