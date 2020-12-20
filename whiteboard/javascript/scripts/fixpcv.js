"use strict";
var fixpcv = (function() {
	var hasUndo = false;

	function process(pcv) {
		var avEventTime = avEvTimeInPCV(pcv);
		var filter = Math.ceil(20 / avEventTime);
		// console.log("   avEventTime: " + avEventTime + ", filter: " + filter);

		fixPCV(pcv, false, filter);
		for (var i in pcv.pcvModules) {
			for (var key in pcv.pcvModules[i].pcvData) {
				fixPCV(pcv.pcvModules[i].pcvData[key], true, filter);
			}
		};
		return pcv;
	};

	function fixPCV(pcv, isPcvModule, fl) {
		if (isPcvModule) {
			if (pcv.audio) {
				delete pcv.audio;
			}				
			if (pcv.segments.json.audio) {
				delete pcv.segments.json.audio;
			}				
			pcv.segments.json.whiteboardEvents = filterEvents(pcv.segments.json.whiteboardEvents, fl);
			for (var i in pcv.jsCursorData) {
				fixJsCursorEvent(pcv.jsCursorData[i]);
			}
		}
		else {
			for (var i in pcv.segments) {
				if (pcv.segments[i].json.audio) {
					delete pcv.segments[i].json.audio;
				}					
				pcv.segments[i].json.whiteboardEvents = filterEvents(pcv.segments[i].json.whiteboardEvents, fl);
			};				

			for (var i in pcv.jsCursorData) {
				for (var j in pcv.jsCursorData[i]) {
					fixJsCursorEvent(pcv.jsCursorData[i][j]);
				}
			}
		}
	};

	function filterEvents(events, fl) {
		var newEvents = [];
		var time = 0, m = 0;

		var nthEvent = fl; // each nth event to keep (level of filtering)
		var lastnEvents = 4; // number of last events in a set of mousemove events (tip precision)

		for (var j = 0; j < events.length; j++) {
			var event = deleteExtras(events[j]);
			if (event.action.selector === 'handleMousemove') {
		        if (m % nthEvent == 0) {
		        	newEvents.push(event);
		        }
		        else {
			        for (var k = 1; k <= Math.min(nthEvent - 1, lastnEvents); k++) {
			        	if (j + k < events.length && 
			        		events[j + k].action.selector !== 'handleMousemove')
			        	{
			        		newEvents.push(event);		
			        		break;
			        	}
			        }			        	
		        }
		        m++;
			}
			else {
				newEvents.push(event);	
				m = 0;

				if (event.action.selector === 'handleUndoRedo' && 
					 	 (event.action.argument === 'undo' || event.action.argument === 'redo') &&
						 !hasUndo) {
					hasUndo = true;
					console.log('ALERT needs manual fixing due to UNDO..');
				}
			}
		}			

		if (newEvents[0].action.selector !== 'recordingStarted') {
			newEvents.unshift({
				time: 0,
				action: {
					selector: 'recordingStarted'
				}
			});
		}

		while(newEvents[newEvents.length - 1].action.selector !== 'recordingComplete') {
			newEvents.pop();
		}

		return newEvents;
	};

	function avEvTimeInPCV(pcv) {
		var time = 0, avTime = 0, count = pcv.segments.length;
		for (var i in pcv.segments) {
			avTime = avEvTimeInSeg(pcv.segments[i].json.whiteboardEvents);
			if (avTime == 0 && count > 0) {
				count--;
			}
			else {
				time += parseFloat(avTime);
			}
		};
		for (var i in pcv.pcvModules) {
			for (var key in pcv.pcvModules[i].pcvData) {
				count += 1;
				avTime = avEvTimeInSeg(pcv.pcvModules[i].pcvData[key].segments.json.whiteboardEvents);
				if (avTime == 0 && count > 0) {
					count--;
				}
				else {
					time += parseFloat(avTime);
				}
			}
		};		

		return time / count;
	};

	function avEvTimeInSeg(events) {
		var time = 0, count = 0; 
		var gTime = 0, gCount = 0;
		var avTime = 0;

		for (var j = 0; j < events.length; j++) {
			var event = events[j];
			if (event.action.selector === 'handleMousedown') {
				time = 0;
				count = 0;
			}
			else if (event.action.selector === 'handleMousemove') {
				count++;
				if (time == 0) {
					time = event.time;
				};
				if (events[j+1].action.selector !== 'handleMousemove') {
					time = event.time - time;

					gTime += time;
					gCount += count;						

					// console.log(count + " in " + time + "ms, average: " + (time / count).toFixed(3) + "ms");
				}	
			}
		}		
		avTime = gCount > 0 ? (gTime / gCount).toFixed(3) : 0;
		
		// console.log("***************");
		// console.log("average " + avTime + "ms");

		return avTime;
	};		

	function deleteExtras(event) {
		delete event.gTime;	
		if (event.action.selector === 'handleMouseup' ||
			event.action.selector === 'handleMousedown' ||
			event.action.selector === 'handleMousemove') 
		{
			delete event.action.argument.clientX;	
			delete event.action.argument.clientY;
		}
		return event;
	};

	function fixJsCursorEvent(event) {
		if (event.hasOwnProperty('point')) {
			event.x = event.point.x;
			event.y = event.point.y;
			event.t = event.time;

			delete event.point;
			delete event.gTime;
			delete event.time;
		}					
		event.x = Math.round(event.x);
		event.y = Math.round(event.y);	
	};			

	return {
		process: process
	};

})();

if (typeof module !== 'undefined' && module.exports) {
	module.exports = fixpcv;	
};
