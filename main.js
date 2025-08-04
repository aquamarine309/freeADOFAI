const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");

// 更新Canvas尺寸
function updateCanvasSize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  options.width = canvas.width;
  options.height = canvas.height;
}

window.addEventListener("resize", updateCanvasSize);

function loadImages(fileNames, callback) {
  const images = {};
  let loadedCount = 0;
  const totalCount = fileNames.length;
  
  for (const name of fileNames) {
    const path = `./images/${name}.png`;
    const img = new Image();
    img.src = path;
    images[name] = img;
    img.onload = function() {
      loadedCount++;
      if (loadedCount === totalCount) {
        callback(images);
      }
    }
  }
  return images;
}

const GameImages = loadImages(["coin", "swirl", "texture", "stab", "blur", "speedUp", "speedDown", "sameSpeed", "miss"], function(images) {
  console.log("所有图片加载完成");
  init();
});

const options = {
  get size() {
    return this.width / 8;
  },
  width: 0,
  height: 0,
  bpm: 180,
  notation: new ADNotations.ScientificNotation()
};


// Speed: angle per second
function bpmToSpeed(bpm) {
  return bpm * Math.PI / 60;
}

// 坐标转换函数
function coordinatesToCanvas(x, y) {
  return {
    x: x * options.size,
    y: y * options.size
  }
}

// 游戏主循环
function gameLoop() {
  const now = Date.now();
  const diff = now - player.lastUpdate;
  player.lastUpdate = now;
  
  if (!player.failed) {
    player.angle += diff / 1000 * bpmToSpeed(options.bpm) * (player.direction ? 1 : -1);
    player.angle %= Math.PI * 2;
    if (player.angle < 0) {
      player.angle += Math.PI * 2;
    }
    const next = findNextPos(0.05);
    if (next !== null) {
      const objects = Grid.find(player.targetX + next[0],   player.targetY + next[1]).objects;
      for (const obj of objects) {
        obj.onMeet();
      }
    }
  }
  render(diff / 1000);
  requestAnimationFrame(gameLoop);
}

// 渲染函数
function render(deltaTime) {
  // 清除画布
  ctx.clearRect(0, 0, options.width, options.height);
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, options.width, options.height);
  
  // 更新相机
  updateCamera(deltaTime);
  
  // 计算可见区域
  const gridSize = options.size;
  const startX = Math.floor(player.camera.x - options.width / (2 * gridSize));
  const endX = Math.ceil(player.camera.x + options.width / (2 * gridSize));
  const startY = Math.floor(player.camera.y - options.height / (2 * gridSize));
  const endY = Math.ceil(player.camera.y + options.height / (2 * gridSize));
  
  // 渲染可见网格
  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      const grid = Grid.find(x, y);
      grid.draw();
    }
  }
  
  // 渲染游戏对象（硬币）
  for (const obj of gameMap.objects) {
    obj.tick(deltaTime);
    if (isInView(obj.grid.x, obj.grid.y)) {
      const pos = coordinatesToCanvas(obj.grid.x - player.camera.x, obj.grid.y - player.camera.y);
      const cutPos = obj.position;
      const size = options.size * 0.6 * obj.size;
      ctx.drawImage(
        obj.image,
        cutPos.x,
        cutPos.y,
        obj.width,
        obj.height,
        options.width / 2 + pos.x - size / 2,
        options.height / 2 + pos.y - size / 2,
        size,
        size,
      );
    }
  }
  
  
  if (!player.failed) {
    const currentPosition = coordinatesToCanvas(player.targetX - player.camera.x, player.targetY - player.camera.y);
    const currentX = currentPosition.x + options.width / 2;
    const currentY = currentPosition.y + options.height / 2;
  
    ctx.setLineDash([Math.PI * options.size / 19.2, Math.PI * options.size / 32]);
    ctx.strokeStyle = getCenterColor();
    ctx.beginPath();
    ctx.arc(currentX, currentY, options.size, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    const angle = player.angle;
    const historyPos = [
      currentX + options.size * Math.cos(angle),
      currentY + options.size * Math.sin(angle)
    ];
    
   updateHistory(historyPos);
  
    ctx.fillStyle = getCenterColor();
    ctx.beginPath();
    ctx.arc(currentX, currentY, options.size / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = getMovingColor();
    for (let i = 0; i < history.length; i++) {
      ctx.globalAlpha = `${1 - i / 10}`;
      ctx.beginPath();
      ctx.arc(
        history[i][0],
        history[i][1],
        options.size / 4 * (1 - i / 10),
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.globalAlpha = "1";
  } else {
    ctx.textAlign = "center";
    ctx.font = "25px sans-serif";
    fillText("Click to restart game.", options.width / 2, options.height * 0.8);
    fillText("~>_<~", options.width / 2, options.height * 0.8 + 25);
  }
  
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.textBaseline = "middle";
  ctx.fillRect(options.width - 140, 0, 140, player.expanded ? 200 : 20);
  ctx.textAlign = "left";
  ctx.font = "22px sans-serif";
  fillText(`${format(player.coins)}`, options.width - 90, 30);
  fillText(`${formatInt(player.failCount)}`, options.width - 90, 80);
  ctx.drawImage(
    GameImages.coin,
    0,
    0,
    96,
    128,
    options.width - 130,
    15,
    21,
    28
  );
  ctx.drawImage(
    GameImages.miss,
    options.width - 130,
    68,
    21,
    21
  );
}

function fillText(text, x, y) {
    ctx.fillStyle = "black";
    ctx.fillText(text, x + 2, y);
    ctx.fillStyle = "white";
    ctx.fillText(text, x, y);
}

// 检查对象是否在视口内
function isInView(x, y) {
  const gridSize = options.size;
  const viewLeft = player.camera.x - options.width / (2 * gridSize);
  const viewRight = player.camera.x + options.width / (2 * gridSize);
  const viewTop = player.camera.y - options.height / (2 * gridSize);
  const viewBottom = player.camera.y + options.height / (2 * gridSize);
  
  return x >= viewLeft && x <= viewRight && y >= viewTop && y <= viewBottom;
}

// 更新相机位置
function updateCamera(deltaTime) {
  const lerpFactor = 1 - Math.pow(0.01, deltaTime);
  player.camera.x += (player.targetX - player.camera.x) * lerpFactor;
  player.camera.y += (player.targetY - player.camera.y) * lerpFactor;
}

let history = [];

function updateHistory(pos) {
  history.unshift(pos);
  if (history.length > 10) {
    history.pop();
  }
}

// 网格类
class Grid {
  static cache = new Map();
  
  static find(x, y) {
    const key = `${x}/${y}`;
    if (Grid.cache.has(key)) {
      return Grid.cache.get(key);
    }
    return new Grid(x, y);
  }
  
  objects = new Set();
  visible = true;
  reached = false;
  
  textureX = Math.random() * 1920;
  textureY = Math.random() * 1920;
  
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.position = coordinatesToCanvas(this.x, this.y);
    this.key = `${this.x}/${this.y}`;
    this.color = this.generateColor(x, y);
    Grid.cache.set(this.key, this);
  }
  
  
  addObject(obj) {
    this.objects.add(obj);
    this.updateVisibility();
  }
  
  removeObject(obj) {
    this.objects.delete(obj);
    this.updateVisibility();
  }
  
  updateVisibility() {
    for (const obj of this.objects) {
      if (obj.data.hideGrid) {
        this.visible = false;
        return;
      }
    }
    this.visible = true;
  }
  
  // 生成固定颜色（根据坐标）
  generateColor(x, y) {
    return "#ac98aa";
  }
  
  draw() {
    if (!this.visible) return;
    const gridSize = options.size * 0.8;
    const screenX = options.width / 2 + (this.x - player.camera.x) * options.size;
    const screenY = options.height / 2 + (this.y - player.camera.y) * options.size;
    
    // 只绘制在视口内的网格
    if (
      screenX < -gridSize || 
      screenX > options.width + gridSize ||
      screenY < -gridSize || 
      screenY > options.height + gridSize
    ) {
      return;
    }
    
    // 绘制网格
    ctx.fillStyle = this.color;
    ctx.fillRect(
      screenX - gridSize / 2,
      screenY - gridSize / 2,
      gridSize,
      gridSize
    );
    
    ctx.globalAlpha = "0.5";
    ctx.drawImage(
      GameImages.texture,
      this.textureX,
      this.textureY,
      128,
      128,
      screenX - gridSize / 2,
      screenY - gridSize / 2,
      gridSize,
      gridSize
    );
    if (this.reached) {
    ctx.globalAlpha = "0.8";
      ctx.drawImage(
        GameImages.blur,
        screenX - gridSize / 2,
        screenY - gridSize / 2,
        gridSize,
        gridSize
      );
    }
    ctx.globalAlpha = "1";
    
    // 绘制网格边框
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      screenX - gridSize / 2,
      screenY - gridSize / 2,
      gridSize,
      gridSize
    );
  }
}

const objectTypes = {
  swirl: {
    onActive() {
      player.direction = !player.direction;
    }
  },
  coin: {
    isSprite: true,
    width: 3,
    height: 3,
    frames: 9,
    cycle: 2,
    onMeet(obj) {
      obj.remove();
      player.coins = player.coins.add(1);
    }
  },
  stab: {
    hideGrid: true,
    size: 1.5,
    onMeet() {
      player.failed = true;
      player.failCount++;
    }
  },
  speed: {
    images: params => {
      if (options.bpm / params.bpm <= 0.97) {
        return "speedUp";
      } else if (options.bpm / params.bpm >= 1.03) {
        return "speedDown";
      }
      return "sameSpeed";
    },
    onActive(obj, params) {
      options.bpm = params.bpm;
    }
  }
}

// 游戏对象类
class GameObject {
  constructor(grid, type, options = {}) {
    this.grid = grid;
    this.type = type;
    this.timer = 0;
    this.options = options;
    this.grid.addObject(this);
  }
  
  get size() {
    return this.data.size ?? 1;
  }
  
  get data() {
    return objectTypes[this.type];
  }
  
  get image() {
    if (this.data.images) {
      return GameImages[this.data.images(this.options.params)];
    }
    return GameImages[this.type];
  }
  
  tick(diff) {
    this.timer += diff;
  }
  
  get frame() {
    if (!this.data.isSprite) return 1;
    return Math.floor(((this.timer / this.data.cycle) % 1) * this.data.frames);
  }
  
  get width() {
    if (!this.data.isSprite) return this.image.width;
    return this.image.width / this.data.width;
  }
  
  get height() {
    if (!this.data.isSprite) return this.image.height;
    return this.image.height / this.data.height;
  }
  
  get position() {
    if (!this.data.isSprite) return { x: 0, y: 0 };
    return {
      x: this.width * (this.frame % this.data.width),
      y: this.height * Math.floor(this.frame / this.data.width)
    };
  }
  
  get isCurrent() {
    return this.grid.x === player.targetX && this.grid.y === player.targetY;
  }
  
  remove() {
    this.grid.removeObject(this);
    gameMap.objects.delete(this);
  }
  
  onActive() {
    if (this.data.onActive) {
      this.data.onActive(this, this.options.params);
    } else if (this.data.onMeet) {
      this.data.onMeet(this, this.options.params);
    }
  }
  
  onMeet() {
    if (this.data.onMeet) {
      this.data.onMeet(this, this.options.params);
    }
  }
}

window.format = function format(value, places = 0, placesUnder1000 = 0) {
  return options.notation.format(value, places, placesUnder1000, 3);
};

window.formatInt = function formatInt(value) {
  if (options.notation.name !== "Standard") {
    return format(value, 2);
  }
  return formatWithCommas(typeof value === "number" ? value.toFixed(0) : value.toNumber().toFixed(0));
};

window.formatFloat = function formatFloat(value, digits) {
  return formatWithCommas(value.toFixed(digits));
};

window.formatX = function formatX(value, places, placesUnder1000) {
  return `×${format(value, places, placesUnder1000)}`;
};

window.formatPow = function formatPow(value, places, placesUnder1000) {
  return `^${format(value, places, placesUnder1000)}`;
};

window.formatPercents = function formatPercents(value, places) {
  return `${format(value * 100, 2, places)}%`;
};

const commaRegexp = /\B(?=(\d{3})+(?!\d))/gu;
window.formatWithCommas = function formatWithCommas(value) {
  const decimalPointSplit = value.toString().split(".");
  decimalPointSplit[0] = decimalPointSplit[0].replace(commaRegexp, ",");
  return decimalPointSplit.join(".");
};

window.isSingular = function isSingular(amount) {
  if (typeof amount === "number") return amount === 1;
  if (amount instanceof Decimal) return amount.eq(1);
  throw `Amount must be either a number or Decimal. Instead, amount was ${amount}`;
};

const PLURAL_HELPER = new Map([
  [/y$/u, "ies"],
  [/x$/u, "xes"],
  [/$/u, "s"]
]);

const pluralDatabase = new Map([]);

window.pluralize = function pluralize(word, amount, plural) {
  if (word === undefined || amount === undefined) throw "Arguments must be defined";

  if (isSingular(amount)) return word;
  const existingPlural = plural ?? pluralDatabase.get(word);
  if (existingPlural !== undefined) return existingPlural;

  const newWord = generatePlural(word);
  pluralDatabase.set(word, newWord);
  return newWord;
};

window.generatePlural = function generatePlural(word) {
  for (const [match, replaceWith] of PLURAL_HELPER.entries()) {
    const newWord = word.replace(match, replaceWith);
    if (word !== newWord) return newWord;
  }
  return word;
};

window.quantify = function quantify(name, value, places, placesUnder1000, formatType = format) {
  if (name === undefined || value === undefined) throw "Arguments must be defined";

  const number = formatType(value, places, placesUnder1000);
  const plural = pluralize(name, value);
  return `${number} ${plural}`;
};

window.quantifyInt = function quantifyInt(name, value) {
  if (name === undefined || value === undefined) throw "Arguments must be defined";

  const number = formatInt(value);
  const plural = pluralize(name, value);
  return `${number} ${plural}`;
};

window.makeEnumeration = function makeEnumeration(items) {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  const commaSeparated = items.slice(0, items.length - 1).join(", ");
  const last = items[items.length - 1];
  return `${commaSeparated}, and ${last}`;
};


// 游戏地图
const gameMap = {
  objects: new Set()
};

// 玩家对象
const player = {
  lastUpdate: Date.now(),
  coins: new Decimal(0),
  camera: {
    x: 0,
    y: 0
  },
  targetX: 0,
  targetY: 0,
  angle: Math.PI,
  red: true,
  direction: true,
  failed: false,
  failCount: 0,
  expanded: true
};

function restart() {
  player.targetX = 0;
  player.targetY = 0;
  player.failed = false;
  player.red = true;
  player.direction = true;
  player.angle = Math.PI;
  player.coins = new Decimal(0);
  options.bpm = 180;
  for (const grid of Grid.cache) {
    grid[1].objects = new Set();
    grid[1].updateVisibility();
    grid[1].reached = false;
  }
  gameMap.objects = new Set();
  generateRandomObj();
}

const colors = {
  red: "#ff0000",
  blue: "#0000ff"
}

function getCenterColor() {
  return player.red ? colors.red : colors.blue;
}

function getMovingColor() {
  return player.red ? colors.blue : colors.red;
}

function generateRandomObj() {
  for (let i = 0; i < 100; i++) {
    for (const key in objectTypes) {
      const x = Math.floor(Math.random() * 100 - 50);
      const y = Math.floor(Math.random() * 100 - 50);
      const grid = Grid.find(x, y);
      let options = {};
      if (key === "speed") {
        options = {
          params: {
            bpm: Math.floor(Math.random() * 180 + 60)
          }
        };
      }
      gameMap.objects.add(new GameObject(grid, key, options));
    }
  }
}

// 初始化函数
function init() {
  updateCanvasSize();
  
  // 创建一些测试硬币
  generateRandomObj();
  
  // 设置玩家初始位置
  player.targetX = 0;
  player.targetY = 0;
  
  // 启动游戏循环
  requestAnimationFrame(gameLoop);
}


function findNextPos(range = 0.25) {
  const pi = Math.PI;
  const angle = player.angle;
  if (angle >= pi * (2 - range) || angle < pi * range) {
    return [1, 0];
  } else if (angle >= pi * (0.5 - range) && angle < pi * (0.5 + range)) {
    return [0, 1];
  } else if (angle >= pi * (1 - range) && angle < pi * (1 + range)) {
    return [-1, 0];
  } else if (angle >= pi * (1.5 - range) && angle < pi * (1.5 + range)) {
    return [0, -1];
  }
  return null;
}

canvas.addEventListener("click", function() {
  if (player.failed) {
    restart();
    return;
  }
  const pi = Math.PI;
  const next = findNextPos();
  player.targetX += next[0];
  player.targetY += next[1];
  player.angle += pi;
  player.angle %= pi * 2;
  player.red = !player.red;
  const grid = Grid.find(player.targetX, player.targetY);
  grid.reached = true;
  const objects = grid.objects;
  for (const obj of objects) {
    obj.onActive();
  }
  history = [];
});

Decimal.prototype.valueOf = function() {
  throw new Error("Cannot convert a  Decimal to a number");
}

Decimal.prototype.copyFrom = function(decimal) {
  this.mantissa = decimal.mantissa;
  this.exponent = decimal.exponent;
}