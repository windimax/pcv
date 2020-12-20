"use strict";
(function($) {
    $.fn.whiteboardRecorder = function(method) {

        var methods = {
            init: function(options) {
                this.whiteboardRecorder.settings = $.extend({}, this.whiteboardRecorder.defaults, options);
                var settings = this.whiteboardRecorder.settings;

                return this.each(function() {
                	var $element = $(this);
                    $element.data('settings', settings);

                    settings.events = [];
                    settings.filter = true;
                    settings.startTime = new Date();                
                });
            },
            reset: function(timestamp) {
                var $element = $(this);
                var settings = $element.data('settings');

                settings.events = [];
                settings.startTime = new Date();

                settings.lastEvent = null;
                settings.timeTracker =  0;
                settings.pointTracker = {
                    x: 0,
                    y: 0
                };

                if (timestamp) {
                    settings.startTime.setTime(timestamp.getTime());    
                };
            },
            addEvent: function(action, timestamp) {
            	return this.each(function() {
		        	var $element = $(this);
                    var settings = $element.data('settings');

                    var event = {
                        action: JSON.parse(JSON.stringify(action))
                    }

                    if (timestamp) {
                        event.time = timestamp.getTime() - settings.startTime.getTime();    
                        settings.events.push(event);
                    }
                    else {
                        event.time = new Date().getTime() - settings.startTime.getTime();
                        if (settings.filter) {
                            applyFilter(settings, event);
                        } else {
                           settings.events.push(event);  
                        }
                    }
            	});
            }, 
            altSegComplete: function() {
                return this.each(function() {
                    var $element = $(this);
                    var settings = $element.data('settings');
                    let time = new Date().getTime() - settings.startTime.getTime();
                    for (var i = settings.events.length - 1; i >= 0; i--) {
                        if (settings.events[i].action.selector == 'showQuestion') {
                            settings.events[i].action.argument.endTime = time;
                            break;
                        }
                    }
                });
            }
        };

        if (methods[method]) {
            return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } 
        else if (typeof method === 'object' || !method) {
            return methods.init.apply(this, arguments);
        } 
        else {
            $.error( 'Method "' +  method + '" does not exist in whiteboardRecorder plugin!');
        }
    };

    $.fn.whiteboardRecorder.defaults = {};
    $.fn.whiteboardRecorder.settings = {};


    function applyFilter(settings, event) {
        if (event.action.selector === 'handleMousemove') { 
            var point = {
                x: event.action.argument.pageX,
                y: event.action.argument.pageY
            }                            
            settings.lastEvent = event;

            if (event.time - settings.timeTracker >= 10) {
                settings.timeTracker = event.time;
                settings.events.push(event); 
                settings.pointTracker = point;
                settings.lastEvent = null;
            }
            else {
                if (Math.abs(point.x - settings.pointTracker.x) >= 1 || Math.abs(point.y - settings.pointTracker.y) >= 1) {                                
                    settings.events.push(event); 
                    settings.pointTracker = point;
                    settings.lastEvent = null;
                }
            };
        }
        else {
            if (event.action.selector === 'handleMouseup' && settings.lastEvent) {
                settings.events.push(settings.lastEvent);
            }  
           settings.events.push(event); 
        }
    };

})(jQuery);


