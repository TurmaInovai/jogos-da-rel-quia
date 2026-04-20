const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreElement = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');

// Configurações do jogo
const gridSize = 40;
const tileCount = canvas.width / gridSize;

let snake = [];
let dx = 0;
let dy = 0;
let food = {};
let score = 0;
let highScore = localStorage.getItem('snakeHighScore') || 0;
let gameLoopId;
let gameSpeed = 160; // ms (Aumentado para diminuir a velocidade)

// Cores vibrantes para a comida
const foodColors = [
    '#ef4444', // Red
    '#f59e0b', // Amber/Yellow
    '#10b981', // Emerald/Green
    '#06b6d4', // Cyan
    '#8b5cf6', // Violet
    '#ec4899'  // Pink
];

// Inicialização
function initGame() {
    snake = [
        { x: 5, y: 5 }
    ];
    dx = 0;
    dy = 0;
    score = 0;
    scoreElement.textContent = score;
    highScoreElement.textContent = highScore;
    gameOverScreen.classList.add('hidden');
    
    spawnFood();
    
    if (gameLoopId) clearTimeout(gameLoopId);
    gameLoop();
}

function spawnFood() {
    food = {
        x: Math.floor(Math.random() * tileCount),
        y: Math.floor(Math.random() * tileCount),
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
    if (checkGameOver()) return;
    draw();
    gameLoopId = setTimeout(gameLoop, gameSpeed - Math.min(score * 2, 60)); // Aumenta dificuldade gradualmente
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
        score++;
        scoreElement.textContent = score;
        if (score > highScore) {
            highScore = score;
            highScoreElement.textContent = highScore;
            localStorage.setItem('snakeHighScore', highScore);
        }
        spawnFood();
        // Efeito visual ao comer (opcional)
        canvas.style.boxShadow = `0 0 40px ${food.color}40`;
        setTimeout(() => { canvas.style.boxShadow = ''; }, 200);
    } else {
        // Se não comeu, remove a cauda
        snake.pop();
    }
}

function checkGameOver() {
    // Retorna true se houver colisão
    const head = snake[0];
    
    // Colisão com as paredes
    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
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
    
    return false;
}

function triggerGameOver() {
    finalScoreElement.textContent = score;
    gameOverScreen.classList.remove('hidden');
}

function draw() {
    // Limpar o canvas
    ctx.fillStyle = '#1e293b'; // var(--canvas-bg)
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Desenhar grid sutil
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 0.5;
    for(let i = 0; i <= canvas.width; i+= gridSize) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
    }

    // Desenhar comida
    ctx.fillStyle = food.color;
    ctx.shadowBlur = 20;
    ctx.shadowColor = food.color;
    ctx.beginPath();
    ctx.arc(
        food.x * gridSize + gridSize/2, 
        food.y * gridSize + gridSize/2, 
        gridSize/2 - 4, 
        0, 
        Math.PI * 2
    );
    ctx.fill();
    ctx.shadowBlur = 0;

    // Desenhar a cobra
    snake.forEach((part, index) => {
        const hue = (index * 25) % 360;
        ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
        
        if (index === 0) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
        } else {
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 0.9;
        }

        drawRoundedRect(
            part.x * gridSize + 2, 
            part.y * gridSize + 2, 
            gridSize - 4, 
            gridSize - 4, 
            8
        );
        ctx.globalAlpha = 1.0;
    });
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

highScoreElement.textContent = highScore;
initGame();
