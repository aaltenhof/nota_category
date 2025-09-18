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
            <p>After typing your response, press Enter to continue to the next word.</p>
            <p>There are no right or wrong answers - we're interested in what comes to mind for you.</p>
            <p><strong>Press any key when you're ready to begin.</strong></p>
        </div>
    `,
    data: {
        trial_type: 'instructions'
    }
};

function isPlural(word) {
    // Convert to lowercase for checking
    const lowerWord = word.toLowerCase();
    
    // Words that end in 's' but are typically singular
    const singularSWords = ['bus', 'class', 'glass', 'grass', 'mass', 'pass', 'bass', 'loss', 'boss', 'cross', 'dress', 'stress', 'chess', 'mess', 'less', 'kiss', 'miss', 'this', 'yes', 'us', 'plus', 'gas', 'focus', 'virus', 'status', 'basis', 'crisis', 'analysis', 'thesis', 'emphasis', 'oasis', 'diagnosis'];
    
    // Check for irregular plurals
    const irregularPlurals = ['children', 'people', 'men', 'women', 'feet', 'teeth', 'mice', 'geese', 'sheep', 'deer', 'fish', 'species', 'series', 'aircraft', 'spacecraft'];
    
    // If it's a known irregular plural
    if (irregularPlurals.includes(lowerWord)) {
        return true;
    }
    
    // If it's a known singular word ending in 's'
    if (singularSWords.includes(lowerWord)) {
        return false;
    }
    
    // Check common plural patterns
    if (lowerWord.endsWith('ies') || 
        lowerWord.endsWith('ves') || 
        lowerWord.endsWith('ses') || 
        lowerWord.endsWith('xes') || 
        lowerWord.endsWith('zes') || 
        lowerWord.endsWith('ches') || 
        lowerWord.endsWith('shes')) {
        return true;
    }
    
    // If ends in 's' but not 'ss', likely plural
    if (lowerWord.endsWith('s') && !lowerWord.endsWith('ss')) {
        return true;
    }
    
    return false;
}

function getSentenceFrame(word, pos) {
    if (pos && pos.toLowerCase() === 'noun') {
        // Check if noun is plural
        if (isPlural(word)) {
            // for plural nouns: NOUNS are not ___
            return `<span class="word-highlight">${word}</span> are not ______`;
        } else {
            // for singular nouns: A(n) NOUN is not a ___
            const firstLetter = word.charAt(0).toLowerCase();
            const vowels = ['a', 'e', 'i', 'o', 'u'];
            const article = vowels.includes(firstLetter) ? 'An' : 'A';
            return `${article} <span class="word-highlight">${word}</span> is not a ______`;
        }
    } else if (pos && pos.toLowerCase() === 'adj') {
        // for adjectives: To be ADJ is to not be ___
        return `To be <span class="word-highlight">${word}</span> is to not be ______`;
    } else if (pos && pos.toLowerCase() === 'verb') {
        // for verbs: VERBing is not ___
        const verbIng = word.endsWith('e') ? word.slice(0, -1) + 'ing' : word + 'ing';
        return `<span class="word-highlight">${verbIng}</span> is not ______`;
    } else {
        // default fallback
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
        
        // single response trial
        const singleResponseTrial = {
            type: jsPsychSurveyText,
            questions: [
                {
                    prompt: function() {
                        return `
                            <div style="text-align: center; max-width: 800px; margin: 0 auto;">
                                <div class="trial-stimulus" style="font-size: 24px; margin: 30px 0;">
                                    ${getSentenceFrame(word, item.pos, item.plurality)}
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
                plurality: item.plurality,
                eng_freq: item.eng_freq,
                list_type: item.list_type,
                randomization: item.randomization
            },
            on_finish: function(data) {
                // add the response to the data object
                data.response_word = data.response.response;
                data.rt = Math.round(data.rt);
                
                console.log(`Trial ${index + 1} completed:`, {
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
        return 'subCode,trial_num,target_word,target_cat,target_pos,target_plurality,target_eng_freq,target_list_type,target_randomization,response_word,rt\n';
    }
    
    try {
        const header = 'subCode,trial_num,target_word,target_cat,target_pos,target_plurality,target_eng_freq,target_list_type,target_randomization,response_word,rt';
        const rows = [];
        
        wordTrials.forEach((trial, trialIndex) => {
            console.log(`Processing trial ${trialIndex + 1}:`, trial);
            
            const row = [
                trial.participant_id || participant_id,
                trial.trial_number || trialIndex + 1,
                trial.word || '',
                trial.cat || '',
                trial.pos || '',
                trial.plurality || '',
                trial.eng_freq || '',
                trial.list_type || '',
                trial.randomization || '',
                trial.response_word || '',
                Math.round(trial.rt || 0)
            ];
            rows.push(row);
            console.log(`Added response row:`, row);
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
        console.log("Generated CSV data:", finalCSV);
        
        return finalCSV;
    } catch (error) {
        console.error("Error in getFilteredData:", error);
        return 'subCode,trial_num,target_word,target_cat,target_pos,target_plurality,target_eng_freq,target_list_type,target_randomization,response_word,rt\nerror,0,error,error,error,error,0,error,error,error,0\n';
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
        } else {
            console.error('Error saving to DataPipe:', data.message);
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

async function loadWords() {
    try {
        const response = await fetch('demo_word_list.csv');
        const csvText = await response.text();
        
        const results = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true
        });

        console.log('Loaded words:', results.data.length);

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