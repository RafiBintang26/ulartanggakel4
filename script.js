// --- Audio System (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(frequency, type, duration, vol = 0.1) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    
    gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
}

const sounds = {
    roll: () => {
        // Quick ascending blips
        playTone(300, 'square', 0.1);
        setTimeout(() => playTone(400, 'square', 0.1), 100);
        setTimeout(() => playTone(500, 'square', 0.1), 200);
    },
    correct: () => {
        // Happy ding
        playTone(600, 'sine', 0.2, 0.2);
        setTimeout(() => playTone(800, 'sine', 0.4, 0.2), 150);
    },
    wrong: () => {
        // Sad buzz
        playTone(300, 'sawtooth', 0.3, 0.2);
        setTimeout(() => playTone(250, 'sawtooth', 0.4, 0.2), 200);
    },
    win: () => {
        // Fanfare
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            setTimeout(() => playTone(freq, 'sine', 0.3, 0.2), i * 150);
        });
    },
    slideUp: () => playTone(400, 'sine', 0.5), // Ladder
    slideDown: () => playTone(200, 'sawtooth', 0.5) // Snake
};

// --- Game Configuration & State ---
const BOARD_SIZE = 100;
const COLUMNS = 10;
const ROWS = 10;

const snakes = {
    16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78
};

const ladders = {
    1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 80: 100
};

const colors = [
    { name: 'Hijau', hex: 'var(--p1-color)' },
    { name: 'Kuning', hex: 'var(--p2-color)' },
    { name: 'Merah', hex: 'var(--p3-color)' },
    { name: 'Biru', hex: 'var(--p4-color)' }
];

let players = [];
let currentPlayerIndex = 0;
let currentDiceValue = 0;

let mathAttempts = 2;
let currentMathAnswer = 0;

// --- DOM Elements ---
const setupModal = document.getElementById('setup-modal');
const playerCountSelect = document.getElementById('player-count');
const playerInputsContainer = document.getElementById('player-inputs');
const startBtn = document.getElementById('start-btn');
const gameUI = document.getElementById('game-ui');
const boardEl = document.getElementById('board');
const playersListEl = document.getElementById('players-list');
const currentPlayerNameEl = document.getElementById('current-player-name');
const rollBtn = document.getElementById('roll-btn');
const diceVisual = document.getElementById('dice-visual');
const diceResultText = document.getElementById('dice-result-text');
const resetBtn = document.getElementById('reset-btn');

// Math Modal Elements
const mathModal = document.getElementById('math-modal');
const mathQuestionEl = document.getElementById('math-question');
const mathAnswerEl = document.getElementById('math-answer');
const mathFeedbackEl = document.getElementById('math-feedback');
const mathAttemptsEl = document.getElementById('math-attempts');
const submitAnswerBtn = document.getElementById('submit-answer-btn');

// Winner Modal Elements
const winnerModal = document.getElementById('winner-modal');
const winnerNameEl = document.getElementById('winner-name');
const playAgainBtn = document.getElementById('play-again-btn');

// --- Setup Phase ---

// Render inputs dynamically based on dropdown
function renderPlayerInputs() {
    const count = parseInt(playerCountSelect.value);
    playerInputsContainer.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const row = document.createElement('div');
        row.className = 'player-input-row';
        row.innerHTML = `
            <div class="color-indicator" style="background-color: ${colors[i].hex}"></div>
            <input type="text" id="player-name-${i}" placeholder="Nama Player ${i + 1}" value="Player ${i + 1}">
        `;
        playerInputsContainer.appendChild(row);
    }
}

playerCountSelect.addEventListener('change', renderPlayerInputs);
renderPlayerInputs();

startBtn.addEventListener('click', () => {
    const count = parseInt(playerCountSelect.value);
    players = [];
    for (let i = 0; i < count; i++) {
        const nameInput = document.getElementById(`player-name-${i}`).value;
        players.push({
            id: i + 1,
            name: nameInput || `Player ${i + 1}`,
            color: colors[i].hex,
            position: 0 // Start outside the board (0)
        });
    }
    
    // Ensure Audio Context is active on first user interaction
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    setupModal.classList.remove('active');
    gameUI.classList.remove('hidden');
    initGame();
});

// --- Game Initialization ---

function initGame() {
    currentPlayerIndex = 0;
    createBoard();
    updatePlayersList();
    updateCurrentTurnUI();
    placePlayersInitial();
}

function createBoard() {
    boardEl.innerHTML = '';
    // SVG layer for snakes and ladders
    const svgLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgLayer.classList.add('svg-layer');
    boardEl.appendChild(svgLayer);

    // Create 100 cells in Boustrophedon order (alternating row direction)
    // Grid handles it sequentially, we just number them correctly
    for (let row = 9; row >= 0; row--) {
        for (let col = 0; col < 10; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            
            // Calculate cell number
            let num;
            if (row % 2 === 0) {
                // Left to right
                num = (row * 10) + col + 1;
            } else {
                // Right to left
                num = (row * 10) + (9 - col) + 1;
            }
            
            cell.id = `cell-${num}`;
            
            // Add visual indicators for snakes/ladders start points
            if (snakes[num]) {
                cell.innerHTML = `🐍 <br>${num}`;
                cell.style.color = "#e74c3c";
            } else if (ladders[num]) {
                cell.innerHTML = `🪜 <br>${num}`;
                cell.style.color = "#2ecc71";
            } else {
                cell.textContent = num;
            }
            
            boardEl.appendChild(cell);
        }
    }
    
    // Wait for layout to draw lines
    setTimeout(drawSnakesAndLadders, 100);
}

function drawSnakesAndLadders() {
    const svg = document.querySelector('.svg-layer');
    if (!svg) return;
    svg.innerHTML = ''; // Clear existing
    
    const drawLine = (start, end, color, strokeDasharray) => {
        const startCell = document.getElementById(`cell-${start}`);
        const endCell = document.getElementById(`cell-${end}`);
        if(!startCell || !endCell) return;
        
        const svgRect = svg.getBoundingClientRect();
        const startRect = startCell.getBoundingClientRect();
        const endRect = endCell.getBoundingClientRect();
        
        const x1 = startRect.left - svgRect.left + startRect.width / 2;
        const y1 = startRect.top - svgRect.top + startRect.height / 2;
        const x2 = endRect.left - svgRect.left + endRect.width / 2;
        const y2 = endRect.top - svgRect.top + endRect.height / 2;
        
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', '4');
        if(strokeDasharray) line.setAttribute('stroke-dasharray', strokeDasharray);
        line.setAttribute('opacity', '0.7');
        
        svg.appendChild(line);
    };

    for (let s in snakes) drawLine(s, snakes[s], '#e74c3c', '5,5'); // Red dashed for snakes
    for (let l in ladders) drawLine(l, ladders[l], '#2ecc71', null); // Green solid for ladders
}

// Redraw lines on window resize
window.addEventListener('resize', () => {
    if (!gameUI.classList.contains('hidden')) {
        drawSnakesAndLadders();
    }
});

function placePlayersInitial() {
    // Remove all existing tokens
    document.querySelectorAll('.token').forEach(t => t.remove());
    // Create token elements but keep them hidden if position is 0
    players.forEach(p => {
        const token = document.createElement('div');
        token.className = `token token-${p.id}`;
        token.id = `token-${p.id}`;
        // append to board but hidden initially
        boardEl.appendChild(token);
        token.style.display = 'none';
        
        if (p.position > 0) {
            updateTokenPosition(p);
        }
    });
}

function updatePlayersList() {
    playersListEl.innerHTML = '';
    players.forEach((p, index) => {
        const li = document.createElement('li');
        if (index === currentPlayerIndex) li.classList.add('active-player');
        li.innerHTML = `
            <div class="color-indicator" style="background-color: ${p.color}"></div>
            ${p.name} (Pos: ${p.position})
        `;
        playersListEl.appendChild(li);
    });
}

function updateCurrentTurnUI() {
    const cp = players[currentPlayerIndex];
    currentPlayerNameEl.textContent = cp.name;
    currentPlayerNameEl.style.color = cp.color;
    updatePlayersList();
}

// --- Dice Logic ---

function drawDice(value) {
    diceVisual.innerHTML = '';
    const createDot = (className) => {
        const dot = document.createElement('div');
        dot.className = `dot ${className}`;
        diceVisual.appendChild(dot);
    };

    const config = {
        1: ['center'],
        2: ['top-left', 'bottom-right'],
        3: ['top-left', 'center', 'bottom-right'],
        4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
        5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
        6: ['top-left', 'top-right', 'mid-left', 'mid-right', 'bottom-left', 'bottom-right']
    };

    diceVisual.style.gridTemplateColumns = 'repeat(3, 1fr)';
    diceVisual.style.gridTemplateRows = 'repeat(3, 1fr)';

    // Quick map for grid placement
    const gridArea = {
        'top-left': '1/1', 'top-right': '1/3',
        'mid-left': '2/1', 'center': '2/2', 'mid-right': '2/3',
        'bottom-left': '3/1', 'bottom-right': '3/3'
    };

    if (config[value]) {
        config[value].forEach(pos => {
            const dot = document.createElement('div');
            dot.className = 'dot';
            dot.style.gridArea = gridArea[pos];
            diceVisual.appendChild(dot);
        });
    }
}
drawDice(1);

rollBtn.addEventListener('click', () => {
    if (rollBtn.disabled) return;
    rollBtn.disabled = true;
    sounds.roll();
    
    diceVisual.classList.add('rolling');
    diceResultText.textContent = "Mengocok...";

    setTimeout(() => {
        diceVisual.classList.remove('rolling');
        currentDiceValue = Math.floor(Math.random() * 6) + 1;
        drawDice(currentDiceValue);
        diceResultText.textContent = `Dapat ${currentDiceValue}!`;
        
        setTimeout(showMathQuestion, 800);
    }, 500);
});

// --- Math Logic ---

function generateMathQuestion() {
    const ops = ['+', '-', '*', '/'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a, b, answer;

    switch(op) {
        case '+':
            a = Math.floor(Math.random() * 20) + 1;
            b = Math.floor(Math.random() * 20) + 1;
            answer = a + b;
            break;
        case '-':
            a = Math.floor(Math.random() * 20) + 10;
            b = Math.floor(Math.random() * a); // ensure positive result
            answer = a - b;
            break;
        case '*':
            a = Math.floor(Math.random() * 10) + 1;
            b = Math.floor(Math.random() * 10) + 1;
            answer = a * b;
            break;
        case '/':
            b = Math.floor(Math.random() * 9) + 2; // 2 to 10
            answer = Math.floor(Math.random() * 10) + 1; // 1 to 10
            a = b * answer; // ensure clean division
            break;
    }
    
    const symbol = op === '*' ? 'x' : op === '/' ? '÷' : op;
    return { question: `${a} ${symbol} ${b} = ?`, answer: answer };
}

function showMathQuestion() {
    const qData = generateMathQuestion();
    currentMathAnswer = qData.answer;
    mathAttempts = 2;
    
    mathQuestionEl.textContent = qData.question;
    mathAnswerEl.value = '';
    mathFeedbackEl.textContent = '';
    mathFeedbackEl.className = 'feedback-text';
    mathAttemptsEl.textContent = `Sisa percobaan: ${mathAttempts}`;
    
    mathModal.classList.add('active');
    mathAnswerEl.focus();
}

submitAnswerBtn.addEventListener('click', handleMathAnswer);
mathAnswerEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleMathAnswer();
});

function handleMathAnswer() {
    const playerAns = parseInt(mathAnswerEl.value);
    
    if (isNaN(playerAns)) {
        mathFeedbackEl.textContent = "Masukkan angka!";
        mathFeedbackEl.className = 'feedback-text error';
        return;
    }

    if (playerAns === currentMathAnswer) {
        // Correct
        sounds.correct();
        mathFeedbackEl.textContent = "Benar! Jawaban tepat. ✅";
        mathFeedbackEl.className = 'feedback-text success';
        submitAnswerBtn.disabled = true;
        
        setTimeout(() => {
            mathModal.classList.remove('active');
            submitAnswerBtn.disabled = false;
            movePlayer(currentDiceValue);
        }, 1500);
    } else {
        // Wrong
        sounds.wrong();
        mathAttempts--;
        mathAttemptsEl.textContent = `Sisa percobaan: ${mathAttempts}`;
        
        if (mathAttempts > 0) {
            mathFeedbackEl.textContent = "Salah! Coba lagi. ❌";
            mathFeedbackEl.className = 'feedback-text error';
            mathAnswerEl.value = '';
            mathAnswerEl.focus();
        } else {
            // Out of attempts
            mathFeedbackEl.textContent = `Kesempatan habis! Jawaban benar: ${currentMathAnswer}. ❌`;
            mathFeedbackEl.className = 'feedback-text error';
            submitAnswerBtn.disabled = true;
            
            setTimeout(() => {
                mathModal.classList.remove('active');
                submitAnswerBtn.disabled = false;
                nextTurn(); // Skip turn
            }, 2000);
        }
    }
}

// --- Movement Logic ---

function updateTokenPosition(player, skipAnimation = false) {
    const token = document.getElementById(`token-${player.id}`);
    const cell = document.getElementById(`cell-${player.position}`);
    if (!cell) return;

    token.style.display = 'block';

    const cellRect = cell.getBoundingClientRect();
    const boardRect = boardEl.getBoundingClientRect();

    const x = cellRect.left - boardRect.left;
    const y = cellRect.top - boardRect.top;

    if (skipAnimation) {
        token.style.transition = 'none';
    } else {
        token.style.transition = 'all 0.4s ease-in-out';
    }

    // Center token in cell
    const tokenSize = cellRect.width * 0.6;
    token.style.width = `${tokenSize}px`;
    token.style.height = `${tokenSize}px`;
    
    // Offset for centering
    const offsetX = (cellRect.width - tokenSize) / 2;
    const offsetY = (cellRect.height - tokenSize) / 2;

    token.style.transform = `translate(${x + offsetX}px, ${y + offsetY}px)`;
}

function movePlayer(steps) {
    const cp = players[currentPlayerIndex];
    let currentStep = 0;
    
    // Start from 1 if at 0
    if (cp.position === 0) {
        cp.position = 1;
        updateTokenPosition(cp);
        steps--;
    }

    const targetPosition = cp.position + steps;

    const interval = setInterval(() => {
        if (currentStep < steps && cp.position < BOARD_SIZE) {
            cp.position++;
            updateTokenPosition(cp);
            currentStep++;
        } else {
            clearInterval(interval);
            checkSnakesAndLadders(cp);
        }
    }, 400); // 400ms per step
}

function checkSnakesAndLadders(player) {
    setTimeout(() => {
        if (snakes[player.position]) {
            sounds.slideDown();
            diceResultText.textContent = "Aduh! Digigit Ular 🐍";
            player.position = snakes[player.position];
            updateTokenPosition(player);
            setTimeout(() => checkWin(player), 1000);
        } else if (ladders[player.position]) {
            sounds.slideUp();
            diceResultText.textContent = "Hore! Naik Tangga 🪜";
            player.position = ladders[player.position];
            updateTokenPosition(player);
            setTimeout(() => checkWin(player), 1000);
        } else {
            checkWin(player);
        }
    }, 500);
}

function checkWin(player) {
    if (player.position >= BOARD_SIZE) {
        player.position = BOARD_SIZE;
        updateTokenPosition(player);
        sounds.win();
        winnerNameEl.textContent = `${player.name} Menang!`;
        winnerNameEl.style.color = player.color;
        winnerModal.classList.add('active');
    } else {
        nextTurn();
    }
}

function nextTurn() {
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    updateCurrentTurnUI();
    diceResultText.textContent = "";
    rollBtn.disabled = false;
}

// --- Reset & Replay ---

resetBtn.addEventListener('click', () => {
    if(confirm("Apakah kamu yakin ingin memulai ulang permainan?")) {
        gameUI.classList.add('hidden');
        setupModal.classList.add('active');
        // clean up
        document.querySelectorAll('.token').forEach(t => t.remove());
    }
});

playAgainBtn.addEventListener('click', () => {
    winnerModal.classList.remove('active');
    gameUI.classList.add('hidden');
    setupModal.classList.add('active');
    document.querySelectorAll('.token').forEach(t => t.remove());
});
