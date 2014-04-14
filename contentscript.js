(function () {

  var SIZE = 4;

// directions
  var UP = 0;
  var RIGHT = 1;
  var DOWN = 2;
  var LEFT = 3;


//////////////////
//parse board funcs

  //rotate cells counter clockwise 90degree, n times
  function rotateCells(cells, n) {
    n = n % 4;
    if (n < 0) n += 4;
    console.assert(n < 4 && n >= 0);
    var ret = cells;
    for (var i = 0; i < n; ++i) {
      ret = emptyCells();
      for (var x = 0; x < SIZE; ++x) {
        for (var y = 0; y < SIZE; ++y) {
          ret[y][SIZE - 1 - x] = cells[x][y];
        }
      }
      cells = ret;
    }
    return ret;
  }

  function cellsToStr(cells) {
    var str = '';
    for (var y = 0; y < SIZE; ++y) {
      for (var x = 0; x < SIZE; ++x) {
        val = cells[x][y];
        str += (val + '      ').substr(0 , 6) + ((x === SIZE - 1) ? '\n' : '|');
      }
    }
    return str;
  }

  function emptyCells() {
    var cells = [];
    for (var x = 0; x < SIZE; x++) {
      var col = cells[x] = [];
      for (var y = 0; y < SIZE; y++) {
        col.push(null);
      }
    }
    return cells;
  }

  function readBoard() {
    var cells = emptyCells();
    var tiles = document.querySelectorAll(".tile-inner");


    for (var i = 0, len = tiles.length; i < len; ++i) {
      var tile = tiles[i];
      var val = +tile.innerText;
      var parent = tile.parentNode;
      var match = parent.className.match(/tile-position-(\d)-(\d)/);
      if (match.length == 3) {
        var x = +match[1] - 1;
        var y = +match[2] - 1;
        cells[x][y] = val; 
        //console.debug(['x=',x, 'y=', y,'val=', val].join(' '));
      } else {
        console.error("tile parse error")
      }
    }
    console.debug(['cells= \n',cellsToStr(cells)].join(''));
    return cells;
  }

/////////////////////
//move funcs  

  // there is a webkit bug! you cannot use KeyboardEvent, even today!!!
  function injectToPage(code) {
    var s = document.createElement('script');
    s.textContent = code;
    (document.head||document.documentElement).appendChild(s);
    s.parentNode.removeChild(s);
  }
  injectToPage(triggerKeyboardEvent.toString());
  
  function triggerKeyboardEvent(el, keyCode)
  {
      var eventObj = document.createEventObject ?
          document.createEventObject() : document.createEvent("Events");
    
      if(eventObj.initEvent){
        eventObj.initEvent("keydown", true, true);
      }
    
      eventObj.keyCode = keyCode;
      eventObj.which = keyCode;
      
      el.dispatchEvent ? el.dispatchEvent(eventObj) : el.fireEvent("onkeydown", eventObj); 
  }

  function makeMove(dir) {
    var map = {
      0: 38, // Up
      1: 39, // Right
      2: 40, // Down
      3: 37, // Left
    };
    injectToPage('triggerKeyboardEvent(document.body, ' + map[dir] + ');');
  }

//////////////////////
// cells calculation

  function withinBounds(x) {
    return x >= 0 && x < SIZE ;
  };

  function tileOccupied(cells, x, y) {
    return cells[x][y] !== null;
  }

  function nextTile(cells, x, y, step) {
    if (!step) step = 1;
    console.assert(Math.abs(step) === 1);
    for (y += step; y < SIZE; y += step) {
      if (tileOccupied(cells, x, y)) {
        return {x: x, y: y, val: cells[x][y]};
      }
    }
    return null;
  }

  function getNextCells(cells, dir) {
    var nextCells = emptyCells();
    cells = rotateCells(cells, dir);
    for (var x = 0; x < SIZE; ++x) {
      var merged = false;
      for (var y = 0; y < SIZE; ++y) {
        var val = cells[x][y];
        if (tileOccupied(cells, x, y)) {
          var nT = nextTile(nextCells, x, y, -1);
          if (!nT) {
            nextCells[x][0] = val;
          } else {
            console.assert(nT.y < 3);
            if (nT.val == val && !merged) {
              nextCells[x][nT.y] = nT.val + val;
              merged = true;
            } else {
              nextCells[x][nT.y + 1] = val;
            }
          }
        }
      }
    }
    return rotateCells(nextCells , -dir);
  }

///////////////////////////
// AI
  function cellsEqual(a, b) {
    for (var x = 0; x < SIZE; ++x) {
      for (var y = 0; y < SIZE; ++y) {
        if (a[x][y] != b[x][y])
          return false;
      }
    }
    return true;
  }

  function canMakeMove(cells, dir) {
    return !cellsEqual(getNextCells(cells, dir), cells);
  }

  var DEPTH = 3;
  var LOST = -1000000000;

  var PRIOR = [
    [12,13,14,15],
    [11,10, 9, 8],
    [ 4, 5, 6, 7],
    [ 3, 2, 1, 0]
  ];

  function visitCells(cells, callback) {
    for (var x = 0; x < SIZE; ++x) {
      for (var y = 0; y < SIZE; ++y) {
        callback(cells[x][y], x, y);
      }
    }
  }

  function getAvailable(cells) {
    var arr = [];
    visitCells(cells, function(val, x, y) {
      if (val == null)
        arr.push({x: x, y: y});
    });
    return arr;
  }

  function getScore(cells) {
    var avail = getAvailable(cells).length;
    if (avail == 0)
      return LOST;
    var score = 0;
    visitCells(cells, function(val, x, y) {
      score +=  val << (PRIOR[x][y]);
    });
    score += 1024 << avail;
    return score;
  }

  function getBestGuess(cells) {
    function guessHelper(cells, depth) {
      if (depth == DEPTH)
        return [-1, getScore(cells)];
      var maxScore = LOST;
      var bestDir = -1;
      [LEFT, DOWN, UP, RIGHT].forEach(function(dir) {
        var nCells = getNextCells(cells, dir);
        if (cellsEqual(nCells, cells))
          return;
        //enemy move
        var avail = getAvailable(nCells);
        var minScore = Number.MAX_VALUE;
        if (avail.length > 6) {
          // do random move, if to many available, take the most priority one
          var sel = null;
          var maxPrior = -1
          avail.forEach(function(pos) {
            if (PRIOR[pos.x][pos.y] > maxPrior) {
              maxPrior = PRIOR[pos.x][pos.y];
              sel = pos;
            }
          });
          [2, 4].forEach(function(val) {
            nCells[sel.x][sel.y] = val;
            var score = guessHelper(nCells, depth + 1)[1];
            nCells[sel.x][sel.y] = null;
            if (score < minScore) 
              minScore = score;
          });
        } else {
          for (var x = 0; x < SIZE; ++x) {
            for (var y =0; y < SIZE; ++y) {
              [2, 4].forEach(function(val) {
                if (!tileOccupied(cells, x, y)) {
                  nCells[x][y] = val;
                  var score = guessHelper(nCells, depth + 1)[1];
                  nCells[x][y] = null;
                  if (score < minScore) 
                    minScore = score;
                }
              });
            }
          }
        }
        console.assert(minScore != Number.MAX_VALUE);
        if (minScore > maxScore) {
          maxScore = minScore;
          bestDir = dir;
        }
      });
      console.assert(bestDir != -1);
      return [bestDir, maxScore];
    }
    var ret = guessHelper(cells, 0)
    console.debug("score = " + ret[1])
    return ret[0];
  }


//////////////////
// main loop
  var GUESSING = false;
  var INTERVAL = 200;
  function mainLoop() {
    if (GUESSING == false)
      return;
    if (document.querySelector(".game-over") != null && 
        window.getComputedStyle(document.querySelector(".game-over")).display === "block") {
      GUESSING = false;
      return;
    }
    var cells = readBoard();
    var dir = getBestGuess(cells);
    makeMove(dir);
    setTimeout(mainLoop, 200);
  }

  function startGuess() {
    GUESSING = true;
    mainLoop();
  }

  function stopGuess() {
    GUESSING = false;
  }

  function swtichGuess() {
    if (GUESSING) {
      stopGuess();
    } else {
      startGuess();
    }
  }
//////////////////
//unit test funcs
  function unitTests() {
    var cells = readBoard(); 

    // test move
    var nCells = getNextCells(cells, UP);
    console.debug("UP");
    console.debug(cellsToStr(nCells));
    nCells = getNextCells(cells, UP);
    console.debug("DOWN");
    console.debug(cellsToStr(nCells));
    nCells = getNextCells(cells, LEFT);
    console.debug("LEFT");
    console.debug(cellsToStr(nCells));
    nCells = getNextCells(cells, RIGHT);
    console.debug("RIGHT");
    console.debug(cellsToStr(nCells));

    // test rotate
    cells = rotateCells(cells, 3);
    console.debug(cellsToStr(cells));

    // test makeMove, destructive
    // makeMove(UP);

  }

  // execute
  chrome.runtime.onMessage.addListener(function (message) {
    if (message == "play") {
      // unitTests();
      swtichGuess();
    }
  });
}());