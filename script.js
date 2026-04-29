const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreElement = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');
const diffBtns = document.querySelectorAll('.diff-btn');
const startScreen = document.getElementById('start-screen');

// Configurações do jogo
let gridSize = 44;
let tileCountX = 10;
let tileCountY = 10;

let snake = [{x: 5, y: 5}];
let fase2 = false;
let dx = 1;
let dy = 0;
let food = {x: 10, y: 6, color: '#ef4444'};
let score = 0;
let highScore = localStorage.getItem('snakeHighScore') || 0;
let highScores = JSON.parse(localStorage.getItem('snakeHighScores')) || [];
let gameSpeed = 500;
let currentDifficulty = 'facil';
let currentSpeedUnits = 2;
let snakeColor = '#39ff14';
let gridColor = 'rgba(57, 255, 20, 0.2)';
let gameLoopId;
let boss = { active: false, body: [], moveCounter: 0, length: 8, dx: 0, dy: 0 };

// Cores vibrantes para a comida
const foodColors = [
    '#ef4444', // Red
    '#f59e0b', // Amber/Yellow
    '#10b981', // Emerald/Green
    '#06b6d4', // Cyan
    '#8b5cf6', // Violet
    '#ec4899'  // Pink
];

function getSpeedFromDifficulty() {
    // 2/s no fácil (500ms), 4/s no médio (250ms), 5/s no difícil (200ms)
    if (currentDifficulty === 'facil') return 500; 
    if (currentDifficulty === 'medio') return 250;
    if (currentDifficulty === 'dificil') return 200;
    return 500;
}

// Inicialização
function initGame(isFirstLoad = false) {
    if (startScreen && !isFirstLoad) startScreen.classList.add('hidden');
    
    // Usando 10x10 colunas para aumentar o tamanho dos quadrados
    tileCountX = 10;
    tileCountY = 10;
    
    gridSize = 440 / tileCountX; // Valor fixo para evitar qualquer erro de carregamento
    fase2 = false;
    
    // Cores aleatórias para a partida
    const randomHue = Math.floor(Math.random() * 360);
    snakeColor = `hsl(${randomHue}, 100%, 60%)`;
    gridColor = `hsla(${randomHue}, 100%, 60%, 0.8)`; // Grade BEM mais destacada e realista
    
    snake = [
        { x: Math.floor(tileCountX / 2), y: Math.floor(tileCountY / 2) }
    ];
    dx = 0; // Volta a ficar parada no início para evitar bugs
    dy = 0;
    score = 0;
    
    // Velocidade inicial ajustada: Fácil=2, Médio=4, Difícil=5
    currentSpeedUnits = currentDifficulty === 'facil' ? 2 : (currentDifficulty === 'medio' ? 4 : 5);
    gameSpeed = 1000 / currentSpeedUnits;
    
    boss = { active: false, body: [], moveCounter: 0, length: 8, dx: 0, dy: 0 };

    scoreElement.textContent = score;
    highScoreElement.textContent = highScore;
    gameOverScreen.classList.add('hidden');
    canvas.focus(); // Garante que os controles funcionem imediatamente
    
    renderLeaderboard();
    spawnFood();
    
    if (gameLoopId) clearTimeout(gameLoopId);
    gameLoop();
}

function spawnFood() {
    food = {
        x: Math.floor(Math.random() * tileCountX),
        y: Math.floor(Math.random() * tileCountY),
        color: foodColors[Math.floor(Math.random() * foodColors.length)]
    };
    
    // Evitar que a comida nasça dentro da cobra
    for (let part of snake) {
        if (part.x === food.x && part.y === food.y) {
            spawnFood();
            break;
        }
    }
}

function gameLoop() {
    update();
    draw(); // Desenha sempre ANTES de checar o fim de jogo para garantir que o frame apareça
    if (checkGameOver()) return;
    gameLoopId = setTimeout(gameLoop, gameSpeed);
}

function update() {
    if (dx === 0 && dy === 0) return; // Não mover enquanto não houver input

    // Calcular nova posição da cabeça
    const headX = snake[0].x + dx;
    const headY = snake[0].y + dy;
    
    const newHead = { x: headX, y: headY };
    
    // Adicionar nova cabeça (move a cobra)
    snake.unshift(newHead);

    // Verificar se comeu a comida
    if (headX === food.x && headY === food.y) {
        score += 10;
        scoreElement.textContent = score;
        
        // Aumenta a velocidade em 0.1 unidades por comida
        currentSpeedUnits += 0.1;
        gameSpeed = 1000 / currentSpeedUnits;
        if (score > highScore) {
            highScore = score;
            highScoreElement.textContent = highScore;
            localStorage.setItem('snakeHighScore', highScore);
        }
        
        // Fase 2: duplicar colunas (diminuir grid) e aumentar vel
        if (score >= 50 && !fase2) {
            fase2 = true;
            tileCountX *= 2;
            tileCountY *= 2;
            gridSize = canvas.width / tileCountX;
            
            // Reajusta as posições multiplicando por 2
            snake.forEach(part => {
                part.x *= 2;
                part.y *= 2;
            });
            // O novo head precisa ser atualizado, pois alteramos as refs da array
            
            // Aumenta a velocidade na Fase 2 (mais colunas = precisa de mais velocidade)
            currentSpeedUnits *= 2.5; 
            gameSpeed = 1000 / currentSpeedUnits;
        }
        
        spawnFood();
        // Efeito visual ao comer (opcional)
        canvas.style.boxShadow = `0 0 40px ${food.color}40`;
        setTimeout(() => { canvas.style.boxShadow = ''; }, 200);
        
        // Fase 3: Boss at 100 points
        if (score >= 100 && score < 150 && !boss.active) {
            boss.active = true;
            
            // Cobra corre um pouco mais devagar
            currentSpeedUnits *= 0.6; // Reduz em 40% a velocidade atual
            gameSpeed = 1000 / currentSpeedUnits;

            // Spawn boss in corner furthest from player
            let startX = (snake[0].x > tileCountX / 2) ? 0 : tileCountX - 1;
            let startY = (snake[0].y > tileCountY / 2) ? 0 : tileCountY - 1;
            
            boss.body = [];
            for (let i = 0; i < boss.length; i++) {
                boss.body.push({ x: startX, y: startY });
            }
            boss.dx = 0;
            boss.dy = 0;
            
            // Alert in UI
            const bossAlert = document.createElement('div');
            bossAlert.textContent = "BOSS BATTLE!";
            bossAlert.style.position = 'absolute';
            bossAlert.style.top = '50%';
            bossAlert.style.left = '50%';
            bossAlert.style.transform = 'translate(-50%, -50%)';
            bossAlert.style.color = '#ff0000';
            bossAlert.style.fontSize = '4rem';
            bossAlert.style.fontWeight = 'bold';
            bossAlert.style.textShadow = '0 0 30px #ff0000, 0 0 10px #000';
            bossAlert.style.zIndex = '100';
            bossAlert.style.animation = 'pulse 0.5s infinite';
            document.querySelector('.canvas-wrapper').appendChild(bossAlert);
            setTimeout(() => bossAlert.remove(), 3000);
        }
        
        // Fase 4: Boss defeated at 150 points
        if (score >= 150 && boss.active) {
            boss.active = false;
            
            // Alert in UI
            const victoryAlert = document.createElement('div');
            victoryAlert.textContent = "BOSS DEFEATED!";
            victoryAlert.style.position = 'absolute';
            victoryAlert.style.top = '50%';
            victoryAlert.style.left = '50%';
            victoryAlert.style.transform = 'translate(-50%, -50%)';
            victoryAlert.style.color = '#00ff00';
            victoryAlert.style.fontSize = '3rem';
            victoryAlert.style.fontWeight = 'bold';
            victoryAlert.style.textShadow = '0 0 30px #00ff00, 0 0 10px #000';
            victoryAlert.style.zIndex = '100';
            victoryAlert.style.animation = 'pulse 0.5s infinite';
            document.querySelector('.canvas-wrapper').appendChild(victoryAlert);
            setTimeout(() => victoryAlert.remove(), 3000);
        }
    } else {
        // Se não comeu, remove a cauda
        snake.pop();
    }

    // Boss Logic
    if (boss.active) {
        boss.moveCounter++;
        // Nerf no Boss: movimenta-se apenas 1 vez a cada 3 turnos (bem mais lento para permitir desvio)
        if (boss.moveCounter < 3) {
            // Não faz nada, fica parado aguardando
        } else {
            boss.moveCounter = 0;
            let bossHead = boss.body[0];
            let diffX = snake[0].x - bossHead.x;
            let diffY = snake[0].y - bossHead.y;
            
            let nextDx = boss.dx;
            let nextDy = boss.dy;

            if (Math.abs(diffX) > Math.abs(diffY)) {
                nextDx = Math.sign(diffX);
                nextDy = 0;
            } else {
                nextDx = 0;
                nextDy = Math.sign(diffY);
            }

            // Evitar que o boss inverta a direção instantaneamente (suicídio)
            if (boss.body.length > 1 && nextDx === -boss.dx && nextDx !== 0) {
                nextDx = 0;
                nextDy = diffY !== 0 ? Math.sign(diffY) : (Math.random() > 0.5 ? 1 : -1);
            } else if (boss.body.length > 1 && nextDy === -boss.dy && nextDy !== 0) {
                nextDy = 0;
                nextDx = diffX !== 0 ? Math.sign(diffX) : (Math.random() > 0.5 ? 1 : -1);
            }
            
            boss.dx = nextDx;
            boss.dy = nextDy;

            let newBossHead = { x: bossHead.x + boss.dx, y: bossHead.y + boss.dy };
            
            boss.body.unshift(newBossHead);
            if (boss.body.length > boss.length) {
                boss.body.pop();
            }
        }
    }
}

function checkGameOver() {
    // Retorna true se houver colisão
    const head = snake[0];
    
    // Colisão com as paredes
    if (head.x < 0 || head.x >= tileCountX || head.y < 0 || head.y >= tileCountY) {
        triggerGameOver();
        return true;
    }
    
    // Colisão com o próprio corpo
    // Ignorar se a cobra está de tamanho 1 ou se não moveu
    if (dx !== 0 || dy !== 0) {
        for (let i = 1; i < snake.length; i++) {
            if (head.x === snake[i].x && head.y === snake[i].y) {
                triggerGameOver();
                return true;
            }
        }
    }
    
    // Colisão com o Boss
    if (boss.active) {
        // Player batendo no corpo do Boss
        for (let i = 0; i < boss.body.length; i++) {
            if (head.x === boss.body[i].x && head.y === boss.body[i].y) {
                triggerGameOver();
                return true;
            }
        }
        
        // Boss batendo no Player
        let bossHead = boss.body[0];
        if (bossHead) {
            for (let i = 0; i < snake.length; i++) {
                if (bossHead.x === snake[i].x && bossHead.y === snake[i].y) {
                    triggerGameOver();
                    return true;
                }
            }
        }
    }
    
    return false;
}

function triggerGameOver() {
    finalScoreElement.textContent = score;
    gameOverScreen.classList.remove('hidden');
    saveHighScore(score, currentDifficulty);
}

function saveHighScore(newScore, mode) {
    if (newScore === 0) return;
    highScores.push({ 
        score: newScore, 
        mode: mode,
        date: new Date().toLocaleDateString('pt-BR') 
    });
    highScores.sort((a, b) => b.score - a.score);
    highScores = highScores.slice(0, 10); // Aumentado para Top 10 histórico
    localStorage.setItem('snakeHighScores', JSON.stringify(highScores));
    renderLeaderboard();
}

function renderLeaderboard() {
    const mainList = document.getElementById('main-leaderboard-list');
    
    [mainList].forEach(list => {
        if (!list) return;
        
        list.innerHTML = '';
        if (highScores.length === 0) {
            list.innerHTML = '<li style="justify-content: center; color: var(--text-secondary); font-size: 0.8rem;">Nenhum recorde</li>';
            return;
        }
        
        // Mostrar apenas o Top 5
        highScores.slice(0, 5).forEach((entry, index) => {
            const li = document.createElement('li');
            let rankDisplay = index + 1;
            if (index === 0) rankDisplay = '🥇';
            if (index === 1) rankDisplay = '🥈';
            if (index === 2) rankDisplay = '🥉';

            li.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="rank" style="font-size: 1rem; min-width: 30px;">${rankDisplay}</span>
                    <div style="display: flex; flex-direction: column;">
                        <span class="mode-badge" style="width: fit-content; font-size: 0.55rem;">${entry.mode}</span>
                        <span style="font-size: 0.55rem; color: var(--text-secondary); opacity: 0.7;">${entry.date || ''}</span>
                    </div>
                </div>
                <div style="text-align: right;">
                    <span class="score-val" style="font-size: 1rem;">${entry.score}</span>
                </div>
            `;
            list.appendChild(li);
        });
    });
}

function draw() {
    // Limpar o canvas (fundo translúcido para ver a imagem)
    ctx.clearRect(0, 0, 440, 440);
    ctx.fillStyle = 'rgba(10, 10, 10, 0.65)'; // Escurece um pouco para o jogo neon contrastar
    ctx.fillRect(0, 0, 440, 440);
    
    // Desenhar grid super destacado (colunas)
    ctx.strokeStyle = gridColor; 
    ctx.lineWidth = 2.5; // Espessura maior para destacar bem as colunas/linhas
    ctx.shadowBlur = 8;
    ctx.shadowColor = gridColor;
    for(let i = 0; i <= 440; i += gridSize) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 440);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(440, i);
        ctx.stroke();
    }
    ctx.shadowBlur = 0; // Reseta para os próximos desenhos

    // Desenhar comida
    ctx.fillStyle = food.color;
    ctx.shadowBlur = 25;
    ctx.shadowColor = food.color;
    ctx.beginPath();
    ctx.arc(
        food.x * gridSize + gridSize/2, 
        food.y * gridSize + gridSize/2, 
        gridSize/2 - 2, 
        0, 
        Math.PI * 2
    );
    ctx.fill();
    
    // Reflexo da comida
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(
        food.x * gridSize + gridSize/2 - 4, 
        food.y * gridSize + gridSize/2 - 4, 
        3, 
        0, 
        Math.PI * 2
    );
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // Desenhar a cobra de forma bem realista (efeito 3D)
    snake.forEach((part, index) => {
        const isHead = index === 0;
        const x = part.x * gridSize;
        const y = part.y * gridSize;
        
        // Gradiente radial para simular escamas esféricas 3D realistas
        let grad = ctx.createRadialGradient(
            x + gridSize * 0.3, y + gridSize * 0.3, gridSize * 0.05,
            x + gridSize * 0.5, y + gridSize * 0.5, gridSize * 0.7
        );
        grad.addColorStop(0, '#ffffff'); // Brilho de luz especular na escama
        grad.addColorStop(0.3, snakeColor); // Cor natural
        grad.addColorStop(1, '#001100'); // Sombra projetada

        ctx.shadowBlur = isHead ? 35 : 15;
        ctx.shadowColor = snakeColor;
        ctx.fillStyle = grad;
        
        ctx.globalAlpha = isHead ? 1.0 : Math.max(0.6, 1.0 - (index / snake.length));

        // Desenha a cobra mais larga, ocupando totalmente o espaço e até um pouco mais para dar volume
        ctx.beginPath();
        ctx.arc(x + gridSize/2, y + gridSize/2, gridSize / 1.7, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.globalAlpha = 1.0;
        
        if (isHead) {
            ctx.save();
            ctx.translate(x, y);
            const scale = gridSize / 40;
            ctx.scale(scale, scale);
            drawSnakeFace();
            ctx.restore();
        }
    });

    if (boss.active) {
        drawBossEntity();
    }
}

function drawBossEntity() {
    if (!boss.body || boss.body.length === 0) return;

    boss.body.forEach((part, index) => {
        const isHead = index === 0;
        const x = part.x * gridSize;
        const y = part.y * gridSize;
        
        let grad = ctx.createRadialGradient(
            x + gridSize * 0.3, y + gridSize * 0.3, gridSize * 0.05,
            x + gridSize * 0.5, y + gridSize * 0.5, gridSize * 0.7
        );
        grad.addColorStop(0, '#ff8888'); // Brilho de pele monstruosa
        grad.addColorStop(0.3, '#8b0000'); // Cor vermelho escuro
        grad.addColorStop(1, '#220000'); // Sombra projetada

        ctx.shadowBlur = isHead ? 35 : 15;
        ctx.shadowColor = '#ff0000';
        ctx.fillStyle = grad;
        
        ctx.globalAlpha = isHead ? 1.0 : Math.max(0.6, 1.0 - (index / boss.body.length));

        ctx.beginPath();
        ctx.arc(x + gridSize/2, y + gridSize/2, gridSize / 1.7, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.globalAlpha = 1.0;
        
        if (isHead) {
            ctx.save();
            ctx.translate(x, y);
            const scale = gridSize / 40;
            ctx.scale(scale, scale);
            drawBossSnakeFace();
            ctx.restore();
        }
    });
}

function drawBossSnakeFace() {
    const px = 0;
    const py = 0;
    
    const faceDx = (boss.dx === 0 && boss.dy === 0) ? 1 : boss.dx;
    const faceDy = (boss.dx === 0 && boss.dy === 0) ? 0 : boss.dy;
    
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ff0000';
    
    let eye1X, eye1Y, eye2X, eye2Y;
    
    if (faceDx === 1) { // Direita
        eye1X = 26; eye1Y = 12; eye2X = 26; eye2Y = 28;
    } else if (faceDx === -1) { // Esquerda
        eye1X = 14; eye1Y = 12; eye2X = 14; eye2Y = 28;
    } else if (faceDy === 1) { // Baixo
        eye1X = 12; eye1Y = 26; eye2X = 28; eye2Y = 26;
    } else if (faceDy === -1) { // Cima
        eye1X = 12; eye1Y = 14; eye2X = 28; eye2Y = 14;
    } else {
        eye1X = 26; eye1Y = 12; eye2X = 26; eye2Y = 28;
    }
    
    // Draw angular realistic glowing eyes
    let eyeGrad1 = ctx.createRadialGradient(eye1X, eye1Y, 0, eye1X, eye1Y, 6);
    eyeGrad1.addColorStop(0, '#ffffff');
    eyeGrad1.addColorStop(0.2, '#ffff00');
    eyeGrad1.addColorStop(1, '#ff0000');
    ctx.fillStyle = eyeGrad1;

    ctx.beginPath();
    ctx.moveTo(eye1X - 6 * faceDx, eye1Y - 6);
    ctx.lineTo(eye1X + 6 * faceDx, eye1Y);
    ctx.lineTo(eye1X - 6 * faceDx, eye1Y + 6);
    ctx.fill();
    
    let eyeGrad2 = ctx.createRadialGradient(eye2X, eye2Y, 0, eye2X, eye2Y, 6);
    eyeGrad2.addColorStop(0, '#ffffff');
    eyeGrad2.addColorStop(0.2, '#ffff00');
    eyeGrad2.addColorStop(1, '#ff0000');
    ctx.fillStyle = eyeGrad2;

    ctx.beginPath();
    ctx.moveTo(eye2X - 6 * faceDx, eye2Y - 6);
    ctx.lineTo(eye2X + 6 * faceDx, eye2Y);
    ctx.lineTo(eye2X - 6 * faceDx, eye2Y + 6);
    ctx.fill();
}

function drawRoundedRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
}

function drawSnakeFace() {
    const px = 0;
    const py = 0;
    
    // Direção atual (se estiver parada, assume direita)
    const faceDx = (dx === 0 && dy === 0) ? 1 : dx;
    const faceDy = (dx === 0 && dy === 0) ? 0 : dy;
    
    ctx.shadowBlur = 0;
    
    // Fundo do olho
    ctx.fillStyle = '#ffffe0';
    
    let eye1X, eye1Y, eye2X, eye2Y;
    const eyeSize = 6.5;
    const pupilSize = 3;
    
    if (faceDx === 1) { // Direita
        eye1X = px + 26; eye1Y = py + 12;
        eye2X = px + 26; eye2Y = py + 28;
    } else if (faceDx === -1) { // Esquerda
        eye1X = px + 14; eye1Y = py + 12;
        eye2X = px + 14; eye2Y = py + 28;
    } else if (faceDy === 1) { // Baixo
        eye1X = px + 12; eye1Y = py + 26;
        eye2X = px + 28; eye2Y = py + 26;
    } else if (faceDy === -1) { // Cima
        eye1X = px + 12; eye1Y = py + 14;
        eye2X = px + 28; eye2Y = py + 14;
    }
    
    // Globos oculares (gradiente realista estilo cobra)
    let eyeGrad1 = ctx.createRadialGradient(eye1X - 1, eye1Y - 1, 1, eye1X, eye1Y, eyeSize);
    eyeGrad1.addColorStop(0, '#ffffff');
    eyeGrad1.addColorStop(0.3, '#ffcc00'); // Amarelo réptil
    eyeGrad1.addColorStop(1, '#552200');

    let eyeGrad2 = ctx.createRadialGradient(eye2X - 1, eye2Y - 1, 1, eye2X, eye2Y, eyeSize);
    eyeGrad2.addColorStop(0, '#ffffff');
    eyeGrad2.addColorStop(0.3, '#ffcc00');
    eyeGrad2.addColorStop(1, '#552200');

    ctx.fillStyle = eyeGrad1;
    ctx.beginPath(); ctx.arc(eye1X, eye1Y, eyeSize, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = eyeGrad2;
    ctx.beginPath(); ctx.arc(eye2X, eye2Y, eyeSize, 0, Math.PI * 2); ctx.fill();
    
    // Pupilas (fenda estilo cobra)
    ctx.fillStyle = '#000000';
    const pOffset = 1.5;
    const pupil1X = eye1X + faceDx * pOffset;
    const pupil1Y = eye1Y + faceDy * pOffset;
    const pupil2X = eye2X + faceDx * pOffset;
    const pupil2Y = eye2Y + faceDy * pOffset;
    
    const isHorizontal = faceDx !== 0;
    const rx = isHorizontal ? pupilSize : 1.5;
    const ry = isHorizontal ? 1.5 : pupilSize;
    
    ctx.beginPath();
    ctx.ellipse(pupil1X, pupil1Y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(pupil2X, pupil2Y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    
    if (score >= 10) {
        // Língua
        ctx.strokeStyle = '#ff3366'; // rosa vibrante
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        
        let bx = px + 20 + faceDx * 18;
        let by = py + 20 + faceDy * 18;
        
        let ex = bx + faceDx * 12;
        let ey = by + faceDy * 12;
        
        ctx.moveTo(bx, by);
        ctx.lineTo(ex, ey);
        
        // Bifurcação da língua mais detalhada
        if (isHorizontal) {
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex + faceDx * 5, ey - 5);
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex + faceDx * 5, ey + 5);
        } else {
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex - 5, ey + faceDy * 5);
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex + 5, ey + faceDy * 5);
        }
        ctx.stroke();
    }
    ctx.lineCap = 'butt'; // volta ao padrao
}

// Controles
window.addEventListener('keydown', e => {
    if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
    }

    switch (e.key.toLowerCase()) {
        case 'arrowup':
        case 'w':
            if (dy === 1) break;
            dx = 0;
            dy = -1;
            break;
        case 'arrowdown':
        case 's':
            if (dy === -1) break;
            dx = 0;
            dy = 1;
            break;
        case 'arrowleft':
        case 'a':
            if (dx === 1) break;
            dx = -1;
            dy = 0;
            break;
        case 'arrowright':
        case 'd':
            if (dx === -1) break;
            dx = 1;
            dy = 0;
            break;
    }
});

restartBtn.addEventListener('click', () => {
    initGame();
});

if (diffBtns) {
    diffBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            diffBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentDifficulty = e.target.getAttribute('data-diff');
            
            // Reinicia o jogo ao mudar dificuldade
            initGame();
        });
    });
}

highScoreElement.textContent = highScore;
renderLeaderboard();
initGame(true); // Inicia o jogo no fundo para que a cobra já comece andando
