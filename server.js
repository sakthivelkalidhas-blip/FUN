import { Server, Room } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Schema, MapSchema, type } from "@colyseus/schema";
import express from "express";
import { createServer } from "http";

// ==========================================
// 1. SCHEMAS
// ==========================================
class Vector3Schema extends Schema {
  constructor() {
    super();
    this.x = 0;
    this.y = 0;
    this.z = 0;
  }
}
type("number")(Vector3Schema.prototype, "x");
type("number")(Vector3Schema.prototype, "y");
type("number")(Vector3Schema.prototype, "z");

class PlayerSchema extends Schema {
  constructor() {
    super();
    this.id = "";
    this.name = "Player";
    this.team = 1;
    this.hp = 200;
    this.maxHp = 200;
    this.isBot = false;
    this.isReady = false;
    this.selectedWeapon = "mp40";
    this.kills = 0;
    this.position = new Vector3Schema();
    this.rotationY = 0;
  }
}
type("string")(PlayerSchema.prototype, "id");
type("string")(PlayerSchema.prototype, "name");
type("number")(PlayerSchema.prototype, "team");
type("number")(PlayerSchema.prototype, "hp");
type("number")(PlayerSchema.prototype, "maxHp");
type("boolean")(PlayerSchema.prototype, "isBot");
type("boolean")(PlayerSchema.prototype, "isReady");
type("string")(PlayerSchema.prototype, "selectedWeapon");
type("number")(PlayerSchema.prototype, "kills");
type(Vector3Schema)(PlayerSchema.prototype, "position");
type("number")(PlayerSchema.prototype, "rotationY");

class GlooWallSchema extends Schema {
  constructor() {
    super();
    this.id = "";
    this.ownerId = "";
    this.position = new Vector3Schema();
    this.rotationY = 0;
    this.hp = 300;
  }
}
type("string")(GlooWallSchema.prototype, "id");
type("string")(GlooWallSchema.prototype, "ownerId");
type(Vector3Schema)(GlooWallSchema.prototype, "position");
type("number")(GlooWallSchema.prototype, "rotationY");
type("number")(GlooWallSchema.prototype, "hp");

class GameState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
    this.glooWalls = new MapSchema();
    this.status = "LOBBY"; // LOBBY | SHOP | IN_ROUND | GAME_OVER
    this.currentRound = 1;
    this.team1Score = 0;
    this.team2Score = 0;
    this.timer = 0;
  }
}
type({ map: PlayerSchema })(GameState.prototype, "players");
type({ map: GlooWallSchema })(GameState.prototype, "glooWalls");
type("string")(GameState.prototype, "status");
type("number")(GameState.prototype, "currentRound");
type("number")(GameState.prototype, "team1Score");
type("number")(GameState.prototype, "team2Score");
type("number")(GameState.prototype, "timer");

// ==========================================
// 2. BOT CONTROLLER
// ==========================================
class BotController {
  constructor(bot) {
    this.bot = bot;
    this.changeDirInterval = 2000;
    this.lastDirChange = Date.now();
    this.targetX = 0;
    this.targetZ = 0;
    this.pickNewDestination();
  }

  pickNewDestination() {
    this.targetX = (Math.random() - 0.5) * 40;
    this.targetZ = (Math.random() - 0.5) * 40;
  }

  update(deltaTime, players) {
    if (this.bot.hp <= 0) return;

    let nearestEnemy = null;
    let minDist = Infinity;

    players.forEach((p) => {
      if (p.id !== this.bot.id && p.team !== this.bot.team && p.hp > 0) {
        const dist = Math.hypot(p.position.x - this.bot.position.x, p.position.z - this.bot.position.z);
        if (dist < minDist) {
          minDist = dist;
          nearestEnemy = p;
        }
      }
    });

    if (nearestEnemy) {
      this.targetX = nearestEnemy.position.x;
      this.targetZ = nearestEnemy.position.z;
    } else if (Date.now() - this.lastDirChange > this.changeDirInterval) {
      this.pickNewDestination();
      this.lastDirChange = Date.now();
    }

    const dx = this.targetX - this.bot.position.x;
    const dz = this.targetZ - this.bot.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 1) {
      const speed = 8 * (deltaTime / 1000);
      this.bot.position.x += (dx / dist) * speed;
      this.bot.position.z += (dz / dist) * speed;
      this.bot.rotationY = Math.atan2(dx, dz);
    }
  }
}

// ==========================================
// 3. BASE ROOM & HIT VALIDATION
// ==========================================
class BaseRoom extends Room {
  onCreate(options) {
    this.setState(new GameState());
    this.shopDuration = 15;
    this.matchStartDelaySec = 24;

    this.onMessage("move", (client, data) => this.handleMove(client, data));
    this.onMessage("shop_lock", (client, data) => this.handleShopLock(client, data));
    this.onMessage("shoot", (client, data) => this.handleShoot(client, data));
    this.onMessage("deploy_gloo", (client, data) => this.handleDeployGloo(client, data));

    this.setSimulationInterval((deltaTime) => this.update(deltaTime), 1000 / 30);
  }

  handleMove(client, data) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.hp <= 0) return;
    player.position.x = data.x;
    player.position.y = data.y;
    player.position.z = data.z;
    player.rotationY = data.ry;
  }

  handleShopLock(client, data) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    player.selectedWeapon = data.weapon;
    player.isReady = true;

    let allReady = true;
    this.state.players.forEach((p) => { if (!p.isReady) allReady = false; });
    if (allReady && this.state.status === "SHOP") this.startRound();
  }

  handleShoot(client, data) {
    if (this.state.status !== "IN_ROUND") return;

    const shooter = this.state.players.get(client.sessionId);
    const target = this.state.players.get(data.targetId);
    if (!shooter || !target || target.hp <= 0 || shooter.team === target.team) return;

    // Server-side distance check
    const dist = Math.hypot(target.position.x - shooter.position.x, target.position.z - shooter.position.z);
    if (dist > 100) return;

    // Line-of-sight check against Gloo Walls
    let blocked = false;
    this.state.glooWalls.forEach((wall) => {
      const wallDist = Math.hypot(wall.position.x - shooter.position.x, wall.position.z - shooter.position.z);
      if (wallDist < dist && Math.abs(wall.position.x - target.position.x) < 2) {
        blocked = true;
      }
    });

    if (blocked) return;

    target.hp = Math.max(0, target.hp - data.damage);
    if (target.hp <= 0) {
      shooter.kills += 1;
      this.checkRoundEnd();
    }
  }

  handleDeployGloo(client, data) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.hp <= 0) return;

    const wall = new GlooWallSchema();
    wall.id = Math.random().toString(36).substring(2, 9);
    wall.ownerId = client.sessionId;
    wall.position.x = data.x;
    wall.position.y = data.y;
    wall.position.z = data.z;
    wall.rotationY = data.ry;

    this.state.glooWalls.set(wall.id, wall);
  }

  startShopPhase() {
    this.state.status = "SHOP";
    this.state.timer = this.shopDuration;
    this.clock.setTimeout(() => {
      if (this.state.status === "SHOP") this.startRound();
    }, this.shopDuration * 1000);
  }

  startRound() {
    this.state.status = "IN_ROUND";
    this.state.glooWalls.clear();
    this.state.players.forEach((p) => {
      p.hp = p.maxHp;
      p.isReady = false;
    });
  }

  onLeave(client) {
    this.state.players.delete(client.sessionId);
  }

  checkRoundEnd() {}
}

// ==========================================
// 4. GAME ROOM IMPLEMENTATIONS
// ==========================================
class LoneWolfRoom extends BaseRoom {
  onJoin(client, options) {
    const player = new PlayerSchema();
    player.id = client.sessionId;
    player.name = (options && options.name) ? String(options.name).trim() : "Player";
    player.team = this.state.players.size + 1;
    this.state.players.set(client.sessionId, player);

    if (this.state.players.size === 2) this.startShopPhase();
  }

  checkRoundEnd() {
    let t1Alive = 0, t2Alive = 0;
    this.state.players.forEach((p) => {
      if (p.hp > 0) {
        if (p.team === 1) t1Alive++;
        if (p.team === 2) t2Alive++;
      }
    });

    if (t1Alive === 0 || t2Alive === 0) {
      if (t1Alive === 0) this.state.team2Score++;
      if (t2Alive === 0) this.state.team1Score++;

      if (this.state.team1Score >= 5 || this.state.team2Score >= 5) {
        this.state.status = "GAME_OVER";
      } else {
        this.state.currentRound++;
        this.startShopPhase();
      }
    }
  }

  update(deltaTime) {}
}

class BattleRoyaleRoom extends BaseRoom {
  onCreate(options) {
    super.onCreate(options);
    this.bots = [];
    this.lobbyTimer = 0;
    this.maxPlayers = 20;
  }

  onJoin(client, options) {
    const player = new PlayerSchema();
    player.id = client.sessionId;
    player.name = (options && options.name) ? String(options.name).trim() : "Player";
    player.team = this.state.players.size + 1;
    this.state.players.set(client.sessionId, player);
  }

  update(deltaTime) {
    if (this.state.status === "LOBBY") {
      this.lobbyTimer += deltaTime / 1000;
      if (this.lobbyTimer >= this.matchStartDelaySec) {
        this.fillWithBots();
        this.startShopPhase();
      }
    }

    if (this.state.status === "IN_ROUND") {
      this.bots.forEach((bot) => bot.update(deltaTime, this.state.players));
    }
  }

  fillWithBots() {
    const remaining = this.maxPlayers - this.state.players.size;
    for (let i = 0; i < remaining; i++) {
      const botId = `bot_${i}`;
      const bot = new PlayerSchema();
      bot.id = botId;
      bot.name = `Bot ${i + 1}`;
      bot.isBot = true;
      bot.team = this.state.players.size + 1;

      this.state.players.set(botId, bot);
      this.bots.push(new BotController(bot));
    }
  }

  checkRoundEnd() {
    let aliveCount = 0;
    this.state.players.forEach((p) => { if (p.hp > 0) aliveCount++; });
    if (aliveCount <= 1) this.state.status = "GAME_OVER";
  }
}

// ==========================================
// 5. SERVER BOOTSTRAP
// ==========================================
const app = express();
app.use(express.json());

const port = Number(process.env.PORT || 2567);
const server = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server })
});

gameServer.define("lone_wolf", LoneWolfRoom);
gameServer.define("battle_royale", BattleRoyaleRoom);

app.get("/health", (req, res) => res.send("OK"));

server.listen(port, () => {
  console.log(`Colyseus game server listening on http://localhost:${port}`);
});
