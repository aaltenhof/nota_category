// generate random participant 
let participant_id = `participant${Math.floor(Math.random() * 999) + 1}`;

// function to generate a random string for the completion code 
function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

const completion_code = generateRandomString(3) + 'zvz' + generateRandomString(3);

const filename = `${participant_id}.csv`;

const jsPsych = initJsPsych({
    show_progress_bar: false,
});

let completedLists = 0;
let globalTrialNumber = 0;

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
            <p>If you are not satisfied with response of the research team, have more questions, or want to talk with someone about your rights as a research participant, you should contact University of Wisconsin's Education Research and Social & Behavioral Science IRB Office at 608-263-2320.</p>
            <p><strong>By clicking the box below, I consent to participate in this task and affirm that I am at least 18 years old.</strong></p>
        </div>
    `,
    choices: ['I Agree', 'I Do Not Agree'],
    data: { trial_type: 'consent' },
    on_finish: function(data) {
        if(data.response == 1) {
            jsPsych.endExperiment('Thank you for your time. The experiment has been ended.');
        }
    }
};

const instructions = {
    type: jsPsychHtmlKeyboardResponse,  
    stimulus: `
        <div style="max-width: 800px; margin: 0 auto; text-align: center;">
            <h2>Instructions</h2>
            <p>In this experiment, you will see sentences like:</p>
            <p style="font-size: 20px; margin: 20px 0; padding: 15px; background-color: #f0f0f0; border-radius: 5px;">
                "A <span style="font-weight: bold; color: #2563eb;">banana</span> is not a ______"
            </p>
            <p>Your task is to complete the sentence by filling in the blank with a word or phrase that makes sense.</p>
            <p>After typing your response, press Enter to continue to the next word.</p>
            <p>There are no right or wrong answers - we're interested in what comes to mind for you.</p>
            <p><strong>Press any key when you're ready to begin.</strong></p>
        </div>
    `,
    data: { trial_type: 'instructions' }
};

function createTrials(wordsData, listNumber) {
    const experimentTrials = [];
    wordsData.forEach((item, index) => {
        const word = item.word;
        if (!word) return;
        globalTrialNumber++; 
        const singleResponseTrial = {
            type: jsPsychSurveyText,
            questions: [{
                prompt: function() {
                    const before = item.sentence_frame_before || '';
                    const after = item.sentence_frame_after || '';
                    const clarification = item.clarification ? ` ${item.clarification}` : '';
                    return `
                        <div style="text-align: center; max-width: 800px; margin: 0 auto;">
                            <div class="trial-stimulus" style="font-size: 24px; margin: 30px 0;">
                                ${before}<span class="word-highlight">${word}</span>${clarification}${after}
                            </div>
                        </div>
                    `;
                },
                placeholder: 'Type your answer here...',
                required: true,
                name: 'response'
            }],
            button_label: 'Continue',
            data: {
                custom_trial_type: 'word_completion_single',
                participant_id: participant_id,
                trial_number: globalTrialNumber,
                word: word,
                cat: item.cat,
                pos: item.pos,
                eng_freq: item.eng_freq,
                aoa_producing: item.aoa_producing,
                list_type: item.list_type,
                list_number: listNumber
            },
            on_finish: function(data) {
                data.response_word = data.response.response;
                data.rt = Math.round(data.rt);
            }
        };
        experimentTrials.push(singleResponseTrial);
    });
    return experimentTrials;
}

function getFilteredData() {   
    const allTrials = jsPsych.data.get().values();
    const wordTrials = allTrials.filter(trial => trial.custom_trial_type === 'word_completion_single');
    if (wordTrials.length === 0) {
        return 'subCode,trial_num,target_word,target_cat,target_pos,target_eng_freq,aoa_producing,list_type,response_word,rt,list_number\n';
    }
    const header = 'subCode,trial_num,target_word,target_cat,target_pos,target_eng_freq,aoa_producing,list_type,response_word,rt,list_number';
    const rows = wordTrials.map((trial, trialIndex) => [
        trial.participant_id || participant_id,
        trial.trial_number || trialIndex + 1,
        trial.word || '',
        trial.cat || '',
        trial.pos || '',
        trial.eng_freq || '',
        trial.aoa_producing || '',
        trial.list_type || '',
        trial.response_word || '',
        Math.round(trial.rt || 0),
        trial.list_number || 1
    ]);
    const csvRows = rows.map(row => row.map(value => {
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    }).join(','));
    return header + '\n' + csvRows.join('\n');
}

const save_data = {
    type: jsPsychPipe,
    action: "save",
    experiment_id: "iEGcC0iYDj4r",
    filename: `${participant_id}.csv`,
    data_string: getFilteredData,
};

async function loadWordsForCondition(condition) {
    try {
        const csvFiles = [
            'wordlist1.csv','wordlist2.csv','wordlist3.csv','wordlist4.csv','wordlist5.csv','wordlist6.csv','wordlist7.csv'
        ];
        const csvFile = csvFiles[condition] || 'wordlist1.csv';
        const response = await fetch(csvFile);
        const csvText = await response.text();
        const results = Papa.parse(csvText, { header: true, skipEmptyLines: true, dynamicTyping: true });
        return jsPsych.randomization.shuffle([...results.data]);
    } catch (error) {
        console.error(`Error loading words for condition ${condition}:`, error);
        return [];
    }
}

const final_screen = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
        const totalLists = completedLists || 1;
        return `
            <div style="text-align: center; max-width: 600px; margin: 0 auto;">
                <h2>Thank you!</h2>
                <p>You have completed the experiment with ${totalLists} word list${totalLists > 1 ? 's' : ''}.</p>
                <p>Your completion code is: <strong style="font-size: 18px; color: #2563eb;">${completion_code}</strong></p>
                <p><em>Click the button below to return to SONA.</em></p>
            </div>
        `;
    },
    choices: ['Finish'],
    data: {
        trial_type: 'final',
        completion_code: completion_code,
        total_lists_completed: function() { return completedLists; }
    },
    on_finish: function() {
        setTimeout(function() {
            window.location.href = `https://uwmadison.sona-systems.com/default.aspx?logout=Y`;
        }, 100);
    }
};

async function addList(listNumber) {
  const condition = await jsPsychPipe.getCondition("iEGcC0iYDj4r");
  const wordsData = await loadWordsForCondition(condition);
  if (wordsData.length === 0) throw new Error(`No words loaded for condition ${condition}`);

  const trials = createTrials(wordsData, listNumber);
  jsPsych.addNodeToEndOfTimeline({ timeline: trials });

  completedLists++;

  if (completedLists < 3) {
    jsPsych.addNodeToEndOfTimeline({
      timeline: [{
        type: jsPsychHtmlButtonResponse,
        stimulus: `
          <div style="text-align: center; max-width: 600px;">
            <h2>List ${completedLists} Complete!</h2>
            <p>You have finished ${completedLists} list${completedLists > 1 ? 's' : ''}.</p>
            <p>Would you like to do another?</p>
          </div>`,
        choices: ['Yes', 'No'],
        on_finish: function(data) {
          if (data.response === 0) {
            addList(completedLists + 1); // recursively add the next list
          } else {
            jsPsych.addNodeToEndOfTimeline({ timeline: [save_data, final_screen] });
          }
        }
      }]
    });
  } else {
    jsPsych.addNodeToEndOfTimeline({ timeline: [save_data, final_screen] });
  }
}

async function runExperiment() {
  try {
    jsPsych.run([consent, instructions]);
    addList(1);  // start with the first list
  } catch (error) {
    console.error('Error running experiment:', error);
    document.body.innerHTML = `<h2>Error starting experiment</h2><p>${error.message}</p>`;
  }
}

document.addEventListener('DOMContentLoaded', runExperiment);
