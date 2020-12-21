"use strict";
(function ($) {

	var PCV = {
		log: function (text) {
			// console.log('PCV:[jsCursor] ' + text);
		}
	}

	// var img = new Image();
	// img.src = 'images/cross.png';

	// let $cursorCanvas = $('#cursorCanvas');
	// let cursorCanvasCtx = $cursorCanvas.get(0).getContext('2d');


	var backup, speed = 1;

	$.fn.jsCursor = function (method) {

		var methods = {
			init: function (options) {
				this.jsCursor.settings = $.extend({}, this.jsCursor.defaults, options);
				var settings = this.jsCursor.settings;

				return this.each(function () {

					var $element = $(this);
					var context = createContext();

					context.this = $element;

					$element
						.data('jsCursorContext', context)
						.data('jsCursorSettings', settings);

					$('<div>')
						.addClass('pointer')
						.appendTo($element);

				});
			},
			startRecording: function (timestamp) {
				this.each(function () {
					var $element = $(this);
					var context = $element.data('jsCursorContext');

					var point1, point2;

					context.startTime = new Date();
					context.startTime.setTime(timestamp.getTime());

					context.events = [];
					context.segments.push(context.events);

					$element.on('mousemove.jsCursor touchmove.jsCursor', function (event) {
						if (context.isDisabled) {
							return;
						};

						if (!point1) {
							point1 = utils.createPoint($element, event);
						};
						point2 = utils.createPoint($element, event);

						if (utils.pointDistance(point1, point2) >= 5) {
							point1 = point2;
							var time = new Date() - context.startTime;

							context.events.push({
								t: time,
								x: point2.x,
								y: point2.y
							});
						};
					});
				});
			},
			stopRecording: function (timestamp) {
				this.each(function () {
					var $element = $(this);
					var context = $element.data('jsCursorContext');

					context.stopTime = new Date();
					context.stopTime.setTime(timestamp.getTime());

					var time = context.stopTime - context.startTime;

					context.events.push({
						t: time,
						x: 0,
						y: 0
					});

					$element.off('mousemove.jsCursor touchmove.jsCursor');
				});
			},
			play: function () {
				this.each(function () {
					var $element = $(this);
					var context = $element.data('jsCursorContext');

					if (!context.segments || context.segments.length == 0) {
						return;
					};

					if (context.segments[0].length == 0) {
						return;
					};

					play(context);
				});
			},
			pause: function () {
				this.each(function () {
					var $element = $(this);
					var context = $element.data('jsCursorContext');

					pause(context);
				});
			},
			setTime: function (time) {
				this.each(function () {
					var $element = $(this);
					var context = $element.data('jsCursorContext');

					setTime(time, context);
				});
			},
			setSpeed: function (newSpeed) {
				speed = newSpeed;
			},
			reset: function () {
				this.each(function () {
					resetContext($(this).data('jsCursorContext'));
				});
			},
			enable: function () {
				this.each(function () {
					// var context = $(this).data('jsCursorContext');
					// context.isDisabled = false;					
				});
			},
			disable: function () {
				this.each(function () {
					// var context = $(this).data('jsCursorContext');
					//context.isDisabled = true;					
				});
			},
			loadData: function (segments) {
				this.each(function () {
					if (!segments || segments.length == 0) {
						return;
					};

					var $element = $(this);
					var context = createContext();

					$element.data('jsCursorContext', context);

					context.segments = segments;
					context.events = context.segments[context.segmentIndex];
					context.this = $element;

					processJSON(context);
				});
			},
			forceUpdate: function (time) {
				this.each(function () {
					$(this).data('jsCursorContext').time.global = time;
				});
			},
			backup: function () {
				return this.each(function () {
					backup = $(this).data('jsCursorContext');
				});
			},
			restore: function () {
				return this.each(function () {
					$(this).data('jsCursorContext', backup);
				});
			},
			forceSegmentChange: function (index) {
				return this.each(function () {
					var context = $(this).data('jsCursorContext');
					if (index >= context.segments.length) {
						return;
					};

					context.eventIndex = 0;
					context.segmentIndex = index;
					context.events = context.segments[context.segmentIndex];
					context.time.global = context.events[0].gTime;
				});
			}
		};

		if (methods[method]) {
			return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
		} else if (typeof method === 'object' || !method) {
			return methods.init.apply(this, arguments);
		} else {
			$.error('Method "' + method + '" does not exist in jsCursor plugin!');
		}
	};

	$.fn.jsCursor.defaults = {};


	function moveCursor(context) {
		var event = context.events[context.eventIndex];

		var delay = event.gTime - context.time.global;
		context.time.global = event.gTime;

		// if (context.eventIndex % 50 == 0) {
		// 	context.time.global = new Date().getTime() - context.playTimestamp.getTime();
		// };

		context.timer = setTimeout(function () {
			context.eventIndex++;

			context.this.find('.pointer').fadeIn().css({
				transform: 'translate(' + event.point.x + 'px,' + event.point.y + 'px)'
			});

			// $cursorCanvas.fadeIn();

			// cursorCanvasCtx.clearRect(0, 0, cursorCanvasCtx.canvas.width, cursorCanvasCtx.canvas.height);
			// cursorCanvasCtx.drawImage(img, event.point.x - 16, event.point.y - 16);

			clearTimeout(context.poiterTimeout);
			context.poiterTimeout = setTimeout(() => {
				context.this.find('.pointer').fadeOut();
				// $cursorCanvas.fadeOut();
			}, 500);

			if (context.eventIndex < context.events.length) {
				moveCursor(context);
			}
			else {
				if (context.segmentIndex < context.segments.length - 1) {
					context.eventIndex = 0;
					context.segmentIndex++;
					context.events = context.segments[context.segmentIndex];

					moveCursor(context);
				}
				else {
					PCV.log('done');
					context.this.find('.pointer').fadeOut();

					context.segmentIndex = 0;
					context.eventIndex = 0;
				}
			}
		}, delay / speed);
	};


	function play(context) {
		context.this.find('.pointer').fadeIn();

		if (context.eventIndex == context.events.length && context.segmentIndex < context.segments.length - 1) {
			context.eventIndex = 0;
			context.segmentIndex++;
			context.events = context.segments[context.segmentIndex];
		}

		// PCV.log('play > time.global: ' + context.time.global);				
		moveCursor(context);
	};


	function pause(context) {
		clearTimeout(context.timer);
	};


	function setTime(time, context) {
		for (var i in context.segments) {
			var segment = context.segments[i];
			for (var j in segment) {
				var event = segment[j];
				if (time < event.gTime) {

					context.eventIndex = j;
					context.segmentIndex = i;
					context.time.global = time;

					context.events = context.segments[context.segmentIndex];
					var event = context.events[context.eventIndex];

					context.this.find('.pointer').css({
						transform: 'translate(' + event.point.x + 'px,' + event.point.y + 'px)'
					});

					return;
				}
			}
		}
	};


	function processJSON(context) {
		var timeIncrement = 0;
		for (var i in context.segments) {
			var events = context.segments[i];
			for (var j in events) {
				var event = events[j];
				if (!event.point) {
					event.point = {
						x: event.x,
						y: event.y
					},
						event.time = event.t;

					delete event.x;
					delete event.y;
					delete event.t;
				};

				event.gTime = event.time + timeIncrement;

				if (j == events.length - 1) {
					timeIncrement = event.gTime;
				}
			}
		};
	}


	var utils = {
		createPoint: function (node, event) {
			return {
				x: (event.type.startsWith('touch') ? event.originalEvent.touches[0].pageX : event.pageX) - node.offset().left,
				y: (event.type.startsWith('touch') ? event.originalEvent.touches[0].pageY : event.pageY) - node.offset().top
			}
		},
		pointDistance: function (p1, p2) {
			return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
		}
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


	function resetContext(context) {
		context.time = {
			local: 0,
			global: 0
		};

		context.eventIndex = 0;
		context.segmentIndex = 0;

		context.events = context.segments[context.segmentIndex];
	};


})(jQuery);

