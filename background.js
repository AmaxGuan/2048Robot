chrome.browserAction.onClicked.addListener(function(tab) {
  chrome.tabs.sendMessage(tab.id, {type: "play"});
});

var embed = document.getElementById("expectimax");
var listener = document.getElementById("listener");
// multi tab will have problem, fix if needed
var lastTab = null;
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse){
	lastTab = sender.tab.id
	if (request.type == "getMove") {
		embed.postMessage(request.board);
	}
})

listener.addEventListener('load', function() {console.log("module load");}, true);
listener.addEventListener('message', function(msg) {
	var dir = -1
	if (msg.data != -1)
		dir = [0, 2, 3, 1][msg.data]
	if (lastTab) {
		if (dir != -1)
			chrome.tabs.sendMessage(lastTab, {type:"move", dir: dir});
		lastTab = null;
	}
}, true);
listener.addEventListener('error', function(ev) {console.error("module error:" + embed.lastError);}, true);
listener.addEventListener('crash', function(ev) {console.error("module crashed");} , true);