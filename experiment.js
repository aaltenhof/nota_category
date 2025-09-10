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
    on_finish: function() {
        jsPsych.data.displayData();
    }
});

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
            <p>Try to think of something that the given word is definitely NOT.</p>
            <p>You can provide multiple responses for each word - they will be shown to you as you type them.</p>
            <p>There are no right or wrong answers - we're interested in what comes to mind for you.</p>
            <p><strong>Press any key when you're ready to begin.</strong></p>
        </div>
    `,
    data: {
        trial_type: 'instructions'
    }
};

function getSentenceFrame(word, pos) {
    if (pos && pos.toLowerCase() === 'noun') {
        // for nouns, use "a" or "an" based on first letter
        const firstLetter = word.charAt(0).toLowerCase();
        const vowels = ['a', 'e', 'i', 'o', 'u'];
        const article = vowels.includes(firstLetter) ? 'An' : 'A';
        return `${article} <span class="word-highlight">${word}</span> is not a ______`;
    } else {
        // for other parts of speech, drop both articles
        return `<span class="word-highlight">${word}</span> is not ______`;
    }
}

function createTrials(wordsData) {
    const experimentTrials = [];
    
    wordsData.forEach((item, index) => {
        const word = item.word;
        
        if (!word) {
            console.warn('Trial missing word:', item);
            return;
        }
        
        // allows multiple responses
        const multiResponseTrial = {
            type: jsPsychHtmlButtonResponse,
            stimulus: function() {
                return `
                    <div style="text-align: center; max-width: 800px; margin: 0 auto;">
                        <div class="trial-stimulus">
                            ${getSentenceFrame(word, item.pos)}
                        </div>
                        
                        <div style="margin: 20px 0;">
                            <input type="text" id="response-input" placeholder="Type your answer here..." 
                                   style="padding: 10px; font-size: 16px; width: 300px; border: 2px solid #ddd; border-radius: 5px;">
                            <button id="add-btn" style="padding: 10px 20px; margin-left: 10px; font-size: 16px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
                                Add Response
                            </button>
                        </div>
                        
                        <div id="responses-display" style="margin: 20px 0; padding: 15px; background-color: #f0f8ff; border-radius: 5px; min-height: 50px; display: none;">
                            <h4>Your responses:</h4>
                            <div id="responses-list" style="text-align: left; display: inline-block;"></div>
                        </div>
                        
                        <div style="margin: 20px 0;">
                            <button id="done-btn" style="padding: 10px 20px; font-size: 16px; background-color: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; display: none;">
                                Done with this word
                            </button>
                        </div>
                    </div>
                `;
            },
            choices: [],
            trial_duration: null,
            data: {
                custom_trial_type: 'word_completion_multi',
                participant_id: participant_id,
                trial_number: index + 1,
                word: word,
                pos: item.pos,
                eng_freq: item.eng_freq
            },
            on_load: function() {
                const responses = [];
                const responseTimes = []; // get RT for each response
                const trialStartTime = Date.now();
                const input = document.getElementById('response-input');
                const addBtn = document.getElementById('add-btn');
                const doneBtn = document.getElementById('done-btn');
                const responsesDisplay = document.getElementById('responses-display');
                const responsesList = document.getElementById('responses-list');
                
                function addResponse() {
                    const response = input.value.trim();
                    if (response) {
                        const responseTime = Date.now() - trialStartTime;
                        responses.push(response);
                        responseTimes.push(responseTime);
                        
                        
                        const responseDiv = document.createElement('div');
                        responseDiv.style.cssText = 'margin: 5px 0; padding: 5px; background-color: #e7f3ff; border-radius: 3px;';
                        responseDiv.innerHTML = `<strong>${response}</strong>`;
                        responsesList.appendChild(responseDiv);
                        
                        
                        responsesDisplay.style.display = 'block';
                        doneBtn.style.display = 'inline-block';
                        
                        
                        //console.log(`Response ${responses.length} added: "${response}" at ${responseTime}ms`);
                        //console.log(`Current responses array:`, responses);
                        //console.log(`Current response times array:`, responseTimes);
                        
                        input.value = '';
                        input.focus();
                    }
                }
                
                function finishTrial() {
                    
                    const responseData = responses.map((response, index) => ({
                        response_word: response,
                        response_order: index + 1,
                        rt: responseTimes[index]
                    }));
                    
                    //console.log('Created response data:', responseData);
                    
                    const trialData = {
                        custom_trial_type: 'word_completion_multi',
                        participant_id: participant_id,
                        trial_number: index + 1,
                        word: word,
                        pos: item.pos,
                        eng_freq: item.eng_freq,
                        responses: [...responses],
                        response_times: [...responseTimes],
                        response_data: responseData.map(r => ({...r})), 
                        num_responses: responses.length,
                        trial_rt: Date.now() - trialStartTime
                    };
                    
                    
                    jsPsych.finishTrial(trialData);
                }
                
                addBtn.addEventListener('click', addResponse);
                doneBtn.addEventListener('click', finishTrial);
                
                input.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        addResponse();
                    }
                });
                
                input.focus();
            },
            on_finish: function(data) {
                data.rt = Math.round(data.rt);
                
                const allData = jsPsych.data.get().values();
                console.log(`Total trials in jsPsych data: ${allData.length}`);
                const wordTrials = allData.filter(trial => trial.custom_trial_type === 'word_completion_multi');
                console.log(`Word completion trials found so far: ${wordTrials.length}`);
                if (wordTrials.length > 0) {
                    console.log('Last completed word trial:', wordTrials[wordTrials.length - 1]);
                }
            }
        };

        experimentTrials.push(multiResponseTrial);
    });
    
    return experimentTrials;
}

function getFilteredData() {   
    // console.log('All trials:', allTrials);
    
    const wordTrials = allTrials.filter(trial => trial.custom_trial_type === 'word_completion_multi');
    console.log(`Word completion trials found: ${wordTrials.length}`);
    
    if (wordTrials.length > 0) {
        console.log('All word trials:', wordTrials);
    }
    
    // if there's no data, return empty CSV
    if (wordTrials.length === 0) {
        console.error("No word completion trials found!");
        //console.log('Available trial types:', [...new Set(allTrials.map(t => t.trial_type))]);
        //console.log('Available custom trial types:', [...new Set(allTrials.map(t => t.custom_trial_type))]);
        return 'subCode,trial_num,target_word,target_pos,target_eng_freq,response_word,response_order,rt\n';
    }
    
    try {
        const header = 'subCode,trial_num,target_word,target_pos,target_eng_freq,response_word,response_order,rt';
        const rows = [];
        
        wordTrials.forEach((trial, trialIndex) => {
            console.log(`Processing trial ${trialIndex + 1}:`, trial);
            
            // Use the detailed response data if available
            if (trial.response_data && trial.response_data.length > 0) {
                console.log(`Using detailed response data for trial ${trialIndex + 1}`);
                trial.response_data.forEach((responseItem) => {
                    const row = [
                        trial.participant_id || participant_id,
                        trial.trial_number || trialIndex + 1,
                        trial.word || '',
                        trial.pos || '',
                        trial.eng_freq || '',
                        responseItem.response_word || '',
                        responseItem.response_order || 1,
                        Math.round(responseItem.rt || 0)
                    ];
                    rows.push(row);
                    console.log(`Added detailed response row:`, row);
                });
            }
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
        //console.log("Generated CSV data:", finalCSV);
        
        return finalCSV;
    } catch (error) {
        console.error("Error in getFilteredData:", error);
        return 'subCode,trial_num,target_word,target_pos,target_eng_freq,response_word,response_order,rt\nerror,0,error,error,0,error,1,0\n';
    }
}

const save_data = {
    type: jsPsychPipe,
    action: "save",
    experiment_id: "iEGcC0iYDj4r",
    filename: filename,
    data_string: getFilteredData,
    on_finish: function(data) {
        if (data.success) {
            console.log('Data saved successfully to DataPipe!');
            //console.log('Participant ID:', participant_id);
            //console.log('Filename:', filename);
        } else {
            console.error('Error saving to DataPipe:', data.message);
            //console.error('Full error data:', data);
        }
    }
};

const final_screen = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
        <div style="text-align: center; max-width: 600px; margin: 0 auto;">
            <h2>Thank you!</h2>
            <p>You have completed the experiment.</p>
            <p>Your completion code is: <strong style="font-size: 18px; color: #2563eb;">${completion_code}</strong></p>
            <p>Please save this code if it was requested by the researcher.</p>
        </div>
    `,
    choices: ['Finish'],
    data: {
        trial_type: 'final',
        completion_code: completion_code
    },  
    on_finish: function() {
        window.location.href = `https://uwmadison.sona-systems.com/default.aspx?logout=Y`;
    }
};

// Function to load trials from CSV
async function loadWords() {
    try {
        const response = await fetch('word_list.csv');
        const csvText = await response.text();
        
        const results = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true
        });

        //console.log('Loaded words:', results.data.length);

        let shuffledData = jsPsych.randomization.shuffle([...results.data]);
        
        return shuffledData;
    } catch (error) {
        console.error('Error loading words:', error);
        return [];
    }
}

async function runExperiment() {
    try {
        console.log('Starting experiment...');
        console.log('Participant ID:', participant_id);
        console.log('Completion code:', completion_code);
        
        const wordsData = await loadWords();
        console.log('Loaded words:', wordsData.length);
        
        if (wordsData.length === 0) {
            throw new Error('No words loaded from CSV file');
        }
        
        const experimentTrials = createTrials(wordsData);
        console.log('Created experiment trials:', experimentTrials.length);
            
        timeline = [
            consent,
            instructions,
            ...experimentTrials,
            save_data,
            final_screen
        ];

        console.log('Timeline initialized with', timeline.length, 'items');
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