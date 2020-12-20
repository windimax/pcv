"use strict";

$(document).ready(function () {

	var PCV = {
		log: function (text) {
			console.log('PCV:[pcvPlayer] ' + text);
		}
	}

	var isMobile = {
		Android: function () {
			return navigator.userAgent.match(/Android/i);
		},
		BlackBerry: function () {
			return navigator.userAgent.match(/BlackBerry/i);
		},
		iOS: function () {
			return navigator.userAgent.match(/iPhone|iPad|iPod/i);
		},
		Opera: function () {
			return navigator.userAgent.match(/Opera Mini/i);
		},
		Windows: function () {
			return navigator.userAgent.match(/IEMobile/i) || navigator.userAgent.match(/WPDesktop/i);
		},
		any: function () {
			return (isMobile.Android() || isMobile.BlackBerry() || isMobile.iOS() || isMobile.Opera() || isMobile.Windows());
		}
	};

	var context = {
		time: 0,
		scale: 1,
		duration: 0,
		uiShown: false,
		isPlaying: false
	};

	var pcvModules;
	var QuizModule, contextBackup, speed = 1;

	var wakeLock = {
		isOn: false,
		noSleep: new NoSleep()
	};

	var skipped;
	var trackSeeking;
	var pauseOnSegmentChange = false;

	// Build UI

	var $board = $('.board');
	var $jsTimeline = $('.jsTimeline');
	var $pcv_controls = $('.controls');

	var $pcv_play = $('<i class="icon play blink ion-play"></i>');
	var $pcv_overlay = $('<span class="playPCV loading"></span>');
	var $pcv_preloader = $('<span class="preloader"></span>');
	var $pcv_loadingbar = $('<span class="loadingbar"><u></u><i></i><b></b></span>');

	var $pcv_topPane = $('<div class="topPane"></div>');
	var $pcv_topPaneBack = $('<i class="icon ion-close import"></i>');
	var $pcv_topPaneTitle = $('<span class="title"></span>');

	var $pcv_player = $('<div class="player"></div>');
	var $pcv_playerTime = $('<div class="time"><i>00:00</i><i>00:00</i></div>');
	var $pcv_playerTrack = $('<div class="track"><u></u><b><i></i></b></div>');
	var $pcv_playerButton = $('<div class="btn"><i class="icon ion-play"></i></div>');
	var $pcv_playerPlaylist = $('<div class="playlist"></div>');

	var $pcv_menu = $('<div class="videoMenu"></div>');
	var $pcv_menu_items = $('<div class="items"></div>');
	var $pcv_menu_quiz = $('<i class="icon quiz ion-ios-paper"></i>');
	var $pcv_menu_video = $('<i class="icon video blink ion-ios-skipforward"></i>');
	var $pcv_menu_replay = $('<i class="icon replay ion-refresh"></i>');
	var $pcv_menu_rating = $('<div class="rating s0"></div>');

	var $pcv_nextVideo = $('<div class="nextVideo"></div>');
	var $pcv_nextVideoTitle = $('<div class="title"></div>');
	var $pcv_nextVideoSubtitle = $('<div class="subtitle"></div>');
	var $pcv_nextVideoDuration = $('<div class="duration"></div>');

	var $pcv_poster = $('<div class="poster"></div>');
	var $pcv_posterPlayBtn = $('<i class="icon play blink ion-play"></i>');
	var $pcv_posterInfo = $('<div class="info"></div>');
	var $pcv_posterTitle = $('<div class="title"></div>');
	var $pcv_posterSubtitle = $('<div class="subtitle"></div>');
	var $pcv_posterDuration = $('<div class="duration"></div>');


	$pcv_overlay
		.append($pcv_play);

	$pcv_topPane
		.append($pcv_topPaneBack)
		.append($pcv_topPaneTitle);

	$pcv_player
		.append($pcv_playerPlaylist);

	$board
		.append($pcv_poster)
		.append($pcv_overlay)
		.append($pcv_topPane)
		.append($pcv_preloader)
		.append($pcv_player)
		.append($pcv_menu);

	$pcv_menu_items
		.append($pcv_menu_replay)
		.append($pcv_menu_video)
		.append($pcv_menu_quiz)
		.append($pcv_menu_rating)
		.appendTo($pcv_menu);

	$pcv_nextVideo
		.append($pcv_nextVideoTitle)
		.append($pcv_nextVideoSubtitle)
		.append($pcv_nextVideoDuration)
		.appendTo($pcv_menu);

	$pcv_poster
		.append($pcv_posterPlayBtn)
		.append($pcv_posterInfo)
		.append($pcv_loadingbar)

	$pcv_posterInfo
		.append($pcv_posterTitle)
		.append($pcv_posterSubtitle)
		.append($pcv_posterDuration);

	for (var i = 0; i < 5; i++) {
		var $star = $('<i class="ion-ios-star"></i>')
		var $starOutline = $('<i class="ion-ios-star-outline"></i>')

		$('<span>')
			.append($star)
			.append($starOutline)
			.appendTo($pcv_menu_rating)
	}


	//Attach event listeners

	function attachEvemtListeners() {
		$pcv_poster.css({
			cursor: 'pointer'
		});

		$pcv_menu_rating
			.click(function () {
				if (typeof FeedbackModal === undefined) {
					return;
				};
				let feedback = new FeedbackModal({
					pcvTokenData: pcvTokenData
				});
				feedback.present();
			});

		$pcv_overlay
			.click(function () {
				if (!context.uiShown && context.isPlaying) {
					showUiElements();
					hideUiElements();
				}
				else {
					context.isPlaying = !context.isPlaying;
					if (context.isPlaying) {
						playMovie();
					}
					else {
						pauseMovie();
					}
				}
			});

		if (!isMobile.any()) {
			$pcv_overlay
				.mousemove(function () {
					if (context.isPlaying) {
						if (!context.uiShown) {
							showUiElements();
						}
						else {
							keepUiElements();
							hideUiElements();
						}
					};
				});
		};

		$pcv_poster.click(function () {
			context.isPlaying = true;
			context.playbackStartTime = new Date().getTime();
			context.watchedTime = 0;

			$pcv_poster.fadeOut();
			$pcv_topPane.addClass('active');

			if (context.url) {
				uaData.ev_pcvStart(context.url);
				// progressData.sendPcvStartEvent();
			};

			playMovie();
		});

		$pcv_menu_replay.click(function () {
			context.isPlaying = true;

			reset();
			hideVideoMenu();

			if (hasQuizBeforeVideo()) {
				QuizModule = createQuizModule(pcvModules[0]);

				backup();
				showQuiz(QuizModule.moduleData);
				loadQuizPcv(QuizModule.pcvData.intro);
			}
			else {
				playMovie();
			}
		});

		$pcv_menu_video.click(function () {
			hideVideoMenu();
			refreshView();

			context = $pcv_menu_video.data('context');
			context.autoplay = true;

			updateModuleUrl(context.code);
			loadData();
		});
	}

	$('.addons .ion-ios-gear').click(function () {
		$('.addons .speed').toggle();
	});

	$('.addons .speed span').click(function () {
		$(this)
			.siblings().removeClass('active').end()
			.addClass('active');
		setSpeed($(this).data('speed'));
	});

	$('.addons .list').click(function () {
		$('.segments').fadeIn();
	});

	$('.segments .ion-close').click(function () {
		$('.segments').fadeOut();
		hideUiElements();
	});

	$board.jsCursor();

	$jsTimeline.jsTimeline({
		onReset: function (toolbarSetup, whiteboardSetup) {
			context.api.renderCanvas(toolbarSetup, whiteboardSetup);
		},
		onDataLoaded: function (toolbarSetup, whiteboardSetup) {
			context.api.renderCanvas(toolbarSetup, whiteboardSetup);
			context.api.contextReady(context);
			if (context.autoplay) {
				context.isPlaying = true;
				playMovie();
			};
			progressbar.setCurrentSegment(0);
		},
		onEventReady: function (event, timeline, seekLoop) {
			// if ($pcv_playerPlaylist.find('audio.active').get(0)) {
			// 	context.time = $pcv_playerPlaylist.find('audio.active').get(0).currentTime * 1000;	
			// }
			// else {
			// context.time = timeline.time.global;	
			// }
			return context.api.handleEvent(event, context, seekLoop);
		},
		onBeforeSeek: function (toolbarSetup, whiteboardSetup) {
			$pcv_preloader.show();
			context.busy = true;

			if ($('.skipExp').length) {
				$('.skipExp')
					.find('.timer')
					.data('terminate')();
			}

			if (toolbarSetup && whiteboardSetup) {
				context.api.renderCanvas(toolbarSetup, whiteboardSetup);
			};
		},
		onAfterSeek: function (timeline) {
			$pcv_preloader.hide();

			if ((trackSeeking || skipped) && context.url) {
				uaData.trackSeeking(context.url, context.time - context.seekFrom, skipped);
			}

			for (var i in pcvModules) {
				if (pcvModules[i].index < timeline.segmentIndex) {
					context.mTime += getPcvModuleDuration(pcvModules[i]);
				}
			}

			if (context.segmentHasMp3) {
				setAudio(timeline.segmentIndex, timeline.time.local);
			}
			else {
				setAudio(0, timeline.time.global);
			}

			if (context.isPlaying) {
				playMovie();
			};
			progressbar.setCurrentSegment(timeline.segmentIndex);
			context.busy = false;
			skipped = trackSeeking = false;
		},
		onSegmentWillChange: function (timeline, callback) {
			if (pauseOnSegmentChange) {
				context.isPlaying = false;
				pauseMovie();
				$('.segments').fadeIn();
				setTimeout(function () {
					context.isPlaying = true;
					if (context.jsCursorData) {
						$board.jsCursor('forceSegmentChange', parseInt(timeline.segmentIndex) + 1);
					};
					$jsTimeline.jsTimeline('forceSegmentChange', parseInt(timeline.segmentIndex) + 1);
					setTimeout(function () {
						$('.segments').fadeOut();
					}, 1500);
				}, 1500);
			}
			else {
				callback();
			}
		},
		onSegmentChange: function (index, toolbarSetup, whiteboardSetup) {
			if (context.segmentHasMp3) {
				playNextAudio(index);
			};
			context.api.renderCanvas(toolbarSetup, whiteboardSetup);
			progressbar.setCurrentSegment(index);
			if (isMobile.any()) {
				context.isPlaying = false;
				pauseMovie();
			}
		},
		onSessionComplete: function () {
			context.isPlaying = false;
			context.isCompleted = true;
			$('.segments').fadeOut();

			clearInterval(context.timer);
			clearInterval(context.syncInterval);

			$pcv_menu.fadeIn(300);
			$pcv_topPane.fadeIn();

			if (context.url) {
				uaData.ev_pcvComplete(context.url);
			};

			if (context.api.appApi !== undefined) {
				context.api.appApi.onVideoComplete(function (nextModule) {
					if (nextModule.type === 'video') {
						var pcv = nextModule.params;

						var _context = setupContext({
							api: context.api,
							pcv: pcv
						});

						$pcv_nextVideoTitle
							.text(_context.title);

						$pcv_nextVideoSubtitle
							.text(_context.section);

						$pcv_nextVideoDuration
							.text('Duration: ' + formatTime(_context.duration));

						$pcv_nextVideo.show();
						$pcv_menu_video.show();
						setTimeout(function () {
							$pcv_nextVideo.addClass('visible');
						}, 500);

						$pcv_menu_video
							.data('context', _context)
							.css({
								display: 'inline-block'
							});

						_context.api.updateResources(pcv.resources);
					};
				});
			};
		},
		onSegmentComplete: function (segmentIndex) {
			if (!hasQuiz(segmentIndex)) {
				$jsTimeline.jsTimeline('play');
			}
		},
		onForceSegmentChange: function (timeline) {
			context.api.renderCanvas(
				timeline.segments[timeline.segmentIndex].toolbarSetup,
				timeline.segments[timeline.segmentIndex].whiteboardSetup
			);
			context.time = timeline.time.global;

			if (context.segmentHasMp3) {
				setAudio(timeline.segmentIndex, timeline.time.local);
			}
			else {
				setAudio(0, timeline.time.global);
			}

			if (context.isPlaying) {
				playMovie();
			};
			progressbar.setTime();
			progressbar.setCurrentSegment(timeline.segmentIndex);
		}
	});


	function hasQuiz(segmentIndex) {
		if (!QuizModule) {
			if (QuizModule = checkQuiz(segmentIndex, -1)) {
				stopMovie();

				backup();
				showQuiz(QuizModule.moduleData);
				loadQuizPcv(QuizModule.pcvData.intro);
				context.mTime += getPcvModuleDuration(QuizModule);
				$('.segments').fadeOut();

				return true;
			};
		}
		else {
			if (!QuizModule.state.testShown) {
				stopMovie();
				$('.board').addClass('inactive');
				$('.optionsPane').addClass('visible');
				progressbar.hide();

				QuizModule.state.testShown = true;
				// QuizModule.timer = setTimeout(function() {
				// 	loadQuizPcv(QuizModule.pcvData.incorrect);
				// 	$('.board').removeClass('inactive');							
				// 	progressbar.show();
				// }, 10000);

				return true;
			}
			else {
				stopMovie();
				$('.quizForm, .optionsPane').remove();

				var index = QuizModule.index;
				var childIndex = QuizModule.childIndex;

				if (QuizModule = checkQuiz(index, childIndex)) {
					showQuiz(QuizModule.moduleData);
					loadQuizPcv(QuizModule.pcvData.intro);

					return true;
				};

				restore();

				if (context.jsCursorData) {
					$board.jsCursor('forceSegmentChange', index + 1);
				};
				$jsTimeline.jsTimeline('forceSegmentChange', index + 1);

				return true;
			}
		}

		return false;
	};


	function hasQuizBeforeVideo() {
		if (!pcvModules) {
			return null;
		};
		return pcvModules[0].index < 0;
	};


	function checkQuiz(index, childIndex) {
		for (var i in pcvModules) {
			if (pcvModules[i].index == index && pcvModules[i].childIndex > childIndex) {
				return createQuizModule(pcvModules[i]);
			}
		}
		return null;
	};


	function createQuizModule(pcvModule) {
		return {
			state: {
				testShown: false,
				introShown: false
			},
			index: pcvModule.index,
			childIndex: pcvModule.childIndex,
			pcvData: pcvModule.pcvData,
			moduleData: pcvModule.moduleData
		};
	};


	function loadQuizPcv(pcv) {
		context.time = 0;
		context.autoplay = context.isPlaying;
		context.segments = refactorSegments([pcv.segments]);
		context.duration = getSegmentsDuration(context.segments);

		progressbar.setTime();
		$('.quizPlayer audio')
			.attr({
				src: base64toBlobUrl(pcv.segments.json.audio)
			})
			.get(0).playbackRate = speed;

		$board.jsCursor('loadData', [pcv.jsCursorData]);
		$jsTimeline.jsTimeline('loadData', context.segments);
	};


	function backup() {
		contextBackup = {
			time: context.time,
			duration: context.duration
		};

		progressbar.backup();
		$board.jsCursor('backup');
		$jsTimeline.jsTimeline('backup');
	};


	function restore() {
		context.time = contextBackup.time;
		context.duration = contextBackup.duration;

		progressbar.restore();
		$board.jsCursor('restore');
		$jsTimeline.jsTimeline('restore');
	};


	window.addEventListener('onDataReady', function (e) {

		if (e.detail.pcv.segments.length == 0) {
			e.detail.pcv.segments = dummySegments()
		};

		if (!e.detail.pcv.processedTime) {
			fixpcv.process(e.detail.pcv);
		};

		e.detail.api.connect({
			play: function () {
				context.isPlaying = true;
				playMovie();
			},
			pause: function () {
				context.isPlaying = false;
				pauseMovie();
			},
			getExplTime: function (t) {
				return {
					'ms': t - context.time,
					'mm:ss': formatTime(t - context.time)
				}
			},
			seekTime: seekTime
		});

		pcvModules = e.detail.pcv.pcvModules;
		context = setupContext(e.detail);

		setTimeout(function () {
			$pcv_overlay
				.addClass('loaded');
		}, 500);
		showVideoPoster();

		setTimeout(function () {
			loadData();

			if (hasQuizBeforeVideo()) {
				QuizModule = createQuizModule(pcvModules[0]);

				backup();
				showQuiz(QuizModule.moduleData);
				loadQuizPcv(QuizModule.pcvData.intro);
			}
		}, 500);

		attachEvemtListeners();

	}, false);


	window.addEventListener('metadataReceived', function (e) {
		$pcv_overlay
			.removeClass('loading');

		$pcv_posterTitle
			.text(e.detail.title)
			.css({
				display: 'none',
				left: '100px',
				opacity: 0
			})

		$pcv_posterDuration
			.text('Duration: ' + formatTime(e.detail.duration))
			.css({
				display: 'none',
				left: '100px',
				opacity: 0
			});

		$pcv_loadingbar.css({
			display: 'none',
			bottom: '80px',
			opacity: 0
		});

		$pcv_poster.fadeIn(300, function () {
			$pcv_loadingbar.show(function () {
				setTimeout(() => {
					$(this).css({
						bottom: '100px',
						opacity: 1
					});


					$pcv_posterTitle.show(function () {
						$(this).css({
							left: '0px',
							opacity: 1
						});
					});

					$pcv_posterDuration.show(function () {
						setTimeout(() => {
							$(this).css({
								left: '0px',
								opacity: 1
							});
							$pcv_loadingbar
								.addClass('hasSpinner');
						}, 200)
					})
				})
			});
		});
	}, false);


	function setupContext(json) {

		json.pcv.segments = refactorSegments(json.pcv.segments);
		json.pcv.duration = getSegmentsDuration(json.pcv.segments);
		json.pcv.fullDuration = getFullDuration(json.pcv)

		var audio;
		if (json.pcv.audio) {
			audio = json.pcv.audio;
			delete json.pcv.audio;
		};

		var questions = json.pcv.segments.reduce(function (res, segment) {
			return res.concat(segment.whiteboardEvents.filter(function (event) {
				return event.action.selector === 'showQuestion';
			}));
		}, []);

		questions.forEach(function (question, index) {
			question.action.argument.index = index;
		});

		return {
			api: json.api,
			url: json.pcv.url,
			code: json.pcv.moduleCode,
			publishDate: json.pcv.modulePublishDate,
			title: json.pcv.moduleName || json.pcv.projectName,
			section: json.pcv.subTopicName,
			segments: json.pcv.segments,
			questions: questions,
			duration: json.pcv.duration,
			fullDuration: json.pcv.fullDuration,
			jsCursorData: json.pcv.jsCursorData,
			isPlaying: false,
			audio: audio,
			mTime: 0,
			time: 0
		}
	};


	function loadData() {
		for (var i in context.segments) {
			var segment = context.segments[i];

			if (segment.audio) {
				if (!context.segmentHasMp3) {
					context.segmentHasMp3 = true;
				};

				$('<audio>')
					.attr({
						src: base64toBlobUrl(segment.audio)
					})
					.appendTo($pcv_playerPlaylist)
			}

			$pcv_playerPlaylist
				.find('audio:eq(0)')
				.addClass('active');
		}

		if (!context.segmentHasMp3 && context.code) {
			var audioSrc;
			if (context.audio) {
				audioSrc = base64toBlobUrl(context.audio);
			} else {
				// audioSrc = '../data/lcdb/pcv/' + context.code + '/' + context.code + '.mp3';
				audioSrc = getMp3Url(context.code, context.publishDate);
			}
			$('<audio>')
				.attr('src', audioSrc)
				.appendTo($pcv_playerPlaylist)
				.addClass('active');
		};

		progressbar.load();
		context.silentPcv = !$('.board audio').length;

		if (context.jsCursorData) {
			$board.jsCursor('loadData', context.jsCursorData);
		};

		$jsTimeline.jsTimeline('loadData', context.segments);
	};


	function getMp3Url(moduleCode, modulePublishDate) {
		var host = "https://lcdb.s3.amazonaws.com/";
		//var host = "/lcdb/";
		return host +
			moduleCode.substring(0, 1) + '/' +
			moduleCode.substring(1, 4) + '/' +
			moduleCode.substring(4, 7) + '/' +
			moduleCode + '/' +
			moduleCode + '-' + modulePublishDate + '.mp3';
	}


	function refactorSegments(segments) {
		var _segments = [];
		var timeIncrement = 0;
		for (var i in segments) {
			var segment = segments[i];
			if (segment.audio) {
				segment.json.audio = segment.audio;
				delete segment.audio;
			};

			var whiteboardEvents = segment.json.whiteboardEvents;

			if (!segment.hasOwnProperty('audioTrackDuration')) {
				segment.json.audioTrackDuration = getSegmentDuration(whiteboardEvents);
			}
			else {
				segment.json.audioTrackDuration = segment.audioTrackDuration * 1000;
			}

			//set global time
			for (var j in whiteboardEvents) {
				var event = whiteboardEvents[j];
				event.gTime = event.time + timeIncrement;
				if (j == whiteboardEvents.length - 1) {
					timeIncrement = event.gTime;
				}
			}

			_segments.push(segment.json);
		}

		return _segments;
	};


	function reset() {
		context.time = 0;
		context.mTime = 0;
		context.isCompleted = false;
		context.timestamp = new Date();

		uaData.reset();
		progressData.reset();
		progressbar.reset();

		progressbar.pause();

		$pcv_playerPlaylist.find('audio').each(function (e) {
			$(this)
				.removeClass('active')
				.get(0).pause();

			if (e == 0) {
				$(this)
					.addClass('active');
			}
		});

		if (context.jsCursorData) {
			$board.jsCursor('reset')
		};

		$jsTimeline.jsTimeline('reset');
	}


	function refreshView() {
		$pcv_playerPlaylist.empty();
	};


	function hideVideoMenu() {
		$pcv_menu.fadeOut(function () {
			$pcv_nextVideo
				.removeClass('visible')
				.hide();

			$pcv_menu_video
				.hide();
		});
	};


	function showVideoPoster() {
		$pcv_overlay
			.removeClass('loading')

		$pcv_poster
			.fadeIn(function () {
				setTimeout(() => {
					$(this).addClass('loaded');
				}, 200)
			})

		$pcv_posterTitle
			.text(context.title);

		$pcv_posterSubtitle
			.text(context.section);

		if (context.duration > 0) {
			$pcv_posterDuration
				.text('Duration: ' + formatTime(context.fullDuration));
		};

		$pcv_topPaneTitle
			.text(context.title);

		if (!context.title) {
			$pcv_topPaneTitle.hide();
		};

		$pcv_loadingbar
			.removeClass('hasSpinner')
			.css({
				opacity: 0
			});
	};


	function seekTime(time) {
		context.seekFrom = context.time;
		context.time = time;
		context.mTime = 0;
		progressbar.setTime();

		stopMovie();
		keepUiElements();

		if (context.jsCursorData) {
			$board.jsCursor('setTime', context.time);
		};

		$jsTimeline.jsTimeline('setTime', context.time);
	};


	function playMovie() {
		if (!wakeLock.isOn) {
			wakeLock.isOn = true;
			wakeLock.noSleep.enable();
		};

		// if (context.api.appApi !== undefined) {
		// 	context.api.appApi.fullscreenApi().enter();
		// }

		$pcv_play.hide();
		$pcv_overlay.removeClass('paused');
		$board.addClass('playing');

		context.timestamp = new Date();
		context.timestamp.setTime(context.timestamp.getTime() - context.time);

		if (context.jsCursorData) {
			$board.jsCursor('play');
		};

		$jsTimeline.jsTimeline('play');

		playAudio();
		progressbar.play();

		hideUiElements();

		context.syncInterval = setInterval(function () {
			if (context.busy) {
				return
			};

			context.time = 0;
			if ($('.quizPlayer').length > 0) {
				context.time = 1000 * $('.quizPlayer audio').get(0).currentTime;
			}
			else {
				var index = $pcv_playerPlaylist.find('audio').index($pcv_playerPlaylist.find('.active'));
				for (var i = 0; i <= index; i++) {
					var audio = $pcv_playerPlaylist.find('audio').eq(i).get(0);
					if (i < index) {
						context.time += 1000 * audio.duration;
					} else {
						context.time += 1000 * audio.currentTime;
						if (!pauseOnSegmentChange &&
							$pcv_playerPlaylist.find('audio').length - 1 > index &&
							context.segments[i + 1] && context.segments[i + 1].show &&
							audio.duration - audio.currentTime <= 1.0 && $('.segments').is(':hidden')) {
							$('.segments').slideDown();
							setTimeout(function () {
								$('.segments').slideUp();
							}, 2000);
						}
					}
				}
			}

			if (context.silentPcv) {
				var timestamp = new Date();
				context.time = timestamp - context.timestamp;
			}

			if (context.url) {
				uaData.trackPlayback(context.url, context.time, context.duration);
				progressData.trackPlayback(context.watchedTime, context.time, context.duration);
			}

			if (context.jsCursorData) {
				$board.jsCursor('forceUpdate', context.time);
			};
			$jsTimeline.jsTimeline('forceUpdate', context.time);
			context.watchedTime += 100;
		}, 100);
	};


	function pauseMovie() {
		$pcv_play.show();
		$pcv_overlay.addClass('paused');
		$board.removeClass('playing');

		var timestamp = new Date();
		context.time = timestamp - context.timestamp;

		if (context.jsCursorData) {
			$board.jsCursor('pause');
		};

		$jsTimeline.jsTimeline('pause');

		pauseAudio();
		progressbar.pause();
		clearInterval(context.syncInterval);

		showUiElements();
	};


	function stopMovie() {
		$board.removeClass('playing');
		if (context.jsCursorData) {
			$board.jsCursor('pause');
		};

		$jsTimeline.jsTimeline('pause');

		stopAudio();
		progressbar.pause();
		clearInterval(context.syncInterval);
	};



	function playNextAudio(index) {
		stopAudio();
		setAudio(index, 0);
		playAudio();
	};


	function setAudio(index, time) {
		if ($pcv_playerPlaylist.find('audio').length > 0) {
			$pcv_playerPlaylist.find('audio')
				.removeClass('active')
				.eq(index)
				.addClass('active')
				.get(0).currentTime = time / 1000;
		}
	};


	function playAudio() {
		if ($('.quizPlayer').length > 0) {
			$('.quizPlayer audio').get(0).play();
			return;
		}
		if ($pcv_playerPlaylist.find('audio').length == 0) {
			return;
		}
		$pcv_playerPlaylist.find('audio.active').get(0).play();
	};


	function pauseAudio() {
		if ($('.quizPlayer').length > 0) {
			$('.quizPlayer audio').get(0).pause();
			return;
		}
		$pcv_playerPlaylist.find('audio.active').get(0).pause();
	};


	function stopAudio() {
		$pcv_playerPlaylist.find('audio').each(function () {
			$(this)
				.removeClass('active')
				.get(0).pause();
		});
	};


	function setSpeed(newSpeed) {
		speed = newSpeed;
		$board.jsCursor('setSpeed', speed);
		$jsTimeline.jsTimeline('setSpeed', speed);

		if ($('.quizPlayer').length > 0) {
			$('.quizPlayer audio').get(0).playbackRate = speed;
		}
		$pcv_playerPlaylist.find('audio').each(function () {
			$(this).get(0).playbackRate = speed;
		});
		seekTime(context.time);
	};


	function hideUiElements() {
		context.timer = setTimeout(function () {
			$pcv_topPane.fadeOut();
			$pcv_controls.fadeOut();
			$('.addons .speed').hide();
			context.uiShown = false;
		}, 2000);
	};

	function showUiElements() {
		clearInterval(context.timer);
		$pcv_topPane.fadeIn();
		$pcv_controls.fadeIn();
		context.uiShown = true;
	};

	function keepUiElements() {
		clearInterval(context.timer);
	};

	function getFullDuration(pcv) {
		var duration = getSegmentsDuration(pcv.segments);
		for (var i in pcv.pcvModules) {
			duration += getPcvModuleDuration(pcv.pcvModules[i]);
		};
		return duration;
	};

	function getPcvModuleDuration(pcvModule) {
		var duration = 0;
		for (var key in pcvModule.pcvData) {
			if (key === 'incorrect') continue;
			var events = pcvModule.pcvData[key].segments.json.whiteboardEvents
			duration += events[events.length - 1].time
		}
		return duration;
	}

	function getSegmentsDuration(segments) {
		var sessionDuration = 0;
		for (var i in segments) {
			var events = segments[i].whiteboardEvents;
			var time = events[events.length - 1].time;
			sessionDuration += time;
		};

		return sessionDuration;
	};

	function getSegmentDuration(events) {
		return events[events.length - 1].time - events[0].time;
	};

	function getKeyframes(segments) {
		var keyframes = [];
		for (var i in segments) {
			keyframes.push({
				time: segments[i].whiteboardEvents[0].gTime,
				duration: getSegmentDuration(segments[i].whiteboardEvents)
			});
		};

		return keyframes;
	};

	function formatTime(milliseconds) {
		var number = milliseconds / 1000;

		var minutes = parseInt(number / 60) % 60;
		var seconds = parseInt(number % 60);

		return (minutes < 10 ? "0" + minutes : minutes) + ":" +
			(seconds < 10 ? "0" + seconds : seconds);
	};


	function getScale() {
		return $board.get(0).getBoundingClientRect().width / $board.get(0).offsetWidth;
	};


	function base64toBlobUrl(base64Audio) {
		var block = base64Audio.split(";");
		var dataType = block[0].split(":")[1];
		var realData = block[1].split(",")[1];

		var audioBlob = base64toBlob(realData, dataType);

		return URL.createObjectURL(audioBlob);
	};


	function base64toBlob(b64Data, contentType, sliceSize) {
		contentType = contentType || '';
		sliceSize = sliceSize || 512;

		var byteCharacters = atob(b64Data);
		var byteArrays = [];

		for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
			var slice = byteCharacters.slice(offset, offset + sliceSize);

			var byteNumbers = new Array(slice.length);
			for (var i = 0; i < slice.length; i++) {
				byteNumbers[i] = slice.charCodeAt(i);
			}

			var byteArray = new Uint8Array(byteNumbers);

			byteArrays.push(byteArray);
		}

		return new Blob(byteArrays, { type: contentType });

	};


	function showQuiz(data) {
		createQuizForm(data);
	};


	function createQuizForm(quizData) {

		var markers;

		var $qForm = $('<div></div>');
		var $qPane = $('<div></div>');
		var $qPlayer = $('<div></div>');
		var $qOptions = $('<ul></ul>');
		var $button = $('<button>GO</button>');


		$qForm
			.addClass('quizForm')
			.appendTo('.board');

		$qPlayer
			.append($('<audio></audio>'))
			.addClass('quizPlayer')
			.appendTo($qForm)

		$qPane
			.addClass('optionsPane')
			.append($qOptions)
			.appendTo('.board')

		if (quizData.bgImage) {
			$('<img>')
				.appendTo($qForm)
				.addClass(quizData.bgImage.src.id)
				.attr('src', context.api.getImageSource(quizData.bgImage.src))
				.css({
					width: quizData.bgImage.scale + '%',
					position: 'absolute'
				});

			$qForm
				.css({
					background: quizData.bgImage.bgColor
				})
				.addClass('image ' + quizData.bgImage.align)
		}
		else {
			$qForm.css({
				backgroundImage: quizData.image ? 'url(' + quizData.image + ')' : 'none'
			})
		}

		if (quizData.marker === 'ABC') {
			markers = ['A', 'B', 'C', 'D', 'E'];
		}
		else if (quizData.marker === '123') {
			markers = ['1', '2', '3', '4', '5'];
			// markers = ['I','II','III','IV','V'];
		}
		else {
			markers = ['TRUE', 'FALSE'];
		}

		for (var i = 0; i < quizData.quantity; i++) {
			var $li = $('<li>');

			$('<i>')
				.appendTo($li)
				.text(markers[i])
				.append('<b class="i ion-close-round"></b>')
				.append('<b class="c ion-checkmark-round"></b>')

			$li
				.appendTo($qOptions)
				.data('correct', quizData.answer == i ? true : false)
				.click(function () {
					$(this)
						.siblings()
						.removeClass('active')
						.end()
						.addClass('active');

					optionSelected();
				});
		}

		$button
			.appendTo($qPane)
			.addClass('button disabled');

		function optionSelected() {
			stopMovie();
			QuizModule.state.testShown = true;

			$('.board').removeClass('inactive');
			$('.optionsPane').addClass('disabled');
			// clearTimeout(QuizModule.timer);
			progressbar.show();

			var $activeLi = $qPane.find('li.active');
			if ($activeLi.data('correct')) {
				loadQuizPcv(QuizModule.pcvData.correct);
				$activeLi.addClass('correct');
			}
			else {
				loadQuizPcv(QuizModule.pcvData.incorrect);
				$activeLi.addClass('incorrect');
				$('.optionsPane li').each(function () {
					if ($(this).data('correct')) {
						$(this).addClass('correct')
					};
				});
			}
			setTimeout(function () {
				$('.optionsPane').addClass('mini');
			}, 2000);
		}
	};


	function updateModuleUrl(moduleCode) {
		var hash = parent.location.hash;
		var hashArray = hash.split('/');

		hashArray.pop();
		hashArray.push(moduleCode);

		hash = hashArray.join('/');

		if (parent && parent.history.pushState) {
			parent.history.pushState(null, null, hash);
		}
		else if (parent) {
			parent.location.hash = '#myhash';
		}
	}


	var vis = (function () {
		var stateKey, eventKey, keys = {
			hidden: "visibilitychange",
			webkitHidden: "webkitvisibilitychange",
			mozHidden: "mozvisibilitychange",
			msHidden: "msvisibilitychange"
		};
		for (stateKey in keys) {
			if (stateKey in document) {
				eventKey = keys[stateKey];
				break;
			}
		}
		return function (c) {
			if (c) document.addEventListener(eventKey, c);
			return !document[stateKey];
		}
	})();


	vis(function () {
		if (vis() && context.isPlaying) {
			var timestamp = new Date();
			var time = timestamp - context.timestamp;
			seekTime(time);
		}
	});



	var progressbar = (function () {

		var skipByMs = 10000;
		var $controls = $('.controls');
		var $progressbar = $controls.find('.progressbar');

		var $title = $('.segments .title');
		var $segments = $('.segments .list');
		var $toggle = $controls.find('.toggle');
		var $tooltip = $controls.find('.tooltip');
		var $maintrack = $controls.find('.maintrack');
		var $quickSeek = $controls.find('.quickSeek i');

		var $totalTime = $controls.find('.time i:last');
		var $currentTime = $controls.find('.time i:first');


		$toggle.click(function () {
			context.isPlaying = !context.isPlaying;
			if ($(this).hasClass('paused')) {
				pauseMovie();
			}
			else {
				playMovie();
			}
		});


		$quickSeek.click(function () {
			if (context.busy) {
				return;
			};

			var time = context.time;
			if ($(this).is('.RE')) {
				if (time - skipByMs > 0) {
					time -= skipByMs;
				} else {
					time = 0;
				}
			}
			else {
				if (time + skipByMs < context.duration) {
					time += skipByMs;
				} else {
					time = context.duration - 100;
				}
			}
			skipped = true;
			seekTime(time);
		});


		$progressbar
			.click(function (e) {
				if (context.busy || $controls.hasClass('basic')) {
					return;
				};

				var seekPosition = (e.pageX - $(this).offset().left) / $(this).width();
				var time = context.duration * seekPosition / context.scale;

				trackSeeking = true;
				seekTime(time);
			})
			.mouseenter(function () {
				keepUiElements();
			})


		$maintrack
			.mouseenter(function (e) {
				context.scale = getScale();

				var x = (e.pageX - $(this).offset().left) / context.scale;
				var time = context.duration * x / $(this).width();

				$tooltip
					.fadeIn(100)
					.css('left', x)
					.text(formatTime(time));
			})
			.mouseleave(function (e) {
				$tooltip
					.fadeOut(100)
			})
			.mousemove(function (e) {
				var x = (e.pageX - $(this).offset().left) / context.scale;
				var time = context.duration * x / $(this).width();

				$tooltip
					.css('left', x)
					.text(formatTime(time));
			});


		function load() {
			$segments.empty();
			$board.removeClass('blank');

			$totalTime.text(formatTime(context.fullDuration));

			var keyframes = getKeyframes(context.segments),
				left = 0;

			for (var i in keyframes) {
				$('<i>')
					.data('index', i)
					.text(context.segments[i].whiteboardEvents[0].title || 'Segment ' + (parseInt(i) + 1))
					.append($('<u>').text(formatTime(keyframes[i].duration)))
					.click(function () {
						stopMovie();
						$('.segments').fadeOut();
						if (context.jsCursorData) {
							$board.jsCursor('forceSegmentChange', $(this).data('index'));
						};
						$jsTimeline.jsTimeline('forceSegmentChange', $(this).data('index'));
					})
					.css({
						display: context.segments[i].show ? 'block' : 'none'
					})
					.data('show', context.segments[i].show)
					.appendTo($segments)

				if (i < keyframes.length - 1) {
					left += 100 * keyframes[i].duration / context.duration;
					$('<b>')
						.css({
							left: left + '%',
							display: context.segments[parseInt(i) + 1].show ? 'block' : 'none'
						})
						.appendTo($maintrack)
				}
			};

			$title.text(context.title + ' (' + formatTime(context.fullDuration) + ')');

			var count = 0;
			context.segments.forEach(function (segment) {
				if (segment.show) {
					count++;
				}
			});

			if (count < 2) {
				$('.addons .list').hide();
			};

			var childIndex = 0;
			for (var i in pcvModules) {
				var index = pcvModules[i].index;
				var x = 0, $quizGroup = null, $quizTab = $('<u>');

				pcvModules[i].childIndex = childIndex;

				$segments.find('b').each(function () {
					if ($(this).data('index') == index) {
						$quizGroup = $(this);
					};
				});

				if (!$quizGroup) {
					$quizGroup = $('<b>');
					childIndex++;

					$quizGroup
						.data('index', index)

					if (index > -1) {
						$quizGroup
							.insertAfter($segments.find('i:eq(' + index + ')'));
					}
					else {
						$quizGroup
							.prependTo($segments);
					}
				}
				$quizTab
					.data('pcvModule', pcvModules[i])
					.text('Quiz ' + childIndex)
					.appendTo($quizGroup)
					.click(function () {
						stopMovie();
						$('.segments').fadeOut();

						QuizModule = createQuizModule($(this).data('pcvModule'));

						backup();
						showQuiz(QuizModule.moduleData);
						loadQuizPcv(QuizModule.pcvData.intro);
					})
			};
		};

		function play() {
			$toggle.addClass('paused');
			context.interval = setInterval(function () {
				if (context.time < context.duration) {
					setTime();
				}
				else {
					clearInterval(context.interval);
				}
			}, 100);
		};

		function pause() {
			$toggle.removeClass('paused');
			clearInterval(context.interval);
		};

		function setTime(time) {
			$maintrack.find('> i').css({
				width: 100 * context.time / context.duration + '%'
			});
			$currentTime.text(formatTime(QuizModule ? context.time : context.time + context.mTime));
			$totalTime.text(formatTime(QuizModule ? context.duration : context.fullDuration));
		};

		function setBasic() {
			$controls.addClass('basic');
			$maintrack = $controls.find('.minitrack');
		};

		function removeBasic() {
			$maintrack = $controls.find('.maintrack');
			$controls.removeClass('basic');
		};

		function hide() {
			$controls.hide();
		};

		function show() {
			$controls.show();
		};

		function reset() {
			$segments.find('i').removeClass('current');
			$segments.find('i').eq(0).addClass('current')
		}

		function setCurrentSegment(segmentIndex) {
			$segments.find('i').each(function (index, item) {
				if (index === parseInt(segmentIndex) && $(item).data('show')) {
					$segments.find('i').removeClass('current');
					$(this).addClass('current');
				};
			});
		};

		return {
			load: load,
			play: play,
			pause: pause,
			backup: setBasic,
			restore: removeBasic,
			setTime: setTime,
			hide: hide,
			show: show,
			reset: reset,
			setCurrentSegment: setCurrentSegment
		};

	})();


	function dummySegments() {
		return [{
			"json": {
				"toolbarSetup": {
					"tool": "penTool",
					"penSize": "LS_1",
					"penColor": "LC_fff200"
				},
				"whiteboardSetup": [{
					"isCurrent": true,
					"backgroundMedia": {
						"type": "none"
					},
					"whiteboardImage": "none"
				}],
				"whiteboardEvents": [{
					"action": {
						"selector": "recordingStarted"
					},
					"time": 1
				}, {
					"action": {
						"selector": "recordingComplete"
					},
					"time": 100
				}]
			}
		}]
	}

	window.onbeforeunload = function () {
		// if (!context.isCompleted && context.url){
		// 	var step = 25;
		// 	var timeSpentRatio = Math.max(1, Math.round(100 * context.watchedTime / context.duration / step)) * step;
		// 	if (!isNaN(timeSpentRatio)) {
		// 		timeSpentRatio = Math.min(timeSpentRatio, 100);
		// 		uaData.ev_pcvCancel(context.url, timeSpentRatio);
		// 	}
		// }
		// progressData.sendPcvCancelEvent(context.watchedTime);
	}

});
