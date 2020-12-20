"use strict";
(function($) {

	var PCV = {
		log: function(text) {
			// console.log('PCV:[jsTimeline] ' + text);
		}
	}	

	var context, backup, speed = 1;

	var callback = {
		onReset: function(toolbarSetup, whiteboardSetup) {
			if (typeof $.fn.jsTimeline.settings.onReset === 'function') {
				$.fn.jsTimeline.settings.onReset(toolbarSetup, whiteboardSetup);
			};
		},								
		onDataLoaded: function(toolbarSetup, whiteboardSetup) {	
			if (typeof $.fn.jsTimeline.settings.onDataLoaded === 'function') {
				$.fn.jsTimeline.settings.onDataLoaded(toolbarSetup, whiteboardSetup);
			};
		},
		onEventReady: function(event, timeline, seekLoop) {	
			if (typeof $.fn.jsTimeline.settings.onEventReady === 'function') {
				return $.fn.jsTimeline.settings.onEventReady(event, timeline, seekLoop);
			};
		},
		onBeforeSeek: function(toolbarSetup, whiteboardSetup) {
			if (typeof $.fn.jsTimeline.settings.onBeforeSeek === 'function') {
				$.fn.jsTimeline.settings.onBeforeSeek(toolbarSetup, whiteboardSetup);
			};								
		},
		onAfterSeek: function(argument) {
			if (typeof $.fn.jsTimeline.settings.onAfterSeek === 'function') {
				$.fn.jsTimeline.settings.onAfterSeek(argument);
			};								
		},
		onSegmentWillChange: function(timeline, callback) {
			if (typeof $.fn.jsTimeline.settings.onSegmentWillChange === 'function') {
				$.fn.jsTimeline.settings.onSegmentWillChange(timeline, callback);
			};					
		},
		onSegmentChange: function(index, toolbarSetup, whiteboardSetup) {
			if (typeof $.fn.jsTimeline.settings.onSegmentChange === 'function') {
				PCV.log('onSegmentChange');
				$.fn.jsTimeline.settings.onSegmentChange(index, toolbarSetup, whiteboardSetup);
			};					
		},
		onSegmentComplete: function(argument) {
			if (typeof $.fn.jsTimeline.settings.onSegmentComplete === 'function') {
				PCV.log('onSegmentComplete');
				return $.fn.jsTimeline.settings.onSegmentComplete(argument);
			};					
		},
		onSessionComplete: function(argument) {
			if (typeof $.fn.jsTimeline.settings.onSessionComplete === 'function') {
				PCV.log('onSessionComplete');
				$.fn.jsTimeline.settings.onSessionComplete(argument);
			};			
		},
		onQuizReady: function(context) {
            if (typeof $.fn.jsTimeline.settings.onQuizReady === 'function') {
				$.fn.jsTimeline.settings.onQuizReady(context);
            };			
		},
		onForceSegmentChange: function(context) {
            if (typeof $.fn.jsTimeline.settings.onForceSegmentChange === 'function') {
				$.fn.jsTimeline.settings.onForceSegmentChange(context);
            };			
		}						
	};	

    $.fn.jsTimeline = function(method) {

        var methods = {
            init: function(options) {
                this.jsTimeline.settings = $.extend({}, this.jsTimeline.defaults, options);
                var settings = this.jsTimeline.settings;            

                return this.each(function() {

                });
            },
            play: function() {
                return this.each(function() {
                	play();
                });
            },
            pause: function() {
                return this.each(function() {
					pause();
                });
            },            
            reset: function() {
                return this.each(function() {
					reset();
                });
            },            
            setTime: function(time) {
                return this.each(function() {
					setTime(time);
                });
            },
            setSpeed: function(newSpeed) {
            	speed = newSpeed;
            },
            loadData: function(data) {
                return this.each(function() {
					loadData(data);
                });
            },  
            backup: function() {
                return this.each(function() {
					backup = context;
				});
            },  
            restore: function() {
                return this.each(function() {
					context = backup;		
                });
            },
            forceUpdate: function(time) {
				context.time.global = time;
            },
            forceSegmentChange: function(index) {
            	return this.each(function() {
            		if (index == context.segments.length) {
            			callback.onSessionComplete();					
            		}
            		else {
		            	context.eventIndex = 0;
		            	context.segmentIndex = index;
		            	context.events = context.segments[context.segmentIndex].whiteboardEvents;
						
						context.time.global = context.events[0].gTime;
						context.time.local = 0;					

						callback.onForceSegmentChange(context);					
               		}
				});
            }
        };

        if (methods[method]) {
            return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return methods.init.apply(this, arguments);
        } else {
            $.error('Method "' + method + '" does not exist in nvrednerViewer plugin!');
        }
    };

    $.fn.jsTimeline.defaults = {};
		

	function loadData(segments) {
		if (!segments || segments.length == 0) {
			return;
		};

		context = createContext();
		
		context.segments = segments;
		context.events = context.segments[context.segmentIndex].whiteboardEvents;

		callback.onDataLoaded(
			context.segments[context.segmentIndex].toolbarSetup,
			context.segments[context.segmentIndex].whiteboardSetup
		);		
	};


	function setTime(time) {
		context.seeker = {
			time: time,
			currentIndex: 0
		};

		for (var i in context.segments) {
			var segment = context.segments[i];
			for (var j in segment.whiteboardEvents) {
				var event = segment.whiteboardEvents[j];
				if (time < event.gTime) {

					context.seeker.eventIndex = Math.max(0, j - 1);
					context.seeker.segmentIndex = i

					startSeeking();
					
					return;
				}
			}
		}
	};	


	function rednerView() {
		if (context.paused) {
			return;
		}

		var event = context.events[context.eventIndex + 1];

		// event.gTime -= (context.audioDelta ? context.audioDelta : 0);

		//skip few ms
		// var next = event;
		// while(next.time < event.time + 10 &&
		// 	context.eventIndex < context.events.length-1) {
		//     next = context.events[1+Number(context.eventIndex)];
		//     if (next.action.selector == 'handleMousemove') {
		// 		context.eventIndex++; //skip next 15ms
		//     } else {
		//     	break;
		//     }
		// }

		var delay = event.gTime - context.time.global;
		context.time.global = event.gTime;

		context.timer = setTimeout(function() {
			context.eventIndex++;
			callback.onEventReady(event, context, false);
			
			if (context.eventIndex + 1 < context.events.length) {
				rednerView();
			} 
			else {
				callback.onSegmentComplete(context.segmentIndex);
			}
		}, delay / speed);			
	};

	function play() {
		context.paused = false;
		if (context.eventIndex + 1 == context.events.length) {
			if (context.segmentIndex < context.segments.length - 1) {
				callback.onSegmentWillChange(context, function() {
					context.eventIndex = 0;
					context.segmentIndex++;
					context.events = context.segments[context.segmentIndex].whiteboardEvents;		
					context.audioDelta = getAudioDelta();
					
					PCV.log('audio delta: ' + context.audioDelta + ', each event global time is to be decreased by the delta');									

					rednerView();	
							
					callback.onSegmentChange(
						context.segmentIndex,
						context.segments[context.segmentIndex].toolbarSetup,
						context.segments[context.segmentIndex].whiteboardSetup
					);	

				});
			}
			else {
				callback.onSessionComplete();
			}
		} 
		else {
			rednerView();
		}
	};

	function pause() {
		clearTimeout(context.timer);
		context.paused = true;
	};


	function reset() {
		var segments = context.segments;
	
		context = createContext();
		context.segments = segments;
		context.events = context.segments[context.segmentIndex].whiteboardEvents;

		callback.onReset(
			context.segments[context.segmentIndex].toolbarSetup,
			context.segments[context.segmentIndex].whiteboardSetup
		);				
	};


	function startSeeking() {
		PCV.log('time:' + formatTime(context.seeker.time) + ', segment:' + (parseInt(context.seeker.segmentIndex) + 1));

		if (context.segmentIndex == context.seeker.segmentIndex && context.eventIndex < context.seeker.eventIndex) {
			context.seeker.currentIndex = context.eventIndex;
			context.eventIndex = context.seeker.eventIndex;

			callback.onBeforeSeek();
		}
		else {
			context.eventIndex = context.seeker.eventIndex;
			context.segmentIndex = context.seeker.segmentIndex;
			context.events = context.segments[context.segmentIndex].whiteboardEvents;

			context.audioDelta = getAudioDelta();

			PCV.log('audio delta: ' + context.audioDelta + ', each event global time is to be decreased by the delta');				

			callback.onBeforeSeek(
				context.segments[context.segmentIndex].toolbarSetup,
				context.segments[context.segmentIndex].whiteboardSetup
			);			
		}

		context.seeker.stack = 0;
		context.time.global = context.seeker.time;
		context.time.local = context.time.global - context.events[0].gTime;

		setTimeout(function() {
			handleEvents();
		}, 100);	
	};


	function handleEvents() {
		context.seeker.stack++;
		if (context.seeker.currentIndex < context.seeker.eventIndex) {
			context.seeker.currentIndex++;
			var needsDelay = callback.onEventReady(context.events[context.seeker.currentIndex], context, true);
			if (needsDelay || !(context.seeker.stack % 500)) {
				setTimeout(handleEvents, 15);
			}
			else {
				handleEvents();
			}
		}
		else {
			seekingComplete();
		}
	};


	function seekingComplete() {
		callback.onAfterSeek(context);
	};


	function createContext() {
		return {	
			date: 0,
			time: {
				local: 0,
				global: 0
			},
			timer: null,
			events: [],
			segments: [],
			eventIndex: 0,
			segmentIndex: 0,
			audioDelta: 0
		}
	};


	function getAudioDelta() {
		var audioTrackDuration = 0;
		for (var i = 0; i < context.segmentIndex; i++) {
			audioTrackDuration += context.segments[i].audioTrackDuration;
		}
		return context.events[0].gTime - audioTrackDuration;
	};


    function formatTime(milliseconds) {
        var number = milliseconds / 1000;

        var minutes = parseInt(number / 60 ) % 60;
        var seconds = parseInt(number % 60);

        return (minutes < 10 ? "0" + minutes : minutes) + ":" +
               (seconds  < 10 ? "0" + seconds : seconds);    
    };


})(jQuery);



