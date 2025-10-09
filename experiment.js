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
    on_finish: function() {
        console.log("Experiment finished!");
    }
});

let completedLists = 0;
let timeline = [];
let shouldContinueToList2 = false;
let shouldContinueToList3 = false;
let globalTrialNumber = 0;

let baseListTrials = [];
let list1Trials = [];
let list2Trials = [];
let list3Trials = [];

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
        if(data.response == 1) { // If 'I Do Not Agree'
            jsPsych.endExperiment('Thank you for your time. The experiment has been ended.');
        }
    }
};

let ratingInstructions = null;
let ratingTrials = [];

let currentRatingIndex = 0;
let baseResponsesForRating = [];

const setup_rating = {
    type: jsPsychCallFunction,
    func: function(done) {
        console.log("===== SETTING UP RATING TRIALS =====");
        
        const baseResponses = jsPsych.data.get()
            .filter({ custom_trial_type: 'word_completion_single', list_type: 'base' })
            .values();
        
        console.log(`Found ${baseResponses.length} base responses for rating.`);
        
        baseResponsesForRating = jsPsych.randomization.shuffle([...baseResponses]);
        currentRatingIndex = 0;
        
        done();
    }
};

const rating_instructions = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `
        <div style="max-width: 800px; margin: 0 auto; text-align: center;">
            <p>Now you will be asked to rate some of your responses to the sentences you just filled in.</p>
            <p>You will see some sentences and the response that you gave for each.</p>
            <p>Your task is to rate, on a scale from 0 to 100, how likely you think another person would be to generate the exact same response as you did.</p>
            <p>0 = Extremely Unlikely<br>100 = Extremely Likely</p>
            <p><strong>Press any key when you're ready to begin.</strong></p>
        </div>
    `,
    data: { trial_type: 'ratings_instructions' },
    conditional_function: function() {
        return baseResponsesForRating.length > 0;
    }
};

const single_rating_trial = {
    type: jsPsychHtmlSliderResponse,
    stimulus: function() {
        const response = baseResponsesForRating[currentRatingIndex];
        return `
            <div style="text-align: center; max-width: 800px; margin: 0 auto;">
                <div class="trial-stimulus" style="font-size: 24px; margin: 30px 0;">
                    "A <span style="font-weight: bold; color: #2563eb;">${response.word}</span> is not a
                    <span style="font-weight: bold; color: #e74c3c;">${response.response_word}</span>"
                </div>
                <p>How likely do you think another person would be to generate the exact same response?</p>
            </div>
        `;
    },
    labels: ['0 (Extremely Unlikely)', '50', '100 (Extremely Likely)'],
    min: 0,
    max: 100,
    step: 1,
    slider_start: 50,
    require_movement: true,
    button_label: 'Continue',
    data: function() {
        const response = baseResponsesForRating[currentRatingIndex];
        return {
            custom_trial_type: 'response_likelihood_rating',
            participant_id: participant_id,
            original_word: response.word,
            original_response: response.response_word,
            original_list_type: response.list_type,
            original_trial_number: response.trial_number
        };
    },
    on_finish: function() {
        currentRatingIndex++;
    }
};

const rating_loop = {
    timeline: [single_rating_trial],
    loop_function: function() {
        return currentRatingIndex < baseResponsesForRating.length;
    },
    conditional_function: function() {
        return baseResponsesForRating.length > 0;
    }
};

const rating_section = {
    timeline: [
        setup_rating,
        rating_instructions,
        rating_loop
    ]
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

function createTrials(wordsData, listType) {
    const experimentTrials = [];
    
    wordsData.forEach((item) => { 
        const word = item.word;
        
        if (!word) {
            console.warn('Trial missing word:', item);
            return;
        }

        globalTrialNumber++; 
        
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
                trial_number: globalTrialNumber, 
                word: word,
                cat: item.cat,
                pos: item.pos,
                eng_freq: item.eng_freq,
                aoa_producing: item.aoa_producing,
                list_type: listType,
            },
            on_finish: function(data) {
                data.response_word = data.response ? data.response.response : '';
                data.rt = Math.round(data.rt);
                
            }
        };

        experimentTrials.push(singleResponseTrial);
    });
    
    return experimentTrials;
}

function getFilteredData() {   
    const allTrials = jsPsych.data.get().values();
    
    const wordCompletionTrials = allTrials.filter(trial => trial.custom_trial_type === 'word_completion_single');
    const ratingTrials = allTrials.filter(trial => trial.custom_trial_type === 'response_likelihood_rating');

    // Create a map for quick lookup of ratings
    // Key: `${original_word}-${original_response}` or just `original_word` if response isn't unique enough
    // Given 'original_word' is sufficient to link to a base trial
    const ratingMap = new Map();
    ratingTrials.forEach(ratingTrial => {
        // The original trial_number is a more robust unique identifier if there are duplicate words
        const key = `${ratingTrial.original_word}-${ratingTrial.original_trial_number}`; 
        ratingMap.set(key, ratingTrial.response); // Stores the slider rating
    });

    if (wordCompletionTrials.length === 0 && ratingTrials.length === 0) {
        console.warn("No relevant trials found for saving!");
        return 'subCode,trial_num,target_word,target_cat,target_pos,target_eng_freq,aoa_producing,list_type,response_word,rt,response_likelihood_rating\n';
    }
    
    try {
        const header = 'subCode,trial_num,target_word,target_cat,target_pos,target_eng_freq,aoa_producing,list_type,response_word,rt,response_likelihood_rating';
        const rows = [];
        
        wordCompletionTrials.forEach((trial) => {
            
            // Get the rating for this specific base word trial, if applicable
            let likelihoodRating = '';
            if (trial.list_type === 'base') { // Only base words get ratings
                const key = `${trial.word}-${trial.trial_number}`;
                likelihoodRating = ratingMap.has(key) ? ratingMap.get(key) : '';
            }

            const row = [
                trial.participant_id || participant_id,
                trial.trial_number || 'NA', 
                trial.word || '',
                trial.cat || '',
                trial.pos || '',
                trial.eng_freq || '',
                trial.aoa_producing || '',
                trial.list_type || '', // Use list_type instead of list_number
                trial.response_word || '',
                Math.round(trial.rt || 0),
                likelihoodRating // New column for rating
            ];
            rows.push(row);
        });
        
        const csvRows = rows.map(row => {
            return row.map(value => {
                if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',');
        });
        
        const finalCSV = header + '\n' + csvRows.join('\n');
        return finalCSV;
    } catch (error) {
        console.error("Error in getFilteredData:", error);
        return 'subCode,trial_num,target_word,target_cat,target_pos,target_eng_freq,aoa_producing,list_type,response_word,rt,response_likelihood_rating\nerror,0,error,error,error,error,0,0,error,0,NA,0\n';
    }
}


var save_data = {
    type: jsPsychPipe,
    action: "save",
    experiment_id: "iEGcC0iYDj4r", 
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

async function loadWordsForCondition(condition) {
    try {
        const csvFiles = [
            'lists/wordlist1.csv',  // condition 0
            'lists/wordlist2.csv',  // condition 1
            'lists/wordlist3.csv',  // condition 2
            'lists/wordlist4.csv',  // condition 3
            'lists/wordlist5.csv',  // condition 4
            'lists/wordlist6.csv',  // condition 5
            'lists/wordlist7.csv'   // condition 6
        ];
        
        const actualCondition = parseInt(condition, 10);
        let csvFile;
        if (condition === 'base') {
            csvFile = 'lists/base_words.csv' 
        } else {
            csvFile = csvFiles[actualCondition] 
        }
        // console.log(`Loading CSV file: ${csvFile} for condition ${actualCondition}`);
        
        const response = await fetch(csvFile);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} for ${csvFile}`);
        }
        const csvText = await response.text();
        
        const results = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true
        });

        // console.log(`Loaded words for condition ${actualCondition}:`, results.data.length);
        let shuffledData = jsPsych.randomization.shuffle([...results.data]);
        
        return shuffledData;
    } catch (error) {
        console.error(`Error loading words for condition ${condition}:`, error);
        return [];
    }
}

const checkContinueList1 = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
        completedLists = 1; 
        const listsRemaining = 3 - completedLists;
        return `
            <div style="text-align: center; max-width: 600px; margin: 0 auto;">
                <h2>You've completed this section!</h2>
                <p>Would you like to do more words?</p>
                <p><em>The next section will take about the same amount of time as the one you just completed.</em></p>
            </div>
        `;
    },
    choices: ['Yes, I\'ll do more words!', 'No, I\'m done'],
    data: {
        trial_type: 'continue_choice',
        list_just_completed: 1
    },
    on_finish: function(data) {
        shouldContinueToList2 = (data.response === 0); 
    }
};

// conditional node for List 2 trials
const list2_conditional_node = {
    timeline: [], 
    conditional_function: function(){
        return shouldContinueToList2; 
    }
};

const checkContinueList2 = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
        completedLists = 2; 
        const listsRemaining = 3 - completedLists;
        return `
            <div style="text-align: center; max-width: 600px; margin: 0 auto;">
                <h2>You've completed this section!</h2>
                <p>Would you like to do more words?</p>
                <p><em>The next section will take about the same amount of time as the one you just completed.</em></p>
            </div>
        `;
    },
    choices: ['Yes, I\'ll do more words!', 'No, I\'m done'],
    data: {
        trial_type: 'continue_choice',
        list_just_completed: 2
    },
    conditional_function: function() {
        return shouldContinueToList2;
    },
    on_finish: function(data) {
        shouldContinueToList3 = (data.response === 0);
    }
};

const list3_conditional_node = {
    timeline: [], 
    conditional_function: function(){
        return shouldContinueToList3; 
    }
};

const list3CompleteMessage = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `
        <div style="text-align: center; max-width: 600px; margin: 0 auto;">
            <h2>You're all done! </h2>
            <p>Thank you for your participation!</p>
            <p><em>Press any key to continue to get your completion code.</em></p>
        </div>
    `,
    data: {
        trial_type: 'list3_complete'
    },
    conditional_function: function() {
        return shouldContinueToList3;
    },
    on_finish: function() {
        if (shouldContinueToList3) {
            completedLists = 3;
        }
    }
};

var final_screen = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
        const totalLists = completedLists; 
        
        return `
            <div style="text-align: center; max-width: 600px; margin: 0 auto;">
                <h2>Thank you!</h2>
                <p>You have completed the experiment! </p>
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

async function runExperiment() {
    try {
        console.log('Participant ID:', participant_id);
        
        // 1. Load words for all potential lists at the start
        const baseWordsData = await loadWordsForCondition("base")
        baseListTrials = createTrials(baseWordsData , 'base'); 

        const condition1 = await jsPsychPipe.getCondition("iEGcC0iYDj4r");
        const wordsData1 = await loadWordsForCondition(condition1);
        if (wordsData1.length === 0) {
            throw new Error(`No words loaded for condition ${condition1} (List 1)`);
        }
        list1Trials = createTrials(wordsData1, 1);
        console.log(`Created ${list1Trials.length} trials for list 1`);
        
        const condition2 = await jsPsychPipe.getCondition("iEGcC0iYDj4r");
        const wordsData2 = await loadWordsForCondition(condition2);
        if (wordsData2.length === 0) {
            throw new Error(`No words loaded for condition ${condition2} (List 2)`);
        }
        list2Trials = createTrials(wordsData2, 2);
        console.log(`Created ${list2Trials.length} trials for list 2`);
        
        const condition3 = await jsPsychPipe.getCondition("iEGcC0iYDj4r");
        const wordsData3 = await loadWordsForCondition(condition3);
        if (wordsData3.length === 0) {
            throw new Error(`No words loaded for condition ${condition3} (List 3)`);
        }
        list3Trials = createTrials(wordsData3, 3);
        console.log(`Created ${list3Trials.length} trials for list 3`);
        
        timeline = [
            consent,
            instructions,
            ...baseListTrials, 
            ...list1Trials,
            checkContinueList1,
            {
                timeline: [
                    ...list2Trials,
                    checkContinueList2,
                    {
                        timeline: [
                            ...list3Trials,
                            list3CompleteMessage
                        ],
                        conditional_function: function() {
                            return shouldContinueToList3;
                        }
                    }
                ],
                conditional_function: function() {
                    return shouldContinueToList2;
                }
            },
            rating_section,
            save_data,
            final_screen
        ];
        
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