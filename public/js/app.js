/**
 * CPS Test Game Application
 * @description 模块化的 CPS 测试游戏应用
 */
(function() {
    'use strict';

    // ==================== 配置常量 ====================
    const CONFIG = {
        // 游戏配置
        DEFAULT_DURATION: 10,
        UPDATE_INTERVAL: 100,

        // Combo 系统配置
        COMBO_THRESHOLD: 500,        // combo 判定时间窗口 (ms)
        COMBO_DISPLAY_THRESHOLD: 10, // 显示 combo 的最小值

        // 能量条配置
        POWER_DECAY_RATE: 2,         // 能量衰减速率
        POWER_INCREMENT: 5,          // 每次点击增加的能量
        CLICK_DECAY_TIME: 2000,      // 点击记录保留时间 (ms)
        POWER_FULL: 100,             // 能量满值
        POWER_HIGH: 80,              // 高能量阈值
        POWER_MEDIUM: 50,            // 中等能量阈值

        // 粒子系统配置
        PARTICLE_COUNT: 12,
        PARTICLE_MIN_SIZE: 4,
        PARTICLE_MAX_SIZE: 8,
        PARTICLE_COLORS: ['#00d4ff', '#ff9500', '#ff4444', '#FFD700', '#FF69B4', '#00FF7F'],
        MAX_PARTICLES: 100,          // 最大粒子数量限制
        PARTICLE_THROTTLE: 100,      // 粒子创建节流时间 (ms)

        // 能量溢出粒子配置
        OVERFLOW_PARTICLE_COUNT: 8,
        OVERFLOW_MIN_SIZE: 3,
        OVERFLOW_MAX_SIZE: 6,

        // 动画配置
        RIPPLE_DURATION: 600,
        NUMBER_FLOAT_DURATION: 800,
        COMBO_TIMEOUT_DELAY: 500
    };

    // ==================== 游戏状态管理 ====================
    const gameState = {
        duration: CONFIG.DEFAULT_DURATION,
        running: false,
        clickCount: 0,
        startTime: 0,
        intervalId: null,
        endTimeoutId: null,
        testFinished: false,

        // DOM 元素缓存
        elements: {},

        /**
         * 初始化 DOM 元素缓存
         */
        initElements() {
            this.elements = {
                clickCount: document.getElementById('clickCount'),
                timerDisplay: document.getElementById('timerDisplay'),
                cpsDisplay: document.getElementById('cpsDisplay'),
                circle: document.getElementById('circle'),
                timeBtns: document.querySelectorAll('.seconds a')
            };

            // 验证必需元素存在
            const required = ['clickCount', 'timerDisplay', 'cpsDisplay', 'circle'];
            for (const key of required) {
                if (!this.elements[key]) {
                    console.error(`Required element missing: ${key}`);
                }
            }
        },

        /**
         * 重置游戏状态
         */
        reset() {
            this.running = false;
            this.testFinished = false;
            this.clearTimers();

            this.clickCount = 0;
            this.updateDisplays(formatTime(this.duration), '0.00', '0');

            powerMeter.reset();
        },

        /**
         * 清理所有定时器
         */
        clearTimers() {
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
            if (this.endTimeoutId) {
                clearTimeout(this.endTimeoutId);
                this.endTimeoutId = null;
            }
        },

        /**
         * 更新显示
         */
        updateDisplays(timer, cps, count) {
            if (this.elements.timerDisplay) this.elements.timerDisplay.textContent = timer;
            if (this.elements.cpsDisplay) this.elements.cpsDisplay.textContent = cps;
            if (this.elements.clickCount) this.elements.clickCount.textContent = count;
        }
    };

    // ==================== 工具函数 ====================
    /**
     * 时间格式化（秒 -> 秒.毫秒）
     */
    function formatTime(seconds) {
        const secs = Math.floor(seconds);
        const ms = Math.floor((seconds % 1) * 100);
        return `${secs}.${ms.toString().padStart(2, '0')}`;
    }

    /**
     * 防抖函数
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // ==================== 计时器系统 ====================
    const timerSystem = {
        /**
         * 更新运行状态
         */
        update() {
            const elapsed = (Date.now() - gameState.startTime) / 1000;
            const remaining = Math.max(gameState.duration - elapsed, 0);
            gameState.updateDisplays(
                formatTime(remaining),
                (elapsed > 0 ? (gameState.clickCount / elapsed) : 0).toFixed(2),
                gameState.clickCount.toString()
            );
        },

        /**
         * 开始计时
         */
        start() {
            gameState.clearTimers();
            gameState.intervalId = setInterval(this.update, CONFIG.UPDATE_INTERVAL);
            gameState.endTimeoutId = setTimeout(
                () => timerSystem.end(),
                gameState.duration * 1000
            );
        },

        /**
         * 结束测试
         */
        end() {
            gameState.running = false;
            gameState.testFinished = true;
            gameState.clearTimers();

            const cps = gameState.duration > 0
                ? (gameState.clickCount / gameState.duration)
                : 0;
            gameState.updateDisplays(
                formatTime(0),
                cps.toFixed(2),
                gameState.clickCount.toString()
            );

            powerMeter.reset();
        }
    };

    // ==================== 粒子系统 ====================
    const particleSystem = {
        activeParticles: 0,

        /**
         * 创建粒子爆炸效果
         */
        createExplosion(x, y, rect) {
            // 限制粒子数量
            if (this.activeParticles >= CONFIG.MAX_PARTICLES) {
                return;
            }

            for (let i = 0; i < CONFIG.PARTICLE_COUNT; i++) {
                this.createParticle(x, y, rect, i);
            }
        },

        /**
         * 创建单个粒子
         */
        createParticle(x, y, rect, index) {
            const particle = document.createElement('div');
            particle.className = 'particle';

            const size = Math.random() * (CONFIG.PARTICLE_MAX_SIZE - CONFIG.PARTICLE_MIN_SIZE)
                + CONFIG.PARTICLE_MIN_SIZE;
            particle.style.width = size + 'px';
            particle.style.height = size + 'px';

            const color = CONFIG.PARTICLE_COLORS[
                Math.floor(Math.random() * CONFIG.PARTICLE_COLORS.length)
            ];
            particle.style.background = color;
            particle.style.boxShadow = `0 0 ${size}px ${color}`;

            const startX = x - rect.left;
            const startY = y - rect.top;
            particle.style.left = startX + 'px';
            particle.style.top = startY + 'px';

            const angle = (Math.PI * 2 * index) / CONFIG.PARTICLE_COUNT;
            const distance = Math.random() * 100 + 50;
            const tx = Math.cos(angle) * distance;
            const ty = Math.sin(angle) * distance;

            particle.style.setProperty('--tx', tx + 'px');
            particle.style.setProperty('--ty', ty + 'px');

            particle.style.animation = `particle-explode ${Math.random() * 0.3 + 0.4}s ease-out forwards`;

            gameState.elements.circle.appendChild(particle);
            this.activeParticles++;

            particle.addEventListener('animationend', () => {
                particle.remove();
                this.activeParticles--;
            });
        },

        /**
         * 创建点击数字效果
         */
        createClickNumber(x, y, rect) {
            const number = document.createElement('div');
            number.className = 'click-number';
            number.textContent = '+1';

            number.style.left = (x - rect.left - 20) + 'px';
            number.style.top = (y - rect.top - 30) + 'px';

            gameState.elements.circle.appendChild(number);

            number.addEventListener('animationend', () => {
                number.remove();
            });
        }
    };

    // ==================== Combo 系统 ====================
    const comboSystem = {
        count: 0,
        lastClickTime: 0,
        comboTimeout: null,
        display: null,
        number: null,

        /**
         * 初始化
         */
        init() {
            this.display = document.getElementById('comboDisplay');
            this.number = document.getElementById('comboNumber');
        },

        /**
         * 处理点击
         */
        handleClick() {
            const now = Date.now();

            if (now - this.lastClickTime < CONFIG.COMBO_THRESHOLD) {
                this.count++;
            } else {
                this.count = 1;
            }

            this.lastClickTime = now;
            this.updateDisplay();

            clearTimeout(this.comboTimeout);
            this.comboTimeout = setTimeout(() => {
                this.reset();
            }, CONFIG.COMBO_THRESHOLD);
        },

        /**
         * 更新显示
         */
        updateDisplay() {
            if (!this.number) return;

            this.number.textContent = 'x' + this.count;

            if (this.count >= CONFIG.COMBO_DISPLAY_THRESHOLD) {
                this.display.classList.add('active');
                this.display.classList.remove('combo-increase');
                void this.display.offsetWidth;
                this.display.classList.add('combo-increase');
            } else {
                this.display.classList.remove('active');
            }

            this.updateColor();
        },

        /**
         * 更新颜色
         */
        updateColor() {
            if (!this.number) return;

            if (this.count >= 50) {
                this.number.style.color = '#ff0040';
                this.number.style.textShadow = '0 0 20px rgba(255, 0, 64, 0.8), 0 0 40px rgba(255, 0, 64, 1)';
            } else if (this.count >= 30) {
                this.number.style.color = '#ff6347';
                this.number.style.textShadow = '0 0 20px rgba(255, 99, 71, 0.8), 0 0 40px rgba(255, 99, 71, 1)';
            } else if (this.count >= CONFIG.COMBO_DISPLAY_THRESHOLD) {
                this.number.style.color = '#fff';
                this.number.style.textShadow = '0 0 20px rgba(255, 255, 255, 0.8), 0 0 40px rgba(255, 215, 0, 0.6)';
            }
        },

        /**
         * 重置
         */
        reset() {
            this.count = 0;
            if (this.display) {
                this.display.classList.remove('active', 'combo-increase');
            }
            if (this.number) {
                this.number.textContent = 'x0';
            }
        }
    };

    // ==================== 能量条系统 ====================
    const powerMeter = {
        textCenter: null,
        powerLevel: 0,
        clickTimes: [],
        decayInterval: null,
        lastParticleTime: 0,

        /**
         * 初始化
         */
        init() {
            this.textCenter = document.querySelector('.text-center');
            this.startDecay();
        },

        /**
         * 重置
         */
        reset() {
            this.powerLevel = 0;
            this.clickTimes = [];
            this.updateDisplay();
        },

        /**
         * 处理点击
         */
        handleClick() {
            const now = Date.now();
            this.clickTimes.push(now);
            this.clickTimes = this.clickTimes.filter(time => now - time < CONFIG.CLICK_DECAY_TIME);
            this.powerLevel = Math.min(this.powerLevel + CONFIG.POWER_INCREMENT, CONFIG.POWER_FULL);
            this.updateDisplay();
        },

        /**
         * 开始衰减
         */
        startDecay() {
            this.decayInterval = setInterval(() => {
                if (this.powerLevel > 0 && this.powerLevel < CONFIG.POWER_FULL) {
                    this.powerLevel = Math.max(this.powerLevel - CONFIG.POWER_DECAY_RATE, 0);
                    this.updateDisplay();
                }
            }, CONFIG.UPDATE_INTERVAL);
        },

        /**
         * 更新显示
         */
        updateDisplay() {
            if (!this.textCenter) return;

            this.textCenter.style.setProperty('--power-width', this.powerLevel + '%');
            this.textCenter.classList.remove('orange', 'overload', 'shake', 'overflowing');

            if (this.powerLevel >= CONFIG.POWER_FULL) {
                this.textCenter.classList.add('overload', 'shake', 'overflowing');
                const now = Date.now();
                if (now - this.lastParticleTime > CONFIG.PARTICLE_THROTTLE) {
                    this.createOverflowParticles();
                    this.lastParticleTime = now;
                }
            } else if (this.powerLevel >= CONFIG.POWER_HIGH) {
                this.textCenter.classList.add('overload', 'shake');
            } else if (this.powerLevel >= CONFIG.POWER_MEDIUM) {
                this.textCenter.classList.add('orange');
            }
        },

        /**
         * 创建溢出粒子
         */
        createOverflowParticles() {
            const rect = this.textCenter.getBoundingClientRect();

            for (let i = 0; i < CONFIG.OVERFLOW_PARTICLE_COUNT; i++) {
                const particle = document.createElement('div');
                particle.className = 'energy-particle';

                const size = Math.random() * (CONFIG.OVERFLOW_MAX_SIZE - CONFIG.OVERFLOW_MIN_SIZE)
                    + CONFIG.OVERFLOW_MIN_SIZE;
                particle.style.width = size + 'px';
                particle.style.height = size + 'px';

                const color = CONFIG.PARTICLE_COLORS[
                    Math.floor(Math.random() * CONFIG.PARTICLE_COLORS.length)
                ];
                particle.style.background = color;
                particle.style.boxShadow = `0 0 ${size * 2}px ${color}`;

                const startX = rect.width - 5;
                const startY = Math.random() * rect.height;

                particle.style.left = (rect.left + startX) + 'px';
                particle.style.top = (rect.top + startY) + 'px';

                const ox = Math.random() * 60 + 30;
                const oy = (Math.random() - 0.5) * 80;

                particle.style.setProperty('--ox', ox + 'px');
                particle.style.setProperty('--oy', oy + 'px');

                particle.style.animation = `energy-overflow ${Math.random() * 0.4 + 0.3}s ease-out forwards`;

                document.body.appendChild(particle);

                particle.addEventListener('animationend', () => {
                    particle.remove();
                });
            }
        }
    };

    // ==================== UI 控制器 ====================
    const uiController = {
        /**
         * 初始化事件监听器
         */
        initEventListeners() {
            // 时间按钮点击事件
            gameState.elements.timeBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    gameState.duration = parseInt(btn.getAttribute('data-seconds'), 10);
                    gameState.updateDisplays(formatTime(gameState.duration), '0.00', '0');
                    gameState.reset();
                });
            });

            // 禁用右键菜单
            gameState.elements.circle.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
            });

            // 点击圆形区域事件
            gameState.elements.circle.addEventListener('click', (e) => {
                this.handleClickArea(e);
            });

            // 禁用浏览器默认行为
            this.initBrowserBehavior();
        },

        /**
         * 处理点击区域
         */
        handleClickArea(e) {
            const rect = gameState.elements.circle.getBoundingClientRect();

            // 波纹效果
            this.createRipple(e, rect);

            // 测试完成后不处理
            if (gameState.testFinished) {
                return;
            }

            // 开始测试并计数
            if (!gameState.running) {
                gameState.running = true;
                gameState.testFinished = false;
                gameState.clickCount = 0;
                gameState.startTime = Date.now();
                gameState.updateDisplays(formatTime(gameState.duration), '0.00', '0');
                powerMeter.reset();
                timerSystem.start();
            }

            gameState.clickCount++;
            powerMeter.handleClick();

            // 视觉特效
            particleSystem.createExplosion(e.clientX, e.clientY, rect);
            particleSystem.createClickNumber(e.clientX, e.clientY, rect);
            comboSystem.handleClick();
        },

        /**
         * 创建波纹效果
         */
        createRipple(e, rect) {
            const size = Math.max(rect.width, rect.height);
            const ripple = document.createElement('span');
            ripple.className = 'ripple';

            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;

            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';

            gameState.elements.circle.appendChild(ripple);

            ripple.addEventListener('animationend', () => {
                ripple.remove();
            });
        },

        /**
         * 初始化浏览器行为禁用
         */
        initBrowserBehavior() {
            // 禁用右键菜单
            document.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                return false;
            });

            // 禁用文本选择
            document.addEventListener('selectstart', (e) => {
                e.preventDefault();
                return false;
            });

            // 禁用拖拽
            document.addEventListener('dragstart', (e) => {
                e.preventDefault();
                return false;
            });
        }
    };

    // ==================== 应用初始化 ====================
    /**
     * 初始化应用
     */
    function init() {
        try {
            gameState.initElements();
            comboSystem.init();
            powerMeter.init();
            uiController.initEventListeners();

            // 初始化显示
            gameState.updateDisplays(formatTime(gameState.duration), '0.00', '0');

            console.log('CPS Test Application initialized successfully');
        } catch (error) {
            console.error('Failed to initialize application:', error);
        }
    }

    // DOM 加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
