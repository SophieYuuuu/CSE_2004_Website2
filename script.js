const ui = {
  solveBtn: document.getElementById("solveBtn"),
  resetBtn: document.getElementById("resetBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  cityInput: document.getElementById("cityInput"),
  cityBtn: document.getElementById("cityBtn"),
  randomBtn: document.getElementById("randomBtn"),
  locationBtn: document.getElementById("locationBtn"),
  locationLabel: document.getElementById("locationLabel"),
  weatherLabel: document.getElementById("weatherLabel"),
  themeLabel: document.getElementById("themeLabel"),
  introText: document.getElementById("introText"),
  timerText: document.getElementById("timerText"),
  encouragementText: document.getElementById("encouragementText"),
  feedbackText: document.getElementById("feedbackText"),
  difficultyChip: document.getElementById("difficultyChip"),
  difficultyLabel: document.getElementById("difficultyLabel"),
  mazeSizeLabel: document.getElementById("mazeSizeLabel"),
  moodLabel: document.getElementById("moodLabel"),
  canvas: document.getElementById("mazeCanvas"),
};

const ctx = ui.canvas.getContext("2d");

const GEODB_API_KEY = "0c75670fdcmsha4bf4eedaa94522p1ba000jsn8c399f168fe9";
const GEODB_HOST = "wft-geo-db.p.rapidapi.com";

const state = {
  location: null,
  weather: null,
  mood: null,
  maze: null,
  player: { x: 0, y: 0 },
  solvedPath: null,
  size: 14,
  timerStart: null,
  elapsedSeconds: 0,
  timerRunning: false,
  timerInterval: null,
};

function updateTimerDisplay(seconds) {
  if (!ui.timerText) return;
  ui.timerText.textContent = `Timer: ${seconds}s`;
}

async function getRandomUSCity() {
  const randomOffset = Math.floor(Math.random() * 1000);

  const url =
    `https://${GEODB_HOST}/v1/geo/cities` +
    `?countryIds=US` +
    `&minPopulation=50000` +
    `&limit=10` +
    `&offset=${randomOffset}` +
    `&sort=-population`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": GEODB_API_KEY,
        "X-RapidAPI-Host": GEODB_HOST,
      },
    });

    if (!response.ok) {
      throw new Error(`GeoDB request failed: ${response.status}`);
    }

    const result = await response.json();

    if (!result.data || result.data.length === 0) {
      throw new Error("No US cities returned from GeoDB.");
    }

    const picked = result.data[Math.floor(Math.random() * result.data.length)];
    const regionCode = picked.regionCode || "";
    const regionName = picked.region || "";
    const fullName = `${picked.city}, ${regionCode || regionName}`.replace(/, $/, "");

    return {
      city: picked.city,
      stateCode: regionCode,
      state: regionName,
      latitude: picked.latitude,
      longitude: picked.longitude,
      fullName,
    };
  } catch (error) {
    console.error("Failed to fetch random US city:", error);

    const fallbackCities = [
      {
        city: "Seattle",
        stateCode: "WA",
        state: "Washington",
        latitude: 47.6062,
        longitude: -122.3321,
      },
      {
        city: "Denver",
        stateCode: "CO",
        state: "Colorado",
        latitude: 39.7392,
        longitude: -104.9903,
      },
      {
        city: "Boston",
        stateCode: "MA",
        state: "Massachusetts",
        latitude: 42.3601,
        longitude: -71.0589,
      },
      {
        city: "Austin",
        stateCode: "TX",
        state: "Texas",
        latitude: 30.2672,
        longitude: -97.7431,
      },
      {
        city: "Miami",
        stateCode: "FL",
        state: "Florida",
        latitude: 25.7617,
        longitude: -80.1918,
      },
    ];

    const picked =
      fallbackCities[Math.floor(Math.random() * fallbackCities.length)];

    return {
      ...picked,
      fullName: `${picked.city}, ${picked.stateCode}`,
    };
  }
}

const weatherCodes = {
  clear: [0, 1],
  cloudy: [2, 3],
  fog: [45, 48],
  drizzle: [51, 53, 55, 56, 57],
  rain: [61, 63, 65, 80, 81, 82],
  snow: [71, 73, 75, 77, 85, 86],
  storm: [95, 96, 99],
};

const tempBands = [
  {
    min: -Infinity,
    max: 31.99,
    difficulty: "Very Easy",
    size: 12,
    theme: { name: "Frost Grid", wall: "#60a5fa", glow: "#93c5fd", bg: "#0b1220" },
  },
  {
    min: 32,
    max: 40.99,
    difficulty: "Easy",
    size: 13,
    theme: { name: "Cold Neon", wall: "#38bdf8", glow: "#22d3ee", bg: "#07131a" },
  },
  {
    min: 41,
    max: 49.99,
    difficulty: "Light",
    size: 14,
    theme: { name: "Breeze Circuit", wall: "#34d399", glow: "#6ee7b7", bg: "#061814" },
  },
  {
    min: 50,
    max: 58.99,
    difficulty: "Normal",
    size: 15,
    theme: { name: "Clear Signal", wall: "#facc15", glow: "#fde047", bg: "#16120a" },
  },
  {
    min: 59,
    max: 67.99,
    difficulty: "Focused",
    size: 16,
    theme: { name: "Amber Sync", wall: "#f97316", glow: "#fdba74", bg: "#1a0f08" },
  },
  {
    min: 68,
    max: 76.99,
    difficulty: "Hard",
    size: 17,
    theme: { name: "Heatline", wall: "#f43f5e", glow: "#fb7185", bg: "#1a0b10" },
  },
  {
    min: 77,
    max: 85.99,
    difficulty: "Very Hard",
    size: 18,
    theme: { name: "Solar Burn", wall: "#e11d48", glow: "#f97316", bg: "#17070a" },
  },
  {
    min: 86,
    max: Infinity,
    difficulty: "Extreme",
    size: 20,
    theme: { name: "Inferno Pulse", wall: "#fb923c", glow: "#facc15", bg: "#120606" },
  },
];

function seededRandom(seed) {
  let t = seed + 0x6d2b79f5;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function dateSeed() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function weatherCategory(code) {
  if (weatherCodes.clear.includes(code)) return "clear";
  if (weatherCodes.cloudy.includes(code)) return "cloudy";
  if (weatherCodes.fog.includes(code)) return "fog";
  if (weatherCodes.drizzle.includes(code)) return "drizzle";
  if (weatherCodes.rain.includes(code)) return "rain";
  if (weatherCodes.snow.includes(code)) return "snow";
  if (weatherCodes.storm.includes(code)) return "storm";
  return "cloudy";
}

function resolveMoodByTemp(tempF) {
  const band =
    tempBands.find((tier) => tempF >= tier.min && tempF <= tier.max) || tempBands[3];
  return { difficulty: band.difficulty, size: band.size, theme: band.theme };
}

function generateNarrative(payload) {
  const { city, weatherText, temperature, difficulty, mood } = payload;
  const introOptions = [
    `Today, ${city} carries a ${weatherText} glow as the maze unfolds.`,
    `${city} reports ${weatherText} with ${temperature}°F, and the challenge awakens.`,
    `Right now in ${city}, ${weatherText} sharpens the maze silhouette.`,
  ];
  const hintOptions = {
    Easy: "Start from the outer edge to find a faster route.",
    Medium: "Check your orientation every three steps to avoid loops.",
    Hard: "Prioritize long corridors to reduce backtracking.",
  };
  const feedbackOptions = [
    `You matched the ${mood} rhythm. The next run will feel smoother.`,
    `Great pace! ${city}'s maze will remember that path.`,
    `Solid execution at ${difficulty} difficulty.`,
  ];

  return {
    intro: introOptions[Math.floor(Math.random() * introOptions.length)],
    hint: hintOptions[difficulty] || hintOptions.Medium,
    feedback: feedbackOptions[Math.floor(Math.random() * feedbackOptions.length)],
  };
}

async function askAI(payload) {
  const response = await fetch("/api/narrative", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return response.json();
}

function extractAIText(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  if (payload.output_text) return payload.output_text;
  if (payload.text) return payload.text;

  const output = payload.output?.[0];
  const content = output?.content?.[0];
  if (typeof content?.text === "string") return content.text;
  if (content?.text?.value) return content.text.value;
  if (content?.value) return content.value;

  return "";
}

async function generateAiNarrative(locationText, weatherText, tempF) {
  const response = await askAI({
    type: "narrative",
    location: locationText,
    weather: weatherText,
    temperature: tempF,
  });
  const text = extractAIText(response).trim();
  return text;
}

async function generateAiEncouragement(locationText) {
  const response = await askAI({
    type: "encouragement",
    location: locationText,
  });
  const text = extractAIText(response).trim();
  return text;
}

function createMaze(size, seed) {
  const rng = seededRandom(seed);
  const grid = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({
      visited: false,
      walls: { top: true, right: true, bottom: true, left: true },
    }))
  );

  const stack = [];
  const start = { x: 0, y: 0 };
  grid[start.y][start.x].visited = true;
  stack.push(start);

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const neighbors = [];

    const dirs = [
      { dx: 0, dy: -1, wall: "top", opposite: "bottom" },
      { dx: 1, dy: 0, wall: "right", opposite: "left" },
      { dx: 0, dy: 1, wall: "bottom", opposite: "top" },
      { dx: -1, dy: 0, wall: "left", opposite: "right" },
    ];

    dirs.forEach((dir) => {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      if (nx >= 0 && nx < size && ny >= 0 && ny < size && !grid[ny][nx].visited) {
        neighbors.push({ x: nx, y: ny, dir });
      }
    });

    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }

    const next = neighbors[Math.floor(rng() * neighbors.length)];
    grid[current.y][current.x].walls[next.dir.wall] = false;
    grid[next.y][next.x].walls[next.dir.opposite] = false;
    grid[next.y][next.x].visited = true;
    stack.push({ x: next.x, y: next.y });
  }

  return grid;
}

function drawMaze() {
  if (!state.maze) return;
  const size = state.size;
  const cell = ui.canvas.width / size;
  ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height);

  const theme = state.mood?.theme || tempBands[3].theme;
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, ui.canvas.width, ui.canvas.height);

  ctx.strokeStyle = theme.wall;
  ctx.lineWidth = 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cellData = state.maze[y][x];
      const px = x * cell;
      const py = y * cell;

      if (cellData.walls.top) {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + cell, py);
        ctx.stroke();
      }
      if (cellData.walls.right) {
        ctx.beginPath();
        ctx.moveTo(px + cell, py);
        ctx.lineTo(px + cell, py + cell);
        ctx.stroke();
      }
      if (cellData.walls.bottom) {
        ctx.beginPath();
        ctx.moveTo(px + cell, py + cell);
        ctx.lineTo(px, py + cell);
        ctx.stroke();
      }
      if (cellData.walls.left) {
        ctx.beginPath();
        ctx.moveTo(px, py + cell);
        ctx.lineTo(px, py);
        ctx.stroke();
      }
    }
  }

  drawPlayer();
  drawGoal();

  if (state.solvedPath) {
    drawPath(state.solvedPath, theme.glow);
  }
}

function drawPlayer() {
  const size = state.size;
  const cell = ui.canvas.width / size;
  const px = state.player.x * cell + cell / 2;
  const py = state.player.y * cell + cell / 2;

  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.arc(px, py, cell * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

function drawGoal() {
  const size = state.size;
  const cell = ui.canvas.width / size;
  const px = (size - 1) * cell + cell / 2;
  const py = (size - 1) * cell + cell / 2;

  ctx.fillStyle = "#22d3ee";
  ctx.beginPath();
  ctx.arc(px, py, cell * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

function drawPath(path, color) {
  const size = state.size;
  const cell = ui.canvas.width / size;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  path.forEach((node, idx) => {
    const x = node.x * cell + cell / 2;
    const y = node.y * cell + cell / 2;
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function movePlayer(dx, dy) {
  if (!state.maze) return;
  const x = state.player.x;
  const y = state.player.y;
  const cell = state.maze[y][x];

  if (dx === 1 && cell.walls.right) return;
  if (dx === -1 && cell.walls.left) return;
  if (dy === 1 && cell.walls.bottom) return;
  if (dy === -1 && cell.walls.top) return;

  const nx = x + dx;
  const ny = y + dy;
  if (nx < 0 || ny < 0 || nx >= state.size || ny >= state.size) return;

  if (!state.timerRunning) {
    state.timerStart = performance.now();
    state.timerRunning = true;
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
    }
    state.timerInterval = setInterval(() => {
      const elapsed = Math.floor((performance.now() - state.timerStart) / 1000);
      updateTimerDisplay(elapsed);
    }, 1000);
  }

  state.player.x = nx;
  state.player.y = ny;
  state.solvedPath = null;
  drawMaze();

  if (nx === state.size - 1 && ny === state.size - 1) {
    if (state.timerRunning && state.timerStart !== null) {
      const elapsed = Math.round((performance.now() - state.timerStart) / 1000);
      state.elapsedSeconds = elapsed;
      state.timerRunning = false;
      if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
      }
    }

    const city = state.location?.city || "your city";
    const timeText = `${state.elapsedSeconds}s`;
    const praiseOptions = ["Great job!", "Nice speed!", "Well done!"];
    const praise = praiseOptions[Math.floor(Math.random() * praiseOptions.length)];
    ui.feedbackText.textContent = `Completed the ${city} maze in ${timeText}. ${praise}`;
    updateTimerDisplay(state.elapsedSeconds);
  }
}

function solveMaze() {
  if (state.solvedPath) {
    state.solvedPath = null;
    drawMaze();
    return;
  }

  const size = state.size;
  const queue = [{ x: 0, y: 0 }];
  const prev = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null)
  );
  const visited = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );
  visited[0][0] = true;

  while (queue.length > 0) {
    const node = queue.shift();
    if (node.x === size - 1 && node.y === size - 1) break;
    const cell = state.maze[node.y][node.x];
    const moves = [
      { dx: 0, dy: -1, wall: "top" },
      { dx: 1, dy: 0, wall: "right" },
      { dx: 0, dy: 1, wall: "bottom" },
      { dx: -1, dy: 0, wall: "left" },
    ];
    moves.forEach((move) => {
      if (cell.walls[move.wall]) return;
      const nx = node.x + move.dx;
      const ny = node.y + move.dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) return;
      if (visited[ny][nx]) return;
      visited[ny][nx] = true;
      prev[ny][nx] = node;
      queue.push({ x: nx, y: ny });
    });
  }

  const path = [];
  let cur = { x: size - 1, y: size - 1 };
  while (cur) {
    path.push(cur);
    cur = prev[cur.y][cur.x];
  }
  path.reverse();
  state.solvedPath = path;
  drawMaze();
}

function setCanvasSize() {
  const size = Math.min(640, window.innerWidth * 0.9);
  ui.canvas.width = size;
  ui.canvas.height = size;
  drawMaze();
}

async function getWeatherByCity(city) {
  const geoResponse = await fetch(
    `https://cse2004.com/api/geocode?address=${encodeURIComponent(city)}`
  );
  if (!geoResponse.ok) {
    throw new Error("Geocode request failed");
  }
  const geoData = await geoResponse.json();
  if (!geoData.results || geoData.results.length === 0) {
    throw new Error("City not found");
  }
  const topResult = geoData.results[0];
  const lat = topResult.geometry.location.lat;
  const lng = topResult.geometry.location.lng;
  const displayName = formatCityState(topResult.address_components) || city;

  const weatherResponse = await fetch(
    `https://cse2004.com/api/weather?latitude=${lat}&longitude=${lng}`
  );
  if (!weatherResponse.ok) {
    throw new Error("Weather request failed");
  }
  const weather = await weatherResponse.json();

  return { weather, lat, lon: lng, city: displayName };
}

async function getWeatherByCoords(lat, lon) {
  const weatherResponse = await fetch(
    `https://cse2004.com/api/weather?latitude=${lat}&longitude=${lon}`
  );
  const weather = await weatherResponse.json();
  return weather;
}

async function reverseGeocode(lat, lon) {
  const response = await fetch(
    `https://cse2004.com/api/geocode?latlng=${lat},${lon}`
  );
  if (!response.ok) {
    throw new Error("Reverse geocode failed");
  }
  const data = await response.json();
  if (!data.results || data.results.length === 0) {
    throw new Error("No reverse geocode results");
  }
  return formatCityState(data.results[0].address_components) || "Your city";
}

async function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ city: "Unknown", lat: 0, lon: 0 });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        resolve({ city: formatCoords(lat, lon), lat, lon });
      },
      () => resolve({ city: "Location blocked", lat: 0, lon: 0 }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

function formatCoords(lat, lon) {
  const latText = Number(lat).toFixed(2);
  const lonText = Number(lon).toFixed(2);
  return `Lat ${latText}, Lon ${lonText}`;
}

function normalizeWeatherPayload(raw) {
  if (!raw) {
    return null;
  }

  const toNumber = (value, fallback) => {
    const num = Number.parseFloat(value);
    return Number.isFinite(num) ? num : fallback;
  };

  const unitCandidates = [
    raw.currentConditions?.temperature?.unit,
    raw.temperature?.unit,
    raw.temperatureUnit,
    raw.units?.temperature,
    raw.unit,
    raw.current?.temperature_unit,
    raw.current?.temp_unit,
  ];
  const unitValue = unitCandidates.find((val) => typeof val === "string");

  const tempCandidates = [
    raw.currentConditions?.temperature?.degrees,
    raw.temperature?.degrees,
    raw.temperature,
    raw.current?.temperature_2m,
    raw.current?.temperature,
    raw.current?.temp_c,
    raw.temp,
    raw.temperatureC,
    raw.tempC,
  ];

  const tempValue = tempCandidates.find((val) => Number.isFinite(Number.parseFloat(val)));
  if (tempValue === undefined) {
    return null;
  }
  const tempRaw = toNumber(tempValue, NaN);
  if (!Number.isFinite(tempRaw)) {
    return null;
  }
  const unit = unitValue ? unitValue.toLowerCase() : null;
  const isFahrenheit = unit === "fahrenheit" || unit === "f" || unit === "imperial";
  const isCelsius =
    unit === "celsius" || unit === "c" || unit === "metric" || unit === "si" || !unit;
  const tempF = isCelsius && !isFahrenheit ? tempRaw * 1.8 + 32 : tempRaw;
  const temp = Math.round(tempF);

  const code =
    raw.currentConditions?.weatherCondition?.type ||
    raw.weatherCondition?.type ||
    raw.weather?.code ||
    raw.weather_code ||
    raw.current?.weather_code ||
    2;

  const text =
    raw.currentConditions?.weatherCondition?.description?.text ||
    raw.weatherCondition?.description?.text ||
    raw.current?.condition?.text ||
    weatherText(code);

  return { temperature: temp, code, text };
}

function formatCityState(components = []) {
  const getPart = (type) =>
    components.find((item) => item.types?.includes(type))?.short_name;
  const city = getPart("locality") || getPart("administrative_area_level_2");
  const state = getPart("administrative_area_level_1");
  const country = getPart("country");

  if (city && state) return `${city}, ${state}`;
  if (city && country) return `${city}, ${country}`;
  return city || null;
}

function weatherText(code) {
  if (typeof code === "string") {
    const map = {
      CLEAR: "Clear",
      MOSTLY_CLEAR: "Mostly clear",
      PARTLY_CLOUDY: "Partly cloudy",
      CLOUDY: "Cloudy",
      FOG: "Fog",
      DRIZZLE: "Drizzle",
      RAIN: "Rain",
      SNOW: "Snow",
      THUNDERSTORM: "Storm",
    };
    return map[code] || "Cloudy";
  }

  const category = weatherCategory(code);
  const map = {
    clear: "Clear",
    cloudy: "Cloudy",
    fog: "Fog",
    drizzle: "Drizzle",
    rain: "Rain",
    snow: "Snow",
    storm: "Storm",
  };
  return map[category] || "Cloudy";
}

function updateUI() {
  const locationText = state.location?.city || "Unknown";
  const weatherText = state.weather
    ? `${state.weather.text} · ${state.weather.temperature}°F`
    : "-";
  ui.locationLabel.textContent = locationText;
  ui.weatherLabel.textContent = weatherText;

  if (state.mood) {
    ui.themeLabel.textContent = state.mood.theme.name;
    ui.difficultyChip.textContent = state.mood.difficulty;
    ui.difficultyLabel.textContent = state.mood.difficulty;
    ui.mazeSizeLabel.textContent = `${state.size} x ${state.size}`;
    ui.moodLabel.textContent = state.mood.theme.name;
  }

  if (state.location && state.weather && state.mood) {
    const narrative = generateNarrative({
      city: state.location.city,
      weatherText: state.weather.text,
      temperature: state.weather.temperature,
      difficulty: state.mood.difficulty,
      mood: state.mood.theme.name,
    });
    ui.encouragementText.textContent = "Loading a boost...";
  }
}

async function buildGameWithCity(city) {
  ui.introText.textContent = "Reading city and weather...";
  ui.encouragementText.textContent = "Calculating maze parameters...";
  ui.feedbackText.textContent = "Complete the maze to unlock feedback.";

  let payload;
  try {
    payload = await getWeatherByCity(city);
  } catch (error) {
    ui.locationLabel.textContent = "Invalid city name";
    ui.weatherLabel.textContent = "-";
    ui.themeLabel.textContent = "-";
    ui.introText.textContent = "City not found. Please check spelling.";
    ui.encouragementText.textContent = "Enter a valid city name to continue.";
    ui.feedbackText.textContent = "No data loaded.";
    updateTimerDisplay(0);
    ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
    state.maze = null;
    state.solvedPath = null;
    return;
  }

  state.location = { city: payload.city, lat: payload.lat, lon: payload.lon };
  state.weather = normalizeWeatherPayload(payload.weather);
  if (!state.weather) {
    ui.locationLabel.textContent = "Invalid city name";
    ui.weatherLabel.textContent = "Weather not found";
    ui.themeLabel.textContent = "-";
    ui.introText.textContent = "Weather data unavailable for this city.";
    ui.encouragementText.textContent = "Check spelling or try another city.";
    ui.feedbackText.textContent = "No data loaded.";
    updateTimerDisplay(0);
    ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
    state.maze = null;
    state.solvedPath = null;
    return;
  }
  state.mood = resolveMoodByTemp(state.weather.temperature);
  state.size = state.mood.size;

  const seedString = `${dateSeed()}-${state.location.lat.toFixed(2)}-${state.location.lon.toFixed(2)}-${String(
    state.weather.code
  )}`;
  const seed = Array.from(seedString).reduce((acc, char) => acc + char.charCodeAt(0), 0);

  state.maze = createMaze(state.size, seed);
  state.player = { x: 0, y: 0 };
  state.solvedPath = null;
  state.timerStart = null;
  state.elapsedSeconds = 0;
  state.timerRunning = false;
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
  updateTimerDisplay(0);

  updateUI();
  setCanvasSize();

  try {
    const aiText = await generateAiNarrative(
      state.location.city,
      state.weather.text,
      state.weather.temperature
    );
    if (aiText) {
      ui.introText.textContent = aiText;
    } else {
      ui.introText.textContent = "AI response empty.";
    }

    const encouragement = await generateAiEncouragement(state.location.city);
    if (encouragement) {
      ui.encouragementText.textContent = encouragement;
    } else {
      ui.encouragementText.textContent = "AI response empty.";
    }
  } catch (error) {
    console.error("AI request failed:", error);
    ui.introText.textContent = "AI request failed.";
    ui.encouragementText.textContent = "AI request failed.";
  }
}

async function buildGameWithCoords(lat, lon) {
  ui.introText.textContent = "Reading location and weather...";
  ui.encouragementText.textContent = "Calculating maze parameters...";
  ui.feedbackText.textContent = "Complete the maze to unlock feedback.";
  updateTimerDisplay(0);

  let weatherRaw;
  let cityName = "Your city";
  try {
    [weatherRaw, cityName] = await Promise.all([
      getWeatherByCoords(lat, lon),
      reverseGeocode(lat, lon),
    ]);
  } catch (error) {
    weatherRaw = await getWeatherByCoords(lat, lon);
  }

  state.location = { city: cityName, lat, lon };
  if (ui.cityInput) {
    ui.cityInput.value = cityName;
  }
  state.weather = normalizeWeatherPayload(weatherRaw);

  if (!state.weather) {
    ui.locationLabel.textContent = "Location unavailable";
    ui.weatherLabel.textContent = "Weather not found";
    ui.themeLabel.textContent = "-";
    ui.introText.textContent = "Weather data unavailable for this location.";
    ui.encouragementText.textContent = "Try a city name instead.";
    ui.feedbackText.textContent = "No data loaded.";
    ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
    state.maze = null;
    state.solvedPath = null;
    return;
  }

  state.mood = resolveMoodByTemp(state.weather.temperature);
  state.size = state.mood.size;

  const seedString = `${dateSeed()}-${state.location.lat.toFixed(2)}-${state.location.lon.toFixed(2)}-${String(
    state.weather.code
  )}`;
  const seed = Array.from(seedString).reduce((acc, char) => acc + char.charCodeAt(0), 0);

  state.maze = createMaze(state.size, seed);
  state.player = { x: 0, y: 0 };
  state.solvedPath = null;
  state.timerStart = null;
  state.elapsedSeconds = 0;
  state.timerRunning = false;
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
  updateTimerDisplay(0);

  updateUI();
  setCanvasSize();

  try {
    const aiText = await generateAiNarrative(
      state.location.city,
      state.weather.text,
      state.weather.temperature
    );
    if (aiText) {
      ui.introText.textContent = aiText;
    } else {
      ui.introText.textContent = "AI response empty.";
    }

    const encouragement = await generateAiEncouragement(state.location.city);
    if (encouragement) {
      ui.encouragementText.textContent = encouragement;
    } else {
      ui.encouragementText.textContent = "AI response empty.";
    }
  } catch (error) {
    console.error("AI request failed:", error);
    ui.introText.textContent = "AI request failed.";
    ui.encouragementText.textContent = "AI request failed.";
  }
}

function downloadMaze() {
  const link = document.createElement("a");
  link.download = `GeoMood-${dateSeed()}.png`;
  link.href = ui.canvas.toDataURL("image/png");
  link.click();
}

window.addEventListener("keydown", (event) => {
  const target = event.target;
  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
    return;
  }

  const key = event.key.toLowerCase();
  const moveKeys = ["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"];
  if (moveKeys.includes(key)) {
    event.preventDefault();
  }

  if (["arrowup", "w"].includes(key)) movePlayer(0, -1);
  if (["arrowdown", "s"].includes(key)) movePlayer(0, 1);
  if (["arrowleft", "a"].includes(key)) movePlayer(-1, 0);
  if (["arrowright", "d"].includes(key)) movePlayer(1, 0);
});

ui.cityBtn.addEventListener("click", () => {
  const value = ui.cityInput.value.trim();
  if (!value) return;
  buildGameWithCity(value);
});
ui.randomBtn.addEventListener("click", () => {
  getRandomUSCity()
    .then((picked) => {
      ui.cityInput.value = picked.fullName;
    })
    .catch(() => {
      ui.cityInput.value = "";
    });
});
ui.locationBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        const cityName = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        if (ui.cityInput) {
          ui.cityInput.value = cityName;
        }
        ui.encouragementText.textContent = "Location detected. You can play when ready.";
      } catch (error) {
        if (ui.cityInput) {
          ui.cityInput.value = "";
        }
        ui.encouragementText.textContent = "Location not found. Please try again.";
      }
    },
    () => {
      if (ui.cityInput) {
        ui.cityInput.value = "";
      }
      ui.encouragementText.textContent = "Location not found. Please try again.";
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
});
ui.cityInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const value = ui.cityInput.value.trim();
    if (!value) return;
    buildGameWithCity(value);
  }
});
ui.solveBtn.addEventListener("click", solveMaze);
ui.resetBtn.addEventListener("click", () => {
  state.player = { x: 0, y: 0 };
  state.solvedPath = null;
  state.timerStart = null;
  state.elapsedSeconds = 0;
  state.timerRunning = false;
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
  updateTimerDisplay(0);
  drawMaze();
});
ui.downloadBtn.addEventListener("click", downloadMaze);

window.addEventListener("resize", setCanvasSize);

ui.locationLabel.textContent = "Enter a city to begin";
ui.weatherLabel.textContent = "-";
ui.themeLabel.textContent = "-";
ui.introText.textContent = "Pick a city to generate today's maze.";
ui.encouragementText.textContent = "Your encouragement will appear here.";
ui.feedbackText.textContent = "Complete the maze to unlock feedback.";
updateTimerDisplay(0);
