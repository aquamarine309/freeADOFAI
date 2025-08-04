        // 获取Canvas元素和上下文
        const canvas = document.getElementById("gameCanvas");
        const ctx = canvas.getContext("2d");
        
        // 获取UI元素
        const gridSizeSlider = document.getElementById("gridSize");
        const gridSizeValue = document.getElementById("gridSizeValue");
        const gridSpacingSlider = document.getElementById("gridSpacing");
        const gridSpacingValue = document.getElementById("gridSpacingValue");
        const cameraSpeedSlider = document.getElementById("cameraSpeed");
        const cameraSpeedValue = document.getElementById("cameraSpeedValue");
        const gridCountElement = document.getElementById("gridCount");
        const fpsCounterElement = document.getElementById("fpsCounter");
        const cameraXElement = document.getElementById("cameraX");
        const cameraYElement = document.getElementById("cameraY");
        const gridHighlight = document.getElementById("gridHighlight");
        const gridCoords = document.getElementById("gridCoords");
        
        // 配置选项
        const options = {
            gridSize: 60,
            gridSpacing: 2,
            cameraSpeed: 5,
            width: 0,
            height: 0,
            colors: {
                grid: "#4361ee",
                gridHighlight: "#f72585",
                background: "rgba(10, 10, 30, 0.9)"
            }
        };
        
        // 游戏状态
        const gameState = {
            camera: {
                x: 0,
                y: 0
            },
            targetCamera: {
                x: 0,
                y: 0
            },
            scale: 1.0,
            keys: {},
            lastUpdate: Date.now(),
            lastFpsUpdate: Date.now(),
            frameCount: 0,
            fps: 0,
            renderedGrids: 0,
            gridCache: new Map(),
            mouse: {
                x: 0,
                y: 0,
                gridX: 0,
                gridY: 0
            }
        };
        
        // 更新Canvas尺寸
        function updateCanvasSize() {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
            options.width = canvas.width;
            options.height = canvas.height;
        }
        
        // 初始化事件监听
        function initEventListeners() {
            window.addEventListener("resize", updateCanvasSize);
            
            // 键盘事件
            window.addEventListener("keydown", (e) => {
                gameState.keys[e.key.toLowerCase()] = true;
                
                // 空格键重置视图
                if (e.key === " ") {
                    gameState.targetCamera.x = 0;
                    gameState.targetCamera.y = 0;
                    gameState.scale = 1.0;
                }
            });
            
            window.addEventListener("keyup", (e) => {
                gameState.keys[e.key.toLowerCase()] = false;
            });
            
            // 鼠标事件
            canvas.addEventListener("mousemove", (e) => {
                const rect = canvas.getBoundingClientRect();
                gameState.mouse.x = e.clientX - rect.left;
                gameState.mouse.y = e.clientY - rect.top;
                
                // 计算网格坐标
                const gridSize = options.gridSize * gameState.scale;
                gameState.mouse.gridX = Math.floor((gameState.mouse.x - options.width/2) / gridSize + gameState.camera.x);
                gameState.mouse.gridY = Math.floor((gameState.mouse.y - options.height/2) / gridSize + gameState.camera.y);
                
                // 更新网格高亮
                updateGridHighlight();
            });
            
            canvas.addEventListener("mouseleave", () => {
                gridHighlight.style.display = "none";
                gridCoords.style.display = "none";
            });
            
            canvas.addEventListener("mouseenter", () => {
                updateGridHighlight();
            });
            
            // 缩放事件
            canvas.addEventListener("wheel", (e) => {
                e.preventDefault();
                
                const zoomIntensity = 0.1;
                const zoom = 1 + (e.deltaY > 0 ? -zoomIntensity : zoomIntensity);
                
                // 计算缩放点
                const rect = canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                // 转换为网格坐标
                const gridSize = options.gridSize * gameState.scale;
                const gridX = (mouseX - options.width/2) / gridSize + gameState.camera.x;
                const gridY = (mouseY - options.height/2) / gridSize + gameState.camera.y;
                
                // 应用缩放
                gameState.scale *= zoom;
                gameState.scale = Math.max(0.25, Math.min(5, gameState.scale));
                
                // 调整相机位置以保持缩放点固定
                const newGridSize = options.gridSize * gameState.scale;
                gameState.targetCamera.x = gridX - (mouseX - options.width/2) / newGridSize;
                gameState.targetCamera.y = gridY - (mouseY - options.height/2) / newGridSize;
            });
            
            // UI控制事件
            gridSizeSlider.addEventListener("input", () => {
                options.gridSize = parseInt(gridSizeSlider.value);
                gridSizeValue.textContent = options.gridSize;
            });
            
            gridSpacingSlider.addEventListener("input", () => {
                options.gridSpacing = parseInt(gridSpacingSlider.value);
                gridSpacingValue.textContent = options.gridSpacing;
            });
            
            cameraSpeedSlider.addEventListener("input", () => {
                options.cameraSpeed = parseInt(cameraSpeedSlider.value);
                cameraSpeedValue.textContent = options.cameraSpeed;
            });
        }
        
        // 更新网格高亮
        function updateGridHighlight() {
            const gridSize = options.gridSize * gameState.scale;
            const spacing = options.gridSpacing * gameState.scale;
            const renderSize = gridSize - spacing * 2;
            
            const screenX = (gameState.mouse.gridX - gameState.camera.x) * gridSize + options.width/2;
            const screenY = (gameState.mouse.gridY - gameState.camera.y) * gridSize + options.height/2;
            
            gridHighlight.style.display = "block";
            gridHighlight.style.width = `${renderSize}px`;
            gridHighlight.style.height = `${renderSize}px`;
            gridHighlight.style.left = `${screenX - gridSize/2 + spacing}px`;
            gridHighlight.style.top = `${screenY - gridSize/2 + spacing}px`;
            
            gridCoords.style.display = "block";
            gridCoords.textContent = `(${gameState.mouse.gridX}, ${gameState.mouse.gridY})`;
            gridCoords.style.left = `${screenX + gridSize/2 + 5}px`;
            gridCoords.style.top = `${screenY - gridSize/2}px`;
        }
        
        // 网格类
        class Grid {
            static cache = new Map();
            
            static find(x, y) {
                const key = `${x}/${y}`;
                if (Grid.cache.has(key)) {
                    return Grid.cache.get(key);
                }
                
                const grid = new Grid(x, y);
                Grid.cache.set(key, grid);
                return grid;
            }
            
            constructor(x, y) {
                this.x = x;
                this.y = y;
                this.color = this.generateColor(x, y);
            }
            
            generateColor(x, y) {
                // 基于位置生成颜色
                const hue = (Math.abs(x * y) * 7) % 360;
                const saturation = 60 + (Math.abs(x + y) % 20;
                const lightness = 40 + (Math.abs(x - y) % 15;
                return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            }
            
            draw(ctx, cameraX, cameraY, scale) {
                const gridSize = options.gridSize * scale;
                const spacing = options.gridSpacing * scale;
                const renderSize = gridSize - spacing * 2;
                
                const screenX = (this.x - cameraX) * gridSize + options.width/2;
                const screenY = (this.y - cameraY) * gridSize + options.height/2;
                
                // 检查网格是否在可见区域内
                if (
                    screenX + gridSize/2 < 0 || 
                    screenX - gridSize/2 > options.width || 
                    screenY + gridSize/2 < 0 || 
                    screenY - gridSize/2 > options.height
                ) {
                    return false;
                }
                
                // 绘制网格
                ctx.fillStyle = this.color;
                ctx.fillRect(
                    screenX - gridSize/2 + spacing,
                    screenY - gridSize/2 + spacing,
                    renderSize,
                    renderSize
                );
                
                // 绘制网格边框
                ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
                ctx.lineWidth = 1;
                ctx.strokeRect(
                    screenX - gridSize/2 + spacing,
                    screenY - gridSize/2 + spacing,
                    renderSize,
                    renderSize
                );
                
                return true;
            }
        }
        
        // 更新相机位置
        function updateCamera(deltaTime) {
            // 平滑移动相机
            const lerpFactor = 0.2;
            gameState.camera.x += (gameState.targetCamera.x - gameState.camera.x) * lerpFactor;
            gameState.camera.y += (gameState.targetCamera.y - gameState.camera.y) * lerpFactor;
            
            // 处理键盘移动
            const moveSpeed = options.cameraSpeed * 0.05 * deltaTime / gameState.scale;
            
            if (gameState.keys["w"] || gameState.keys["arrowup"]) {
                gameState.targetCamera.y -= moveSpeed;
            }
            if (gameState.keys["s"] || gameState.keys["arrowdown"]) {
                gameState.targetCamera.y += moveSpeed;
            }
            if (gameState.keys["a"] || gameState.keys["arrowleft"]) {
                gameState.targetCamera.x -= moveSpeed;
            }
            if (gameState.keys["d"] || gameState.keys["arrowright"]) {
                gameState.targetCamera.x += moveSpeed;
            }
        }
        
        // 渲染函数
        function render() {
            // 清除画布
            ctx.fillStyle = options.colors.background;
            ctx.fillRect(0, 0, options.width, options.height);
            
            // 计算可见网格范围
            const gridSize = options.gridSize * gameState.scale;
            const startX = Math.floor(gameState.camera.x - (options.width / 2) / gridSize - 1);
            const endX = Math.ceil(gameState.camera.x + (options.width / 2) / gridSize + 1);
            const startY = Math.floor(gameState.camera.y - (options.height / 2) / gridSize - 1);
            const endY = Math.ceil(gameState.camera.y + (options.height / 2) / gridSize + 1);
            
            // 渲染可见网格
            let renderedCount = 0;
            for (let y = startY; y <= endY; y++) {
                for (let x = startX; x <= endX; x++) {
                    const grid = Grid.find(x, y);
                    if (grid.draw(ctx, gameState.camera.x, gameState.camera.y, gameState.scale)) {
                        renderedCount++;
                    }
                }
            }
            
            gameState.renderedGrids = renderedCount;
        }
        
        // 更新FPS计数器
        function updateFpsCounter() {
            gameState.frameCount++;
            const now = Date.now();
            const delta = now - gameState.lastFpsUpdate;
            
            if (delta >= 1000) {
                gameState.fps = Math.round((gameState.frameCount * 1000) / delta);
                gameState.frameCount = 0;
                gameState.lastFpsUpdate = now;
            }
        }
        
        // 更新UI显示
        function updateUI() {
            gridCountElement.textContent = gameState.renderedGrids;
            fpsCounterElement.textContent = gameState.fps;
            cameraXElement.textContent = gameState.camera.x.toFixed(2);
            cameraYElement.textContent = gameState.camera.y.toFixed(2);
        }
        
        // 游戏主循环
        function gameLoop() {
            const now = Date.now();
            const deltaTime = (now - gameState.lastUpdate) / 1000;
            gameState.lastUpdate = now;
            
            updateCamera(deltaTime);
            render();
            updateFpsCounter();
            updateUI();
            requestAnimationFrame(gameLoop);
        }
        
        // 初始化函数
        function init() {
            updateCanvasSize();
            initEventListeners();
            gameLoop();
        }
        
        // 启动游戏
        init();