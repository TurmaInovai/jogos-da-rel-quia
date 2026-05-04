const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreElement = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');
const diffBtns = document.querySelectorAll('.diff-btn');
const startScreen = document.getElementById('start-screen');
const exitBtn = document.getElementById('exit-btn');

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
let isDead = false;
let deathProgress = 0;
let deathAnimationId = null;
let immunityEndTime = 0;
let immunityCooldownTime = 0;
const powerStatusElement = document.getElementById('power-status');

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
    isDead = false;
    deathProgress = 0;
    immunityEndTime = 0;
    immunityCooldownTime = 0;
    if (powerStatusElement) {
        powerStatusElement.textContent = "Pronto!";
        powerStatusElement.style.color = "#39ff14";
    }
    if (deathAnimationId) {
        cancelAnimationFrame(deathAnimationId);
        deathAnimationId = null;
    }

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
    if (isDead) return;
    update();
    draw(); // Desenha sempre ANTES de checar o fim de jogo para garantir que o frame apareça
    if (checkGameOver()) return;
    gameLoopId = setTimeout(gameLoop, gameSpeed);
}

function update() {
    if (dx === 0 && dy === 0) return; // Não mover enquanto não houver input

    const now = Date.now();
    const isImmune = now < immunityEndTime;
    
    // Atualizar UI do Poder
    if (powerStatusElement) {
        if (isImmune) {
            powerStatusElement.textContent = `Ativo: ${Math.ceil((immunityEndTime - now)/1000)}s`;
            powerStatusElement.style.color = "#ffd700";
        } else if (now < immunityCooldownTime) {
            powerStatusElement.textContent = `Espera: ${Math.ceil((immunityCooldownTime - now)/1000)}s`;
            powerStatusElement.style.color = "#ef4444";
        } else {
            powerStatusElement.textContent = "Pronto!";
            powerStatusElement.style.color = "#39ff14";
        }
    }

    // Calcular nova posição da cabeça
    let headX = snake[0].x + dx;
    let headY = snake[0].y + dy;
    
    // Poder: Bater na parede durante a imunidade (bate e volta perdendo velocidade)
    if (isImmune && (headX < 0 || headX >= tileCountX || headY < 0 || headY >= tileCountY)) {
        dx = -dx;
        dy = -dy;
        
        currentSpeedUnits = Math.max(1.5, currentSpeedUnits * 0.8); // Perde velocidade
        gameSpeed = 1000 / currentSpeedUnits;
        
        canvas.style.boxShadow = `0 0 30px #ffd700`;
        setTimeout(() => { canvas.style.boxShadow = ''; }, 200);
        
        headX = snake[0].x + dx;
        headY = snake[0].y + dy;
    }
    
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

            // NERF: Boss só tenta seguir o jogador ativamente 50% das vezes
            if (Math.random() < 0.5) {
                if (Math.abs(diffX) > Math.abs(diffY)) {
                    nextDx = Math.sign(diffX);
                    nextDy = 0;
                } else {
                    nextDx = 0;
                    nextDy = Math.sign(diffY);
                }
            } else {
                // Nos outros 50%, tenta manter a direção se estiver andando, ou escolhe uma aleatória se parado
                if (nextDx === 0 && nextDy === 0) {
                    nextDx = Math.random() > 0.5 ? 1 : -1;
                    nextDy = 0;
                }
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
    const head = snake[0];
    let collided = false;
    
    const now = Date.now();
    const isImmune = now < immunityEndTime;
    if (isImmune) return false; // Se estiver imune, ignora qualquer colisão!
    
    // Colisão com as paredes
    if (head.x < 0 || head.x >= tileCountX || head.y < 0 || head.y >= tileCountY) {
        collided = true;
    }
    
    // Colisão com o próprio corpo
    if (!collided && (dx !== 0 || dy !== 0)) {
        for (let i = 1; i < snake.length; i++) {
            if (head.x === snake[i].x && head.y === snake[i].y) {
                collided = true;
                break;
            }
        }
    }
    
    // Colisão com o Boss
    if (!collided && boss.active) {
        // NERF: O boss só mata o jogador se houver colisão de CABEÇAS
        let bossHead = boss.body[0];
        if (bossHead) {
            if (head.x === bossHead.x && head.y === bossHead.y) {
                collided = true;
            }
        }
    }
    
    if (collided) {
        if (!isDead) {
            startDeathAnimation();
        }
        return true;
    }
    
    return false;
}

function startDeathAnimation() {
    isDead = true;
    deathProgress = 0;
    deathAnimationId = requestAnimationFrame(deathAnimationLoop);
}

function deathAnimationLoop() {
    deathProgress += 0.015; // Duração aprox de 1.1s
    if (deathProgress > 1) deathProgress = 1;

    // Engana a função draw para desenhar a cobrinha pequena congelada e normal
    let tempIsDead = isDead;
    isDead = false;
    draw();
    isDead = tempIsDead;

    drawGiantDeathAnimation(deathProgress);

    if (deathProgress < 1) {
        deathAnimationId = requestAnimationFrame(deathAnimationLoop);
    } else {
        setTimeout(triggerGameOver, 500);
    }
}

function drawGiantDeathAnimation(progress) {
    // Fundo escuro com opacidade crescendo rapidamente
    const fade = Math.min(0.85, progress * 4);
    ctx.fillStyle = `rgba(0, 0, 0, ${fade})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Animação de entrada rápida (pop-in)
    const popScale = Math.min(1, progress * 4); 
    if (popScale < 0.05) return; 

    const giantRadius = 150 * popScale; // Cabeça gigante no meio da tela
    
    ctx.save();
    
    // Gira e tomba a cabeça
    const easeProgress = Math.pow(progress, 0.5); 
    const rotateAngle = Math.sin(easeProgress * Math.PI * 5) * 0.15 * (1 - easeProgress) + (easeProgress * Math.PI / 4);
    
    ctx.translate(centerX, centerY);
    // Afunda um pouco
    ctx.translate(0, easeProgress * 60);
    ctx.rotate(rotateAngle);
    ctx.translate(-centerX, -centerY);
    
    // Cabeça
    let grad = ctx.createRadialGradient(
        centerX - giantRadius*0.3, centerY - giantRadius*0.3, giantRadius * 0.1,
        centerX, centerY, giantRadius * 1.5
    );
    // Perde brilho e escurece
    grad.addColorStop(0, '#cccccc'); 
    grad.addColorStop(0.3, snakeColor); 
    grad.addColorStop(1, '#000000'); 
    
    ctx.fillStyle = grad;
    
    // Achata levemente
    const flatten = 1 + (progress * 0.25);
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, giantRadius * flatten, giantRadius, 0, 0, Math.PI * 2);
    ctx.fill();
    
    let eyeHeightMultiplier = Math.max(0.05, 1 - progress * 3.5); // Fechar os olhos rápido
    
    // Olhos Gigantes
    const eyeOffsetX = giantRadius * 0.4;
    const eyeOffsetY = -giantRadius * 0.2;
    const giantEyeSize = giantRadius * 0.25;
    const giantPupilRx = giantEyeSize * 0.2;
    const giantPupilRy = giantEyeSize * 0.6;

    let eye1X = centerX - eyeOffsetX;
    let eye1Y = centerY + eyeOffsetY;
    let eye2X = centerX + eyeOffsetX;
    let eye2Y = centerY + eyeOffsetY;

    if (eyeHeightMultiplier > 0.05) {
        let eyeGrad1 = ctx.createRadialGradient(eye1X - 5, eye1Y - 5, 2, eye1X, eye1Y, giantEyeSize);
        eyeGrad1.addColorStop(0, '#ffffff');
        eyeGrad1.addColorStop(0.3, '#ffcc00');
        eyeGrad1.addColorStop(1, '#552200');

        ctx.fillStyle = eyeGrad1;
        ctx.beginPath(); ctx.ellipse(eye1X, eye1Y, giantEyeSize, giantEyeSize * eyeHeightMultiplier, 0, 0, Math.PI * 2); ctx.fill();
        
        let eyeGrad2 = ctx.createRadialGradient(eye2X - 5, eye2Y - 5, 2, eye2X, eye2Y, giantEyeSize);
        eyeGrad2.addColorStop(0, '#ffffff');
        eyeGrad2.addColorStop(0.3, '#ffcc00');
        eyeGrad2.addColorStop(1, '#552200');

        ctx.fillStyle = eyeGrad2;
        ctx.beginPath(); ctx.ellipse(eye2X, eye2Y, giantEyeSize, giantEyeSize * eyeHeightMultiplier, 0, 0, Math.PI * 2); ctx.fill();
        
        // Pupilas
        ctx.fillStyle = '#000000';
        ctx.beginPath(); ctx.ellipse(eye1X, eye1Y, giantPupilRx, giantPupilRy * eyeHeightMultiplier, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(eye2X, eye2Y, giantPupilRx, giantPupilRy * eyeHeightMultiplier, 0, 0, Math.PI * 2); ctx.fill();
    } else {
        // Olhos fechados
        ctx.strokeStyle = '#221100';
        ctx.lineWidth = giantRadius * 0.06;
        ctx.beginPath();
        ctx.moveTo(eye1X - giantEyeSize, eye1Y);
        ctx.quadraticCurveTo(eye1X, eye1Y + giantRadius*0.1, eye1X + giantEyeSize, eye1Y);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(eye2X - giantEyeSize, eye2Y);
        ctx.quadraticCurveTo(eye2X, eye2Y + giantRadius*0.1, eye2X + giantEyeSize, eye2Y);
        ctx.stroke();
    }
    
    // Língua Gigante caindo
    ctx.strokeStyle = '#cc5577';
    ctx.lineWidth = giantRadius * 0.08;
    ctx.lineCap = 'round';
    
    let tongueStartX = centerX;
    let tongueStartY = centerY + giantRadius - giantRadius*0.1;
    
    let tongueLength = giantRadius * 0.8;
    let tongueEndX = tongueStartX + progress * giantRadius * 0.3;
    let tongueEndY = tongueStartY + tongueLength + progress * giantRadius * 0.4;
    
    ctx.beginPath();
    ctx.moveTo(tongueStartX, tongueStartY);
    ctx.lineTo(tongueEndX, tongueEndY);
    
    let forkLength = giantRadius * 0.15;
    ctx.moveTo(tongueEndX, tongueEndY);
    ctx.lineTo(tongueEndX - forkLength, tongueEndY + forkLength * 1.5);
    ctx.moveTo(tongueEndX, tongueEndY);
    ctx.lineTo(tongueEndX + forkLength, tongueEndY + forkLength * 1.5);
    ctx.stroke();

    ctx.restore();
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
        
        const now = Date.now();
        const isImmune = now < immunityEndTime;

        if (isImmune) {
            grad.addColorStop(0, '#ffffff'); 
            grad.addColorStop(0.3, '#ffd700'); // Dourado imune
            grad.addColorStop(1, '#ff8800'); 
        } else if (isDead) {
            // Cobra morta perde um pouco do brilho
            grad.addColorStop(0, '#cccccc'); 
            grad.addColorStop(0.3, snakeColor);
            grad.addColorStop(1, '#000000'); 
        } else {
            grad.addColorStop(0, '#ffffff'); // Brilho de luz especular na escama
            grad.addColorStop(0.3, snakeColor); // Cor natural
            grad.addColorStop(1, '#001100'); // Sombra projetada
        }

        ctx.shadowBlur = isDead ? 0 : (isHead ? 35 : 15);
        ctx.shadowColor = isImmune ? '#ffd700' : (isDead ? 'transparent' : snakeColor);
        ctx.fillStyle = grad;
        
        ctx.globalAlpha = isHead ? 1.0 : Math.max(0.6, 1.0 - (index / snake.length));

        if (isDead) {
            // Corpo "esparramado" no chão ao morrer
            const flatten = 1 + (deathProgress * 0.2); // Fica até 20% mais gorda e achatada
            ctx.beginPath();
            ctx.ellipse(x + gridSize/2, y + gridSize/2, (gridSize / 1.7) * flatten, gridSize / 1.7, 0, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Desenha a cobra mais larga, ocupando totalmente o espaço e até um pouco mais para dar volume
            ctx.beginPath();
            ctx.arc(x + gridSize/2, y + gridSize/2, gridSize / 1.7, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.globalAlpha = 1.0;
        
        if (isHead) {
            ctx.save();
            ctx.translate(x, y);
            
            if (isDead) {
                // Faz a cabeça girar para o lado e afundar suavemente, simulando desmaio
                const easeProgress = Math.pow(deathProgress, 0.5); 
                const rotateAngle = Math.sin(easeProgress * Math.PI * 5) * 0.15 * (1 - easeProgress) + (easeProgress * Math.PI / 2.5);
                ctx.translate(gridSize/2, gridSize/2);
                ctx.rotate(rotateAngle);
                ctx.translate(-gridSize/2, -gridSize/2);
            }
            
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
    
    // Globos oculares e pálpebras
    let eyeHeightMultiplier = 1;
    if (isDead) {
        // Olhos fecham progressivamente
        eyeHeightMultiplier = Math.max(0.1, 1 - deathProgress * 3);
    }
    
    const isHorizontal = faceDx !== 0;

    if (eyeHeightMultiplier > 0.1) {
        let eyeGrad1 = ctx.createRadialGradient(eye1X - 1, eye1Y - 1, 1, eye1X, eye1Y, eyeSize);
        eyeGrad1.addColorStop(0, '#ffffff');
        eyeGrad1.addColorStop(0.3, '#ffcc00'); // Amarelo réptil
        eyeGrad1.addColorStop(1, '#552200');

        let eyeGrad2 = ctx.createRadialGradient(eye2X - 1, eye2Y - 1, 1, eye2X, eye2Y, eyeSize);
        eyeGrad2.addColorStop(0, '#ffffff');
        eyeGrad2.addColorStop(0.3, '#ffcc00');
        eyeGrad2.addColorStop(1, '#552200');

        ctx.fillStyle = eyeGrad1;
        ctx.beginPath(); ctx.ellipse(eye1X, eye1Y, eyeSize, eyeSize * eyeHeightMultiplier, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = eyeGrad2;
        ctx.beginPath(); ctx.ellipse(eye2X, eye2Y, eyeSize, eyeSize * eyeHeightMultiplier, 0, 0, Math.PI * 2); ctx.fill();
        
        // Pupilas (fenda estilo cobra)
        ctx.fillStyle = '#000000';
        const pOffset = 1.5;
        const pupil1X = eye1X + faceDx * pOffset;
        const pupil1Y = eye1Y + faceDy * pOffset;
        const pupil2X = eye2X + faceDx * pOffset;
        const pupil2Y = eye2Y + faceDy * pOffset;
        
        const rx = isHorizontal ? pupilSize : 1.5;
        const ry = isHorizontal ? 1.5 : pupilSize;
        
        ctx.beginPath();
        ctx.ellipse(pupil1X, pupil1Y, rx, ry * eyeHeightMultiplier, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(pupil2X, pupil2Y, rx, ry * eyeHeightMultiplier, 0, 0, Math.PI * 2);
        ctx.fill();
    } else {
        // Olhos fechados (uma linha curvada de "desmaio")
        ctx.strokeStyle = '#221100';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(eye1X - eyeSize, eye1Y);
        ctx.quadraticCurveTo(eye1X, eye1Y + 4, eye1X + eyeSize, eye1Y);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(eye2X - eyeSize, eye2Y);
        ctx.quadraticCurveTo(eye2X, eye2Y + 4, eye2X + eyeSize, eye2Y);
        ctx.stroke();
    }
    
    if (score >= 10 || isDead) {
        // Língua
        ctx.strokeStyle = isDead ? '#cc5577' : '#ff3366'; // rosa vibrante ou mais pálida se morta
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        
        let bx = px + 20 + faceDx * 18;
        let by = py + 20 + faceDy * 18;
        
        let ex = bx + faceDx * 12;
        let ey = by + faceDy * 12;
        
        if (isDead) {
            // A língua cai mais flácida para baixo e sai mais da boca
            ex += (faceDy === 0 ? 0 : faceDx * 4);
            ey += (faceDx === 0 ? 4 : 8); 
        }

        ctx.moveTo(bx, by);
        ctx.lineTo(ex, ey);
        
        // Bifurcação da língua mais detalhada
        if (isHorizontal && !isDead) {
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex + faceDx * 5, ey - 5);
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex + faceDx * 5, ey + 5);
        } else if (!isHorizontal && !isDead) {
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex - 5, ey + faceDy * 5);
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex + 5, ey + faceDy * 5);
        } else if (isDead) {
            // Língua flácida, pontas caídas
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex + 2, ey + 4);
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex - 2, ey + 4);
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
        case 'g':
            if (Date.now() >= immunityCooldownTime) {
                immunityEndTime = Date.now() + 5000;
                immunityCooldownTime = Date.now() + 25000;
                
                // Efeito visual na borda para confirmar
                if (canvas) {
                    canvas.style.boxShadow = `0 0 50px #ffd700`;
                    setTimeout(() => { canvas.style.boxShadow = ''; }, 300);
                }
            }
            break;
    }
});

restartBtn.addEventListener('click', () => {
    initGame();
});

if (exitBtn) {
    exitBtn.addEventListener('click', () => {
        // Pausar o jogo imediatamente
        isDead = true;
        if (gameLoopId) clearTimeout(gameLoopId);
        if (deathAnimationId) cancelAnimationFrame(deathAnimationId);
        
        // Tenta fechar a aba (se o navegador permitir)
        try { window.close(); } catch(e) {}
        
        // Se a aba não fechar, volta para a tela inicial simulando que "saiu"
        startScreen.classList.remove('hidden');
        gameOverScreen.classList.add('hidden');
    });
}

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
