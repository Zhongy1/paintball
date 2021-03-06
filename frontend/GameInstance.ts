import { ClientComponents } from ".";
import { Calculator } from "../shared/Calculator";
import { CONFIG } from "../shared/config";
import { AxialCoord, CartCoord, Color, EntityData, HexCell, HexCellMod, MapData, MapProperties, MoveKey, PlayerProperties, ProjectileProperties, SetupData, Sprites, TeamColors } from "../shared/models";
import { Linker } from "./Linker";



export class GameInstance {
    public mapProps: MapProperties;
    public players: PlayerProperties[];
    public projectiles: ProjectileProperties[];

    public playerId: string;
    public myPlayer: PlayerProperties;

    private linker: Linker;

    private renderer: GameRenderer;
    private fps: number;
    // private ctx: CanvasRenderingContext2D;

    constructor(private gameCanvas: HTMLCanvasElement, private clientComponents: ClientComponents) {
        this.mapProps = {
            grid: {}
        };
        this.players = [];
        this.projectiles = [];

        this.renderer = new GameRenderer(gameCanvas, this);
        // this.setCanvasSize();
        // this.ctx = this.gameCanvas.getContext('2d');
        // window.onresize = this.setCanvasSize.bind(this);
    }

    public start(linker: Linker) {
        if (this.linker) return;
        this.linker = linker;

        this.initializeClientComponents();
        this.startGameLoop();
    }

    private startGameLoop() {
        let self = this;
        let secondsPassed: number;
        let oldTimeStamp: number;

        window.requestAnimationFrame(startIteration);
        function startIteration(timeStamp) {
            oldTimeStamp = timeStamp;
            window.requestAnimationFrame(doGameIteration);
        }
        function doGameIteration(timeStamp) {
            secondsPassed = (timeStamp - oldTimeStamp) / 1000;
            oldTimeStamp = timeStamp;
            self.fps = Math.round(1 / secondsPassed);

            self.renderFrame();
            self.renderer.renderFPS(self.fps);

            self.predictNextFrame();

            window.requestAnimationFrame(doGameIteration);
        }
    }

    private renderFrame() {
        this.renderer.clearGameCanvas();
        // Revamp later to get O(1) retrieval
        this.myPlayer = null;
        for (let i = 0; i < this.players.length; i++) {
            if (this.playerId == this.players[i].id) {
                this.myPlayer = this.players[i];
            }
        }
        // revamp ^^^
        this.renderer.renderMap(this.myPlayer);
        this.players.forEach(player => {
            this.renderer.drawPlayer(player, this.myPlayer);
        });
        this.projectiles.forEach(projectile => {
            if (projectile.progress == 1) return;
            this.renderer.drawProjectile(projectile, this.myPlayer);
        });
    }

    private predictNextFrame() {
        this.players.forEach(player => {
            this.updatePlayer(player);
        });
        this.projectiles.forEach(projectile => {
            this.updateProjectile(projectile);
        });
    }

    private updatePlayer(player: PlayerProperties) {
        if (player.direction.x != 0 || player.direction.y != 0) {
            let nextPos: CartCoord = this.predictNextPosition(player);
            let nextAxialPos: AxialCoord = Calculator.pixelToFlatHex(player.coord, CONFIG.EDGE_LENGTH);

            if (Math.abs(nextAxialPos.q) <= CONFIG.RING_COUNT && this.mapProps.grid[nextAxialPos.q].hasOwnProperty(nextAxialPos.r)) {
                player.coord = nextPos;
                if (player.cellCoord.q != nextAxialPos.q || player.cellCoord.r != nextAxialPos.r) {
                    player.cellCoord = nextAxialPos;
                }
            }
        }
    }

    private predictNextPosition(player: PlayerProperties): CartCoord {
        let pos: CartCoord = {
            x: player.coord.x,
            y: player.coord.y
        }
        if (player.direction.x != 0) {
            pos.x += player.direction.x * CONFIG.MOVE_SPEED / this.fps;
        }
        if (player.direction.y != 0) {
            pos.y += player.direction.y * CONFIG.MOVE_SPEED / this.fps;
        }
        return pos;
    }

    private updateProjectile(projectile: ProjectileProperties) {
        if (projectile.progress < 1) {
            let d = CONFIG.PROJ_SPEED / this.fps;
            let distRemaining = Math.sqrt(Math.pow(projectile.remOffset.x, 2) + Math.pow(projectile.remOffset.y, 2));
            if (distRemaining > d) {
                let dx = projectile.remOffset.x * d / distRemaining;
                let dy = projectile.remOffset.y * d / distRemaining;

                projectile.coord.x += dx;
                projectile.coord.y += dy;
                projectile.remOffset.x -= dx;
                projectile.remOffset.y -= dy;

                let travDistance = distRemaining / (1 - projectile.progress);
                distRemaining -= d;
                projectile.progress = (travDistance - distRemaining) / travDistance;
            }
            else {
                projectile.progress = 1;
            }
        }
    }

    private initializeClientComponents() {
        let self = this;
        function login(username: string) {
            console.log(username);
            self.linker.spawnPlayer(username)
                .then(id => {
                    console.log('Player ID: ' + id);
                    self.playerId = id;
                });
            self.clientComponents.entry.classList.add('hidden');
            self.clientComponents.submit.setAttribute('disabled', '');
            self.clientComponents.username.setAttribute('disabled', '');
        }
        this.clientComponents.submit.addEventListener('click', () => {
            if (this.playerId) return;
            let username = this.clientComponents.username.value;
            login(username);
        });
        this.clientComponents.username.addEventListener('keypress', (e) => {
            if (e.key == 'Enter') {
                if (this.playerId) return;
                let username = this.clientComponents.username.value;
                login(username);
            }
        });
        let isDownW, isDownA, isDownS, isDownD;
        isDownW = isDownA = isDownS = isDownD = false;
        document.body.addEventListener('keydown', (e) => {
            if (this.playerId) {
                switch (e.key) {
                    case 'w': {
                        if (isDownW) return;
                        isDownW = true;
                        this.linker.setKey(this.playerId, MoveKey.w, true);
                        break;
                    }
                    case 'a': {
                        if (isDownA) return;
                        isDownA = true;
                        this.linker.setKey(this.playerId, MoveKey.a, true);
                        break;
                    }
                    case 's': {
                        if (isDownS) return;
                        isDownS = true;
                        this.linker.setKey(this.playerId, MoveKey.s, true);
                        break;
                    }
                    case 'd': {
                        if (isDownD) return;
                        isDownD = true;
                        this.linker.setKey(this.playerId, MoveKey.d, true);
                        break;
                    }
                }
            }
        });
        document.body.addEventListener('keyup', (e) => {
            if (this.playerId) {
                switch (e.key) {
                    case 'w': {
                        isDownW = false;
                        this.linker.setKey(this.playerId, MoveKey.w, false);
                        break;
                    }
                    case 'a': {
                        isDownA = false;
                        this.linker.setKey(this.playerId, MoveKey.a, false);
                        break;
                    }
                    case 's': {
                        isDownS = false;
                        this.linker.setKey(this.playerId, MoveKey.s, false);
                        break;
                    }
                    case 'd': {
                        isDownD = false;
                        this.linker.setKey(this.playerId, MoveKey.d, false);
                        break;
                    }
                }
            }
        });
        document.body.addEventListener('click', (e) => {
            let selection: CartCoord = {
                x: e.offsetX - window.innerWidth / 2,
                y: e.offsetY - window.innerHeight / 2
            }
            let coordTransformed: CartCoord = {
                x: this.myPlayer.coord.x,
                y: this.myPlayer.coord.y
            }
            Calculator.rotateX(coordTransformed, -CONFIG.MAP_VIEW_ANGLE);
            // let selection: CartCoord = {
            //     x: e.offsetX - window.innerWidth / 2 + this.myPlayer.coord.x,
            //     y: e.offsetY - window.innerHeight / 2 + this.myPlayer.coord.y
            // }
            selection.x += coordTransformed.x;
            selection.y += coordTransformed.y;
            selection.z = Calculator.calcZofPoint(selection, CONFIG.MAP_VIEW_ANGLE);
            Calculator.rotateX(selection, -CONFIG.MAP_VIEW_ANGLE);
            let axialSelection: AxialCoord = Calculator.pixelToFlatHex(selection, CONFIG.EDGE_LENGTH);
            // if (this.map.checkCellExists(options.target) && Calculator.calcCellDistance(options.target, player.cellCoord) <= CONFIG.ATTACK_RANGE)
            this.linker.attack({
                id: this.playerId,
                target: axialSelection
            });
        });
    }

    public handleSetupData(data: SetupData) {
        // console.log('from instance');
        console.log(data);
        this.mapProps = data.map;
        this.players = data.players;
        this.projectiles = data.projectiles;

        this.renderer.generateMap(this.mapProps.grid);
        // this.players.forEach(player => {
        //     this.renderer.drawPlayer(player);
        // })
    }

    public handleMapData(data: MapData) {
        // console.log('Received map data');
        data.cells.forEach((cell) => {
            this.mapProps.grid[cell.cellCoord.q][cell.cellCoord.r].color = cell.color;
            this.renderer.drawCell(cell);
        });
    }

    public handleEntityData(data: EntityData) {
        // console.log(data);
        this.players = data.players;
        this.projectiles = data.projectiles;

        // this.renderer.clearGameCanvas();
        // this.renderer.renderMap();
        // this.players.forEach(player => {
        //     this.renderer.drawPlayer(player);
        // });
    }
}

export class GameRenderer {

    private mainCtx: CanvasRenderingContext2D;

    private mapCanvas: HTMLCanvasElement;
    private mapCtx: CanvasRenderingContext2D;
    private mapWidth: number;

    private hexCornerPoints;

    private sprites: Sprites;

    constructor(private gameCanvas: HTMLCanvasElement, private gameInstance: GameInstance) {
        this.mainCtx = gameCanvas.getContext('2d');

        this.mapCanvas = document.createElement('canvas');
        this.mapCtx = this.mapCanvas.getContext('2d');
        this.mapWidth = (CONFIG.RING_COUNT * 2 + 1) * CONFIG.EDGE_LENGTH * Math.sqrt(3) + 10;
        console.log(this.mapWidth);
        this.mapCanvas.width = this.mapWidth;
        this.mapCanvas.height = this.mapWidth;
        // document.body.appendChild(this.mapCanvas);

        this.hexCornerPoints = [{ x: -CONFIG.EDGE_LENGTH, y: 0, z: 0 }, { x: -CONFIG.EDGE_LENGTH / 2, y: CONFIG.EDGE_LENGTH * Math.sqrt(3) / 2, z: 0 }, { x: CONFIG.EDGE_LENGTH / 2, y: CONFIG.EDGE_LENGTH * Math.sqrt(3) / 2, z: 0 }, { x: CONFIG.EDGE_LENGTH, y: 0, z: 0 }, { x: CONFIG.EDGE_LENGTH / 2, y: -CONFIG.EDGE_LENGTH * Math.sqrt(3) / 2, z: 0 }, { x: -CONFIG.EDGE_LENGTH / 2, y: -CONFIG.EDGE_LENGTH * Math.sqrt(3) / 2, z: 0 }];
        Calculator.rotateX(this.hexCornerPoints, CONFIG.MAP_VIEW_ANGLE);

        this.setCanvasSize();
        window.onresize = this.setCanvasSize.bind(this);

        this.prerenderSprites();
    }

    private setCanvasSize() {
        this.gameCanvas.width = window.innerWidth;
        this.gameCanvas.height = window.innerHeight;
    }

    private prerenderSprites() {
        this.sprites = {
            'a-t': new Image(),
            'a-tr': new Image(),
            'a-r': new Image(),
            'a-br': new Image(),
            'a-b': new Image(),
            'a-bl': new Image(),
            'a-l': new Image(),
            'a-tl': new Image(),
            't-red': new Image(),
            't-blue': new Image()
        }
        this.sprites['a-t'].src = '/images/arrow-t.png';
        this.sprites['a-tr'].src = '/images/arrow-tr.png';
        this.sprites['a-r'].src = '/images/arrow-r.png';
        this.sprites['a-br'].src = '/images/arrow-br.png';
        this.sprites['a-b'].src = '/images/arrow-b.png';
        this.sprites['a-bl'].src = '/images/arrow-bl.png';
        this.sprites['a-l'].src = '/images/arrow-l.png';
        this.sprites['a-tl'].src = '/images/arrow-tl.png';
        this.sprites['t-red'].src = '/images/r_square.png';
        this.sprites['t-blue'].src = '/images/b_square.png';
    }

    public drawCell(cell: HexCell | HexCellMod) {
        let coordTransformed: CartCoord = {
            x: cell.coord.x,
            y: cell.coord.y
        }
        Calculator.rotateX(coordTransformed, CONFIG.MAP_VIEW_ANGLE);
        this.mapCtx.moveTo(coordTransformed.x + this.hexCornerPoints[0].x + this.mapWidth / 2, coordTransformed.y + this.hexCornerPoints[0].y + this.mapWidth / 2);
        this.mapCtx.beginPath();
        this.hexCornerPoints.forEach(point => {
            this.mapCtx.lineTo(coordTransformed.x + point.x + this.mapWidth / 2, coordTransformed.y + point.y + this.mapWidth / 2);
        });
        this.mapCtx.lineTo(coordTransformed.x + this.hexCornerPoints[0].x + this.mapWidth / 2, coordTransformed.y + this.hexCornerPoints[0].y + this.mapWidth / 2);
        this.mapCtx.stroke();
        if (cell.color != Color.nocolor) {
            switch (cell.color) {
                case Color.red: {
                    this.mapCtx.fillStyle = 'pink';
                    this.mapCtx.fill();
                    break;
                }
                case Color.blue: {
                    this.mapCtx.fillStyle = 'lightblue';
                    this.mapCtx.fill();
                    break;
                }
            }
        }
    }

    public generateMap(grid: { [index: string]: { [index: string]: HexCell } }) {
        this.mapCtx.strokeStyle = 'white';
        Object.keys(grid).forEach(q => {
            Object.keys(grid[q]).forEach(r => {
                this.drawCell(grid[q][r]);
            });
        });
    }

    public renderMap(player?: PlayerProperties) {
        // player = this.gameInstance.players[0];
        let offset;
        if (player) {
            let coordTransformed: CartCoord = {
                x: player.coord.x,
                y: player.coord.y
            }
            Calculator.rotateX(coordTransformed, CONFIG.MAP_VIEW_ANGLE);
            offset = {
                x: (window.innerWidth - this.mapWidth) / 2 - coordTransformed.x,
                y: (window.innerHeight - this.mapWidth) / 2 - coordTransformed.y
            }
        }
        else {
            offset = {
                x: (window.innerWidth - this.mapWidth) / 2,
                y: (window.innerHeight - this.mapWidth) / 2
            }
        }
        this.mainCtx.drawImage(this.mapCanvas, offset.x, offset.y);
    }

    public drawPlayer(player: PlayerProperties, myPlayer?: PlayerProperties) {
        if (myPlayer) {
            var coordTransformed: CartCoord = {
                x: player.coord.x - myPlayer.coord.x,
                y: player.coord.y - myPlayer.coord.y
            }
        }
        else {
            var coordTransformed: CartCoord = {
                x: player.coord.x,
                y: player.coord.y
            }
        }
        Calculator.rotateX(coordTransformed, CONFIG.MAP_VIEW_ANGLE);
        // this.mainCtx.fillStyle = 'red';
        switch (player.team) {
            case Color.red: {
                this.mainCtx.fillStyle = 'red';
                break;
            }
            case Color.blue: {
                this.mainCtx.fillStyle = 'blue';
                break;
            }
        }
        let center = {
            x: coordTransformed.x + window.innerWidth / 2,
            y: coordTransformed.y + window.innerHeight / 2
        }

        // draw player model
        // this.mainCtx.fillRect(center.x - 10, center.y - 10, 20, 20);
        this.mainCtx.drawImage(this.sprites['t-' + TeamColors[player.team]], center.x - 15, center.y - 15, 30, 30);

        //draw arrows
        let dir: string = 'b';
        let dirVec: CartCoord = {
            x: player.direction.x,
            y: player.direction.y
        }
        if (dirVec.x == -1) {
            dir = 'l';
        }
        else if (dirVec.x == 1) {
            dir = 'r';
        }
        else if (dirVec.y == -1) {
            dir = 't';
        }
        else if (dirVec.y == 1) {
            dir = 'b';
        }
        else if (Math.sign(dirVec.x) == 1) {
            if (Math.sign(dirVec.y) == -1) {
                dir = 'tr';
            }
            else if (Math.sign(dirVec.y) == 1) {
                dir = 'br';
            }
        }
        else if (Math.sign(dirVec.x) == -1) {
            if (Math.sign(dirVec.y) == -1) {
                dir = 'tl';
            }
            else if (Math.sign(dirVec.y) == 1) {
                dir = 'bl';
            }
        }
        this.mainCtx.drawImage(this.sprites['a-' + dir], center.x - 20, center.y - 20, 40, 40);

        // draw health bar
        this.mainCtx.fillStyle = 'purple';
        this.mainCtx.fillRect(center.x - 17, center.y - 27, 34, 9);
        if (player.health == 2) {
            this.mainCtx.fillStyle = 'lime';
            this.mainCtx.fillRect(center.x - 15, center.y - 25, 30, 5);
        }
        else {
            this.mainCtx.fillStyle = 'lime';
            this.mainCtx.fillRect(center.x - 15, center.y - 25, 30, 5);
            this.mainCtx.fillStyle = 'red';
            this.mainCtx.fillRect(center.x, center.y - 25, 15, 5);
        }

        // draw username
        this.mainCtx.font = '18px Arial';
        this.mainCtx.fillStyle = 'purple';
        let txtWidth = this.mainCtx.measureText(player.name).width;
        this.mainCtx.fillText(player.name, center.x - txtWidth / 2, center.y + 30);
    }

    public drawProjectile(projectile: ProjectileProperties, myPlayer?: PlayerProperties) {
        let travDistance = Math.sqrt(Math.pow(projectile.remOffset.x, 2) + Math.pow(projectile.remOffset.y, 2)) / (1 - projectile.progress);
        if (myPlayer) {
            var coordTransformed: CartCoord = {
                x: projectile.coord.x - myPlayer.coord.x,
                y: projectile.coord.y - myPlayer.coord.y,
                z: (-CONFIG.GRAVITY * projectile.progress * travDistance * travDistance / 2 / CONFIG.PROJ_SPEED / CONFIG.PROJ_SPEED - CONFIG.PROJ_LAUNCH_HEIGHT) * (projectile.progress - 1)
            }
        }
        else {
            var coordTransformed: CartCoord = {
                x: projectile.coord.x,
                y: projectile.coord.y,
                // z: Math.sqrt(Math.pow(200, 2) - Math.pow(200 * 2 * (projectile.progress - 0.5), 2))
                // z: 1 / 2 * (-CONFIG.GRAVITY) * Math.pow(projectile.progress * travDistance / CONFIG.PROJ_SPEED, 2) - (-CONFIG.GRAVITY * travDistance / 2 / CONFIG.PROJ_SPEED + CONFIG.PROJ_SPEED * 40 / travDistance) * (projectile.progress * travDistance / CONFIG.PROJ_SPEED) + 40
                z: (-CONFIG.GRAVITY * projectile.progress * travDistance * travDistance / 2 / CONFIG.PROJ_SPEED / CONFIG.PROJ_SPEED - CONFIG.PROJ_LAUNCH_HEIGHT) * (projectile.progress - 1)
            }
        }
        Calculator.rotateX(coordTransformed, CONFIG.MAP_VIEW_ANGLE);

        switch (projectile.team) {
            case Color.red: {
                this.mainCtx.fillStyle = 'red';
                break;
            }
            case Color.blue: {
                this.mainCtx.fillStyle = 'blue';
                break;
            }
        }
        // this.mainCtx.fillRect(coordTransformed.x + window.innerWidth / 2 - 5, coordTransformed.y + window.innerHeight / 2 - 5, 10, 10);
        this.mainCtx.moveTo(coordTransformed.x + window.innerWidth / 2, coordTransformed.y + window.innerHeight / 2);
        this.mainCtx.beginPath();
        this.mainCtx.arc(coordTransformed.x + window.innerWidth / 2, coordTransformed.y + window.innerHeight / 2, 5, 0, 2 * Math.PI);
        this.mainCtx.fill();
    }

    public clearGameCanvas() {
        this.mainCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }

    public renderFPS(fps: number) {
        this.mainCtx.font = '25px Arial';
        this.mainCtx.fillStyle = 'white';
        this.mainCtx.fillText("FPS: " + fps, 10, 30);
    }

}