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

// Create a check continue screen
function createCheckContinue() {
    return {
        type: jsPsychHtmlButtonResponse,
        stimulus: function() {
            const listsRemaining = 3 - completedLists;
            return `
                <div style="text-align: center; max-width: 600px; margin: 0 auto;">
                    <h2>List ${completedLists} Complete!</h2>
                    <p>You have completed ${completedLists} out of 3 possible word lists.</p>
                    ${completedLists < 3 ? 
                        `<p>Would you like to do another list? You can do up to ${listsRemaining} more.</p>
                        <p><em>Each list takes about the same amount of time as the one you just completed.</em></p>` :
                        `<p>You have completed all 3 lists!</p>`
                    }
                </div>
            `;
        },
        choices: function() {
            return completedLists < 3 ? ['Yes, do another list', 'No, I\'m done'] : ['Continue'];
        },
        data: {
            trial_type: 'continue_choice',
            list_just_completed: completedLists
        }
    };
}

// Load next list using call-function
const loadNextList = {
    type: jsPsychCallFunction,
    async: true,
    func: async function(done) {
        try {
            const lastTrial = jsPsych.data.getLastTrialData().values()[0];
            
            // Check if they want to continue (response = 0) and haven't reached max
            if (lastTrial.response === 0 && completedLists < 3) {
                console.log(`Loading list ${completedLists + 1}...`);
                
                // Get next condition from DataPipe
                const nextCondition = await jsPsychPipe.getCondition("iEGcC0iYDj4r");
                console.log(`List ${completedLists + 1}: Assigned condition:`, nextCondition);
                
                const wordsData = await loadWordsForCondition(nextCondition);
                
                if (wordsData.length === 0) {
                    throw new Error(`No words loaded for condition ${nextCondition}`);
                }
                
                // Create trials for the next list
                const nextListTrials = createTrials(wordsData, completedLists + 1);
                
                // Build continuation timeline
                let continuationTimeline = [];
                
                // Add the trials
                continuationTimeline = continuationTimeline.concat(nextListTrials);
                
                // Increment completed lists AFTER creating trials but BEFORE check screen
                completedLists++;
                
                // Add another check continue screen if not at max
                if (completedLists < 3) {
                    continuationTimeline.push(createCheckContinue());
                    continuationTimeline.push(loadNextList); // Recursive call for next list
                } else {
                    // Reached 3 lists, add final check screen then save
                    continuationTimeline.push(createCheckContinue());
                    continuationTimeline.push(save_data);
                    continuationTimeline.push(final_screen);
                }
                
                // Add all trials to timeline
                continuationTimeline.forEach(trial => {
                    jsPsych.addNodeToEndOfTimeline(trial);
                });
                
            } else {
                // They're done or reached max - save and end
                jsPsych.addNodeToEndOfTimeline(save_data);
                jsPsych.addNodeToEndOfTimeline(final_screen);
            }
            
            done();
        } catch (error) {
            console.error('Error loading next list:', error);
            // On error, save and end
            jsPsych.addNodeToEndOfTimeline(save_data);
            jsPsych.addNodeToEndOfTimeline(final_screen);
            done();
        }
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
        total_lists_completed: completedLists
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
        
        // Get condition from DataPipe for first list
        const condition = await jsPsychPipe.getCondition("iEGcC0iYDj4r");
        console.log('List 1: Assigned condition:', condition);
        
        const wordsData = await loadWordsForCondition(condition);
        console.log('Loaded words for list 1:', wordsData.length);
        
        if (wordsData.length === 0) {
            throw new Error(`No words loaded for condition ${condition}`);
        }
        
        const firstListTrials = createTrials(wordsData, 1);
        
        // Mark first list as completed after trials are created
        completedLists = 1;
        
        // Build initial timeline
        timeline = [
            consent,
            instructions,
            ...firstListTrials,
            createCheckContinue(),  // Check if they want to continue after list 1
            loadNextList  // This will handle loading lists 2 and 3 if needed
        ];
        
        console.log('Initial timeline created with', timeline.length, 'items');
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