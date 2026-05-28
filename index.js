/*
 * Breadcrumb (Chat Search) — SillyTavern extension
 * 현재 채팅의 전체 메시지를 검색하고, 결과를 클릭하면 해당 메시지로 점프합니다.
 * - 마법봉(확장) 메뉴에 고정 버튼
 * - getContext().chat 배열을 직접 검색 (REST 불필요)
 * - 결과 클릭 → 해당 메시지로 스크롤 (팝업 없음, ST는 점프가 빠름)
 */

const MODULE_NAME = 'breadcrumb';
const PREFIX = 'st-bc';

/* ----------------------------- 유틸 ----------------------------- */
function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function debounce(fn, ms) {
    let t;
    return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
}

/* 메시지 작성자 라벨 (ST 메시지 객체 기준) */
function authorLabel(m) {
    if (!m) return '';
    if (m.is_user) return m.name || 'You';
    if (m.is_system) return m.name || 'System';
    return m.name || 'Character';
}

/* 메시지의 표시용 텍스트(검색 대상) */
function messageText(m) {
    return (m && typeof m.mes === 'string') ? m.mes : '';
}

/* ----------------------------- 상태 ----------------------------- */
const state = {
    results: [],   // [{ index, m }]
    cursor: -1,
    query: '',
    open: false,
};

/* ----------------------------- 검색 ----------------------------- */
function runSearch(query) {
    const ctx = SillyTavern.getContext();
    const chat = ctx.chat || [];
    state.query = query || '';
    const terms = state.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const results = [];
    if (terms.length) {
        for (let i = 0; i < chat.length; i++) {
            const text = messageText(chat[i]).toLowerCase();
            if (!text) continue;
            let ok = true;
            for (const t of terms) { if (text.indexOf(t) === -1) { ok = false; break; } }
            if (ok) results.push({ index: i, m: chat[i] });
        }
    }
    state.results = results;
    state.cursor = results.length ? 0 : -1;
    renderResults();
}

/* 미리보기 스니펫 + 검색어 하이라이트 */
function makePreview(content, q) {
    const terms = (q || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    const lc = content.toLowerCase();
    let pos = -1;
    terms.forEach((t) => { const p = lc.indexOf(t); if (p !== -1 && (pos === -1 || p < pos)) pos = p; });
    if (pos === -1) pos = 0;
    const s = Math.max(0, pos - 40), e = Math.min(content.length, pos + 120);
    let snip = (s > 0 ? '…' : '') + content.slice(s, e) + (e < content.length ? '…' : '');
    let html = escapeHtml(snip);
    terms.forEach((t) => {
        if (!t) return;
        const re = new RegExp('(' + escapeRegExp(escapeHtml(t)) + ')', 'gi');
        html = html.replace(re, '<mark class="' + PREFIX + '-mark">$1</mark>');
    });
    return html;
}

function fmtTime(m) {
    // ST 메시지의 send_date 는 문자열/타임스탬프가 섞여 올 수 있음
    const d = m && m.send_date;
    if (!d) return '';
    let date;
    if (typeof d === 'number') date = new Date(d);
    else date = new Date(d);
    if (isNaN(date.getTime())) return String(d);
    const p = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}.${p(date.getMonth() + 1)}.${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`;
}

/* ----------------------------- 렌더 ----------------------------- */
function renderResults() {
    const listEl = document.getElementById(PREFIX + '-list');
    const countEl = document.getElementById(PREFIX + '-count');
    if (!listEl) return;

    if (!state.query.trim()) {
        listEl.innerHTML = '<div class="' + PREFIX + '-empty">검색어를 입력하세요.</div>';
        if (countEl) countEl.textContent = '';
        updateNav();
        return;
    }
    if (!state.results.length) {
        listEl.innerHTML = '<div class="' + PREFIX + '-empty">결과 없음</div>';
        if (countEl) countEl.textContent = '0';
        updateNav();
        return;
    }

    let html = '';
    for (let i = 0; i < state.results.length; i++) {
        const r = state.results[i], m = r.m;
        const label = authorLabel(m);
        const roleClass = m.is_user ? ' ' + PREFIX + '-user' : '';
        html +=
            '<div class="' + PREFIX + '-item' + (i === state.cursor ? ' ' + PREFIX + '-active' : '') + '" data-i="' + i + '">' +
            '<div class="' + PREFIX + '-meta">' +
            '<span class="' + PREFIX + '-role' + roleClass + '">' + escapeHtml(label) + '</span>' +
            '<span class="' + PREFIX + '-time">' + fmtTime(m) + '</span>' +
            '<span class="' + PREFIX + '-time">#' + (r.index) + '</span>' +
            '</div>' +
            '<div class="' + PREFIX + '-snippet">' + makePreview(messageText(m), state.query) + '</div>' +
            '</div>';
    }
    listEl.innerHTML = html;
    if (countEl) countEl.textContent = String(state.results.length);

    listEl.querySelectorAll('.' + PREFIX + '-item').forEach((el) => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.getAttribute('data-i'), 10);
            state.cursor = idx;
            renderResults();
            const rr = state.results[idx];
            if (rr) jumpToMessage(rr.index);
        });
    });
    updateNav();
}

function scrollActiveIntoView() {
    const listEl = document.getElementById(PREFIX + '-list');
    if (!listEl) return;
    const active = listEl.querySelector('.' + PREFIX + '-active');
    if (active) active.scrollIntoView({ block: 'nearest' });
}

function updateNav() {
    const has = state.results.length > 0;
    const pos = document.getElementById(PREFIX + '-pos');
    if (pos) pos.textContent = has ? (state.cursor + 1) + ' / ' + state.results.length : '';
}

function moveCursor(delta) {
    if (!state.results.length) return;
    state.cursor = (state.cursor + delta + state.results.length) % state.results.length;
    renderResults();
    scrollActiveIntoView();
}

/* ----------------------------- 점프 ----------------------------- */
/* ST 메시지는 .mes[mesid="N"] 로 DOM 에 존재. 스크롤해서 강조. */
function jumpToMessage(messageIndex) {
    closePanel();
    const sel = '#chat .mes[mesid="' + messageIndex + '"]';
    let tries = 0;
    const maxTries = 40; // 약 4초
    const timer = setInterval(() => {
        const el = document.querySelector(sel);
        if (el) {
            clearInterval(timer);
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // 잠깐 강조
            el.classList.add(PREFIX + '-flash');
            setTimeout(() => el.classList.remove(PREFIX + '-flash'), 1600);
        } else if (++tries >= maxTries) {
            clearInterval(timer);
            if (window.toastr) toastr.info('메시지를 찾지 못했어요. 채팅을 스크롤한 뒤 다시 시도해 주세요.');
        }
    }, 100);
}

/* ----------------------------- 패널 UI ----------------------------- */
function buildPanel() {
    if (document.getElementById(PREFIX + '-panel')) return;
    const panel = document.createElement('div');
    panel.id = PREFIX + '-panel';
    panel.className = PREFIX + '-panel';
    panel.innerHTML =
        '<div class="' + PREFIX + '-scrim" id="' + PREFIX + '-scrim"></div>' +
        '<div class="' + PREFIX + '-box" role="dialog" aria-label="채팅 검색">' +
        '<div class="' + PREFIX + '-head">' +
        '<input id="' + PREFIX + '-input" class="' + PREFIX + '-input" type="text" placeholder="현재 채팅 검색… (공백=AND)" autocomplete="off">' +
        '<span id="' + PREFIX + '-count" class="' + PREFIX + '-cnt"></span>' +
        '<button id="' + PREFIX + '-close" class="' + PREFIX + '-x" title="닫기">&times;</button>' +
        '</div>' +
        '<div class="' + PREFIX + '-nav">' +
        '<button id="' + PREFIX + '-prev" class="' + PREFIX + '-navbtn" title="이전 (Shift+Enter)">▲</button>' +
        '<button id="' + PREFIX + '-next" class="' + PREFIX + '-navbtn" title="다음 (Enter)">▼</button>' +
        '<span id="' + PREFIX + '-pos" class="' + PREFIX + '-pos"></span>' +
        '<span class="' + PREFIX + '-hint">클릭하면 해당 메시지로 이동</span>' +
        '</div>' +
        '<div id="' + PREFIX + '-list" class="' + PREFIX + '-list"></div>' +
        '</div>';
    document.body.appendChild(panel);

    const input = document.getElementById(PREFIX + '-input');
    const doSearch = debounce(() => runSearch(input.value), 150);
    input.addEventListener('input', doSearch);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) moveCursor(-1); else moveCursor(1);
        } else if (e.key === 'Escape') {
            e.preventDefault(); closePanel();
        }
    });
    document.getElementById(PREFIX + '-close').addEventListener('click', closePanel);
    document.getElementById(PREFIX + '-scrim').addEventListener('click', closePanel);
    document.getElementById(PREFIX + '-prev').addEventListener('click', () => moveCursor(-1));
    document.getElementById(PREFIX + '-next').addEventListener('click', () => moveCursor(1));
}

function openPanel() {
    buildPanel();
    const panel = document.getElementById(PREFIX + '-panel');
    // 다른 요소(메뉴/모달)에 가려지지 않도록 body 맨 끝으로 이동
    if (panel.parentElement !== document.body || document.body.lastElementChild !== panel) {
        document.body.appendChild(panel);
    }
    panel.classList.add(PREFIX + '-show');
    panel.style.display = 'block'; // CSS 충돌 대비 강제 표시
    state.open = true;
    const input = document.getElementById(PREFIX + '-input');
    setTimeout(() => { input && input.focus(); input && input.select(); }, 30);
    // 패널 열 때 기존 검색어로 재검색
    if (input && input.value) runSearch(input.value);
    else renderResults();
}

function closePanel() {
    const panel = document.getElementById(PREFIX + '-panel');
    if (panel) {
        panel.classList.remove(PREFIX + '-show');
        panel.style.display = 'none';
    }
    state.open = false;
}

function togglePanel() {
    if (state.open) closePanel(); else openPanel();
}

/* ----------------------------- 마법봉 메뉴 버튼 ----------------------------- */
function addWandButton() {
    const menu = document.getElementById('extensionsMenu');
    if (!menu) return false;
    if (document.getElementById(PREFIX + '-wand')) return true;

    const item = document.createElement('div');
    item.id = PREFIX + '-wand';
    item.className = 'list-group-item flex-container flexGap5 interactable';
    item.tabIndex = 0;
    item.title = '현재 채팅 검색';
    item.innerHTML =
        '<div class="fa-solid fa-magnifying-glass extensionsMenuExtensionButton"></div>' +
        '<span>채팅 검색 (Breadcrumb)</span>';
    const openHandler = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        // ST 마법봉 메뉴가 닫히는 동작과 충돌하지 않도록 약간 지연 후 열기
        setTimeout(() => openPanel(), 60);
    };
    item.addEventListener('click', openHandler);
    item.addEventListener('touchend', openHandler);
    menu.appendChild(item);
    return true;
}

/* 마법봉 메뉴는 늦게 생성될 수 있으니 재시도. 실패 시 폴백 버튼 표시 */
function ensureWandButton() {
    if (addWandButton()) return;
    let tries = 0;
    const timer = setInterval(() => {
        if (addWandButton()) { clearInterval(timer); return; }
        if (++tries > 50) { clearInterval(timer); addFallbackButton(); }
    }, 200);
}

/* 폴백: 마법봉 메뉴에 못 넣었을 때 화면에 떠있는 작은 검색 버튼 */
function addFallbackButton() {
    if (document.getElementById(PREFIX + '-fab')) return;
    const fab = document.createElement('button');
    fab.id = PREFIX + '-fab';
    fab.className = PREFIX + '-fab';
    fab.title = '채팅 검색 (Breadcrumb)';
    fab.innerHTML = '<div class="fa-solid fa-magnifying-glass"></div>';
    const openHandler = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } openPanel(); };
    fab.addEventListener('click', openHandler);
    fab.addEventListener('touchend', openHandler);
    document.body.appendChild(fab);
    console.log('[Breadcrumb] 마법봉 메뉴 삽입 실패 → 폴백 버튼 표시');
}

/* ----------------------------- 단축키 ----------------------------- */
function installHotkey() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/⌘+F 로 열기 (입력창 포커스 중이 아니어도 동작; ST 자체 기능과 충돌 시 조정)
        if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
            e.preventDefault();
            openPanel();
        }
    });
}

/* ----------------------------- 초기화 ----------------------------- */
function init() {
    ensureWandButton();
    installHotkey();
    console.log('[Breadcrumb] SillyTavern extension loaded.');
}

// APP_READY 이후 초기화 (메뉴/DOM 준비됨)
try {
    const ctx = SillyTavern.getContext();
    if (ctx && ctx.eventSource && ctx.event_types) {
        ctx.eventSource.on(ctx.event_types.APP_READY, init);
        // 이미 준비된 경우 대비
        if (document.getElementById('extensionsMenu')) init();
    } else {
        jQuery(() => init());
    }
} catch (e) {
    jQuery(() => init());
}
