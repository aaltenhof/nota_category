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

// create filename for data saving
const filename = `${participant_id}.csv`;

// Initialize jsPsych
const jsPsych = initJsPsych({
    show_progress_bar: false,
});

let completedLists = 0;
let timeline = [];
let shouldContinue = false;

// Store all list data globally
let allListsData = [];

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
    data: {
        trial_type: 'consent'
    },
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
    data: {
        trial_type: 'instructions'
    }
};

function createTrials(wordsData, listNumber) {
    const experimentTrials = [];
    
    wordsData.forEach((item, index) => {
        const word = item.word;
        
        if (!word) {
            console.warn('Trial missing word:', item);
            return;
        }
        
        const singleResponseTrial = {
            type: jsPsychSurveyText,
            questions: [
                {
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
                }
            ],
            button_label: 'Continue',
            data: {
                custom_trial_type: 'word_completion_single',
                participant_id: participant_id,
                trial_number: index + 1,
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
                
                console.log(`List ${listNumber}, Trial ${index + 1} completed:`, {
                    word: word,
                    response: data.response_word,
                    rt: data.rt
                });
            }
        };

        experimentTrials.push(singleResponseTrial);
    });
    
    return experimentTrials;
}

function getFilteredData() {   
    const allTrials = jsPsych.data.get().values();
    console.log('All trials:', allTrials.length);
    
    const wordTrials = allTrials.filter(trial => trial.custom_trial_type === 'word_completion_single');
    console.log(`Word completion trials found: ${wordTrials.length}`);
    
    // if there's no data, return empty CSV
    if (wordTrials.length === 0) {
        console.error("No word completion trials found!");
        return 'subCode,trial_num,target_word,target_cat,target_pos,target_eng_freq,aoa_producing,list_type,response_word,rt,list_number\n';
    }
    
    try {
        const header = 'subCode,trial_num,target_word,target_cat,target_pos,target_eng_freq,aoa_producing,list_type,response_word,rt,list_number';
        const rows = [];
        
        wordTrials.forEach((trial, trialIndex) => {
            console.log(`Processing trial ${trialIndex + 1}:`, trial);
            
            const row = [
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
            ];
            rows.push(row);
        });
        
        // convert to CSV format
        const csvRows = rows.map(row => {
            return row.map(value => {
                if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',');
        });
        
        const finalCSV = header + '\n' + csvRows.join('\n');
        console.log("Generated CSV data (first 500 chars):", finalCSV.substring(0, 500));
        
        return finalCSV;
    } catch (error) {
        console.error("Error in getFilteredData:", error);
        return 'subCode,trial_num,target_word,target_cat,target_pos,target_eng_freq,aoa_producing,list_type,response_word,rt,list_number\nerror,0,error,error,error,error,0,0,error,0,1\n';
    }
}

const save_data = {
    type: jsPsychPipe,
    action: "save",
    experiment_id: "iEGcC0iYDj4r",
    filename: `${participant_id}.csv`,
    data_string: getFilteredData,
    on_finish: function(data) {
        if (data.success) {
            console.log('Data saved successfully to DataPipe!');
            console.log('Total lists completed:', completedLists);
        } else {
            console.error('Error saving to DataPipe:', data.message);
        }
    }
};

async function loadWordsForCondition(condition) {
    try {
        const csvFiles = [
            'wordlist1.csv',  // condition 0
            'wordlist2.csv',  // condition 1
            'wordlist3.csv',  // condition 2
            'wordlist4.csv',  // condition 3
            'wordlist5.csv',  // condition 4
            'wordlist6.csv',  // condition 5
            'wordlist7.csv'   // condition 6
        ];
        
        const csvFile = csvFiles[condition] || 'wordlist1.csv';
        console.log(`Loading CSV file: ${csvFile} for condition ${condition}`);
        
        const response = await fetch(csvFile);
        const csvText = await response.text();
        
        const results = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true
        });

        console.log(`Loaded words for condition ${condition}:`, results.data.length);
        let shuffledData = jsPsych.randomization.shuffle([...results.data]);
        
        return shuffledData;
    } catch (error) {
        console.error(`Error loading words for condition ${condition}:`, error);
        return [];
    }
}

// Check continue for first list
const checkContinueList1 = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
        completedLists = 1; // Mark list 1 as completed
        const listsRemaining = 3 - completedLists;
        return `
            <div style="text-align: center; max-width: 600px; margin: 0 auto;">
                <h2>List 1 Complete!</h2>
                <p>You have completed 1 out of 3 possible word lists.</p>
                <p>Would you like to do another list? You can do up to ${listsRemaining} more.</p>
                <p><em>Each list takes about the same amount of time as the one you just completed.</em></p>
            </div>
        `;
    },
    choices: ['Yes, do another list', 'No, I\'m done'],
    data: {
        trial_type: 'continue_choice',
        list_just_completed: 1
    },
    on_finish: function(data) {
        shouldContinue = (data.response === 0);
        console.log('After list 1, continue?', shouldContinue);
    }
};

// Create second list timeline
const list2Timeline = {
    timeline: [],
    conditional_function: function() {
        return shouldContinue;
    },
    on_timeline_start: async function() {
        try {
            console.log('Loading list 2...');
            const condition = await jsPsychPipe.getCondition("iEGcC0iYDj4r");
            console.log('List 2: Assigned condition:', condition);
            
            const wordsData = await loadWordsForCondition(condition);
            if (wordsData.length === 0) {
                throw new Error(`No words loaded for condition ${condition}`);
            }
            
            const list2Trials = createTrials(wordsData, 2);
            
            // Add trials to this timeline
            list2Timeline.timeline = list2Trials;
        } catch (error) {
            console.error('Error loading list 2:', error);
            list2Timeline.timeline = [];
        }
    }
};

// Check continue for second list
const checkContinueList2 = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
        completedLists = 2; // Mark list 2 as completed
        const listsRemaining = 3 - completedLists;
        return `
            <div style="text-align: center; max-width: 600px; margin: 0 auto;">
                <h2>List 2 Complete!</h2>
                <p>You have completed 2 out of 3 possible word lists.</p>
                <p>Would you like to do another list? You can do up to ${listsRemaining} more.</p>
                <p><em>Each list takes about the same amount of time as the one you just completed.</em></p>
            </div>
        `;
    },
    choices: ['Yes, do another list', 'No, I\'m done'],
    data: {
        trial_type: 'continue_choice',
        list_just_completed: 2
    },
    conditional_function: function() {
        return shouldContinue; // Only show if they continued after list 1
    },
    on_finish: function(data) {
        if (data.response !== undefined) {
            shouldContinue = (data.response === 0);
            console.log('After list 2, continue?', shouldContinue);
        }
    }
};

// Create third list timeline
const list3Timeline = {
    timeline: [],
    conditional_function: function() {
        return shouldContinue && completedLists === 2;
    },
    on_timeline_start: async function() {
        try {
            console.log('Loading list 3...');
            const condition = await jsPsychPipe.getCondition("iEGcC0iYDj4r");
            console.log('List 3: Assigned condition:', condition);
            
            const wordsData = await loadWordsForCondition(condition);
            if (wordsData.length === 0) {
                throw new Error(`No words loaded for condition ${condition}`);
            }
            
            const list3Trials = createTrials(wordsData, 3);
            
            // Add trials to this timeline
            list3Timeline.timeline = list3Trials;
        } catch (error) {
            console.error('Error loading list 3:', error);
            list3Timeline.timeline = [];
        }
    },
    on_timeline_finish: function() {
        completedLists = 3; // Mark list 3 as completed
    }
};

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
        console.log('Experiment complete. Total lists:', completedLists);
        console.log('Redirecting to SONA...');
        setTimeout(function() {
            window.location.href = `https://uwmadison.sona-systems.com/default.aspx?logout=Y`;
        }, 100);
    }
};

async function runExperiment() {
    try {
        console.log('Starting experiment...');
        console.log('Participant ID:', participant_id);
        
        // Pre-load all conditions and data for all 3 lists
        console.log('Pre-loading all list data...');
        
        for (let i = 0; i < 3; i++) {
            const condition = await jsPsychPipe.getCondition("iEGcC0iYDj4r");
            console.log(`List ${i + 1}: Assigned condition:`, condition);
            
            const wordsData = await loadWordsForCondition(condition);
            if (wordsData.length === 0) {
                throw new Error(`No words loaded for condition ${condition}`);
            }
            
            allListsData.push(wordsData);
            console.log(`Loaded ${wordsData.length} words for list ${i + 1}`);
        }
        
        // Create trials for list 1
        const list1Trials = createTrials(allListsData[0], 1);
        
        // Build the main timeline with all components
        timeline = [
            consent,
            instructions
        ];
        
        // Add list 1 trials directly
        timeline = timeline.concat(list1Trials);
        
        // Add continue check after list 1
        timeline.push(checkContinueList1);
        
        // Create conditional timeline for list 2
        const list2ConditionalTimeline = {
            timeline: function() {
                if (shouldContinue) {
                    console.log('Building list 2 timeline...');
                    return createTrials(allListsData[1], 2);
                }
                return [];
            },
            conditional_function: function() {
                return shouldContinue;
            },
            on_timeline_finish: function() {
                if (shouldContinue) {
                    completedLists = 2;
                    console.log('List 2 completed');
                }
            }
        };
        timeline.push(list2ConditionalTimeline);
        
        // Add continue check after list 2
        timeline.push(checkContinueList2);
        
        // Create conditional timeline for list 3
        const list3ConditionalTimeline = {
            timeline: function() {
                if (shouldContinue && completedLists === 2) {
                    console.log('Building list 3 timeline...');
                    return createTrials(allListsData[2], 3);
                }
                return [];
            },
            conditional_function: function() {
                return shouldContinue && completedLists === 2;
            },
            on_timeline_finish: function() {
                if (shouldContinue && completedLists === 2) {
                    completedLists = 3;
                    console.log('List 3 completed');
                }
            }
        };
        timeline.push(list3ConditionalTimeline);
        
        // Always add save and final screen at the end
        timeline.push(save_data);
        timeline.push(final_screen);
        
        console.log('Complete timeline created with', timeline.length, 'components');
        console.log('Starting jsPsych...');
        
        jsPsych.run(timeline);
        
    } catch (error) {
        console.error('Error running experiment:', error);
        document.body.innerHTML = `
            <div style="max-width: 800px; margin: 50px auto; padding: 20px; background: #f8f8f8; border-radius: 5px; text-align: center;">
                <h2>Error Starting Experiment</h2>
                <p>There was a problem starting the experiment. Please try refreshing the page.</p>
                <p>If the problem persists, please contact the researcher.</p>
                <p>Technical details: ${error.message}</p>
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', runExperiment);