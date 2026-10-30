// Contrast annotation task for RAs.
// RAs upload a work unit (trial_lists/fileN.csv) and, optionally, their results from a previous session.
// For each target they sort the top responses into groups, name each group by how it differs from the
// target, and tag each response with its relationship to the target. Answers that aren't contrasts
// go in an exclusion bin instead. Results download as a CSV (one row per response).

const MAX_RESPONSES = 12;   // must match MAX_RESPONSES in make_trial_lists.py

// ─── Relationship tags ────────────────────────────────────────────────────────
// Exactly one per response (answers in a group). Edit this list to change what RAs see; `key` is what
// gets saved. Labels are kept short so they fit on the chip.
//   counterpart    the dimension has two values or two ends (brother → sister, hot → cold, giving → take)
//   sibling        one of many alternatives, including functional ones (tiger → lion, yellow → blue, stairs → elevator)
//   near_synonym   almost the same, but a distinction is being drawn (hearing → listen, house → home)
//   broader        banana → fruit          narrower    a kind or (usually atypical) example: plant → tree, present → car
//   part_whole     ankle → foot            goes_together  keys → lock, jelly → peanut butter
//   form           sound or spelling (ant → aunt)
const TAGS = [
    { key: 'counterpart',   label: 'Counterpart' },
    { key: 'sibling',       label: 'Sibling' },
    { key: 'near_synonym',  label: 'Near-synonym' },
    { key: 'broader',       label: 'Broader category' },
    { key: 'narrower',      label: 'Narrower category / example' },
    { key: 'part_whole',    label: 'Part or whole' },
    { key: 'goes_together', label: 'Goes together' },
    { key: 'form',          label: 'Sound or spelling' },
    { key: 'other',         label: 'Other' }
];

const TAG_OPTIONS = TAGS.map(t => `<option value="${t.key}">${t.label}</option>`).join('');

// ─── Follow-up questions ──────────────────────────────────────────────────────
// A second dropdown that appears on the chip for some tags (optionally only for some target parts of speech).
// Required once it appears; reset if the tag changes. `column` is the results column it's saved in.
const FOLLOWUPS = {
    counterpart: {
        column:   'counterpart_type',
        short:    'How opposite?',
        question: 'Either/or: if it\'s not one, it\'s the other (dead → alive). ' +
                  'Scale: there\'s an in-between or neutral point (hot → cold, up → down). ' +
                  'Two sides: swap who\'s who and you get the other word (buy → sell, under → over). ' +
                  'Undoes: one reverses the change the other makes (make → break). ' +
                  'None: explain in notes.',
        options: [
            { key: 'either_or', label: 'Either/or' },
            { key: 'scale',     label: 'Ends of a scale' },
            { key: 'two_sides', label: 'Two sides' },
            { key: 'undoes',    label: 'Undoes' },
            { key: 'none',      label: 'None of these' }
        ]
    }
};

// the follow-up for this tag on this target, or null
function followupFor(tag, pos) {
    const f = FOLLOWUPS[tag];
    if (!f || (f.pos && !f.pos.includes(pos))) return null;
    return f;
}

function followupHTML(f) {
    if (!f) return '';
    return `<option value="">${f.short}</option>` +
           f.options.map(o => `<option value="${o.key}">${o.label}</option>`).join('');
}


// the follow-up for this tag on this target, or null
function followupFor(tag, pos) {
    const f = FOLLOWUPS[tag];
    if (!f || (f.pos && !f.pos.includes(pos))) return null;
    return f;
}


// ─── Exclusion bins ───────────────────────────────────────────────────────────
// Answers that are claims about the target rather than alternatives to it. They get no group or tag;
// `key` is saved in `excluded`, using the same labels as the phrase annotation (prescriptive / descriptive).
const BINS = [
    { key: 'prescriptive', title: 'Normative claim',  subtitle: 'a judgment or rule about the target' },
    { key: 'descriptive',  title: 'Factual claim',    subtitle: 'a category or property the target lacks' },
    { key: 'doesnt_fit',   title: "Doesn't fit",      subtitle: "unclear or doesn't make sense" }
];

// bin keys used by earlier versions of the page
const OLD_ZONES = { nofit: 'doesnt_fit', normative: 'prescriptive', factual: 'descriptive' };

function isGroupZone(zone) {
    return /^g\d+$/.test(zone);
}

// ─── Group colours ────────────────────────────────────────────────────────────
// From the Semantic Load decks. Each new group gets a random colour not already used on that target.
const GROUP_COLORS = ['#8077DD', '#048A81', '#226CE0', '#3D3454', '#9F7A77', '#B6B1C6'];

function pickGroupColor(state) {
    const used = state.groupOrder.map(g => state.groups[g].color);
    const free = GROUP_COLORS.filter(c => !used.includes(c));
    const pool = free.length ? free : GROUP_COLORS;
    return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Global state ─────────────────────────────────────────────────────────────
let coder = '';
let unit = { listNum: null, items: [] };   // items are in this coder's sidebar order
let annotations = {};                      // target key -> annotation state
let currentIndex = 0;
let currentStart = null;                   // when the current target was opened
let unsavedChanges = false;
let lastDownload = null;
let restoreNote = '';                      // shown until the RA changes something

// ─── Helpers ──────────────────────────────────────────────────────────────────
function escapeHTML(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function itemKey(item) {
    return `${item.target_word}_${item.target_pos}`;
}

// Same frame logic as the original nota task: before + target + clarification + after + blank
function buildFrameHTML(item) {
    const before = item.sentence_frame_before || '';
    const after = item.sentence_frame_after || '';
    const clarification = item.clarification ? ` ${item.clarification}` : '';
    return `${before}<span class="word-highlight">${escapeHTML(item.target_word)}</span>${clarification}${after}<span class="frame-blank">______</span>`;
}

// Pull response1..responseN / count1..countN out of a work-unit row
function getResponses(item) {
    const responses = [];
    for (let i = 1; i <= MAX_RESPONSES; i++) {
        const r = item[`response${i}`];
        if (r === undefined || r === null || String(r).trim() === '') continue;
        responses.push({
            response: String(r),
            lexeme:   item[`lexeme${i}`] ? String(item[`lexeme${i}`]) : String(r),
            count:    parseInt(item[`count${i}`], 10),
            rank:     i
        });
    }
    return responses;
}

function shuffle(arr, rand = Math.random) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Seeded RNG so each coder gets their own, but stable, target order for a work unit
function seededRandom(seedString) {
    let h = 1779033703 ^ seedString.length;
    for (let i = 0; i < seedString.length; i++) {
        h = Math.imul(h ^ seedString.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    let a = h >>> 0;
    return function() {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function parseCSVFile(file) {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false,   // keep responses like "true" or "1" as strings
            complete: results => resolve(results.data),
            error: err => reject(err)
        });
    });
}

function chipHTML(r, idx) {
    return `
        <div class="chip" data-idx="${idx}" title="${r.count} people gave this response">
            <span class="chip-word">${escapeHTML(r.response)}</span>
            <span class="chip-count">${r.count}</span>
            <button class="chip-note-btn" title="Add a comment on this answer">&#9998;</button>
            <select class="chip-tag">
                <option value="">Relationship&hellip;</option>
                ${TAG_OPTIONS}
            </select>
            <select class="chip-followup"></select>
            <input class="chip-note" type="text" maxlength="200" placeholder="Comment on this answer" autocomplete="off">
        </div>`;
}

// ─── Annotation state ─────────────────────────────────────────────────────────
// display:   responses in the order shown in the bank (fixed per coder, so revisits look the same)
// chipZone:  display idx -> 'bank' | a BINS key | 'g1', 'g2', ...
// chipTag:   display idx -> relationship tag key ('' if not tagged yet); kept if the chip moves groups
// chipFollowup: display idx -> '' or an option key for the tag's follow-up question (see FOLLOWUPS)
// chipNote:  display idx -> the RA's comment on that answer ('' if none)
// groups:    group id -> { label, color }
// notes:     free-text notes on this target
function newAnnotation(item) {
    const display = shuffle(getResponses(item));
    return {
        display:        display,
        chipZone:       display.map(() => 'bank'),
        chipTag:        display.map(() => ''),
        chipFollowup:   display.map(() => ''),
        chipNote:       display.map(() => ''),
        groups:         {},
        groupOrder:     [],
        nextGroup:      1,
        nMoves:         0,
        nGroupsCreated: 0,
        nGroupsRemoved: 0,
        notes:          '',
        timeSpent:      0,       // seconds
        completed:      false,
        lastSaved:      ''
    };
}

function getProblems(state, pos) {
    const nUnsorted = state.chipZone.filter(z => z === 'bank').length;
    let nUnnamed = 0, nUntagged = 0, nFollowup = 0;
    state.groupOrder.forEach(g => {
        if (!state.chipZone.includes(g)) return;   // empty groups are ignored
        if (state.groups[g].label.trim() === '') nUnnamed++;
    });
    // only answers in a group need a tag (not ones in the bank or an exclusion bin)
    state.chipZone.forEach((z, i) => {
        if (isGroupZone(z) && !state.chipTag[i]) nUntagged++;
        if (isGroupZone(z) && followupFor(state.chipTag[i], pos) && !state.chipFollowup[i]) nFollowup++;
    });
    return { nUnsorted, nUnnamed, nUntagged, nFollowup };
}

function isComplete(state, pos) {
    const p = getProblems(state, pos);
    return p.nUnsorted === 0 && p.nUnnamed === 0 && p.nUntagged === 0 && p.nFollowup === 0;
}

function isTouched(state) {
    return state && (state.nMoves > 0 || state.groupOrder.length > 0 || state.notes.trim() !== '' ||
                     (state.chipNote || []).some(n => n.trim() !== ''));
}

// ─── Start screen ─────────────────────────────────────────────────────────────
async function startAnnotating() {
    const errorEl = document.getElementById('start-error');
    errorEl.textContent = '';

    coder = document.getElementById('coder-input').value.trim().toUpperCase();
    const unitFile = document.getElementById('unit-input').files[0];
    const resultsFile = document.getElementById('results-input').files[0];

    if (!coder) { errorEl.textContent = 'Please enter your initials.'; return; }
    if (!unitFile) { errorEl.textContent = 'Please choose a work unit file.'; return; }

    try {
        // load work unit
        const rows = await parseCSVFile(unitFile);
        if (rows.length === 0 || !('target_word' in rows[0]) || !('response1' in rows[0])) {
            throw new Error(`${unitFile.name} doesn't look like a work unit file.`);
        }
        unit.listNum = rows[0].list_num;
        unit.items = shuffle(rows, seededRandom(`${coder}_${unit.listNum}`));
        console.log(`Loaded work unit ${unit.listNum}: ${unit.items.length} targets`);

        // restore previous work: uploaded results file first, otherwise this browser's autosave
        let restoredFrom = '';
        if (resultsFile) {
            const resultRows = await parseCSVFile(resultsFile);
            const fileUnit = resultRows.length ? resultRows[0].list_num : null;
            if (fileUnit && String(fileUnit) !== String(unit.listNum)) {
                throw new Error(`That results file is for work unit ${fileUnit}, not work unit ${unit.listNum}.`);
            }
            restoreFromResults(resultRows);
            restoredFrom = `Restored ${Object.keys(annotations).length} targets from ${resultsFile.name}.`;
        } else if (restoreFromLocal()) {
            restoredFrom = 'Restored autosaved work from this browser. Download your results to keep a copy.';
            unsavedChanges = true;
        }

        unit.items.forEach(item => {
            if (!annotations[itemKey(item)]) annotations[itemKey(item)] = newAnnotation(item);
        });

        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        document.getElementById('unit-title').textContent = `Work unit ${unit.listNum}`;
        document.getElementById('unit-meta').textContent = `Coder: ${coder}`;
        restoreNote = restoredFrom;

        // open the first target that isn't finished
        const firstOpen = unit.items.findIndex(item => !annotations[itemKey(item)].completed);
        openTarget(firstOpen === -1 ? 0 : firstOpen);

    } catch (error) {
        console.error('Error starting:', error);
        errorEl.textContent = error.message;
    }
}

// ─── Restore from a downloaded results file ──────────────────────────────────
function restoreFromResults(resultRows) {
    const byKey = {};
    resultRows.forEach(r => {
        const key = `${r.target_word}_${r.target_pos}`;
        (byKey[key] = byKey[key] || []).push(r);
    });

    unit.items.forEach(item => {
        const key = itemKey(item);
        const rows = byKey[key];
        if (!rows) return;

        rows.sort((a, b) => parseInt(a.display_order, 10) - parseInt(b.display_order, 10));
        const responses = getResponses(item);
        const state = newAnnotation(item);

        // rebuild display order from the file; anything not in the file goes to the end.
        // Match on the response text, or on its rank if the text has changed since (verbs shown as -ing).
        const display = [];
        const rowFor = new Map();
        rows.forEach(r => {
            const match = responses.find(x => x.response === r.response && !display.includes(x)) ||
                          responses.find(x => String(x.rank) === String(r.response_rank) && !display.includes(x));
            if (match) { display.push(match); rowFor.set(match, r); }
        });
        responses.forEach(x => { if (!display.includes(x)) display.push(x); });
        state.display = display;

        state.chipZone = display.map(x => {
            const r = rowFor.get(x);
            if (!r) return 'bank';
            const excluded = OLD_ZONES[r.excluded] || r.excluded;
            if (BINS.some(b => b.key === excluded)) return excluded;
            if (r.group_num !== '') return `g${r.group_num}`;
            return 'bank';
        });

        state.chipTag = display.map(x => {
            const r = rowFor.get(x);
            return r ? (r.response_tag || '') : '';
        });

        state.chipFollowup = display.map((x, i) => {
            const r = rowFor.get(x);
            const f = followupFor(state.chipTag[i], item.target_pos);
            if (!r || !f) return '';
            return f.options.some(o => o.key === r[f.column]) ? r[f.column] : '';
        });

        state.chipNote = display.map(x => {
            const r = rowFor.get(x);
            return r ? (r.response_note || '') : '';
        });

        rows.forEach(r => {
            if (r.group_num === '' || state.groups[`g${r.group_num}`]) return;
            state.groups[`g${r.group_num}`] = { label: r.group_label || '' };
        });
        state.groupOrder = Object.keys(state.groups).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
        state.nextGroup = state.groupOrder.length ? Math.max(...state.groupOrder.map(g => parseInt(g.slice(1)))) + 1 : 1;

        const first = rows[0];
        state.nMoves         = parseInt(first.n_moves, 10) || 0;
        state.nGroupsCreated = parseInt(first.n_groups_created, 10) || 0;
        state.nGroupsRemoved = parseInt(first.n_groups_removed, 10) || 0;
        state.timeSpent      = parseFloat(first.time_on_target_s) || 0;
        state.notes          = first.notes || '';
        state.lastSaved      = first.last_saved || '';
        state.completed      = isComplete(state, item.target_pos);

        annotations[key] = state;
    });
}

// ─── Autosave (this browser only; the downloaded file is the real save) ──────
function localKey() {
    return `nota_annotation_${coder}_unit${unit.listNum}`;
}

function autosave() {
    try {
        localStorage.setItem(localKey(), JSON.stringify({ savedAt: new Date().toISOString(), annotations }));
    } catch (e) {
        console.warn('Autosave failed:', e);
    }
}

function restoreFromLocal() {
    try {
        const saved = JSON.parse(localStorage.getItem(localKey()) || 'null');
        if (!saved || !saved.annotations) return false;
        // only keep targets that are in this work unit
        unit.items.forEach(item => {
            const s = saved.annotations[itemKey(item)];
            if (!s) return;
            // autosaves from earlier versions of the page
            if (!s.chipTag) s.chipTag = s.display.map(() => '');
            if (!s.chipFollowup) s.chipFollowup = s.display.map(() => '');
            if (!s.chipNote) s.chipNote = s.display.map(() => '');
            // refresh the answers' text from the work unit (e.g. verbs now shown as -ing), matched by rank
            const current = getResponses(item);
            s.display = s.display.map(x => current.find(y => y.rank === x.rank) || x);
            // drop follow-up answers that aren't valid options any more (e.g. the old yes/no)
            s.chipFollowup = s.chipFollowup.map((v, i) => {
                const f = followupFor(s.chipTag[i], item.target_pos);
                return f && f.options.some(o => o.key === v) ? v : '';
            });
            if (s.notes === undefined) s.notes = '';
            s.chipZone = s.chipZone.map(z => OLD_ZONES[z] || z);
            s.completed = isComplete(s, item.target_pos);
            annotations[itemKey(item)] = s;
        });
        return Object.keys(annotations).length > 0;
    } catch (e) {
        console.warn('Could not read autosave:', e);
        return false;
    }
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function renderSidebar() {
    const list = document.getElementById('target-list');
    list.innerHTML = unit.items.map((item, i) => {
        const state = annotations[itemKey(item)];
        let status = '';
        if (state.completed)       status = '<span class="target-status done">&#10003;</span>';
        else if (isTouched(state)) status = '<span class="target-status partial">&#9679;</span>';
        return `
            <button class="target-btn ${i === currentIndex ? 'current' : ''}" data-i="${i}">
                <span>${escapeHTML(item.target_word)}<span class="target-pos">${escapeHTML(item.target_pos)}</span></span>
                ${status}
            </button>`;
    }).join('');

    list.querySelectorAll('.target-btn').forEach(btn => {
        btn.addEventListener('click', () => openTarget(parseInt(btn.dataset.i, 10)));
    });

    const nDone = unit.items.filter(item => annotations[itemKey(item)].completed).length;
    document.getElementById('progress').textContent = `${nDone} / ${unit.items.length} done`;

    const note = document.getElementById('save-note');
    if (restoreNote) {
        note.textContent = restoreNote;
    } else if (unsavedChanges) {
        note.textContent = 'Changes not downloaded yet.';
        note.classList.add('unsaved');
    } else if (lastDownload) {
        note.textContent = `Downloaded at ${lastDownload}.`;
        note.classList.remove('unsaved');
    }
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function closeCurrentTarget() {
    if (currentStart === null) return;
    const state = annotations[itemKey(unit.items[currentIndex])];
    state.timeSpent += (Date.now() - currentStart) / 1000;
    currentStart = null;
}

function openTarget(i) {
    closeCurrentTarget();
    currentIndex = i;
    currentStart = Date.now();

    const item = unit.items[i];
    document.getElementById('sort-container').innerHTML = buildSortHTML(item);
    setupSortLogic(item, annotations[itemKey(item)]);

    document.getElementById('prev-btn').disabled = i === 0;
    document.getElementById('next-btn').disabled = i === unit.items.length - 1;
    renderSidebar();
    window.scrollTo(0, 0);
}

// ─── Sorting HTML builder ─────────────────────────────────────────────────────
function buildSortHTML(item) {
    return `
        <div id="sort-task">
            <div class="frame">${buildFrameHTML(item)}</div>

            <div id="sort-columns">
                <div id="left-column">
                    <div id="response-bank" class="drop-zone" data-zone="bank">
                        <div class="zone-title">Answers to sort</div>
                        <div class="chip-holder"></div>
                    </div>
                    ${BINS.map(b => `
                    <div class="drop-zone exclude-zone" data-zone="${b.key}">
                        <div class="zone-title">${b.title} <span class="zone-subtitle">${escapeHTML(b.subtitle)}</span></div>
                        <div class="chip-holder"></div>
                    </div>`).join('')}
                </div>

                <div id="group-area">
                    <div id="new-group-zone" class="drop-zone new-group-zone" data-zone="new">
                        + New group
                        <small>drag an answer here, or click</small>
                    </div>
                </div>
            </div>

            <div id="notes-box">
                <label for="target-notes">Notes on <strong>${escapeHTML(item.target_word)}</strong></label>
                <textarea id="target-notes" rows="2" placeholder="Anything odd about this target or its answers, or a decision you weren't sure about"></textarea>
            </div>
        </div>
    `;
}

function buildGroupHTML(groupId, target) {
    return `
        <div class="drop-zone group-box" data-zone="${groupId}">
            <div class="group-header">
                <div style="flex:1;">
                    <div class="group-prompt">Dimension</div>
                    <input class="group-label" type="text" maxlength="100" placeholder="e.g. time, how welcome it is" autocomplete="off">
                </div>
                <button class="group-remove" title="Remove group">&times;</button>
            </div>
            <div class="chip-holder"></div>
        </div>`;
}

// ─── Sort logic ───────────────────────────────────────────────────────────────
// Builds the boxes and chips from the saved state, then keeps the state up to date as the RA works
function setupSortLogic(item, state) {
    const task = document.getElementById('sort-task');
    if (!task) return;

    const groupArea = document.getElementById('group-area');
    const newZone   = document.getElementById('new-group-zone');

    function zoneEl(zoneId) {
        return task.querySelector(`[data-zone="${zoneId}"]`);
    }

    // show the follow-up question for the chip's current tag (or hide it)
    function renderFollowup(chip) {
        const i = chip.dataset.idx;
        const sel = chip.querySelector('.chip-followup');
        const f = followupFor(state.chipTag[i], item.target_pos);
        sel.innerHTML = followupHTML(f);
        sel.classList.toggle('active', !!f);
        sel.title = f ? f.question : '';
        sel.value = state.chipFollowup[i];
    }

    // anything changed: re-check completion, autosave, refresh sidebar/status
    function markChanged() {
        state.completed = isComplete(state, item.target_pos);
        state.lastSaved = new Date().toISOString();
        unsavedChanges = true;
        restoreNote = '';
        autosave();
        updateStatus();
        renderSidebar();
    }

    // ── Groups ──────────────────────────────────────────────────────────────
    function addGroupBox(groupId) {
        newZone.insertAdjacentHTML('beforebegin', buildGroupHTML(groupId, item.target_word));
        const box = zoneEl(groupId);

        const labelInput = box.querySelector('.group-label');
        labelInput.value = state.groups[groupId].label;

        // groups restored from a file or an older save get a colour the first time they're shown
        if (!state.groups[groupId].color) state.groups[groupId].color = pickGroupColor(state);
        box.style.setProperty('--group-color', state.groups[groupId].color);

        labelInput.addEventListener('input', (e) => {
            state.groups[groupId].label = e.target.value;
            markChanged();
        });

        // removing a group sends its answers back to the bank
        box.querySelector('.group-remove').addEventListener('click', () => {
            const bankHolder = zoneEl('bank').querySelector('.chip-holder');
            box.querySelectorAll('.chip').forEach(chip => {
                bankHolder.appendChild(chip);
                state.chipZone[chip.dataset.idx] = 'bank';
            });
            box.remove();
            delete state.groups[groupId];
            state.groupOrder = state.groupOrder.filter(g => g !== groupId);
            state.nGroupsRemoved++;
            markChanged();
        });

        return box;
    }

    function createGroup() {
        const groupId = `g${state.nextGroup++}`;
        state.groups[groupId] = { label: '', color: pickGroupColor(state) };
        state.groupOrder.push(groupId);
        state.nGroupsCreated++;
        return addGroupBox(groupId);
    }

    // ── Rebuild from saved state ────────────────────────────────────────────
    state.groupOrder.forEach(g => addGroupBox(g));
    state.display.forEach((r, i) => {
        const zone = zoneEl(state.chipZone[i]) || zoneEl('bank');
        zone.querySelector('.chip-holder').insertAdjacentHTML('beforeend', chipHTML(r, i));
        const chip = zone.querySelector(`.chip[data-idx="${i}"]`);
        chip.querySelector('.chip-tag').value = state.chipTag[i];
        chip.querySelector('.chip-note').value = state.chipNote[i];
        chip.classList.toggle('has-note', state.chipNote[i].trim() !== '');
        chip.classList.toggle('note-open', state.chipNote[i].trim() !== '');
        renderFollowup(chip);
    });

    // notes
    const notesBox = document.getElementById('target-notes');
    notesBox.value = state.notes;
    notesBox.addEventListener('input', (e) => {
        state.notes = e.target.value;
        markChanged();
    });

    // per-answer comments: the pencil opens a comment field on the chip
    task.addEventListener('click', (e) => {
        const btn = e.target.closest('.chip-note-btn');
        if (!btn) return;
        const chip = btn.closest('.chip');
        const open = !chip.classList.contains('note-open');
        chip.classList.toggle('note-open', open || state.chipNote[chip.dataset.idx].trim() !== '');
        if (open) chip.querySelector('.chip-note').focus();
    });
    task.addEventListener('input', (e) => {
        if (!e.target.classList.contains('chip-note')) return;
        const chip = e.target.closest('.chip');
        state.chipNote[chip.dataset.idx] = e.target.value;
        chip.classList.toggle('has-note', e.target.value.trim() !== '');
        markChanged();
    });

    // per-answer relationship tags
    task.addEventListener('change', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        const i = chip.dataset.idx;
        if (e.target.classList.contains('chip-tag')) {
            state.chipTag[i] = e.target.value;
            state.chipFollowup[i] = '';
            renderFollowup(chip);
            markChanged();
        } else if (e.target.classList.contains('chip-followup')) {
            state.chipFollowup[i] = e.target.value;
            markChanged();
        }
    });

    newZone.addEventListener('click', () => {
        const box = createGroup();
        box.querySelector('.group-label').focus();
        markChanged();
    });

    // ── Dropping ────────────────────────────────────────────────────────────
    function dropChip(chip, zone) {
        let zoneId = zone.dataset.zone;
        let focusLabel = false;

        if (zoneId === 'new') {
            zone = createGroup();
            zoneId = zone.dataset.zone;
            focusLabel = true;
        }

        if (state.chipZone[chip.dataset.idx] === zoneId) return;

        zone.querySelector('.chip-holder').appendChild(chip);
        state.chipZone[chip.dataset.idx] = zoneId;
        state.nMoves++;

        if (focusLabel) zone.querySelector('.group-label').focus();
        markChanged();
    }

    // ── Validation / status line ────────────────────────────────────────────
    function updateStatus() {
        groupArea.querySelectorAll('.group-box').forEach(box => {
            const g = box.dataset.zone;
            const hasChips = state.chipZone.includes(g);
            box.classList.toggle('needs-label', hasChips && state.groups[g].label.trim() === '');
        });
        task.querySelectorAll('.chip').forEach(chip => {
            const i = chip.dataset.idx;
            chip.classList.toggle('needs-tag', isGroupZone(state.chipZone[i]) && !state.chipTag[i]);
            chip.classList.toggle('needs-followup', isGroupZone(state.chipZone[i]) && !!followupFor(state.chipTag[i], item.target_pos) && !state.chipFollowup[i]);
        });

        const p = getProblems(state, item.target_pos);
        const status = document.getElementById('sort-status');
        if (isComplete(state, item.target_pos)) {
            status.innerHTML = '<span style="color:#27ae60;">&#10003; Done</span>';
        } else {
            const parts = [];
            if (p.nUnsorted > 0) parts.push(`Answers left to sort: ${p.nUnsorted}`);
            if (p.nUnnamed > 0)  parts.push(`Groups without a name: ${p.nUnnamed}`);
            if (p.nUntagged > 0) parts.push(`Answers without a relationship type: ${p.nUntagged}`);
            if (p.nFollowup > 0) parts.push(`Follow-up questions unanswered: ${p.nFollowup}`);
            status.textContent = parts.join(' · ');
        }
    }

    // ── Dragging ────────────────────────────────────────────────────────────
    // The chip stays in place (faded) while a fixed-position copy follows the pointer
    function zoneAt(x, y) {
        const el = document.elementFromPoint(x, y);
        return el ? el.closest('.drop-zone') : null;
    }

    task.addEventListener('pointerdown', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip || e.target.closest('select, input, button')) return;
        e.preventDefault();
        if (document.activeElement) document.activeElement.blur();

        const rect  = chip.getBoundingClientRect();
        const offX  = e.clientX - rect.left;
        const offY  = e.clientY - rect.top;

        const ghost = chip.cloneNode(true);
        ghost.classList.add('ghost');
        ghost.style.width = rect.width + 'px';
        ghost.style.left  = rect.left + 'px';
        ghost.style.top   = rect.top  + 'px';
        document.body.appendChild(ghost);
        chip.classList.add('placeholder');

        let overZone  = null;
        let lastY     = e.clientY;
        let scrolling = true;

        // scroll the page when dragging near the top or bottom edge
        function autoScroll() {
            if (!scrolling) return;
            const edge = 60;
            if (lastY < edge) window.scrollBy(0, -12);
            else if (lastY > window.innerHeight - edge) window.scrollBy(0, 12);
            requestAnimationFrame(autoScroll);
        }
        requestAnimationFrame(autoScroll);

        function onMove(ev) {
            lastY = ev.clientY;
            ghost.style.left = (ev.clientX - offX) + 'px';
            ghost.style.top  = (ev.clientY - offY) + 'px';

            const z = zoneAt(ev.clientX, ev.clientY);
            if (z !== overZone) {
                if (overZone) overZone.classList.remove('drag-over');
                if (z) z.classList.add('drag-over');
                overZone = z;
            }
        }

        function onUp(ev) {
            scrolling = false;
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            document.removeEventListener('pointercancel', onUp);

            ghost.remove();
            chip.classList.remove('placeholder');
            if (overZone) overZone.classList.remove('drag-over');

            const z = zoneAt(ev.clientX, ev.clientY);
            if (z && task.contains(z)) dropChip(chip, z);
        }

        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
        document.addEventListener('pointercancel', onUp);
    });

    updateStatus();
}

// ─── Data export ──────────────────────────────────────────────────────────────
// Long format: one row per response per target. Targets the RA hasn't touched are left out.
// Groups that ended up empty are dropped and the rest are renumbered 1..k in the order they were created.
function followupValue(state, i, inGroup, tag, pos) {
    if (!inGroup || state.chipTag[i] !== tag || !followupFor(tag, pos)) return '';
    return state.chipFollowup[i];
}

function getResultsCSV() {
    const header = [
        'coder', 'list_num', 'target_word', 'target_pos', 'target_cat',
        'response', 'response_lexeme', 'response_count', 'response_rank', 'display_order',
        'excluded', 'group_num', 'group_label', 'response_tag', 'counterpart_type', 'response_note', 'group_size',
        'n_responses', 'n_groups', 'n_excluded', 'n_moves', 'n_groups_created', 'n_groups_removed',
        'time_on_target_s', 'completed', 'notes', 'last_saved'
    ];

    const rows = [];
    unit.items.forEach(item => {
        const state = annotations[itemKey(item)];
        if (!isTouched(state)) return;

        const usedGroups = state.groupOrder.filter(g => state.chipZone.includes(g));
        const groupNum = {};
        usedGroups.forEach((g, i) => { groupNum[g] = i + 1; });

        const groupSize = {};
        state.chipZone.forEach(z => { groupSize[z] = (groupSize[z] || 0) + 1; });

        const nExcluded = state.chipZone.filter(z => BINS.some(b => b.key === z)).length;

        state.display.forEach((r, i) => {
            const zone = state.chipZone[i];
            const inGroup = zone in groupNum;
            rows.push([
                coder,
                unit.listNum,
                item.target_word,
                item.target_pos,
                item.target_cat || '',
                r.response,
                r.lexeme,
                r.count,
                r.rank,
                i + 1,
                BINS.some(b => b.key === zone) ? zone : '',
                inGroup ? groupNum[zone] : '',
                inGroup ? state.groups[zone].label.trim() : '',
                inGroup ? state.chipTag[i] : '',
                followupValue(state, i, inGroup, 'counterpart', item.target_pos),
                state.chipNote[i].trim(),
                inGroup ? groupSize[zone] : '',
                state.display.length,
                usedGroups.length,
                nExcluded,
                state.nMoves,
                state.nGroupsCreated,
                state.nGroupsRemoved,
                Math.round(state.timeSpent),
                state.completed ? 1 : 0,
                state.notes.trim(),
                state.lastSaved
            ]);
        });
    });

    return header.join(',') + '\n' + rows.map(row => row.map(value => {
        const s = String(value);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""').replace(/\n/g, ' ')}"`;
        }
        return s;
    }).join(',')).join('\n');
}

function downloadResults() {
    // bank time on the current target without closing it
    if (currentStart !== null) {
        annotations[itemKey(unit.items[currentIndex])].timeSpent += (Date.now() - currentStart) / 1000;
        currentStart = Date.now();
    }

    const csv = getResultsCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${coder}_unit${unit.listNum}_results.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);

    unsavedChanges = false;
    restoreNote = '';
    lastDownload = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    autosave();
    renderSidebar();
}

// ─── Run ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('start-btn').addEventListener('click', startAnnotating);
    document.getElementById('download-btn').addEventListener('click', downloadResults);
    document.getElementById('prev-btn').addEventListener('click', () => openTarget(currentIndex - 1));
    document.getElementById('next-btn').addEventListener('click', () => openTarget(currentIndex + 1));

    // warn before closing the tab with work that hasn't been downloaded
    window.addEventListener('beforeunload', (e) => {
        if (unsavedChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
});
