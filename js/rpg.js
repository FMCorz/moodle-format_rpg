var TILESX = 20,
    TILESY = 20,
    TILESW = 32,
    TILESH = 32;

var maps = {
    0: {
        id: 0,
        bg: '#454645',
        warps: [
            {
                to: 1,
                x: 10,
                y: 10
            }
        ],
        npcs: [
            {
                type: 'dog',
                x: 18,
                y: 18
            }
        ],
        layer: 'world1layer1'
    },
    1: {
        id: 1,
        bg: '#ff9900',
        warps: [
            {
                to: 2,
                x: 200,
                y: 200
            }
        ],
        layer: 'world2layer1'
    },
    2: {
        id: 2,
        bg: '#ffff00',
        warps: [
            {
                to: 0,
                x: 400,
                y: 400
            }
        ],
        layer: 'world3layer1'
    }
};

var game = new Phaser.Game(TILESX * TILESW, TILESY * TILESH, Phaser.AUTO, 'container', {
    preload: preload,
    create: create,
    update: update,
    render: render
});

var player,
    map = maps[0],
    currentMap,
    tilemap,
    layer,
    warps,
    npcs = [];

function preload() {
    game.load.baseURL = '';
    game.load.spritesheet('dude', 'assets/dude.png', 32, 48);
    game.load.spritesheet('warp', 'assets/diamond.png', 32, 28);
    game.load.spritesheet('dog', 'assets/baddie.png', 32, 32);
    game.load.tilemap('map1', 'assets/tilemaps/maps/map1.json', null, Phaser.Tilemap.TILED_JSON);
    game.load.image('terrain_atlas_image', 'assets/terrain_atlas.png');
}

function create() {
    var sprite;
    game.physics.startSystem(Phaser.Physics.ARCADE);

    tilemap = game.add.tilemap('map1');
    tilemap.addTilesetImage('terrain_atlas', 'terrain_atlas_image');

    warps = game.add.group();
    warps.enableBody = true;
    for (var i = 0; i < 4; i++) {
        var warp = warps.create(0, 0, 'warp');
        warp.kill();
    }

    sprite = game.add.sprite(128, 128, 'dude');
    game.physics.arcade.enable(sprite);
    sprite.anchor.set(0.5, 0.5);
    sprite.body.collideWorldBounds = true;
    sprite.animations.add('left', [0, 1, 2, 3], 10, true);
    sprite.animations.add('right', [5, 6, 7, 8], 10, true);
    sprite.frame = 4;
    player = new Player(sprite);
    player.jumpToXY(4, 4);
    game.camera.follow(player.sprite);

    game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
    game.scale.pageAlignHorizontally = true;
    game.scale.pageAlignVertically = true;
    game.scale.setScreenSize(true);
}

function update() {
    var i;
    if (currentMap != map) {
        game.world.remove(layer);
        layer = tilemap.createLayer(map.layer);
        layer.resizeWorld();
        game.world.sendToBack(layer);
        tilemap.setCollisionByExclusion([183, 181], true, layer);

        // TODO Destroy all the elements from the previous map, memory leaks!!
        for (i = 0; i < npcs.length; i++) {
            npcs[i].destroy();
            delete npcs[i];
        }

        // New map transition
        //console.log(tilemap.layers);
        if (tilemap.layers.length > 0) {
            //tilemap.layers[tilemap.currentLayer].destroy();
            //layer = tilemap.createLayer('world2layer1');;
            //layer = tilemap.createLayer('world2layer1');
        }

        for (i = 0; i < 4; i++) {
            var warp = warps.getAt(i),
                infos = map.warps[i];

            if (infos) {
                warp.x = infos.x;
                warp.y = infos.y;
                // TODO Store the information somewhere else than in the sprite.
                warp.to = infos.to;
                warp.revive();
            } else {
                warp.kill();
            }
        }

        npcs = [];
        if (map.npcs) {
            for (i = 0; i < map.npcs.length; i++) {
                npcs.push(new NPC(map.npcs[i]));
            }
        }

        currentMap = map;
        return;
    }

    if (game.input.activePointer.isDown) {
        // TODO Not store destination here.
        var clear = true,
            x = game.input.activePointer.worldX,
            y = game.input.activePointer.worldY;
        for (i = 0; i < npcs.length; i++) {
            if (npcs[0].sprite.body.hitTest(x, y)) {
                clear = false;
                break;
            }
        }

        if (clear) {
            player.moveToXY(layer.getTileX(x), layer.getTileX(y));
            console.log(pathfinder(player.x, player.y, layer.getTileX(x), layer.getTileY(y), tilemap));
        }

        // game.physics.arcade.moveToXY(player, player.dest[0], player.dest[1], 200);
        // console.log(tilemap);
        // console.log(tilemap.getTileWorldXY(this.game.input.activePointer.x, this.game.input.activePointer.y));
        // player.x = this.game.input.activePointer.x - Math.floor(player.width / 2);
        // player.y = this.game.input.activePointer.y - Math.floor(player.height / 2);
    }

    game.physics.arcade.overlap(player.sprite, warps, warpOverlap, null, this);
    player.update();
    for (i = 0; i < npcs.length; i++) {
        game.physics.arcade.collide(npcs[i].sprite, player.sprite);
        npcs[i].update();
    }
}

function render() {
}

function warpOverlap(player, warp) {
    map = maps[warp.to];
}

function Character(sprite) {
    this.sprite = sprite;
    this.x = 0;
    this.y = 0;
    this.origin = {x: this.x, y: this.y};
    this.destination = {x: this.x, y: this.y};
    this.angle = 0;
    this.waypoints = [];
}
Character.prototype.destroy = function() {
    this.sprite.destroy();
};
Character.prototype.isMoving = function() {
    return !Phaser.Point.equals(this.sprite.body.velocity, new Phaser.Point(0,0));
};
Character.prototype.jumpToXY = function(x, y) {
    this.origin = {x: this.x, y: this.y};
    this.destination = {x: x, y: y};
    this.angle = 0;
    this.x = x;
    this.y = y;
    this.sprite.x = x * TILESW;
    this.sprite.y = y * TILESH;
};
Character.prototype.moveToXY = function(x, y) {
    this.origin = {x: this.x, y: this.y};
    this.destination = {x: x, y: y};
    this.angle = game.physics.arcade.moveToXY(this.sprite, x * TILESW, y * TILESH, 200);
};
Character.prototype.stop = function() {
    this.sprite.x = this.x * TILESW;
    this.sprite.y = this.y * TILESH;
    this.sprite.body.velocity.setTo(0, 0);
    this.sprite.animations.stop();
};
Character.prototype.update = function() {
    if (this.sprite.body.speed > 0) {
        var stopCondition,
            x = this.sprite.x,
            y = this.sprite.y,
            destX = this.destination.x * TILESW,
            destY = this.destination.y * TILESH;

        this.x = Math.round(x / TILESW);
        this.y = Math.round(y / TILESH);

        if (this.angle >= 0 && this.angle < Math.PI/2) {
            // Going bottom right.
            stopCondition = x >= destX && y >= destY;
            this.sprite.animations.play('right');
        } else if (this.angle >= Math.PI/2) {
            // Going bottom left.
            stopCondition = x <= destX && y >= destY;
            this.sprite.animations.play('left');
        } else if (this.angle >= -Math.PI && this.angle < -Math.PI/2) {
            // Going top left.
            stopCondition = x <= destX && y <= destY;
            this.sprite.animations.play('left');
        } else {
            // Going top right.
            stopCondition = x >= destX && y <= destY;
            this.sprite.animations.play('right');
        }

        if (stopCondition) {
            this.x = this.destination.x;
            this.y = this.destination.y;
            this.stop();
        } else {
            // this.angle = game.physics.arcade.moveToXY(this.sprite, this.destination.x * TILESW, this.destination.y * TILESH, 200);
        }
    }
    game.physics.arcade.collide(this.sprite, layer);
};

function Player() {
    Character.apply(this, arguments);
}
Player.prototype = Object.create(Character.prototype);
Player.prototype.constructor = Player;
Player.prototype.stop = function() {
    Character.prototype.stop.apply(this, arguments);
    this.sprite.frame = 4;
};

function NPC(infos) {
    // TODO Handle different types of NPCs somehow, probably somewhere else.
    var sprite = game.add.sprite(0, 0, infos.type);
    Character.apply(this, [sprite]);

    sprite.kill();
    game.physics.arcade.enable(sprite);
    sprite.body.collideWorldBounds = true;
    sprite.animations.add('left', [0, 1], 10, true);
    sprite.animations.add('right', [2, 3], 10, true);
    sprite.frame = 1;
    sprite.body.immovable = true;
    sprite.anchor.set(0.5, 0.5);

    this.infos = infos;
    this.jumpToXY(infos.x, infos.y);
    sprite.revive();

    sprite.inputEnabled = true;
    sprite.events.onInputUp.add(this.interact, this);
    this.text = null;
}
NPC.prototype = Object.create(Character.prototype);
NPC.prototype.constructor = NPC;
NPC.prototype.interact = function() {
    var str = 'Woof!',
        x,
        y;

    if (this.text) {
        this.text.destroy();
    }

    x = this.sprite.x;
    y = this.sprite.y - 10;
    this.text = game.add.text(x, y, str, {
        wordWrap: true,
        wordWrapWidth: 200,
        strokeThickness: 2,
        fontSize: 12,
        fill: '#ffffff'
    });
    this.text.anchor.set(0.5, 1);
    this.text.lifespan = 1000;
};
NPC.prototype.stop = function() {
    Character.prototype.stop.apply(this, arguments);
    this.sprite.frame = 1;
};
NPC.prototype.update = function() {
    Character.prototype.update.apply(this, arguments);
    // Disabling this feature for now.
    // if (!this.isMoving()) {
    //     if (this.x == 1) {
    //         this.moveToXY(this.infos.x, this.infos.y);
    //     } else {
    //         this.moveToXY(1, this.infos.y);
    //     }
    // }
};

function pathfinder(fromX, fromY, toX, toY, tilemap) {
    var COSTL = 10,
        COSTD = 14,
        opened = {},    // Open tiles and their evaluated costs.
        tilesG = {},    // Cost of tile from origin.
        tilesH = {},    // Cost of tile to destination.
        closed = [],
        parents = {},
        tmp;

    if (fromX == toX && fromY == toY) {
        return false;
    }

    opened[fromX + ':' + fromY] = (Math.abs(fromX - toX) + Math.abs(fromY - toY)) * COSTL;

    while (Object.keys(opened).length > 0) {
        var cheapest = null,
            diagonals,
            neighbours,
            keys,
            currentKey,
            i,
            x,
            y;

        keys = Object.keys(opened);
        for (i = 0; i < keys.length; i++) {
            if (cheapest == null || cheapest > opened[keys[i]]) {
                currentKey = keys[i];
                cheapest = opened[currentKey];
                tmp = currentKey.split(':')
                x = parseInt(tmp[0], 10);
                y = parseInt(tmp[1], 10);
            }
        }

        if (x == toX && y == toY) {
            break;
        }

        neighbours = [((x-1) + ':' + (y-1)),(x + ':' + (y-1)),((x+1) + ':' + (y-1)),
                      ((x-1) + ':' + y),                      ((x+1) + ':' + y),
                      ((x-1) + ':' + (y+1)),(x + ':' + (y+1)),((x+1) + ':' + (y+1))];
        diagonals = [((x-1) + ':' + (y-1)),((x+1) + ':' + (y-1)),
                     ((x-1) + ':' + (y+1)),((x+1) + ':' + (y+1))];

        // Check the neighbouring tiles.
        for (i = 0; i < neighbours.length; i++) {
            var key = neighbours[i],
                costParent,
                cost,
                g,
                h,
                tile;

            console.log(key);

            if (closed.indexOf(key) != -1) {
                continue;
            }

            // Get the tile.
            tmp = key.split(':')
            tile = tilemap.getTile(tmp[0], tmp[1]);
            if (!tile) {
                console.log(key);
            } else if (tile.collideUp) {
                continue;
            }

            // Get the tile cost.
            cost = COSTL;
            if (diagonals.indexOf(key) != -1) {
                cost = COSTD;
            }

            // Get the parent cost.
            costParent = 0
            if (opened[x + ':' + y]) {
                costParent = opened[x + ':' + y];
            }

            // Calculate G.
            // TODO Account for the tile 'friction'.
            g = costParent + cost;
            h = (Math.abs(parseInt(tmp[0], 10) - toX) + Math.abs(parseInt(tmp[1], 10) - toY)) * COSTL

            // Check if the tile already had a value, and if its better.
            if (tilesG[key] && tilesG[key] < g) {
                g = tilesG[key];
            } else {
                parents[key] = x + ':' + y
            }

            // Store the G, H and F.
            tilesG[key] = g;
            tilesH[key] = h;
            opened[key] = g + h;
        }

        closed.push(currentKey);
        delete opened[currentKey];
    }

    // Send back the path.
    var path = [],
        child;
    path.push([toX, toY]);
    child = toX + ':' + toY
    while (true) {
    
        // Parent does not exist?!
        if (!parents[child]) {
            return false
        }
            
        // Add parent before child.
        path.unshift(child);
        child = parent
        
        // We made it!
        if (child == fromX + ':' + fromY) {
            break;
        }
    }

    return path
}
