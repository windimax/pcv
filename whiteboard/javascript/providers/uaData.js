"use strict";
var uaData = (() => {

	var debug = false;

	var parseFileName = (pcvLink) => {
		let parts = pcvLink.split('/');
		return parts[parts.length-1];
	};

	var _ga = (pcvLink, eventAction) => {
		if (!pcvLink) {
			return;
		}

		let eventData = {
	      hitType: 'event',
	      eventCategory: 'pcv',
	      eventAction: eventAction,
	      eventLabel: parseFileName(pcvLink)
		}

		if (debug) {
      		http.post(window.host + 'ga', JSON.stringify(eventData), {
	      		headers: {
		        	'Content-Type': 'application/json; charset=utf-8'
				}
		    });
			return console.log(eventData);
		};
		ga('send', eventData);
	};

	var step = 25;
	var plyackStage = {};

	var trackPlayback = (pcvLink, time, duration) => {
		var timeRatio = Math.round(100 * time / duration / step) * step;
		if (!isNaN(timeRatio) && timeRatio >= step && !plyackStage[timeRatio]) {
			_ga(pcvLink, 'pcv-played-' + timeRatio);	
			plyackStage[timeRatio] = true;
		}
	};	

	var trackSeeking = (pcvLink, seekLength, skipped) => {
		var seekDirection = seekLength > 0 ? 'forward' : 'backward'
		var seekLengthMins = Math.round(Math.abs(seekLength / 60000));

		if (skipped) {
			return _ga(pcvLink, 'pcv-skip-' + seekDirection);
		}
		if (seekLengthMins <= 1) {
			_ga(pcvLink, 'pcv-seek-' + seekDirection + '-1m');
		}
		else if (seekLengthMins <= 5) {
			_ga(pcvLink, 'pcv-seek-' + seekDirection + '-5m');
		}
		else if (seekLengthMins <= 10) {
			_ga(pcvLink, 'pcv-seek-' + seekDirection + '-10m');
		}
		else {
			_ga(pcvLink, 'pcv-seek-' + seekDirection + '-xl');
		}
	};	

	var reset = () => {
		plyackStage = {};
	}

	return {
		setUserId: (userId) => {
			ga('set', 'userId', userId);
		},
		ev_pcvLoadSuccess: (pcvLink) => {
		    _ga(pcvLink, 'pcv-load-success');
		},
		ev_pcvLoadFail: (pcvLink) => {
			_ga(pcvLink, 'pcv-load-fail');
		},
		ev_pcvStart: (pcvLink) => {
			_ga(pcvLink, 'pcv-start');
		},
		ev_pcvComplete: (pcvLink) => {
			_ga(pcvLink, 'pcv-complete');	
		},
		ev_pcvFeedback: (pcvLink) => {
			_ga(pcvLink, 'pcv-feedback');	
		},
		ev_pcvCancel: (pcvLink, timeRatio) => {
			_ga(pcvLink, 'pcv-cancel-' + timeRatio);		
		},
		ev_pcvSkipForward: (pcvLink) => {
			_ga(pcvLink, 'pcv-skip-forward');		
		},
		ev_pcvSkipBackwards: (pcvLink) => {
			_ga(pcvLink, 'pcv-skip-backwards');		
		},
		ev_pcvSeekForward: (pcvLink) => {
			_ga(pcvLink, 'pcv-seek-forward');		
		},
		ev_pcvSeekBackwards: (pcvLink) => {
			_ga(pcvLink, 'pcv-seek-backwards');		
		},
		ev_pcvCancel: (pcvLink, timeRatio) => {
			_ga(pcvLink, 'pcv-cancel-' + timeRatio);		
		},
		reset: reset,
		trackSeeking: trackSeeking,
		trackPlayback: trackPlayback
	}
})();