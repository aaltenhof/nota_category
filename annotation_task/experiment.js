function getUrlParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

const sonaId = getUrlParam('sona_id');
const workerId = getUrlParam('workerId');

// ?list=N loads trial_lists/fileN.csv directly instead of asking DataPipe (for piloting / RAs)
const listOverride = getUrlParam('list');

let participant_id;
if (sonaId) {
    participant_id = sonaId;
    console.log('Using SONA ID:', participant_id);
} else if (workerId) {
    participant_id = workerId;
    console.log('Using MTurk Worker ID:', participant_id);
} else {
    participant_id = `participant${Math.floor(Math.random() * 999) + 1}`;
    console.log('No worker ID found, using random ID:', participant_id);
}

const jsPsych = initJsPsych({
    show_progress_bar: true,
    on_finish: function() {}
});

let timeline = [];
let globalTrialNumber = 0;
let assignedList = null;

const MAX_RESPONSES = 12;   // must match MAX_RESPONSES in make_trial_lists.py

// ─── Helpers ──────────────────────────────────────────────────────────────────
function escapeHTML(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Same frame logic as the original nota task: before + target + clarification + after + blank
function buildFrameHTML(item) {
    const before = item.sentence_frame_before || '';
    const after = item.sentence_frame_after || '';
    const clarification = item.clarification ? ` ${item.clarification}` : '';
    return `${before}<span class="word-highlight">${escapeHTML(item.target_word)}</span>${clarification}${after}<span class="frame-blank">______</span>`;
}

// Pull response1..responseN / count1..countN out of a trial-list row
function getResponses(item) {
    const responses = [];
    for (let i = 1; i <= MAX_RESPONSES; i++) {
        const r = item[`response${i}`];
        if (r === undefined || r === null || String(r).trim() === '') continue;
        responses.push({
            response: String(r),
            count:    parseInt(item[`count${i}`], 10),
            rank:     i
        });
    }
    return responses;
}

function chipHTML(r, idx) {
    return `
        <div class="chip" data-idx="${idx}" title="${r.count} people gave this response">
            <span class="chip-word">${escapeHTML(r.response)}</span>
            <span class="chip-count">${r.count}</span>
        </div>`;
}

// ─── Consent ──────────────────────────────────────────────────────────────────
const consent = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
        <div class="consent-text">
            <h3>Consent to Participate in Research</h3>

            <p>The task you are about to do is sponsored by University of Wisconsin-Madison. It is part of a protocol titled "What are we learning from language?"</p>

            <p>The task you are asked to do involves making simple responses to words and sentences. For example, you may be asked to rate a pair of words on their similarity or to indicate how true you think a given sentence is. More detailed instructions for this specific task will be provided on the next screen.</p>

            <p>This task has no direct benefits. We do not anticipate any psychosocial risks. There is a risk of a confidentiality breach. Participants may become fatigued or frustrated due to the length of the study.</p>

            <p>The responses you submit as part of this task will be stored on a secure server and accessible only to researchers who have been approved by UW-Madison. Processed data with all identifiers removed could be used for future research studies or distributed to another investigator for future research studies without additional informed consent from the subject or the legally authorized representative.</p>

            <p>You are free to decline to participate, to end participation at any time for any reason, or to refuse to answer any individual question without penalty or loss of earned compensation. We will not retain data from partial responses. If you would like to withdraw your data after participating, you may send an email lupyan@wisc.edu or complete this form which will allow you to make a request anonymously.</p>

            <p>If you have any questions or concerns about this task please contact the principal investigator: Prof. Gary Lupyan at lupyan@wisc.edu.</p>

            <p>If you are not satisfied with response of the research team, have more questions, or want to talk with someone about your rights as a research participant, you should contact University of Wisconsin's Education Research and Social &amp; Behavioral Science IRB Office at 608-263-2320.</p>

            <p><strong>By clicking the box below, I consent to participate in this task and affirm that I am at least 18 years old.</strong></p>
        </div>
    `,
    choices: ['I Agree', 'I Do Not Agree'],
    data: { trial_type: 'consent' },
    on_finish: function(data) {
        if (data.response == 1) {
            jsPsych.endExperiment('Thank you for your time. The experiment has been ended.');
        }
    }
};

// ─── Instructions ─────────────────────────────────────────────────────────────
// Worked example uses "lemon", which is not a target word. Counts are illustrative only.
const exampleGroups = [
    { label: 'other citrus fruits', responses: [{ response: 'lime', count: 52 }, { response: 'orange', count: 38 }, { response: 'grapefruit', count: 11 }] },
    { label: 'other fruits',        responses: [{ response: 'apple', count: 20 }, { response: 'banana', count: 12 }] },
    { label: 'different taste',     responses: [{ response: 'sweet', count: 9 }, { response: 'sugar', count: 4 }] }
];

function buildExampleHTML() {
    const groups = exampleGroups.map(g => `
        <div class="drop-zone group-box" style="min-height:0;">
            <div class="group-prompt">How do these differ from <strong>lemon</strong>?</div>
            <div class="group-label" style="margin-bottom:8px; background:#fff;">${g.label}</div>
            <div class="chip-holder">${g.responses.map((r, i) => chipHTML(r, i)).join('')}</div>
        </div>`).join('');

    return `
        <div style="border:1px solid #ddd; border-radius:8px; padding:16px; margin:20px 0; text-align:center;">
            <div class="frame">A <span class="word-highlight">lemon</span> is not a <span class="frame-blank">______</span></div>
            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; margin-top:14px; text-align:left;">
                ${groups}
            </div>
        </div>`;
}

const instructions = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: () => `
        <div style="max-width: 850px; margin: 0 auto; text-align: center; font-family: sans-serif;">
            <h2>Instructions</h2>
            <p>In an earlier study, people completed sentences like <strong>"A lemon is not a ______."</strong></p>

            <p>On each screen of this study, you will see one of those sentences along with the <strong>most common answers</strong> people gave.
            The number next to each answer is <strong>how many people</strong> gave that answer.</p>

            <p>Your job is to <strong>sort the answers into groups</strong> based on <strong>how they differ</strong> from the word in the sentence,
            and then <strong>give each group a name</strong> that describes that difference in your own words.</p>

            <p>For example, <em>lime</em>, <em>orange</em>, and <em>grapefruit</em> all differ from <em>lemon</em> in the same way: they are other citrus fruits.
            <em>Sweet</em> and <em>sugar</em> differ from <em>lemon</em> in a different way: they are about taste.</p>

            ${buildExampleHTML()}

            <div style="text-align:left; max-width:700px; margin:0 auto;">
                <ul style="line-height:1.7;">
                    <li>Drag an answer onto <strong>+ New group</strong> to start a group, then type a name for it.</li>
                    <li>Make as many or as few groups as you need. A group can have just one answer.</li>
                    <li>If an answer doesn't make sense, or you can't tell how it relates to the word, drag it to <strong>Doesn't fit</strong>.</li>
                    <li>You must place <strong>every answer</strong> and name <strong>every group</strong> before you can continue.</li>
                </ul>
            </div>

            <p>You will do a practice trial first to get a better sense of how the task works.</p>

            <p><strong>Press any key when you're ready to begin.</strong></p>
        </div>
    `,
    data: { trial_type: 'instructions' }
};

// ─── Practice ─────────────────────────────────────────────────────────────────
// "guitar" is not a target word. Counts are illustrative only.
const practiceItem = {
    target_word: 'guitar', target_pos: 'noun', target_cat: 'practice',
    sentence_frame_before: 'A ', sentence_frame_after: ' is not a ', clarification: '',
    response1: 'piano',   count1: 48,
    response2: 'violin',  count2: 31,
    response3: 'drum',    count3: 24,
    response4: 'ukulele', count4: 14,
    response5: 'flute',   count5: 9,
    response6: 'song',    count6: 5,
    response7: 'quiet',   count7: 4
};

// ─── Begin Main Study ─────────────────────────────────────────────────────────
const beginMainStudy = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
        <div style="max-width: 700px; margin: 0 auto; text-align: center; font-family: sans-serif;">
            <h2>Ready to Begin</h2>
            <p style="font-size: 16px; line-height: 1.6;">
                Great job! You've completed the practice trial.
            </p>
            <p style="font-size: 16px; line-height: 1.6;">
                You're now ready to begin the main study. The task will be exactly the same:
                sort the answers into groups by how they differ from the word, and give each group a name.
            </p>
            <p style="font-size: 16px; line-height: 1.6; margin-top: 20px;">
                <strong>Click Continue when you're ready to start.</strong>
            </p>
        </div>
    `,
    choices: ['Continue'],
    data: { trial_type: 'begin_main_study' }
};

// ─── Sorting HTML builder ─────────────────────────────────────────────────────
// displayResponses is already shuffled; chip data-idx indexes into it
function buildSortHTML(item, displayResponses) {
    const chips = displayResponses.map((r, i) => chipHTML(r, i)).join('');

    return `
        <div id="sort-task">
            <div class="frame">${buildFrameHTML(item)}</div>
            <p class="task-hint">
                Sort the answers into groups by <strong>how they differ from <span class="word-highlight">${escapeHTML(item.target_word)}</span></strong>,
                and give each group a name. The number on each answer is how many people gave it.
            </p>

            <div id="sort-columns">
                <div id="left-column">
                    <div id="response-bank" class="drop-zone" data-zone="bank">
                        <div class="zone-title">Answers to sort</div>
                        <div class="chip-holder">${chips}</div>
                    </div>
                    <div id="nofit-zone" class="drop-zone" data-zone="nofit">
                        <div class="zone-title">Doesn't fit <span class="zone-subtitle">(unclear or doesn't make sense)</span></div>
                        <div class="chip-holder"></div>
                    </div>
                </div>

                <div id="group-area">
                    <div id="new-group-zone" class="drop-zone new-group-zone" data-zone="new">
                        + New group
                        <small>drag an answer here, or click</small>
                    </div>
                </div>
            </div>

            <p id="sort-status"></p>
        </div>
    `;
}

function buildGroupHTML(groupId, target) {
    return `
        <div class="drop-zone group-box" data-zone="${groupId}">
            <div class="group-header">
                <div style="flex:1;">
                    <div class="group-prompt">How do these differ from <strong>${escapeHTML(target)}</strong>?</div>
                    <input class="group-label" type="text" maxlength="100" placeholder="Name this group" autocomplete="off">
                </div>
                <button class="group-remove" title="Remove group">&times;</button>
            </div>
            <div class="chip-holder"></div>
        </div>`;
}

// Store sort state globally so it persists after DOM is cleared
let sortState = {};

// ─── Sort logic (called from on_load) ────────────────────────────────────────
function setupSortLogic(item, displayResponses) {
    const task = document.getElementById('sort-task');
    if (!task) return;

    const groupArea   = document.getElementById('group-area');
    const newZone     = document.getElementById('new-group-zone');
    const continueBtn = document.getElementById('jspsych-continue-btn');

    // Reset state for this trial
    sortState = {
        chipZone:    displayResponses.map(() => 'bank'),   // chip idx -> 'bank' | 'nofit' | 'g1', 'g2', ...
        groupLabels: {},                                    // group id -> label text
        groupOrder:  [],                                    // group ids in creation order
        nextGroup:   1,
        nMoves:      0,
        nGroupsCreated: 0,
        nGroupsRemoved: 0
    };

    if (continueBtn) continueBtn.disabled = true;

    // ── Groups ──────────────────────────────────────────────────────────────
    function createGroup() {
        const groupId = `g${sortState.nextGroup++}`;
        newZone.insertAdjacentHTML('beforebegin', buildGroupHTML(groupId, item.target_word));
        const box = groupArea.querySelector(`[data-zone="${groupId}"]`);

        sortState.groupLabels[groupId] = '';
        sortState.groupOrder.push(groupId);
        sortState.nGroupsCreated++;

        box.querySelector('.group-label').addEventListener('input', (e) => {
            sortState.groupLabels[groupId] = e.target.value;
            updateStatus();
        });

        // removing a group sends its answers back to the bank
        box.querySelector('.group-remove').addEventListener('click', () => {
            const bankHolder = document.querySelector('#response-bank .chip-holder');
            box.querySelectorAll('.chip').forEach(chip => {
                bankHolder.appendChild(chip);
                sortState.chipZone[chip.dataset.idx] = 'bank';
            });
            box.remove();
            delete sortState.groupLabels[groupId];
            sortState.groupOrder = sortState.groupOrder.filter(g => g !== groupId);
            sortState.nGroupsRemoved++;
            updateStatus();
        });

        return box;
    }

    newZone.addEventListener('click', () => {
        const box = createGroup();
        box.querySelector('.group-label').focus();
        updateStatus();
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

        if (sortState.chipZone[chip.dataset.idx] === zoneId) return;

        zone.querySelector('.chip-holder').appendChild(chip);
        sortState.chipZone[chip.dataset.idx] = zoneId;
        sortState.nMoves++;

        if (focusLabel) zone.querySelector('.group-label').focus();
        updateStatus();
    }

    // ── Validation / status line ────────────────────────────────────────────
    function updateStatus() {
        const nUnsorted = sortState.chipZone.filter(z => z === 'bank').length;

        let nUnnamed = 0;
        groupArea.querySelectorAll('.group-box').forEach(box => {
            const groupId = box.dataset.zone;
            const hasChips = sortState.chipZone.includes(groupId);
            const unnamed  = hasChips && sortState.groupLabels[groupId].trim() === '';
            box.classList.toggle('needs-label', unnamed);
            if (unnamed) nUnnamed++;
        });

        const status = document.getElementById('sort-status');
        if (nUnsorted === 0 && nUnnamed === 0) {
            status.innerHTML = '<span style="color:#27ae60;">All answers sorted. Click Continue when you\'re happy with your groups.</span>';
        } else {
            const parts = [];
            if (nUnsorted > 0) parts.push(`Answers left to sort: ${nUnsorted}`);
            if (nUnnamed > 0)  parts.push(`Groups that still need a name: ${nUnnamed}`);
            status.textContent = parts.join(' · ');
        }

        if (continueBtn) continueBtn.disabled = !(nUnsorted === 0 && nUnnamed === 0);
    }

    // ── Dragging ────────────────────────────────────────────────────────────
    // The chip stays in place (faded) while a fixed-position copy follows the pointer
    function zoneAt(x, y) {
        const el = document.elementFromPoint(x, y);
        return el ? el.closest('.drop-zone') : null;
    }

    task.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('pointerdown', (e) => {
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

            let overZone = null;
            let lastY    = e.clientY;
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
                if (z) dropChip(chip, z);
            }

            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
            document.addEventListener('pointercancel', onUp);
        });
    });

    updateStatus();
}

// ─── Result extraction (called from on_finish) ───────────────────────────────
// Returns one entry per response with its final group. Groups that ended up empty are dropped and the
// rest are renumbered 1..k in the order they were created.
function getSortResult(displayResponses) {
    const usedGroups = sortState.groupOrder.filter(g => sortState.chipZone.includes(g));
    const groupNum   = {};
    usedGroups.forEach((g, i) => { groupNum[g] = i + 1; });

    const groupSize = {};
    sortState.chipZone.forEach(z => { groupSize[z] = (groupSize[z] || 0) + 1; });

    return displayResponses.map((r, i) => {
        const zone = sortState.chipZone[i];
        const inGroup = zone in groupNum;
        return {
            response:      r.response,
            count:         r.count,
            rank:          r.rank,
            display_order: i + 1,
            doesnt_fit:    zone === 'nofit' ? 1 : 0,
            group_num:     inGroup ? groupNum[zone] : '',
            group_label:   inGroup ? sortState.groupLabels[zone].trim() : '',
            group_size:    inGroup ? groupSize[zone] : ''
        };
    });
}

// ─── Trial factory ────────────────────────────────────────────────────────────
function createSortTrial(item, trialNum, isPractice) {
    // Randomize the order answers appear in the bank
    const displayResponses = jsPsych.randomization.shuffle(getResponses(item));

    return {
        type: jsPsychHtmlButtonResponse,
        stimulus: () => buildSortHTML(item, displayResponses),
        choices: ['Continue'],
        button_html: '<button class="jspsych-btn" id="jspsych-continue-btn" disabled>%choice%</button>',
        on_load: function() {
            if (isPractice) {
                // Request fullscreen
                const elem = document.documentElement;
                if (elem.requestFullscreen) {
                    elem.requestFullscreen().catch(err => {
                        console.log('Fullscreen request failed:', err);
                    });
                }
            }
            setupSortLogic(item, displayResponses);
        },
        data: {
            custom_trial_type: 'sort_label',
            is_practice:       isPractice ? 1 : 0,
            trial_number:      trialNum,
            participant_id:    participant_id,
            target_word:       item.target_word,
            target_pos:        item.target_pos,
            target_cat:        item.target_cat,
            n_responses:       displayResponses.length,
            viewport_w: window.innerWidth  || null,
            viewport_h: window.innerHeight || null
        },
        on_finish: function(data) {
            const result = getSortResult(displayResponses);
            data.list_num         = assignedList;
            data.sort_result      = result;
            data.n_groups         = new Set(result.filter(r => r.group_num !== '').map(r => r.group_num)).size;
            data.n_doesnt_fit     = result.filter(r => r.doesnt_fit === 1).length;
            data.n_moves          = sortState.nMoves;
            data.n_groups_created = sortState.nGroupsCreated;
            data.n_groups_removed = sortState.nGroupsRemoved;
        }
    };
}

function createTrials(trialsData) {
    const experimentTrials = [];

    trialsData.forEach((item) => {
        globalTrialNumber++;
        experimentTrials.push(createSortTrial(item, globalTrialNumber, false));
    });

    return experimentTrials;
}

const practiceTrial = createSortTrial(practiceItem, 0, true);

// ─── Data export ──────────────────────────────────────────────────────────────
// Long format: one row per response per trial
function getFilteredData() {
    const sortTrials = jsPsych.data.get()
        .filter({ custom_trial_type: 'sort_label' })
        .values();

    const header = [
        'subjCode', 'list_num', 'trial_num', 'is_practice',
        'target_word', 'target_pos', 'target_cat',
        'response', 'response_count', 'response_rank', 'display_order',
        'doesnt_fit', 'group_num', 'group_label', 'group_size',
        'n_responses', 'n_groups', 'n_doesnt_fit', 'n_moves', 'n_groups_created', 'n_groups_removed',
        'rt', 'viewport_w', 'viewport_h'
    ].join(',');

    if (sortTrials.length === 0) {
        console.warn('No sort trials found for saving!');
        return header + '\n';
    }

    try {
        const rows = [];
        sortTrials.forEach(trial => {
            (trial.sort_result || []).forEach(r => {
                const row = [
                    trial.participant_id      || participant_id,
                    trial.list_num            ?? '',
                    trial.trial_number        ?? 'NA',
                    trial.is_practice         ?? '',
                    trial.target_word         || '',
                    trial.target_pos          || '',
                    trial.target_cat          || '',
                    r.response,
                    r.count,
                    r.rank,
                    r.display_order,
                    r.doesnt_fit,
                    r.group_num,
                    r.group_label,
                    r.group_size,
                    trial.n_responses         ?? '',
                    trial.n_groups            ?? '',
                    trial.n_doesnt_fit        ?? '',
                    trial.n_moves             ?? '',
                    trial.n_groups_created    ?? '',
                    trial.n_groups_removed    ?? '',
                    Math.round(trial.rt       || 0),
                    trial.viewport_w          ?? '',
                    trial.viewport_h          ?? ''
                ];

                rows.push(row.map(value => {
                    const s = String(value);
                    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                        return `"${s.replace(/"/g, '""').replace(/\n/g, ' ')}"`;
                    }
                    return s;
                }).join(','));
            });
        });

        return header + '\n' + rows.join('\n');
    } catch (error) {
        console.error('Error in getFilteredData:', error);
        return 'error\n';
    }
}

// ─── Data save ────────────────────────────────────────────────────────────────
var save_data = {
    type: jsPsychPipe,
    action: 'save',
    experiment_id: 'REPLACE_WITH_DATAPIPE_ID',   // TODO: DataPipe experiment ID
    filename: `${participant_id}.csv`,
    data_string: getFilteredData,
    on_finish: function(data) {
        if (data.success) {
            console.log('Data saved successfully!');
        } else {
            console.error('Error saving to DataPipe:', data.message);
        }
    }
};

// ─── Trial loader ─────────────────────────────────────────────────────────────
async function loadTrials(list_num) {
    try {
        const response = await fetch(`trial_lists/file${list_num}.csv`);
        console.log('Trial List:', response);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const csvText = await response.text();
        // dynamicTyping off so responses like "true" or "1" stay strings; counts are parsed in getResponses
        const results = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false
        });

        console.log(`Loaded ${results.data.length} trials`);
        return jsPsych.randomization.shuffle([...results.data]);
    } catch (error) {
        console.error('Error loading trials:', error);
        return [];
    }
}

// ─── Final screen ─────────────────────────────────────────────────────────────
var final_screen = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
        <div style="text-align:center; max-width:600px; margin:0 auto;">
            <h2>Thank you!</h2>
            <p>You have completed the experiment! You may now close this window.</p>
        </div>
    `,
    choices: [],
    data: { trial_type: 'final' }
    // on_finish: function() {
    //     setTimeout(function() {
    //         let qualtricsUrl = `https://uwmadison.co1.qualtrics.com/jfe/form/SV_XXXXXXXXXXXXXXX`;
    //         if (sonaId) qualtricsUrl += `?sona_id=${sonaId}`;
    //         window.location.href = qualtricsUrl;
    //     }, 100);
    // }
};

// ─── Run ──────────────────────────────────────────────────────────────────────
async function runExperiment() {
    try {
        console.log('Participant ID:', participant_id);

        if (listOverride) {
            assignedList = parseInt(listOverride, 10);
            console.log('Using list from URL:', assignedList);
        } else {
            const datapipe_condition = await jsPsychPipe.getCondition('REPLACE_WITH_DATAPIPE_ID');   // TODO: DataPipe experiment ID
            console.log('Assigned condition:', datapipe_condition);
            assignedList = datapipe_condition + 1;
        }

        const trialsData = await loadTrials(assignedList);
        if (trialsData.length === 0) throw new Error('No trials loaded');

        const sortTrials = createTrials(trialsData);
        console.log(`Created ${sortTrials.length} sort-and-label trials`);

        timeline = [
            consent,
            instructions,
            practiceTrial,
            beginMainStudy,
            ...sortTrials,
            save_data,
            final_screen
        ];

        jsPsych.run(timeline);

    } catch (error) {
        console.error('Error running experiment:', error);
        document.body.innerHTML = `
            <div style="max-width:800px; margin:50px auto; padding:20px; background:#f8f8f8;
                        border-radius:5px; text-align:center;">
                <h2>Error Starting Experiment</h2>
                <p>There was a problem starting the experiment. Please try refreshing the page.</p>
                <p>If the problem persists, please contact the researcher.</p>
                <p>Technical details: ${error.message}</p>
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', runExperiment);
