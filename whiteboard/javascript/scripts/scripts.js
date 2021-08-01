"use strict";

var appVersion = '0.0.7';

var gridSettings = {
	size: 30,
	show: true
};


var canvasSize = {
	// width: 904,
	// height: 509,
	width: 960,
	height: 541
}

var bitRate = 32;
var boardColor = '#000000';

var colorPalette = {
	red: {
		id: 'LC_ff0000',
		value: '#d64263'
	},
	green: {
		id: 'LC_00a651',
		value: '#00a651'
	},
	blue: {
		id: 'LC_0000ff',
		value: '#38a7d2'
	},
	yellow: {
		id: 'LC_fff200',
		value: '#fff200'
	},
	white: {
		id: 'LC_ffffff',
		value: '#ffffff'
	},
	black: {
		id: 'LC_000000',
		value: '#000000'
	}
};


var whiteboardSettings = {
	minWidth: 1,
	maxWidth: 1,
	penColor: colorPalette['yellow'].value
}

var mousedown;

var penCanvas;
var whiteboard;
var $mainplayer;

var status;
var recorder = {};

var toolbarSetup;
var whiteboardSetup;
var voiceRecorder;

var iframeData = {};
var resources;
var pcvToken;
var teacherProfile;
var cmsdb = 'NEW';
var lastMove;

var cursorMode;
var directTouch;
var latestTouchEndEvent;
var isMobile;
var enableEventsOnlyRec;

var altSeg = {
	isRecording: false
};

var _pcv = {
	log: function (text) {
		console.log('PCV_log: ' + text);
	}
}


var doubtPcv;

window.onbeforeunload = function (event) {
	// return confirm('The data will be lost');
};

var ProfileManager = (function () {

	function loadProfile() {
		if (sessionStorage.getItem('teacherProfile')) {
			return JSON.parse(sessionStorage.getItem('teacherProfile'));
		}
		return null;
	};

	function saveProfile(data, callback) {
		sessionStorage.setItem('teacherProfile', JSON.stringify(data));
		callback();
	};

	function clearProfile() {
		sessionStorage.removeItem('teacherProfile');
	};

	return {
		loadProfile: loadProfile,
		saveProfile: saveProfile,
		clearProfile: clearProfile
	};

})()



$(document).ready(function () {

	penCanvas = document.getElementById('penCanvas');

	if (penCanvas) {
		require('/scripts/whiteboard.js', () => {
			whiteboard = new Whiteboard('penCanvas', whiteboardSettings);
			init();
		});
	}
	else {
		require('/scripts/drawingboard.js', () => {
			whiteboard = new DrawingBoard.Board('drawingboard', {
				controls: false,
				background: false,
				webStorage: false,
				color: whiteboardSettings.penColor,
				size: whiteboardSettings.maxWidth * 1.5
			});
			penCanvas = $('.drawing-board-canvas').get(0);	
			init();			
		});
	}

});

function init() {

	whiteboard.off();

	if (window.opener && window.location.hash) {
		doubtPcv = {
			dbtid: window.location.hash.replace('#', '')
		};

		window.addEventListener('message', function (event) {
			doubtPcv.title = 'Doubt Clarification';
			if (event.data.question) {
				if (event.data.question.subject && event.data.question.subject) {
					doubtPcv.title += ': ' + event.data.question.subject + ' | ' + event.data.question.topic;
				}
				setProjectName(doubtPcv.title);
				createQsCanvas(event.data.question);
			};
		}, false);

		window.opener.postMessage({
			task: 'passData',
			dbtid: doubtPcv.dbtid
		}, '*')
	}


	function createQsCanvas(question) {

		const fontColor = '#fff200';
		const $questionDiv = $('<div>'),
			$questionOptionsDiv = $('<div>');

		$questionDiv
			.appendTo($('body'))
			.addClass('questionDiv')
			.css({
				width: canvasSize.width + 'px',
				height: canvasSize.height + 'px',
				color: fontColor
			})
			.append(question.text.replace(/currentColor/g, fontColor));

		$questionOptionsDiv
			.addClass('questionOptionsDiv')
			.appendTo($questionDiv)


		if (question.imageData) {
			var $questionImageDiv = $('<div>');

			$questionImageDiv
				.addClass('questionImageDiv')
				.appendTo($questionOptionsDiv);

			$('<img>')
				.attr('src', question.imageData)
				.appendTo($questionImageDiv);
		}


		if ((question.segments || []).length) {
			var $questionSegmentsDiv = $('<div>');

			$questionSegmentsDiv
				.addClass('questionSegmentsDiv')
				.appendTo($questionOptionsDiv);

			question.segments.forEach(segment => {
				segment.textSegments.forEach(txtSgm => {
					if (txtSgm.type === 'text') {
						$questionSegmentsDiv.append(txtSgm.text.replace(/currentColor/g, fontColor));
					}
					else {
						$('<span>')
							.css({
								width: '70px',
								margin: '0px 10px',
								display: 'inline-block',
								borderBottom: '1px solid ' + fontColor
							})
							.appendTo($questionSegmentsDiv)
					}
				})
			});
		}

		html2canvas($questionDiv[0], {
			backgroundColor: null
		}).then(canvas => {
			addNewMedia({
				type: 'image',
				url: {
					id: addImageToResources(canvas.toDataURL())
				}
			});
			$('.mediaLibrary li:last > i').click();
			$questionDiv.remove();
		});
	}



	isMobile = detectmob();
	// enableEventsOnlyRec = true;

	var $cursorPointer = $('.cursorPointer');

	if (teacherProfile = ProfileManager.loadProfile()) {
		updateUserPane();
	}

	status = 'idle';
	$('.appVersion').text('App ver.' + appVersion);

	$('.board').jsCursor();
	$('#main').whiteboardRecorder();


	// $("#main").click(function(e) {
	// 	if ($(e.target).is('.uiToggle .icon')) {
	// 		return;
	// 	}
	// 	if (!$('#main').hasClass('minimalistic') &&
	//  	!($(e.target).is('.ui') || $(e.target).is('.ui *'))) {
	// 		setTimeout(() => {
	//  		$('#main').addClass('minimalistic');	
	// 		})
	// 	}
	// });

	if (isMobile) {
		directTouch = $('.toolBar .finger').hasClass('activated');
	} else {
		$('.toolBar .finger').hide();
	}

	if (!$('#main').hasClass('standalone') && !enableEventsOnlyRec) {
		voiceRecorder = new VoiceRecorder();
	};

	$('#image').change(function () {
		var file = this.files[0];
		fileUtils.checkMimeType(this.files[0], function (isValid) {
			if (isValid) {
				if (file.size / 1024 > 1024) {
					showDialog('You have selected an image larger than 1 mb. We do not recommend using such files.', [
						{
							text: 'use anyways',
							handler: function () {
								loadFile(file);
							}
						},
						{
							text: 'cancel'
						}
					]);
				}
				else {
					loadFile(file);
				}
			}
			else {
				showDialog('Unsoported file format. Only PNG, JPG, GIF and SVG image files allowed.', [
					{
						text: 'try again',
						handler: function () {
							$('#image').click();
						}
					},
					{
						text: 'close'
					}
				]);
			}
		});
	});


	function loadFile(file) {
		var reader = new FileReader();
		reader.onload = function (progressEvent) {
			addNewMedia({
				type: 'image',
				url: {
					id: addImageToResources(this.result)
				}
			});
		};
		reader.readAsDataURL(file);
	}

	$('#newMediaPopup input[type="text"]').keyup(checkMediaForm);


	function checkMediaForm() {
		var disabled = false;
		$('#newMediaPopup input[type="text"]').each(function () {
			if (!$(this).val()) {
				disabled = true;
			};
		});
		if (disabled) {
			$('#newMediaPopup button').attr('disabled', 'disabled');
		}
		else {
			$('#newMediaPopup button').removeAttr('disabled');
		}
	};

	function resetMediaForm() {
		$('#newMediaPopup input').each(function () {
			if ($(this).is('[type="text"]') || $(this).is('[type="file"]')) {
				$(this).val('');
			};
		});

		$('#newMediaPopup input[name="url"]').hide();
		$('#newMediaPopup input[name="image"]').show();
		$('#newMediaPopup input[name="media_type"]').prop('checked', false);
		$('#newMediaPopup input[name="media_type"]:eq(0)').prop('checked', true);
	};

	$('.mediaLibrary').on('click', 'li > i', function () {
		// $('#main').whiteboardRecorder('addEvent', {
		// 	selector: 'selectBackgroundMedia',
		// 	argument:  $(this).parent('li').data('config')
		// }); 
		selectBackgroundMedia(Object.assign({}, $(this).parent('li').data('config')));
	});

	$('.mediaLibrary').on('click', '.delete', function (e) {
		e.preventDefault();
		var $li = $('.mediaLibrary li').eq($(this).data('index'));

		if (typeof $li.data('config').src === 'object') {
			var mess = '';
			var imgId = $li.data('config').src.id;

			var fakePCV = {
				json: {
					whiteboardSetup: serrialiseWhiteboardSetup()
				}
			};
			if (pcvContainsImage(fakePCV, imgId)) {
				mess += 'Whiteboard setup, ';
			};

			$('.recordedSeesions li').each(function (e) {
				if ($(this).hasClass('pcvModule')) {
					var pcvModule = $(this).data('pcvModule');
					for (var key in pcvModule.pcvData) {
						if (pcvContainsImage(pcvModule.pcvData[key].segments, imgId)) {
							mess += $(this).find('h2').text() + ', '
							break;
						}
					}
				}
				else {
					if (pcvContainsImage($(this).data('pcv'), imgId)) {
						mess += $(this).find('h2').text() + ', '
					};
				}
			});

			if (mess !== '') {
				alert('Cannot delete. The image is used in: ' + mess.slice(0, -2) + '.');
			}
			else {
				deleteItemFromLIbrary($li, imgId);
			};
		};
	});


	$('.mediaLibrary').on('click', '.edit', function (e) {
		var cfg = $(this).parents('li').data('config');

		var $tpl = $($('#editImage').html());

		var $curImg = $tpl.find('.imgPreview.cur');
		var $newImg = $tpl.find('.imgPreview.new');

		var $edit = $curImg.find('.icon');
		var $button = $tpl.find('.button');
		var $browse = $tpl.find('.browse');

		$edit.click(function () {
			$('#main')
				.addClass('drawImage');

			addNewWhiteboard();
			resources.editableImgId = cfg.src.id;
			renderImage(resources.images[cfg.src.id], $mainCanvas);

			$.fancybox.close();
		});

		$curImg
			.css({
				backgroundImage: 'url(' + resources.images[cfg.src.id] + ')'
			})

		$.fancybox.open({
			content: $tpl,
			padding: 30
		});

		$button.click(function () {
			resources.images[cfg.src.id] = $(this).data('image');
			$.fancybox.close();

			savePCV();
			$('.' + cfg.src.id).each(function () {
				var $this = $(this);
				if ($this.is('img')) {
					$this.attr('src', resources.images[cfg.src.id]);
				}
				else if ($this.is('a.export')) {
					$this
						.attr({
							download: cfg.src.id + '.' + fileUtils.imgExtForFile(resources.images[cfg.src.id]),
							href: fileUtils.base64toBlobUrl(resources.images[cfg.src.id])
						})
				}
				else {
					$this.css({
						backgroundImage: 'url(' + resources.images[cfg.src.id] + ')'
					});
					var base64String = resources.images[cfg.src.id];
					if (fileUtils.imgExtForFile(base64String) === 'gif') {
						staticGif(base64String, function (base64String) {
							$this.css({
								backgroundImage: 'url(' + base64String + ')'
							});
						})
					}
				};
			});
		});

		$browse.find('input').change(function () {
			var reader = new FileReader();
			reader.onload = function (progressEvent) {
				$browse.css({
					display: 'none'
				});
				$newImg.css({
					backgroundImage: 'url(' + this.result + ')'
				});
				$button
					.removeAttr('disabled')
					.data('image', this.result)
			};
			reader.readAsDataURL(this.files[0]);
		});

	});


	$('.mediaLibrary').on('click', '.button.new', function (e) {
		if ($(this).is('.disabled')) {
			return;
		};

		var $tpl = $($('#newImage').html());

		var $browse = $tpl.find('.browse');
		var $create = $tpl.find('.create');
		var $txtImg = $tpl.find('.txtImg');

		$browse.click(function () {
			$('#image').click();
			$.fancybox.close();
		});

		$create.click(function () {
			$('#main')
				.addClass('drawImage');

			addNewWhiteboard();
			$.fancybox.close();
		});

		$txtImg.click(function () {
			$.fancybox.close();
			
			if (typeof Quill !== 'undefined') {
				openWYSIWYG();
			}
			else {
				require('/components/quilljs/quill.js', () => {
					openWYSIWYG();
				});
			}
		});

		$.fancybox.open({
			content: $tpl,
			padding: 30
		});
	});


	function openWYSIWYG() {

		var $tpl = $($('#textEditor').html()),
			$editor = $tpl.find('.editor'),
			$toolbar = $tpl.find('.toolbar');

		var $buttonSave = $tpl.find('.saveToCanvas'),
			$buttonClose = $tpl.find('.closeEditor')

		$editor.css({
			width: canvasSize.width + 'px',
			height: canvasSize.height + 'px'
		});

		var $html = $editor.html();
		var quill = new Quill($editor[0], {
			modules: {
				toolbar: $toolbar[0]
			},
			theme: 'snow'
		});

		setTimeout(() => {
			$('.ql-editor').html($html);
		})

		$buttonSave.click(function () {
			if (typeof html2canvas !== 'undefined') {
				convertTextToImage($editor, () => {
					$.fancybox.close();
				})
			}
			else {
				require('/lib/html2canvas.js', () => {
					convertTextToImage($editor, () => {
						$.fancybox.close();
					});
				});
			}
		});

		$buttonClose.click(function () {
			$.fancybox.close();
		});

		$.fancybox.open({
			content: $tpl,
			padding: 0,
			modal: true,
			showClose: true,
			helpers: {
				overlay: {
					css: {
						'background': 'rgba(255, 255, 255, 0.5)'
					}
				}
			}
		});

	}


	function convertTextToImage($editor, callback) {
		html2canvas($editor[0], {
			backgroundColor: null
		}).then(canvas => {
			addNewMedia({
				type: 'image',
				url: {
					id: addImageToResources(canvas.toDataURL())
				}
			});
			callback();
		});
	}


	$('.saveDrawing .button').click(function () {
		if ($(this).is('.save')) {
			if ((resources || {}).editableImgId) {
				addImageToResources($mainCanvas.get(0).toDataURL(), resources.editableImgId);
				$('.mediaLibrary li').each(function () {
					var config = $(this).data('config');
					if (config.type == 'image') {
						$(this).find('i').css({
							backgroundImage: 'url(' + getImageSource(config.src) + ')'
						})
					};
				});
				delete resources.editableImgId;
			}
			else {
				addNewMedia({
					type: 'image',
					url: {
						id: addImageToResources($mainCanvas.get(0).toDataURL())
					}
				});
			}
		}

		$('#main').removeClass('drawImage');
		handleRemove($('.whiteboards canvas').length - 1);
	})


	function deleteItemFromLIbrary($item, imgId) {
		delete resources.images[imgId];
		$item.remove();
		$('.mediaLibrary li').each(function (e) {
			$(this).find('.delete').data('index', e);
		});
		savePCV();
	};


	function pcvContainsImage(pcv, imgId) {
		for (var i in pcv.json.whiteboardSetup) {
			var slideSetup = pcv.json.whiteboardSetup[i];
			if (typeof slideSetup.backgroundMedia.src === 'object'
				&& slideSetup.backgroundMedia.src.id === imgId) {
				return true;
			};
		}
		return false;
	};


	$('.playbackPane .ion-record').click(function () {
		if ($(this).is('.disabled')) {
			return;
		};

		recorder = {
			mode: 'segment'
		};

		if (enableEventsOnlyRec) {
			return runCountdown(3, 0, function () {
				startRecording();
			});
		}

		requestMicAccess(function () {
			prepareToRecord();
		});
	});

	$('.playbackPane .ion-play').click(function () {
		if ($(this).is('.disabled')) {
			return;
		};
		$('.recordedSeesions li:last-child .btn').click();
	});

	$('.userPane .ion-ios-gear').click(function () {
		if ($(this).is('.disabled')) {
			return;
		};

		showBitRateSettings();
	});


	function requestMicAccess(callback) {
		voiceRecorder.powerOnMic({
			bitRate: bitRate
		},
			function () {
				callback();
			},
			function () {
				$.fancybox.open({
					content: 'Cannot record a session. Mic permission denied.',
					padding: 30
				});
			}
		);
	};


	function showBitRateSettings() {
		var $tpl = $('.bitRateSettings').clone();
		var $select = $tpl.find('select');
		var $button = $tpl.find('button');

		$select.find('option').each(function () {
			$(this).prop('selected', parseInt($(this).prop('value')) === bitRate);
		})

		$button.click(function () {
			bitRate = $select.val();
			$.fancybox.close();
		});

		$.fancybox.open({
			content: $tpl,
			padding: 30
		});
	};


	function updateUI() {
		var $li = recorder.item || $('<li>');

		$li.addClass('blank');

		if ($li.is('[index]')) {
			$li.empty()
		}
		else {
			$li
				.attr('index', $('.recordedSeesions li[index]').length)
				.appendTo('.recordedSeesions ul')
		}

		if (recorder.mode === 'segment') {
			$li.prepend('<h2>Segment ' + (parseInt($li.attr('index')) + 1) + '</h2>')
		}
		else {
			$li.prepend('<h2>Quiz module: ' + recorder.section + '</h2>')
			if (recorder.section === 'intro') {
				$('.toolBar .opts').show();
			};
		}

		$('<p>')
			.addClass('recording')
			.text('recording...')
			.appendTo($li);


		$('.status .text').addClass('recording').text(status);
		$('.playbackPane .ion-stop').removeClass('disabled');
		$('.disableOnRec').addClass('disabled');
		$('.quickQs').show();

		if (isMobile) {
			$('.basicUi .cursor').addClass('shown');
		}

		status = 'recording';
		runTimer();
	};


	function prepareToRecord() {
		if (voiceRecorder) {
			voiceRecorder.start(
				function (startVoiceRecorder) {
					runCountdown(window.micUsed ? 0 : 3, 0, function () {
						window.micUsed = true;
						startVoiceRecorder();
						startRecording();
					});
				},
				function (errorMessage) {
					$.fancybox.open({
						content: errorMessage,
						padding: 30
					});
				}
			);
		}
	};


	function startRecording() {
		startEventsRecording();
		updateUI();
	};


	function startEventsRecording() {
		var timestamp = new Date();

		$('#main').whiteboardRecorder('reset', timestamp);
		$('#main').whiteboardRecorder('addEvent', {
			selector: 'recordingStarted'
		});

		$('.board').jsCursor('startRecording', timestamp);

		toolbarSetup = serrialiseToolbarSetup();
		whiteboardSetup = serrialiseWhiteboardSetup();
	};


	function runCountdown(counter, delay, callback) {
		setTimeout(function () {
			if (counter > 0) {
				showGhostText(counter);
				counter--;
				runCountdown(counter, 1000, callback);
			}
			else {
				showGhostText('GO!');
				callback();
			}
		}, delay);
	};


	var ghostTextTimeout;
	function showGhostText(text) {
		$('.countdown b')
			.removeClass('animation')
			.text(text);

		setTimeout(function () {
			$('.countdown b')
				.addClass('animation');
		}, 20);

		if ($('.countdown').is(':hidden')) {
			$('.countdown').show();
		}

		clearTimeout(ghostTextTimeout);
		ghostTextTimeout = setTimeout(function () {
			$('.countdown').hide();
		}, 1000);
	};


	$('.playbackPane .ion-stop').click(function () {
		if (!$(this).is('disabled') && !$(this).is('.inactive')) {
			stopRecording();
		}
	});


	$('.userPane .login').click(function () {
		if (status == 'recording') {
			return;
		};
		showLogin();
	});


	$('.userPane .logout').click(function () {
		if ($(this).is('disabled')) {
			return;
		};

		showDeleteWarning(function () {
			teacherProfile = null;
			ProfileManager.clearProfile();
			updateUserPane();
			resetTool();
		}, 'Unsaved changes will be lost');

	});

	function stopAltSegRecording() {
		altSeg.isRecording = false;

		// $('#main').whiteboardRecorder('addEvent', {
		// 	selector: 'switchWhiteboard',
		// 	argument: altSeg.whiteboardIndex
		// }); 
		// switchWhiteboard(altSeg.whiteboardIndex);			


		showGhostText('Go! Resume segment!');
		$('#main').whiteboardRecorder('altSegComplete');

		$('.quickQs')
			.removeClass('recording')
			.show();

		$('#main').removeClass('special');
		$('.playbackPane .ion-stop').removeClass('inactive');
	}


	function stopRecording() {

		var timestamp = new Date();

		$('#main').whiteboardRecorder('addEvent', {
			selector: 'recordingComplete'
		}, timestamp);

		$('.board').jsCursor('stopRecording', timestamp);

		if (cursorMode) {
			cursorMode = false;
			toggleCursorButtonState($(".basicUi .cursor"));
		}

		stopTimer();

		var audioBlob;
		var audioCfg;
		if (voiceRecorder) {
			voiceRecorder.stop(function(blob) {
				audioBlob = blob;
				audioCfg = voiceRecorder.getAudioCfg();
				createPcv(audioBlob, audioCfg);
			});
		} 
		else {
			createPcv(audioBlob, audioCfg);
		}

		status = 'idle';

		$('.status .text').removeClass('recording').text(status);
		$('.playbackPane .ion-stop').addClass('disabled');
		$('.disableOnRec').removeClass('disabled');
		$('.basicUi .cursor').removeClass('shown');
		$('.quickQs').hide();

	}


	function createPcv(audioBlob, audioCfg) {
		var pcv = {
			json: {
				toolbarSetup: toolbarSetup,
				whiteboardSetup: whiteboardSetup,
				whiteboardEvents: $('#main').data('settings').events
			}
		};

		if (audioCfg) {
			pcv.json.audioCfg = audioCfg;
		}

		if (audioBlob) {
			var reader = new FileReader();
			reader.onload = function (progressEvent) {
				pcv.audio = this.result

				$('<audio>')
					.attr({
						src: URL.createObjectURL(audioBlob)
					})
					.on('loadedmetadata', function () {
						pcv.audioDuration = this.duration * 1000;
						let pcvDuration = pcv.json.whiteboardEvents[pcv.json.whiteboardEvents.length - 1].time;
						
						//audioDuration and pcvDuration delta should not be more than 3% or 5 seconds;
						if (pcv.audioDuration > 30000 && Math.abs(1 - pcv.audioDuration / pcvDuration) > 0.03 ||
							Math.abs(pcv.audioDuration - pcvDuration) > 5000) {
							showSegmentAudioWarning();
						}

						onAudioStringCreated(pcv);
					});

			};
			reader.readAsDataURL(audioBlob);
		}
		else {
			onAudioStringCreated(pcv);
		}
	}


	function prepareToRecordOnKeyDown() {
		$('.playbackPane .ion-record').click();
	};

	function stopRecordingOnKeyDown() {
		stopRecording();
	};


	function onAudioStringCreated(pcv) {
		
		let jsCursorData = getJsCursorEvents();

		let pcvDuration = pcv.json.whiteboardEvents[pcv.json.whiteboardEvents.length - 1].time;
		let audioRatio = pcv.audioDuration / pcvDuration;
		
		pcv.json.whiteboardEvents.forEach(e => {
			e.time = Math.round(e.time * audioRatio);
		});

		jsCursorData.forEach(e => {
			e.t = Math.round(e.t * audioRatio);
		})

		var $li = $('.recordedSeesions .blank');

		if (recorder.mode === 'quiz') {
			$li.remove();

			if ($('.toolBar .opts').is(':visible')) {
				$('.toolBar .opts').hide();
			};

			quiz_ctx[recorder.section] = {
				segments: pcv,
				jsCursorData: jsCursorData
			};

			$.fancybox.open({
				content: loadQuizForm()
			});
		}
		else {
			$li.html($('#sessionTPL').html());

			var $player = $li.find('.player');
			$player.find('.time i').text(formatTime(pcv.json.whiteboardEvents[pcv.json.whiteboardEvents.length - 1].time));

			var index = $li.attr('index');

			$li
				.data('pcv', pcv)
				.data('cursorEvents', jsCursorData)
				.find('h2').text('Segment ' + (parseInt(index) + 1)).end()
				.removeClass('blank')

			// Main player
			updateMainPlayer();

			// Save pcv
			setTimeout(savePCV, 300);
		};
	}


	$('.recordedSeesions').on('click', '.rename', function () {
		if ($(this).is('.disabled')) {
			return;
		};

		var $li = $(this).parents('li'),
			$h2 = $(this).parent().next('h2'),
			title = $h2.text().trim();

		rename(title, function (newTitle) {
			$h2.text(newTitle)
			if ($li.is('li')) {
				$li.data('pcv')['json'].show = title !== newTitle
			}
			savePCV();
		});
	});

	$('.recordedSeesions').on('click', 'li h2', function () {
		var index = $(this).parent().attr('index');
		selectSession(index);
	});

	$('.recordedSeesions').on('click', '.session .delete', function (e) {
		if ($(this).is('.disabled')) {
			return;
		};
		showDeleteWarning(function () {
			$('.recordedSeesions ul').empty();
			$('.recordedSeesions .session .player').remove();
			savePCV();
		});
	});

	$('.recordedSeesions').on('click', 'li .delete', function (e) {
		if ($(this).is('.disabled')) {
			return;
		};
		var $this = $(this);
		showDeleteWarning(function () {
			$this.parents('li').remove();
			updateMainPlayer();
			resetWhiteboard();
			setTimeout(savePCV, 300);
		});
	});

	$('.recordedSeesions').on('click', 'li .edit', function (e) {
		e.preventDefault();

		recorder = {
			mode: 'segment',
			item: $(this).parents('li')
		};

		requestMicAccess(function () {
			selectSession(recorder.item.attr('index'));
			prepareToRecord();
		})
	});


	$('.recordedSeesions').on('click', '.session .btn', function () {
		if ($(this).is('.disabled')) {
			return;
		};
		openPlayer(
			buildPCV()
		);
	});


	$('.recordedSeesions').on('click', 'li .btn', function () {
		if ($(this).is('.disabled')) {
			return;
		};
		var $this = $(this);
		if ($this.parents('li').hasClass('pcvModule')) {
			openPlayer(
				buildPCVForQuizModule($this.parents('li').data('pcvModule'))
			);
		}
		else {
			var index = $this.parents('li').attr('index');
			openPlayer(
				buildPCVbyIndex(index)
			);
		}
	});

	function rename(name, onRename) {
		var $tpl = $('#projectNamePopup').clone();
		var $input = $tpl.find('input');
		var $button = $tpl.find('.button');

		$button
			.click(function () {
				onRename($input.val().trim());
				$.fancybox.close();
			});

		$input
			.val(name)
			.keyup(function () {
				$button.prop('disabled', $input.val().trim() === '');
			});

		$.fancybox.open({
			content: $tpl,
			afterShow: function () {
				$input.focus();
			}
		});
	}

	function selectSession(index) {
		var $li = $('.recordedSeesions li[index="' + index + '"]');

		$li
			.siblings().removeClass('active').end()
			.addClass('active');

		resetWhiteboard();
		setupWhiteboardSession($li.data('pcv').json.whiteboardSetup);
	};


	var $mainCanvas = addWhiteboard();
	var mainCanvasCtx = $mainCanvas.get(0).getContext('2d');
	var gridCanvas = document.getElementById("grid");


	var $gridSize = $('#gridSize');

	$gridSize
		.val(gridSettings.size)
		.change(function () {
			gridSettings.size = $(this).val();
			updateGrid(gridSettings);
		});

	setCanvasSize(canvasSize);


	function setCanvasSize(size) {
		$(penCanvas).attr('width', canvasSize.width);
		$(penCanvas).attr('height', canvasSize.height);

		$(gridCanvas).attr('width', canvasSize.width);
		$(gridCanvas).attr('height', canvasSize.height);

		$('.whiteboards canvas').each(function () {
			$(this).attr('width', canvasSize.width);
			$(this).attr('height', canvasSize.height);
		});

		$('.backgroundMedia, .whiteboard').css({
			minWidth: canvasSize.width + 'px',
			minHeight: canvasSize.height + 'px',
		});

		$('.fullscreen .viewport').css({
			maxWidth: canvasSize.width + 'px'
		});

		updateGrid(gridSettings);
	}


	$(".toolBar .tool").click(function () {
		if (status === 'recording') {
			$('#main').whiteboardRecorder('addEvent', {
				selector: 'selectTool',
				argument: $(this).attr('id')
			});
		};

		if ($(this).parent().is('menu')) {
			$(this).parent('menu').hide();
		}
		selectTool($(this).attr('id'));
	});

	$(".toolBar .finger").click(function () {
		$(this).toggleClass('activated');
		directTouch = $(this).hasClass('activated');
	});

	$(".basicUi .cursor").click(function () {
		if (status !== 'recording') {
			return;
		}
		cursorMode = !cursorMode;
		toggleCursorButtonState($(this));
	});


	$(".uiToggle").click(function () {
		$('#main').toggleClass('minimalistic');
	});

	function toggleCursorButtonState($cursorBtn) {
		if (cursorMode) {
			$cursorBtn.addClass('activated');
		} else {
			$cursorBtn.removeClass('activated');
		}
		showGhostText(cursorMode ? 'Cursor On' : 'Cursor Off');
	}


	// load color palette
	for (var key in colorPalette) {
		$('<i>')
			.data('name', key)
			.data('color', colorPalette[key].value)
			.css({
				backgroundColor: colorPalette[key].value
			})
			.addClass(colorPalette[key].id)
			.attr('title', 'Ctrl+Shift+' + (Object.keys(colorPalette).indexOf(key) + 1))
			.appendTo('.colorsList');
	};


	$('.colorsList').on('click', 'i', function () {
		setColor($(this).data('name'));
	});


	$('.penSize').click(function () {
		if (status === 'recording') {
			$('#main').whiteboardRecorder('addEvent', {
				selector: 'selectLineWidth',
				argument: $(this).find('i').attr('class').split(' ')[1]
			});
		};

		// $('.penSize').css({display: 'none'});
		selectLineWidth($(this).find('i').attr('class').split(' ')[1]);
	});


	$('.grid_icon img').click(function () {
		gridSettings.show = !gridSettings.show;
		updateGrid(gridSettings);
	});


	$('.clear').click(function () {
		if (status === 'recording') {
			$('#main').whiteboardRecorder('addEvent', {
				selector: 'handleClear'
			});
		};

		handleClear();
	});

	$('.clearAll').click(function () {
		if (status === 'recording') {
			return;
		}
		handleClearAll();
	});


	$('.quickQs').click(function () {
		if (altSeg.isRecording) {
			return stopAltSegRecording();
		}

		let buttons = ['A', 'B'];
		if ($(this).data('option')) {
			$(this).siblings('.quickQs').hide();
			return captureQuestion(buttons, $(this).data('option'));
		};

		showQsSeqOptions({
			buttons: buttons,
			onClose: captureQuestion
		});
	});


	function captureQuestion(options, choice) {

		options = options.map(b => {
			return {
				txt: b,
				correct: b == choice
			}
		});

		let index = $('.WB_preview .thumbs li.active').index();

		altSeg.whiteboardIndex = index;
		altSeg.isRecording = true;

		// cloneWhiteboard(index);			
		showGhostText('Go! Explanation!');

		$('#main').addClass('special');
		$('.quickQs').addClass('recording');
		$('.playbackPane .ion-stop').addClass('inactive');

		$('#main').whiteboardRecorder('addEvent', {
			selector: 'showQuestion',
			argument: {
				options: options
			}
		});
	}


	$('.undo, .redo').click(function (e) {
		e.preventDefault();
		if (!$(this).is('.disabled')) {
			if (status === 'recording') {
				var imgData = 'none';
				var action = $(this).attr('id');
				var history = $mainCanvas.data('history');

				if (action == 'redo') {
					history.state++;
				}
				else {
					history.state--;
				}

				if (history.state == 0) {
					imgData = $mainCanvas.get(0).toDataURL();
				}
				else {
					imgData = history.array[history.state - 1];
				}

				renderImage(imgData, $mainCanvas);
				updateThumbnails();
				updateUndoRedo();

				$('#main').whiteboardRecorder('addEvent', {
					selector: 'handleUndoRedo',
					argument: {
						action: action,
						imgData: imgData
					}
				});
			}
			else {
				handleUndoRedo($(this).attr('id'));
			}
		};
	});

	$('.toolBar .new').click(function () {
		if ($(this).is('.disabled')) {
			return;
		};
		showDeleteWarning(resetTool);
	});


	$('.toolBar .save').click(function () {
		if ($(this).is('.disabled')) {
			return;
		};

		savePCV();
	});


	$('.import').click(function () {
		if ($(this).is('.disabled')) {
			return;
		};
		showStorageSelection('import');
	});

	$('.export').click(function () {
		if ($(this).is('.disabled')) {
			return;
		};
		showStorageSelection('export');
	});



	$(".help .icon").click(function () {
		$.fancybox.open({
			content: $('#help').html(),
			padding: 30
		});
	});

	$('.toolBar .opts').click(function () {
		showQuizOptions();
	});

	$('.toolBar .bgEdit').click(function () {
		if ($mainCanvas.data('backgroundMedia').type === 'image') {
			configureSlideBgImage($mainCanvas.data('backgroundMedia'), function (config) {
				saveBackgroundMediaConfig(config);
				setBackgroundMedia(config);
			});
		}
	});

	$('.toolBar span').mouseenter(function () {
		$('.toolBar menu').hide();
		$(this).find('menu').show();
	})

	$('.toolBar span').mouseleave(function () {
		if ($(this).find('menu')) {
			$(this).find('menu').hide();
		};
	})


	$('.WB_preview .new').click(function () {
		if (status === 'recording') {
			$('#main').whiteboardRecorder('addEvent', {
				selector: 'addNewWhiteboard'
			});
		};

		addNewWhiteboard();
	});


	$('.WB_preview .thumbs').on('click', 'li > i', function () {
		var $this = $(this).parent();

		if (!$this.is('.active')) {
			if (status === 'recording') {
				$('#main').whiteboardRecorder('addEvent', {
					selector: 'switchWhiteboard',
					argument: $('.WB_preview .thumbs li').index($this)
				});
			};

			switchWhiteboard($('.WB_preview .thumbs li').index($this));
		};
	});

	$('.WB_preview .thumbs').on('click', '.delete', function (e) {
		e.preventDefault();
		var $this = $(this);
		showDeleteWarning(function () {
			var index = $this.data('index');
			if (status === 'recording') {
				$('#main').whiteboardRecorder('addEvent', {
					selector: 'handleRemove',
					argument: index
				});
			};
			handleRemove(index);
		});
	});


	$('#checkbox').change(function () {
		handleGridChange($(this).is(':checked'));
	});


	$(".board").on('mousedown touchstart', '.whiteboard', function (event) {
		// if (!$('#main').hasClass('minimalistic')) {
		// 	return;
		// }
		event.preventDefault();
		var mouse_event = minifyEvent(event);

		if (isMobile) {
			$cursorPointer.stop().show().css({
				transform: 'translate(' + mouse_event.pageX + 'px, ' + mouse_event.pageY + 'px)'
			});
		}

		if (event.type === 'touchstart' && !directTouch && event.originalEvent.touches[0].touchType === 'direct' || cursorMode) {
			return;
		}

		if (status === 'recording') {
			$('#main').whiteboardRecorder('addEvent', {
				selector: 'handleMousedown',
				argument: mouse_event
			});
		};

		handleMousedown(mouse_event);
	});


	$(".board").on('mousemove touchmove', '.whiteboard', function (event) {
		event.preventDefault();

		var mouse_event = minifyEvent(event);
		if (isMobile) {
			$cursorPointer.css({
				transform: 'translate(' + mouse_event.pageX + 'px, ' + mouse_event.pageY + 'px)'
			});
		}

		if (event.type === 'touchmove' && !directTouch && event.originalEvent.touches[0].touchType === 'direct') {
			return;
		}
		if (!mousedown) {
			return;
		};
		lastMove = event;

		if (status === 'recording') {
			$('#main').whiteboardRecorder('addEvent', {
				selector: 'handleMousemove',
				argument: mouse_event
			});
		};

		handleMousemove(mouse_event);
	});


	$(document).on('mouseup touchend', window, function (event) {

		// if (isMobile && status === 'recording' && event.target.id === 'penCanvas') {
		// 	if (!latestTouchEndEvent) {
		// 		latestTouchEndEvent = event;
		// 	} 
		// 	else {
		// 		if (event.timeStamp - latestTouchEndEvent.timeStamp < 300) {
		// 			mousedown = false;
		//   	cursorMode = !cursorMode;
		//   	toggleCursorButtonState($(".basicUi .cursor"));        			
		// 		}
		// 		latestTouchEndEvent = event;
		// 	}
		// }

		if (isMobile) {
			$cursorPointer.stop().hide();
		}

		if (!mousedown) {
			return;
		};

		var mouse_event = minifyEvent(event);

		if (status === 'recording') {
			$('#main').whiteboardRecorder('addEvent', {
				selector: 'handleMouseup',
				argument: mouse_event
			});
		};

		handleMouseup(mouse_event);
	});


	function handleMousedown(e) {
		mousedown = true;
		whiteboard.handleSimulatedEvent(e);
	};


	function handleMousemove(e) {
		whiteboard.handleSimulatedEvent(e);
	};

	function handleMouseup(e) {
		mousedown = false;
		whiteboard.handleSimulatedEvent(e);

		//!potencial memory issue
		mergeDrawing();
	};


	function showQuizOptions() {
		if (status === 'recording') {
			$('.toolBar .opts').hide();
			$('#main').whiteboardRecorder('addEvent', {
				selector: 'showQuizOptions'
			});
		};
	};



	function minifyEvent(event) {

		let evnt = {
			which: 1
		};

		if (event.type == 'touchstart') {
			evnt.type = 'mousedown';
		}
		else if (event.type == 'touchmove') {
			evnt.type = 'mousemove';
		}
		else if (event.type == 'touchend') {
			evnt.type = 'mouseup';
			event = lastMove
		}
		else {
			evnt.type = event.type;
		}

		var point = localPoint(
			$("#whiteboard").parent(), {
			x: event.type.startsWith('touch') ? event.originalEvent.touches[0].pageX : event.pageX,
			y: event.type.startsWith('touch') ? event.originalEvent.touches[0].pageY : event.pageY,
		}
		);

		evnt.pageX = Math.round(point.x);
		evnt.pageY = Math.round(point.y);

		return evnt;
	}


	function mergeDrawing() {
		mainCanvasCtx.drawImage(penCanvas, 0, 0);
		whiteboard.clear();

		if ($mainCanvas.hasClass('blank')) {
			$mainCanvas
				.removeClass('blank')
				.addClass('modified')
		}
		else if (!$mainCanvas.hasClass('modified')) {
			$mainCanvas.addClass('modified');
		}

		logHistory();
	};

	function logHistory() {
		var history = $mainCanvas.data('history');

		if (history.state == 25) {
			history.array.shift();
			history.array.push($mainCanvas.get(0).toDataURL());
		}
		else {
			history.state += 1;
		}

		if (history.state > history.array.length) {
			history.array.push($mainCanvas.get(0).toDataURL());
		}
		else {
			var tempArray = [];
			for (var i = 0; i < history.state; i++) {
				if (history.state - 1 == i) {
					tempArray.push($mainCanvas.get(0).toDataURL());
				}
				else {
					tempArray.push(history.array[i]);
				}
			}
			history.array = tempArray;
		}

		updateThumbnails();
		updateUndoRedo();
	};


	function clearHistory($canvas) {
		var history = $canvas.data('history');
		history.state = 0;
		history.array = [];

		updateUndoRedo();
	};


	function updateThumbnails($canvas = null) {
		//!potencial memory issue
		$canvas = $canvas || $mainCanvas;
		var history = $canvas.data('history');
		var whiteboardImage = $canvas.data('whiteboardImage');
		var backgroundMedia = $canvas.data('backgroundMedia');

		var index = $canvas.index();

		setThumbnail(index, {
			whiteboardImage: history.array.length > 0 ? history.array[history.state - 1] : whiteboardImage,
			backgroundMedia: backgroundMedia
		});
	};


	function setThumbnail(index, params) {
		var $li = $('.WB_preview .thumbs li').eq(index);
		var $i = $li.find('i');
		var $b = $li.find('b');

		$b.css({
			backgroundColor: params.backgroundMedia.bgColor || boardColor,
		});

		if (params.whiteboardImage && params.whiteboardImage !== 'none') {
			$i.css('background-image', 'url(' + getImageSource(params.whiteboardImage) + ')');
		}
		else {
			$i.css('background-image', 'none');
		}

		if (params.backgroundMedia && params.backgroundMedia.type === 'image') {
			$b
				.removeAttr('class')
				.addClass(params.backgroundMedia.align)
				.addClass(params.backgroundMedia.src.id)
				.css({
					backgroundImage: 'url(' + getImageSource(params.backgroundMedia.src) + ')',
					backgroundSize: params.backgroundMedia.scale + '% ' + params.backgroundMedia.scale + '%'
				});

			var base64String = getImageSource(params.backgroundMedia.src);
			if (fileUtils.imgExtForFile(base64String) === 'gif') {
				staticGif(base64String, function (base64String) {
					$b.css({
						backgroundImage: 'url(' + base64String + ')'
					});
				})
			}
		}
		else {
			$b.css('background-image', 'none');
		}
	};


	function handleClear() {
		$mainCanvas
			.data('whiteboardImage', 'none')
			.removeClass('modified')
			.addClass('blank');

		clearCanvas($mainCanvas);
		clearHistory($mainCanvas);
	};

	function handleClearAll() {
		$('.whiteboards canvas').each(function () {
			var $canvas = $(this);
			clearCanvas($canvas);
			clearHistory($canvas);
			updateThumbnails($canvas);
		});
	};

	function handleRemove(index) {
		$('.whiteboards canvas').eq(index).remove();
		$('.WB_preview .thumbs li').eq(index).remove();

		if ($('.whiteboards canvas').length > 0) {
			$('.WB_preview .thumbs li').each(function (e) {
				$(this).find('.delete').data('index', e);
				$(this).find('u').text(e + 1);
			});
			switchWhiteboard(0);
		}
		else {
			$('.board').hide();
		}
	};


	function handleUndoRedo(action) {
		var history = $mainCanvas.data('history');

		if (action == 'redo') {
			history.state++;
			if (!$mainCanvas.hasClass('modified')) {
				$mainCanvas
					.addClass('modified')
					.removeClass('blank')
			}
		}
		else {
			history.state--;
		}

		if (history.state == 0) {
			$mainCanvas.removeClass('modified')
			var whiteboardImage = $mainCanvas.data('whiteboardImage');

			if (whiteboardImage && whiteboardImage !== 'none') {
				renderImage(getImageSource(whiteboardImage), $mainCanvas);
			}
			else {
				$mainCanvas.addClass('blank');
				clearCanvas($mainCanvas);
			}
		}
		else {
			renderImage(history.array[history.state - 1], $mainCanvas);
		}

		updateThumbnails();
		updateUndoRedo();
	};


	function setupWhiteboardSession(session) {
		var currentIndex = 0;

		if (session) {
			for (var index in session) {
				if (index > 0) {
					addNewWhiteboard();
				}

				if (session[index].isCurrent) {
					currentIndex = index;
				}

				var $canvas = $('.whiteboards canvas').eq(index);
				var backgroundMedia = session[index].backgroundMedia;
				var whiteboardImage = session[index].whiteboardImage;

				if (whiteboardImage !== 'none') {
					$canvas.removeClass('blank');
				};

				$canvas
					.data('backgroundMedia', backgroundMedia)
					.data('whiteboardImage', whiteboardImage)

				renderImage(getImageSource(whiteboardImage), $canvas);

				setThumbnail(index, {
					whiteboardImage: whiteboardImage,
					backgroundMedia: backgroundMedia
				});
			}

			switchWhiteboard(currentIndex);
		};
	};


	function addNewWhiteboard() {
		$mainCanvas = addWhiteboard();
		mainCanvasCtx = $mainCanvas.get(0).getContext('2d');

		var $backgroundMedia = $('.backgroundMedia');
		$backgroundMedia.empty();

		if ($('.board').is(':hidden')) {
			$('.board').show();
		};

		$('.board').css({
			background: boardColor
		});

		updateUndoRedo();
	};


	function createWhiteboard() {
		var canvas = $('<canvas>')
			.attr('width', canvasSize.width)
			.attr('height', canvasSize.height)
			.data('history', {
				state: 0,
				array: []
			})
			.data('backgroundMedia', {
				type: 'none',
				bgColor: boardColor
			})
			.addClass('blank');

		return canvas;
	};


	function addWhiteboard() {
		$('.whiteboards canvas').hide();

		var canvas = createWhiteboard();
		canvas.appendTo($('.whiteboards'));

		$('<li>')
			.html($('#thumbTPL').html())
			.appendTo($('.WB_preview .thumbs'))
			.find('u').text($('.whiteboards canvas').length).end()
			.find('.delete').data('index', $('.whiteboards canvas').length - 1).end()
			.find('b').css('background-color', boardColor)

		updatePagination($('.whiteboards canvas').length - 1);

		return canvas;
	};


	function cloneWhiteboard(index) {
		var $whiteboardClone = cloneCanvas($('.whiteboards canvas').eq(index)),
			$whiteboardThumbClone = $('.WB_preview .thumbs li').eq(index).clone(true);

		$whiteboardClone
			.insertAfter($('.whiteboards canvas').eq(index));

		$whiteboardThumbClone
			.insertAfter($('.WB_preview .thumbs li').eq(index))
			.find('.delete').data('index', index + 1);

		switchWhiteboard(index + 1);
	};


	function switchWhiteboard(index) {
		$('.whiteboards canvas').hide();
		$('.whiteboards canvas').eq(index).show();

		$mainCanvas = $('.whiteboards canvas').eq(index);
		mainCanvasCtx = $mainCanvas.get(0).getContext('2d');

		updateUndoRedo();
		updatePagination(index);

		setBackgroundMedia($mainCanvas.data('backgroundMedia'));
	};


	function resetWhiteboard() {
		$('#main').whiteboardRecorder('reset');

		$('.whiteboards').empty();
		$('.backgroundMedia').empty();
		$('.WB_preview .thumbs').empty();

		mousedown = false;
		whiteboard.clear();

		selectLineColor('LC_fff200');
		selectLineWidth('LS_1');
		selectTool('penTool');

		addNewWhiteboard();
	};


	function cloneCanvas($canvas) {
		var $clone = $canvas.clone(true),
			canvasCtx = $canvas.get(0);

		$clone
			.get(0)
			.getContext('2d')
			.drawImage(canvasCtx, 0, 0);

		return $clone;
	};


	function resetTool(onToolReset) {
		dbUtils.dropDB(function () {
			resources = null;
			resetSegments();
			resetWhiteboard();
			resetMediaLibrary();
			if (onToolReset) {
				onToolReset();
			}
		});
	};


	function resetSegments() {
		$('.recordedSeesions ul').empty();
		$('.recordedSeesions .session .player').remove();
		setProjectName('Untitled project');
	};


	function setupToolbar(settings) {
		selectTool(settings.tool);
		selectLineColor(settings.penColor);
		selectLineWidth(settings.penSize);
	};


	function updateGrid(settings) {
		if (settings.show) {
			drawGrid(settings.size);
			showGrid();
		}
		else {
			hideGrid();
		};
	};


	function showGrid() {
		$('.grid').show();
		$('.grid_icon').addClass('selected');
		$gridSize.prop("disabled", false);
	};


	function hideGrid() {
		$('.grid').hide();
		$('.grid_icon').removeClass('selected');
		$gridSize.prop("disabled", true);
	};


	function updateUndoRedo() {
		var history = $mainCanvas.data('history');
		$('.undo, .redo').addClass('disabled');

		if (history.state > 0) {
			$('.undo').removeClass('disabled');
		}
		if (history.state < history.array.length) {
			$('.redo').removeClass('disabled');
		}
	};


	function updatePagination(index) {
		$('.WB_preview .thumbs li')
			.removeClass('active')
			.eq(index).addClass('active');
	};


	function getImageSource(imgageSource) {
		if (typeof imgageSource === 'object') {
			return resources.images[imgageSource.id]
		} else {
			return imgageSource;
		}
	};


	function addImageToResources(imageBase64, id = null) {
		if (!resources) {
			resources = {
				images: {}
			};
		};

		var imgObjectId = id || guid();
		resources.images[imgObjectId] = imageBase64;
		console.log('adding image to resources');

		return imgObjectId
	};



	function renderImage(imgData, $canvas) {
		if (!imgData) {
			return;
		}

		var img = new Image();
		img.src = imgData;
		img.onload = function () {
			clearCanvas($canvas);
			$canvas.get(0).getContext('2d').drawImage(img, 0, 0);
		};
	};


	function clearCanvas(canvas) {
		canvas.get(0).getContext('2d').clearRect(0, 0, canvas.width(), canvas.height());
	};


	function staticGif(imgData, onReady) {
		var $canvas = $('<canvas>')

		var img = new Image();
		img.src = imgData;
		img.onload = function () {
			$canvas.attr({
				width: img.width,
				height: img.height
			});
			$canvas.get(0).getContext('2d').drawImage(img, 0, 0);
			onReady($canvas.get(0).toDataURL());
		};
	};


	function drawGrid(cellSize) {

		var canvas = document.getElementById("grid");
		canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

		var options = {
			minorLines: {
				separation: cellSize,
				color: '#ffffff'
			},
			majorLines: {
				separation: cellSize * 10,
				color: '#ffffff'
			}
		};

		drawGridLines(canvas, options.minorLines);
		drawGridLines(canvas, options.majorLines);
	};


	function drawGridLines(canvas, options) {
		var width = canvas.width;
		var height = canvas.height;
		var rows = Math.floor(width / options.separation) + 1;
		var cols = Math.floor(height / options.separation) + 1;

		var ctx = canvas.getContext('2d');
		ctx.strokeStyle = options.color;
		ctx.strokeWidth = 1;

		ctx.beginPath();

		for (var i = 0; i <= rows; i++) {
			var x = (i * options.separation);
			ctx.moveTo(x, 0);
			ctx.lineTo(x, height);
			ctx.stroke();
		}

		for (var i = 0; i <= cols; i++) {
			var y = (i * options.separation);
			ctx.moveTo(0, y);
			ctx.lineTo(width, y);
			ctx.stroke();
		}

		ctx.closePath();
	};


	function showPointer(event) {
		$('.pointer').css({
			top: event.pageY,
			left: event.pageX
		});
	};


	var localPoint = function (node, point) {
		return {
			x: point.x - node.offset().left,
			y: point.y - node.offset().top
		}
	};


	var distance = function (p0, p1) {
		return Math.sqrt(Math.pow(p0.x - p1.x, 2) + Math.pow(p0.y - p1.y, 2));
	};


	function setColor(color) {
		if (status === 'recording') {
			$('#main').whiteboardRecorder('addEvent', {
				selector: 'selectLineColor',
				argument: colorPalette[color].id
			});
			if (cursorMode) {
				cursorMode = false;
				toggleCursorButtonState($(".basicUi .cursor"));
			}
		};
		selectLineColor(colorPalette[color].id);
	};


	function selectLineColor(color_id) {
		var $color = $('.' + color_id);

		$color
			.siblings().removeClass('active').end()
			.addClass('active');

		$color.parents('.colorPallete').find('b').css({
			backgroundColor: $color.data('color')
		})

		whiteboard.setPenColor($color.data('color'));
		whiteboardSettings.penColor = $color.data('color');
	};


	function selectLineWidth(size_id) {
		var $size = $('.' + size_id);

		$('.penSize').removeClass('active');
		$size.parent().addClass('active');

		$size
			.siblings().removeClass('active').end()
			.addClass('active');

		whiteboard.setDotSize($size.data('size'));
		whiteboardSettings.minWidth = $size.data('size');
		whiteboardSettings.maxWidth = $size.data('size');
	};


	function selectTool(tool_id) {
	};

	function selectBackgroundMedia(config) {
		if (config.type === 'none') {
			saveBackgroundMediaConfig(config)
			clearBackgroundMedia();
		}
		else {
			configureSlideBgImage(config, function (config) {
				saveBackgroundMediaConfig(config);
				setBackgroundMedia(config);
			});
		}
	};

	function saveBackgroundMediaConfig(config) {
		if (status === 'recording') {
			$('#main').whiteboardRecorder('addEvent', {
				selector: 'setBackgroundMedia',
				argument: config
			});
		}
		$mainCanvas.data('backgroundMedia', config);
		updateThumbnails();
	}

	function setBackgroundMedia(config) {
		clearBackgroundMedia();

		if (!config) {
			return;
		}

		if (config.bgColor) {
			$('.board').css({
				background: config.bgColor
			});
		};

		var $backgroundMedia = $('.backgroundMedia');

		if (config.type === 'image') {
			setSlideBgImage(config);
		}
		else if (config.type === 'iframe') {
			var $iframeDiv = $('<div class="iframe"></div>');
			$backgroundMedia.append($iframeDiv);

			$('<iframe></iframe>')
				.appendTo($iframeDiv)
				.attr('src', config.src)
				.attr('width', config.width)
				.attr('height', config.height)
		}
	};

	function configureSlideBgImage(config, callback) {
		config.scale = config.scale || 100;
		config.align = config.align || 'cm';
		config.bgColor = config.bgColor || boardColor;

		if (true) {
			return (function (isOpen) {
				if (isOpen) {
					$.fancybox.close();
					return setTimeout(callback, 300, config);
				}
				callback(config);
			})($.fancybox.isOpen); //disables bg image configurаtion feature;
		};

		var $tpl = $('.bgMediaSettings').clone();

		var $imgPreview = $('<img>');
		var $submitButton = $tpl.find('.button');

		var $bgColorSettings = $tpl.find('.bgColor');
		var $imgScaleSettings = $tpl.find('.imgScale');
		var $imgPositionSettings = $tpl.find('.alignment');

		$imgPreview
			.appendTo($tpl.find('.preview span i'))
			.attr('src', getImageSource(config.src))
			.css('width', config.scale + '%');

		$tpl.find('.preview span').css({
			background: config.bgColor
		});

		$imgPositionSettings
			.find('li[data-align="' + config.align + '"]')
			.addClass('active');

		$imgPreview
			.parent()
			.removeAttr('class')
			.addClass(config.align);

		$bgColorSettings
			.find('span')
			.each(function () {
				$(this).css({
					background: $(this).data('color')
				});
			})
			.click(function () {
				config.bgColor = $(this).data('color');
				$tpl.find('.preview span').css({
					background: config.bgColor
				})
			});

		$imgScaleSettings
			.find('i')
			.click(function () {
				if ($(this).is('.inc')) {
					config.scale = config.scale + 5;
				} else {
					config.scale = Math.max(5, config.scale - 5);
				}

				$imgPreview
					.css('width', config.scale + '%');
			});

		$imgPositionSettings
			.find('li')
			.click(function () {
				$(this)
					.siblings().removeClass('active').end()
					.addClass('active');

				config.align = $(this).data('align');

				$imgPreview
					.parent()
					.removeAttr('class')
					.addClass(config.align);
			});

		$submitButton
			.click(function () {
				$.fancybox.close();
				setTimeout(function () {
					callback(config);
				})
			});

		$.fancybox.open({
			content: $tpl,
			padding: 0
		});
	};

	function setSlideBgImage(config) {
		var $image = $('<img>');
		var $imageDiv = $('<div>');
		var $backgroundMedia = $('.backgroundMedia');

		$image
			.appendTo($imageDiv)
			.addClass(config.src.id)
			.attr('src', getImageSource(config.src))

		$imageDiv
			.appendTo($backgroundMedia)
			.addClass('image ' + config.align)

		if (config.scale) {
			$image.css({
				width: config.scale + '%'
			});
		}
		else if (config.width) {
			setBackgroundMediaParams({
				align: config.align,
				width: config.width
			});
		}
	};

	function clearBackgroundMedia() {
		$('.backgroundMedia').empty();
		$('.board').css({
			background: boardColor
		});
	};

	function addNewMedia(params) {
		var $li = $('<li>');
		$li.html($('#bgMediaTPL').html());
		var base64String = getImageSource(params.url);

		if (params.type === 'image') {
			$li
				.data('config', {
					type: 'image',
					title: params.title || '',
					src: params.url
				})
				.find('i').css({
					backgroundImage: 'url(' + base64String + ')'
				})
				.addClass(params.url.id).end()
				.find('u').text(params.title || '').end()
				.find('.delete').data('index', $('.mediaLibrary li').length).end()
				.find('.export')
				.attr({
					download: params.url.id + '.' + fileUtils.imgExtForFile(base64String),
					href: fileUtils.base64toBlobUrl(base64String)
				})
				.addClass(params.url.id)

			if (fileUtils.imgExtForFile(base64String) === 'gif') {
				staticGif(base64String, function (base64String) {
					$li.find('i').css({
						backgroundImage: 'url(' + base64String + ')'
					});
				})
			}
		}
		else if (params.type === 'video' || params.type === 'simulation') {
			$li
				.data('config', {
					type: 'iframe',
					src: params.url,
					width: 900,
					height: 480
				})
				.find('u').text(params.title);
		}

		$('.mediaLibrary ul').append($li);
		$('.mediaLibrary ul').scrollTop($('.mediaLibrary ul')[0].scrollHeight);
	};


	function checkStorage() {
		return new Promise(function (resolve) {
			dbUtils.getStorage(function (results) {
				if (results.length > 0) {
					return resolve(sortByDate(results)[0]);
				}
				resolve();
			});
		});
	}

	if (!doubtPcv) {
		pcvToken = hasValidPcvToken();
		checkStorage().then(function (data) {
			if (data && pcvToken) {
				if (teacherProfile && teacherProfile.id.indexOf(pcvToken.toAddress) > -1) {
					if (!data.pcvToken || data.pcvToken && data.pcvToken.timestamp !== pcvToken.timestamp) {
						showAlert('Your current project work will be lost. Do you want to continue?', 'Continue', setToken);
					};
				}
				else {
					var text = 'Unsaved project work' + (data.pcvToken ? ' for ' + data.pcvToken.toAddress : '') + ' found.'
					showAlert(text + ' If you login, those changes will be lost. Do you want to continue?', 'Login', function () {
						showLogin(setToken, pcvToken.toAddress);
					});
				}
				readPCV(data);
			}
			else if (pcvToken) {
				showLogin(setToken, pcvToken.toAddress);
			}
			else if (data) {
				if (data.pcvToken && (!teacherProfile || teacherProfile.id.indexOf(data.pcvToken.toAddress) === -1)) {
					var text = 'Unsaved project work for ' + data.pcvToken.toAddress + ' found.'
					showDialog(text + ' Do you want to login or delete the project work?', [{
						text: 'login',
						handler: function () {
							showLogin(null, pcvToken.toAddress);
						}
					},
					{
						text: 'delete',
						handler: function () {
							resetTool();
						}
					}]);
				}
				readPCV(data);
			}
			else {
				promptFileName();
			}
		});
	};

	function setToken() {
		setProjectName(pcvToken.title);
		savePCV();
	};


	document.getElementById('file').onchange = function () {
		var file = this.files[0];
		var reader = new FileReader();
		reader.onload = function (progressEvent) {
			if (file.type === 'application/x-gzip') {
				unzipPcv(this.result, (pcv) => {
					readPCV(pcv);
					$.fancybox.close();		
				})
			}
			else {
				readPCV(JSON.parse(this.result));
				$.fancybox.close();	
			}
		};
		if (file.type === 'application/x-gzip') {
			reader.readAsArrayBuffer(file);
		}
		else {
			reader.readAsText(file);
		}
	};


	function zipPcv(pcv, callback) {
		if (typeof pako !== 'undefined') {
			callback(zip(pcv));
		}
		else {
			require('/lib/pako.js', () => {
				callback(zip(pcv));
			});
		}
		function zip(pcv) {
			return pako.gzip(JSON.stringify(pcv))
		}
	};


	function unzipPcv(zip, callback) {
		if (typeof pako !== 'undefined') {
			callback(unzip(zip));			
		}
		else {
			require('/lib/pako.js', () => {
				callback(unzip(zip));
			});
		}
		function unzip(zip) {
			return JSON.parse(pako.ungzip(zip, {
				to: 'string'
			}))
		}
	};

	function readPCV(pcv) {
		if (!pcv) {
			return;
		}

		pcvToken = pcvToken || pcv.pcvToken;

		if (pcv.resources) {
			resources = pcv.resources;
		};

		if (pcv.canvasSize) {
			canvasSize = pcv.canvasSize;
			setCanvasSize(canvasSize);
		};

		if (pcv.hasOwnProperty('projectName')) {
			setProjectName((pcvToken && pcvToken.title) || pcv.projectName);
		};

		if (pcv.hasOwnProperty('setup')) {
			setupToolbar(pcv.setup.toolbarSetup);
			// setupWhiteboardSession(pcv.setup.whiteboardSetup);
		}

		if (pcv.hasOwnProperty('mediaLibrary')) {
			resetMediaLibrary();
			for (var index in pcv.mediaLibrary) {
				var media = pcv.mediaLibrary[index];

				if (media.type === 'none') {
					continue;
				}
				else {
					addNewMedia({
						type: media.type,
						title: media.title,
						url: media.src
					});
				}
			}
		}


		$('.recordedSeesions ul').empty();

		for (var index in pcv.segments) {
			var pcvSegment = pcv.segments[index];

			var $li = $('<li>');
			$li.html($('#sessionTPL').html());

			var $player = $li.find('.player');
			$player.find('.time i').text(formatTime(pcvSegment.json.whiteboardEvents[pcvSegment.json.whiteboardEvents.length - 1].time));

			var index = $('.recordedSeesions li[index]').length;

			$li
				.appendTo('.recordedSeesions ul')
				.data('pcv', pcvSegment)
				.attr('index', index)
				.find('h2').text(pcvSegment.json.whiteboardEvents[0]['title'] || 'Segment ' + (index + 1))

			if (pcvSegment.audio) {
				var $audio = $('<audio controls="controls"></audio>');
				$audio.attr('src', pcvSegment.audio).appendTo($player);
			}
			else {
				_pcv.log('readPCV: no audio');
			}
		}

		if (pcv.hasOwnProperty('jsCursorData')) {
			$('.recordedSeesions li[index]').each(function (e) {
				$(this).data('cursorEvents', pcv.jsCursorData[e])
			});
		}

		if (pcv.hasOwnProperty('pcvModules')) {
			for (var i in pcv.pcvModules) {
				var module = pcv.pcvModules[i];

				var $li = $('<li>');

				$li
					.addClass('pcvModule')
					.data('pcvModule', module)
					.prepend('<h2>Quiz module</h2>')
					.append($('#sessionTPL .actions').clone(true))
					.append($('#sessionTPL .player').clone(true))
					.find('.rename').remove()


				if (module.index == -1) {
					$li.prependTo('.recordedSeesions ul');
				}
				else {
					$li.insertAfter($('.recordedSeesions li[index="' + module.index + '"]'));
				}
			}
		}

		if (pcv.segments.length) {
			$('.playbackPane .ion-play').removeClass('disabled');
		}
		else {
			$('.playbackPane .ion-play').addClass('disabled');
		}

		// Main player

		$('.recordedSeesions .session .player').remove();

		if (pcv.segments.length > 0) {
			$('.recordedSeesions .session').append($('#sessionTPL').find('.player').clone());

			$mainplayer = $('.recordedSeesions .session').find('.player');
			$mainplayer.addClass('no-border');

			var sessionDuration = 0;
			$('.recordedSeesions li[index]').each(function () {
				var events = $(this).data('pcv').json.whiteboardEvents;
				var time = events[events.length - 1].time;
				sessionDuration += time;
			});

			$mainplayer.find('.time i').text(formatTime(sessionDuration));
		}

	};


	function updateMainPlayer() {
		$mainplayer = $('.recordedSeesions .session .player');
		$mainplayer.remove();

		$mainplayer = $('#sessionTPL').find('.player').clone();

		$mainplayer
			.addClass('no-border')
			.appendTo($('.recordedSeesions .session'))

		var sessionDuration = 0;
		$('.recordedSeesions li[index]').each(function () {
			if (!$(this).hasClass("pcvModule")) {
				var events = $(this).data('pcv').json.whiteboardEvents;
				var time = events[events.length - 1].time;
				sessionDuration += time;
			};
		});

		if ($('.recordedSeesions li').length) {
			$('.playbackPane .ion-play').removeClass('disabled');
		}
		else {
			$('.playbackPane .ion-play').addClass('disabled');
		}

		$mainplayer.find('.time i').text(formatTime(sessionDuration));
	};

	function setProjectName(name) {
		$('.recordedSeesions .session h2').text(name);
	};

	function getProjectName() {
		return (doubtPcv || pcvToken || {}).title || $('.recordedSeesions .session h2').text();
	};

	function promptFileName(name) {
		var $h2 = $('.recordedSeesions .session h2');
		rename($h2.text().trim(), function (newName) {
			$h2.text(newName);
			savePCV();
		});
	};

	function runTimer() {
		var startTime = new Date();
		$('.playbackPane .timer').show();
		$('.playbackPane .timer').text(formatTime(0));

		window.counter = setInterval(function () {
			var elapsedTime = new Date() - startTime;
			$('.playbackPane .timer').text(formatTime(elapsedTime));
		}, 1000);
	};

	function stopTimer() {
		clearInterval(window.counter);
		$('.playbackPane .timer').hide();
	};

	function formatTime(milliseconds) {
		var number = milliseconds / 1000;

		var minutes = parseInt(number / 60) % 60;
		var seconds = parseInt(number % 60);

		return (minutes < 10 ? "0" + minutes : minutes) + ":" +
			(seconds < 10 ? "0" + seconds : seconds);
	};



	// scaleWhiteboard();
	// $(window).resize(scaleWhiteboard);

	function scaleWhiteboard() {
		var padding = 0;
		// if ($('.content').width() - padding < $('.board').width()) {
		var scaleX = ($('.content').width() - padding) / $('.board').width();
		var scaleY = ($('.content').height() - padding) / $('.board').height();
		var scale = scaleX < scaleY ? scaleX : scaleY;

		var transform = 'scale(' + scale + ',' + scale + ') translate(-50%,-50%)';

		$('.board').css({
			'webkitTransform': transform,
			'MozTransform': transform,
			'transform': transform
		});
		// };			
	};


	// if (!$('#main').hasClass('standalone')) {
	// 	window.onresize = resizeCanvas;
	// 	resizeCanvas();
	// };

	function resizeCanvas() {
		var ratio = Math.max(window.devicePixelRatio || 1, 1);
		penCanvas.width = canvasSize.width * ratio;
		penCanvas.height = canvasSize.height * ratio;
		penCanvas.getContext("2d").scale(ratio, ratio);
	};



	function showDeleteWarning(callback, text) {
		if (confirm(text || "This action cannot be undone, do you want to continue?")) {
			callback();
		}
	};


	function sortByDate(array) {
		array.sort(function (a, b) {
			return new Date(b.updateTime) - new Date(a.updateTime);
		});
		return array;
	};


	function resetMediaLibrary() {
		$('.mediaLibrary li:gt(0)').remove();
	};


	function serialiseMediaLib() {
		var array = [];
		$('.mediaLibrary li').each(function () {
			array.push($(this).data('config'));
		});
		return array;
	};


	function serrialiseToolbarSetup() {
		return {
			tool: $('.toolBar .tool.active').attr('id'),
			penSize: $('.penSize .active').attr('class').split(' ')[1],
			penColor: colorPalette[$('.colorsList .active').data('name')].id
		}
	};


	function serrialiseWhiteboardSetup() {
		var array = [];
		$('.whiteboards canvas').each(function (e) {
			var whiteboardImage, $this = $(this);
			var backgroundMedia = $this.data('backgroundMedia');

			if ($this.hasClass('blank')) {
				whiteboardImage = 'none';
			}
			else if ($this.hasClass('modified')) {
				whiteboardImage = {
					id: addImageToResources($this.get(0).toDataURL())
				}
				$this
					.data('whiteboardImage', whiteboardImage)
					.removeClass('modified');
			}
			else {
				whiteboardImage = $this.data('whiteboardImage');
			}

			var isCurrent = $this.is(':visible');

			var config = {
				isCurrent: isCurrent,
				backgroundMedia: backgroundMedia,
				whiteboardImage: whiteboardImage
			}
			array.push(config);
			clearHistory($this);
		});
		return array;
	};


	function showNotification(text) {
		$('.notification')
			.text(text)
			.animate({ top: '0px' }, 500, function () {
				$(this).delay(1500).animate({ top: '-50px' }, 500)
			});
	};


	function getJsCursorEvents() {
		return $('.board').data('jsCursorContext').events;
	};


	function buildPCV() {
		var libJSON = serialiseMediaLib();
		var toolbarJSON = serrialiseToolbarSetup();
		var whiteboardJSON = serrialiseWhiteboardSetup();

		var session = {
			setup: {
				toolbarSetup: toolbarJSON,
				whiteboardSetup: whiteboardJSON
			},
			segments: [],
			mediaLibrary: libJSON,
			updateTime: new Date(),
			pcvVersion: appVersion,
			jsCursorData: [],
			resources: resources,
			projectName: getProjectName(),
			canvasSize: canvasSize
		};

		var index = -1;
		$('.recordedSeesions li').each(function (e) {
			if ($(this).hasClass('pcvModule')) {
				if (!session.pcvModules) {
					session.pcvModules = [];
				}
				var pcvModule = $(this).data('pcvModule');
				pcvModule.index = index;
				session.pcvModules.push($(this).data('pcvModule'))
			}
			else {
				index++;
				session.segments.push($(this).data('pcv'));
				session.jsCursorData.push($(this).data('cursorEvents'))

				var title = $(this).find('h2').text().trim();
				$(this).data('pcv')['json']['whiteboardEvents'][0]['title'] = title;
				$(this).data('pcv')['json'].show = $(this).data('pcv')['json'].show || false;
			}
		});

		return verifySession(session);
	};


	function buildPCVbyIndex(index) {
		var libJSON = serialiseMediaLib();
		var toolbarJSON = serrialiseToolbarSetup();
		var whiteboardJSON = serrialiseWhiteboardSetup();

		var session = {
			setup: {
				toolbarSetup: toolbarJSON,
				whiteboardSetup: whiteboardJSON
			},
			segments: [],
			mediaLibrary: libJSON,
			updateTime: new Date(),
			pcvVersion: appVersion,
			jsCursorData: [],
			resources: resources,
			projectName: getProjectName(),
			canvasSize: canvasSize
		};

		session.segments.push($('.recordedSeesions li[index="' + index + '"]').data('pcv'));
		session.jsCursorData.push($('.recordedSeesions li[index="' + index + '"]').data('cursorEvents'));

		return verifySession(session);
	};


	function buildPCVForQuizModule(pcvModule) {
		pcvModule.index = -1;
		var session = {
			updateTime: new Date(),
			pcvVersion: appVersion,
			jsCursorData: [],
			pcvModules: [pcvModule],
			resources: resources,
			projectName: getProjectName()
		};

		session.segments = [{
			json: {
				toolbarSetup: {
					tool: "penTool",
					penSize: "LS_1",
					penColor: "LC_fff200"
				},
				whiteboardSetup: [{
					isCurrent: true,
					backgroundMedia: {
						type: "none"
					},
					whiteboardImage: "none"
				}],
				whiteboardEvents: [{
					action: {
						selector: 'recordingStarted'
					}, time: 0
				}, {
					action: {
						selector: 'recordingComplete'
					}, time: 10
				}]
			}
		}];

		return session;
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
			var events = segments[i].json.whiteboardEvents;
			var time = events[events.length - 1].time;
			sessionDuration += time;
		};

		return sessionDuration;
	};

	function verifySession(session) {
		for (var i in session.segments) {
			var whiteboardEvents = session.segments[i].json.whiteboardEvents;

			if (whiteboardEvents[0].action.selector !== 'recordingStarted') {
				whiteboardEvents.unshift({
					time: 0,
					action: {
						selector: 'recordingStarted'
					}
				});
			}

			while (whiteboardEvents[whiteboardEvents.length - 1].action.selector !== 'recordingComplete') {
				whiteboardEvents.pop();
			}
		}
		return session;
	};


	function savePCV(pcv = null) {
		if (!pcv) {
			pcv = buildPCV();
			if (pcvToken) {
				pcv.pcvToken = pcvToken;
			}
		};

		dbUtils.dropDB(function () {
			dbUtils.setFile(pcv, function () {
				showNotification('Project saved');
			});
		});
	};


	function openPlayer(data) {

		window.pcv = data;
		window.open("player.html");

		// iframeData.data = JSON.parse(JSON.stringify(data));
		// // iframeData.data = data;

		//      	$.fancybox.open({
		//      		type: 'iframe',
		// 	href:'player.html',
		// 	width: canvasSize.width,
		// 	height: canvasSize.height,
		// 	padding: 0,
		// 	autoSize: false,
		//     helpers : {
		//         overlay : {
		//             css : {
		//                 'background' : 'rgba(255, 255, 255, 0.95)'
		//             }
		//         }
		//     }
		//  		});								
	};

	window.connectIFrameAPI = function (api) {
		api.loadPCV(iframeData.data);
	};



	$("#sortable").sortable({
		handle: ".drag"
	});


	resetWhiteboard();

	$(document).keydown(function (e) {
		if (e.ctrlKey && e.shiftKey) {
			switch (e.keyCode) {
				case 49: //ctrl+shift+1
					setColor('red');
					break;
				case 50: //ctrl+shift+2
					setColor('green');
					break;
				case 51: //ctrl+shift+3
					setColor('blue');
					break;
				case 52: //ctrl+shift+4
					setColor('yellow');
					break;
				case 53: //ctrl+shift+5
					setColor('white');
					break;
				case 82: //ctrl+shift+R
					prepareToRecordOnKeyDown();
					break;
				case 83: //ctrl+shift+S
					stopRecordingOnKeyDown();
				case 77: //ctrl+shift+M
					toggleUI();
					break;
				case 79: //ctrl+shift+O						
					showQuizOptions();
					break;
				default:
					break;
			}
		}
	});






	var quiz_ctx = {};
	var quizModule = {};


	$('.toolBar .quiz').click(function () {
		if ($(this).is('.disabled')) {
			return;
		};
		openFancybox();
	});


	$('.quizRecordForm .ion-record').click(function () {
		if ($(this).parents('li').is('.disabled')) {
			return;
		};
		recorder = {
			mode: 'quiz',
			section: $(this).data('section')
		}
		$.fancybox.close();

		requestMicAccess(function () {
			prepareToRecord();
		});
	});


	function openFancybox() {
		$.fancybox.open({
			content: loadQuizForm()
		});
	};


	function loadQuizForm() {
		var $form = $('.quizRecordForm').clone('true');

		$form.find('.settings').click(function () {
			loadQuizImageForm();
		});

		if (quizModule.hasOwnProperty('imageConfig') && quizModule.imageConfig.hasOwnProperty('answer')) {
			$form
				.find('.quizID')
				.addClass("done");
		}
		else {
			$form
				.find('.quizID')
				.removeClass("disabled");
			return $form;
		}

		if (quiz_ctx.hasOwnProperty('intro')) {
			$form
				.find('.intro')
				.addClass("done")
				.removeClass("disabled");
		}
		else {
			$form
				.find('.intro')
				.removeClass("disabled");
			return $form;
		}

		if (quiz_ctx.hasOwnProperty('correct')) {
			$form
				.find('.correct')
				.addClass("done")
				.removeClass("disabled");

			resetWhiteboard();
			setupWhiteboardSession(quiz_ctx.correct.segments.json.whiteboardSetup);
		}
		else {
			$form
				.find('.correct')
				.removeClass("disabled");
			return $form;
		}

		if (quiz_ctx.hasOwnProperty('incorrect')) {
			$form
				.find('.incorrect')
				.addClass("done")
				.removeClass("disabled");
		}
		else {
			$form
				.find('.incorrect')
				.removeClass("disabled");
			return $form;
		}

		$form
			.find(".button.disabled")
			.removeClass("disabled")
			.click(function () {
				addQuizModule();
			});

		return $form;
	};


	function loadQuizImageForm() {
		var $form = $('.quizImageForm').clone('true');

		quizModule.imageConfig = quizModule.imageConfig || {
			marker: 'ABC',
			quantity: '2'
		};

		//  	if ($mainCanvas.data('backgroundMedia').type !== 'none' && !quizModule.imageConfig.bgImage) {
		//  		quizModule.imageConfig.bgImage = $mainCanvas.data('backgroundMedia');
		//  	};

		//  	if (quizModule.imageConfig.bgImage) {
		// var $imgPreview = $('<img>');

		// $imgPreview
		// 	.appendTo($form.find('.preview span i'))
		// 	.attr('src', getImageSource(quizModule.imageConfig.bgImage.src))
		// 	.css('width', quizModule.imageConfig.bgImage.scale + '%')
		// 	.parent()
		// 	.removeAttr('class')
		// 	.addClass(quizModule.imageConfig.bgImage.align)


		// $form.find('.preview span').css({
		// 	background: quizModule.imageConfig.bgImage.bgColor
		// });	    		
		//  	};

		//  	var $mediaLibrary = $('.mediaLibrary').clone('true');
		var imageConfig = Object.assign({}, quizModule.imageConfig);

		//  	$mediaLibrary
		//  		.off('click')
		//  		.insertAfter($form.find('.leftPane'))
		// .find('li').click(function() {
		//   		var config = Object.assign({}, $(this).data('config'));
		//   		if (config.type === 'none') {
		//   			delete imageConfig.bgImage;
		//   			$form.find('.preview span i').empty();
		// 		saveBackgroundMediaConfig({
		// 			type: 'none'
		// 		});				
		//       		clearBackgroundMedia();		    			
		//   		}
		//   		else {
		// 		configureSlideBgImage(config, function(bgImage) {
		// 			quizModule.imageConfig.bgImage = bgImage;
		// 			saveBackgroundMediaConfig(bgImage);					   	
		// 			setBackgroundMedia(bgImage);										
		//             loadQuizImageForm();
		// 		});        				    			
		//   		}
		//   	});

		$form.find('.options').on('change', 'input', function () {
			var name = $(this).attr('name');
			var value = $(this).attr('value');

			imageConfig[name] = value;

			if (name === 'marker' && value === 'BOOL') {
				$('.options input[name="quantity"][value="2"]').prop('checked', true);
				$('.options input[name="quantity"]').prop('disabled', true);
				imageConfig['quantity'] = 2;
			}
			else if (name === 'marker') {
				$('.options input[name="quantity"]').prop('disabled', false);
			}

			if (name !== 'answer') {
				delete imageConfig['answer'];
				quizModule.generateOptions(imageConfig, $form);
			}
			else {
				$('.answer')
					.find('label:eq(' + value + ')')
					.addClass('active')
					.siblings()
					.removeClass('active')
			}
			quizModule.validateImageForm(imageConfig, $form);
		});

		$form.find('.submit button').click(function () {
			if (!$(this).hasClass('disabled')) {
				quizModule.imageConfig = imageConfig;
				quizModule.showQuizImage(imageConfig);
				quiz_ctx.setupImage = false;
				openFancybox();
			};
		});

		quizModule.validateImageForm(quizModule.imageConfig, $form);
		quizModule.generateOptions(quizModule.imageConfig, $form);

		if (quizModule.imageConfig.marker) {
			$form.find('.marker input[value=' + quizModule.imageConfig.marker + ']').prop('checked', true);
			if (quizModule.imageConfig.marker === 'BOOL') {
				$('.options input[name="quantity"]').prop('disabled', true);
			}
		};
		if (quizModule.imageConfig.quantity) {
			$form.find('.quantity [value=' + quizModule.imageConfig.quantity + ']').prop('checked', true);
		};
		if (quizModule.imageConfig.image) {
			$form.find('.preview').css({
				backgroundImage: 'url(' + quizModule.imageConfig.image + ')'
			});
		};

		$.fancybox.open({
			content: $form
		});
	};

	function addQuizModule() {
		var module = {
			type: 'quiz',
			moduleData: quizModule.imageConfig,
			pcvData: {
				intro: quiz_ctx.intro,
				correct: quiz_ctx.correct,
				incorrect: quiz_ctx.incorrect
			}
		}
		delete module.moduleData.bgImage;

		$('<li>')
			.addClass('pcvModule')
			.data('pcvModule', module)
			.prepend('<h2>Quiz module</h2>')
			.append($('#sessionTPL .actions').clone(true))
			.append($('#sessionTPL .player').clone(true))
			.appendTo('.recordedSeesions ul');

		quiz_ctx = {};
		delete quizModule.imageConfig;

		$.fancybox.close();
		savePCV();
	};


	quizModule.validateImageForm = function (imageConfig, $form) {
		var $submit = $form.find('.submit button');
		if (imageConfig.answer) {
			$submit.removeClass('disabled');
		}
		else if (!$submit.hasClass('disabled')) {
			$submit.addClass('disabled')
		}
	};


	quizModule.generateOptions = function (imageConfig, $form) {
		var ABC = ['A', 'B', 'C', 'D', 'E'];

		var $options = $form.find('.answer');
		$options.empty();

		for (var i = 0; i < imageConfig.quantity; i++) {
			var $text = $('<i>');
			var $label = $('<label>')
			var $input = $('<input>')

			if (imageConfig.marker === 'ABC') {
				$text.text(ABC[i]);
			}
			else if (imageConfig.marker === 'BOOL') {
				$text.text(['TRUE', 'FALSE'][i]);
			}
			else {
				$text.text(i + 1);
			}

			$input
				.prop('type', 'radio')
				.prop('name', 'answer')
				.prop('value', i)

			$label
				.prepend($text)
				.prepend($input)
				.appendTo($options)
		}

		if (imageConfig.hasOwnProperty('answer')) {
			$form.find('.answer label:eq(' + imageConfig.answer + ')').addClass('active');
		};
	};


	quizModule.showQuizImage = function (imageConfig) {
		if (imageConfig.bgImage) {
			saveBackgroundMediaConfig(imageConfig.bgImage);
			setBackgroundMedia(imageConfig.bgImage);
		}
	};


	function guid() {
		function s4() {
			return Math.floor((1 + Math.random()) * 0x10000)
				.toString(16)
				.substring(1);
		}
		return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
			s4() + '-' + s4() + s4() + s4();
	};

	function pointDistance(p1, p2) {
		return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
	};

	function showUploadSettings() {
		var $tpl = $($('#AWSupload').html());

		var $pcvType = $tpl.find('input[name="pcvType"]');
		var $pcvCode = $tpl.find('input[name="pcvCode"]');
		var $pcvTitle = $tpl.find('input[name="pcvTitle"]');
		var $emailCheckbox = $tpl.find('input[name="adminMail"]');

		$pcvType.val(pcvToken.type || '');
		$pcvCode.val(pcvToken.topicCode || pcvToken.moduleCode || '');
		$pcvTitle.val(pcvToken.title || '');

		$pcvType.prop('disabled', pcvToken && pcvToken.type);
		$pcvTitle.prop('disabled', pcvToken && pcvToken.title);
		$pcvCode.prop('disabled', pcvToken && (pcvToken.topicCode || pcvToken.moduleCode));

		$pcvCode.prev('span').text(pcvToken.topicCode ? 'Topic Code' : 'Module Code');

		validateSettingsForm($tpl);
		$tpl.find('input[type="text"]').change(function () {
			validateSettingsForm($tpl);
		});

		$tpl.find('button').click(function () {
			pcvToken.sendMail = $emailCheckbox.is(':checked');
			$.fancybox.close();
			uploadFile(pcvToken);
		});

		$.fancybox.open({
			content: $tpl,
			padding: 30
		});
	}


	function showLogin(callback, username = false) {
		var $tpl = $($('#login').html());

		var $u = $tpl.find('input[name="username"]');
		var $p = $tpl.find('input[name="password"]');

		if (username) {
			$u
				.val(username)
				.prop('disabled', true);
		};

		$tpl.find('button').click(function () {
			$.fancybox.showLoading();

			let token = encodeURIComponent(btoa(JSON.stringify({
				u: $u.val(),
				p: $p.val(),
				t: Date.now()
			})));

			let cms = $tpl.find('select[name="cmsdb"]').val();
			let uri = cms == 'NEW' ? '/teacher/' : '/o_teacher/';
			// let uri = 'https://pcv.lernity.com/o_teacher/';
			// let uri = 'http://localhost:8081/teacher/';

			http.get(uri + token).then(data => {
				$.fancybox.close();

				ProfileManager.saveProfile(data, function () {
					teacherProfile = data;
					cmsdb = cms;
					updateUserPane();
				});

				if (callback) {
					callback();
				}
			}, (err) => {
				showAlert('Failed to login, check your username and password', 'Try again', function () {
					showLogin();
				});
			});
		});

		var options = {
			content: $tpl,
			padding: 30,
			beforeClose: function () {
				$.fancybox.hideLoading();
			}
		}

		if (username) {
			options.modal = true;
			options.showClose = false;
		};

		$.fancybox.open(options);
	}


	function updateUserPane() {
		if (teacherProfile) {
			$('.userPane').addClass('authorized');
			$('.userPane .username').text(teacherProfile.id.split(':')[0]);
		} else {
			$('.userPane').removeClass('authorized');
		}
	}


	function showStorageSelection(string) {

		var $tpl = $($('#storage').html());

		var $diskImport = $tpl.find('.disk.import');
		var $diskExport = $tpl.find('.disk.export');

		var $cloudUpload = $tpl.find('.cloud.upload');
		var $cloudDownload = $tpl.find('.cloud.download');

		if (string === 'import') {
			[$cloudUpload, $diskExport].forEach(function ($item) {
				$item.css('display', 'none');
			});
		} else if (string === 'export') {
			[$cloudDownload, $diskImport].forEach(function ($item) {
				$item.css('display', 'none');
			});
		}

		$cloudDownload.click(function () {
			if (teacherProfile) {
				showCloudProjects();
			} else {
				showLogin(showCloudProjects);
			};
		});

		$cloudUpload.click(function () {
			if (doubtPcv) {
				return showDoubtPcvUpload();
			}
			if (!pcvToken || !pcvToken.toAddress) {
				return showAlert('Operation failed. You are not assigned to this project.', 'OK')
			}
			if (teacherProfile) {
				showUploadSettings();
			} else {
				showLogin(showUploadSettings);
			};
		});

		$diskImport.click(function () {
			$('#file').click();
			$.fancybox.close();
		});

		$diskExport.click(function () {
			var pcv = buildPCV();
			zipPcv(pcv, function(pcvZip) {
				var output = new Blob([pcvZip], {
					type: "application/gzip"
				})
				var fileUrl = window.URL.createObjectURL(output),
				fileName = pcv.projectName.toLowerCase().replace(/\s+/g, '_') + '.pcv.gz'

				downloadFile(fileUrl, fileName);
				$.fancybox.close();
			});
		});

		$.fancybox.open({
			content: $tpl,
			padding: 30
		});

	}


	function downloadFile(fileUrl, fileName) {
		$('<a>')
			.appendTo('body')
			.prop('href', fileUrl)
			.prop('download', fileName)
			.get(0).click()
	};

	function showCloudProjects() {

		var $tpl = $($('#cloudProjects').html());

		var $ul = $tpl.find('ul');
		var $h2 = $tpl.find('h2');

		var sorted = Object.keys(teacherProfile.projects).sort(function (a, b) {
			return new Date(teacherProfile.projects[b].update_time) - new Date(teacherProfile.projects[a].update_time)
		});

		sorted.forEach(function (key) {
			var item = teacherProfile.projects[key];

			var $li = $('<li>');
			var $div = $('<div>');

			$li.appendTo($ul);

			$('<u>')
				.addClass('progress')
				.appendTo($li)

			$div
				.appendTo($li)
				.css({
					cursor: 'pointer'
				})
				.click(function () {
					resetTool(function () {
						pcvToken = item;
						if (!item.url) {
							setProjectName(item.title);
							savePCV();
							$.fancybox.close();
						}
						else {
							$.fancybox.showLoading();
							http.get(item.url, {
								onprogress: function (event) {
									if (item.compressedSize && item.uncompressedSize) {
										var width = 0;
										if (event.lengthComputable) {
											width = 100 * event.loaded / item.compressedSize
										} else {
											width = 100 * event.loaded / item.uncompressedSize
										}
										$li.find('u').css({
											width: Math.min(100, width) + '%'
										});
									}
								}
							}).then(data => {
								data.pcvToken = pcvToken;
								setTimeout(function () {
									$.fancybox.hideLoading();
									$.fancybox.close();
									readPCV(data);
									savePCV(data);
								}, 500);
							}, (err) => {
								showAlert('Failed to load pcv');
							});
						}
					});
				});

			$('<span>')
				.appendTo($div)
				.text(item.title)

			$('<span>')
				.appendTo($div)
				.text(item.type)

			$('<span>')
				.appendTo($div)
				.text(item.topicCode || item.moduleCode.substring(0, 7))

			$('<span>')
				.appendTo($div)
				.text(formatDate(item.update_time) || '')

			$('<span>')
				.appendTo($div)
				.text((item.compressedSize ? (item.compressedSize / 1024 / 1024).toFixed(2) + ' MB' : false) || '')

		});

		$.fancybox.open({
			content: $tpl,
			padding: 30
		});
	}


	function showDoubtPcvUpload() {

		var $div = $('<div>');
		var $text = $('<div>');
		var $input = $('<input>')
		var $button = $('<button>');

		$div
			.addClass('AWSuploadConfirm')

		$text
			.appendTo($div)
			.addClass('text')
			.text('You are ready to upload doubt pcv');

		$input
			.css({

			})
			.attr('type', 'text')
			.val(doubtPcv.title)
			.appendTo($div)
			.wrap('<div>')

		$button
			.text('Upload')
			.appendTo($div)
			.addClass('button')
			.click(function () {
				uploadFile({
					doubt: true,
					dbtid: doubtPcv.dbtid,
					title: $input.val()
				})
			});

		$.fancybox.open({
			content: $div,
			padding: 30
		});

	}


	function showAlert(text, buttonText, action) {
		var $tpl = $($('#alert').html());

		var $text = $tpl.find('.text');
		var $button = $tpl.find('button');

		$text.text(text);

		$button
			.text(buttonText || $button.text())
			.click(function () {
				$.fancybox.close();
				if (action) {
					setTimeout(action, 100);
				}
			});

		$.fancybox.open({
			content: $tpl,
			padding: 30
		});
	}


	function showDialog(text, buttons, modal = true) {
		var $tpl = $('<div>');
		var $text = $('<div>');

		$tpl
			.addClass('alert')

		$text
			.text(text)
			.addClass('text')
			.appendTo($tpl)

		buttons.forEach(function (item) {
			$('<button>')
				.text(item.text)
				.addClass('button')
				.appendTo($tpl)
				.click(function () {
					$.fancybox.close();
					if (item.handler) {
						setTimeout(item.handler, 100);
					};
				})
		});

		$.fancybox.open({
			content: $tpl,
			padding: 30,
			modal: modal,
			showClose: !modal
		});
	};


	function validateSettingsForm($form) {
		var valid = true;
		$form.find('input[type="text"]').each(function () {
			if (!$(this).val()) {
				valid = false;
			}
		});
		$form.find('button').prop('disabled', !valid);
	};


	function uploadFile(pcvToken) {

		var $div = $('<div>');
		var $text = $('<div>');
		var $input = $('<input>')
		var $button = $('<button>');

		$div
			.addClass('AWSupload')

		$text
			.appendTo($div)
			.addClass('text')
			.text('Fetching credentials...');

		$input
			.css({
				display: 'none'
			})
			.attr('type', 'text')
			.prop('readonly', true)
			.appendTo($div)
			.wrap('<div>')

		$button
			.text('OK')
			.appendTo($div)
			.addClass('button')
			.click(function () {
				$.fancybox.close();
			});

		$.fancybox.open({
			content: $div,
			padding: 30
		});

		var pcv = buildPCV();

		var name = pcvToken.title.toLowerCase().replace(/\s+/g, '-') + '.pcv';

		zipPcv(pcv, function(pcvZip) {
			var file = new Blob([pcvZip], {
				type: "application/gzip"
			});

			var awsUrl = 'https://lpcv.s3.amazonaws.com';
			var policyUrl = cmsdb == 'NEW' ? '/s3policy/' : '/o_s3policy/';
			// var policyUrl = 'http://cms1.lernity.com:8082/s3policy/';
			// var policyUrl = 'http://localhost:8081/s3policy/';
	
			if (pcvToken.moduleCode) {
				name = pcvToken.moduleCode.substring(1, 3) + '/' +
					pcvToken.moduleCode.substring(0, 1) + '/' +
					pcvToken.moduleCode.substring(0, 7) + '/' +
					pcvToken.moduleCode + '-' + name;
			} else if (pcvToken.topicCode) {
				name = pcvToken.topicCode.substring(1, 3) + '/' +
					pcvToken.topicCode.substring(0, 1) + '/' +
					pcvToken.topicCode.substring(0, 7) + '/' +
					pcvToken.topicCode + '-' + name;
			};
	
			if (pcvToken.doubt) {
				name = 'doubts/doubts/' + name.replace('.pcv', '-' + pcvToken.dbtid.substring(0, 8) + '.pcv');
			};
	
			pcvToken.url = awsUrl + '/' + name;
			pcvToken.uncompressedSize = JSON.stringify(pcv).length;
			pcvToken.compressedSize = file.size
	
			var metadata = {
				fileSize: {
					compressed: file.size,
					uncompressed: pcvToken.uncompressedSize
				},
				fileName: name,
				pcvTitle: pcvToken.title,
				pcvDuration: getFullDuration(pcv)
			}
	
			$input.val(pcvToken.url);
	
			getS3policy(name, policyUrl + 'pcv/').then((s3policy) => {
				uploadToAws(createFormData(s3policy, file, metadata), awsUrl, (event) => {
					$text.text('Uploading... ' + (100 * event.loaded / event.total).toFixed(2) + '%');
					pcvToken.compressedSize = event.total;
				}).then(() => {
					$text.text('File has been successfully uploaded');
					$button.css('display', 'inline-block');
					$input.css('display', 'inline');
	
					if (pcvToken.doubt && window.opener) {
						let data = {
							task: 'saveDoubt',
							dbtid: pcvToken.dbtid,
							pcvUrl: pcvToken.url,
							pcvTitle: pcvToken.title,
						};
						window.opener.postMessage(data, '*');
						setTimeout(() => {
							window.close();
						});
					}
					else {
						sendAdminEmail();
					}
				}, (err) => {
					$text.text('Failed to upload the file: ' + err);
					$button.css('display', 'inline-block');
				});
			}, (err) => {
				console.log('Failed to load s3policy:', err);
			});				
		});
	};

	function createFormData(s3policy, file, metadata) {
		var formData = new FormData();
		formData.append('acl', s3policy.xAmzAcl);
		formData.append('X-Amz-Date', s3policy.xAmzDate);
		formData.append('x-amz-server-side-encryption', s3policy.xAmzServerSideEncryption);
		formData.append('X-Amz-Algorithm', s3policy.xAmzAlgorithm);
		formData.append('X-Amz-Credential', s3policy.xAmzCredential);
		formData.append('X-Amz-Signature', s3policy.s3Signature);
		formData.append('x-amz-meta-compressed-length', metadata.fileSize.compressed);
		formData.append('x-amz-meta-uncompressed-length', metadata.fileSize.uncompressed);
		formData.append('x-amz-meta-pcv-duration', metadata.pcvDuration);
		formData.append('x-amz-meta-pcv-title', metadata.pcvTitle);
		formData.append('Policy', s3policy.base64Policy);
		formData.append('Content-Type', 'application/json');
		formData.append('Content-Encoding', 'gzip');
		formData.append('key', metadata.fileName);
		formData.append('file', file);

		return formData;
	};

	function getS3policy(name, url) {
		return http.get(url + encodeURIComponent(name));
	};

	function uploadToAws(data, awsUrl, onprogress) {
		return new Promise((resolve, reject) => {
			http.post(awsUrl, data, {
				onprogress: onprogress
			}).then(() => {
				resolve()
			}, (err) => {
				reject(err);
			});
		});
	};

	function sendAdminEmail() {
		let uri = cmsdb == 'NEW' ? '/pcvSubmit' : '/o_pcvSubmit';
		// let uri = 'http://cms1.lernity.com:8082/pcvSubmit';
		http.post(uri, JSON.stringify(pcvToken), {
			headers: {
				"Content-Type": "application/json;charset=UTF-8"
			}
		}).then(() => {
			console.log('Admin email sent');
		}, (err) => {
			console.log('Failed to send admin email: ', err);
		});
	};


	function hasValidPcvToken() {
		if (window.location.hash) {
			var token = window.location.hash.replace('#', '');
			var decoded = JSON.parse(atob(decodeURIComponent(token)));
			return decoded && decoded.type ? decoded : null;
		}
	}


	$('.disableOnRec').click(function (e) {
		// if ($(this).is('.disabled')) {
		// 	e.preventDefault();
		// }
	})


	window.addEventListener('audioRecAlert', function (e) {
		stopRecording();
		showRecordingAudioWarning();
	}, false);

	function showRecordingAudioWarning() {
		showAudioWarning({
			title: 'ERROR',
			subtitle: 'Audio is not detected, recording stopped',
			hints: [
				"Check if microphone is OK by recording a test PCV"
			]
		})
	}

	function showSegmentAudioWarning() {
		showAudioWarning({
			title: 'ERROR',
			subtitle: 'Audio might be out of sync in the recent segment',
			hints: [
				"Play the recent segment and verify audio is in sync with the content on screen"
			]
		})
	}

	function showAudioWarning(message) {

		var $tpl = $('<div>');
		$tpl.addClass('audioProblemWarning');

		$('<h1>')
			.text(message.title)
			.appendTo($tpl);

		$('<h2>')
			.text(message.subtitle)
			.appendTo($tpl);

		var $ul = $('<ul>');
		$ul.appendTo($tpl);

		message.hints.forEach((hint, index) => {
			$('<li>')
				.text((index + 1) + '. ' + hint)
				.appendTo($ul);
		})

		$.fancybox.open({
			content: $tpl,
			padding: 30
		});
	}


	function showQsSeqOptions(config) {

		var $h3 = $('<h3>'),
			$qsLayer = $('<div>'),
			$qsContent = $('<div>');

		$qsLayer
			.addClass('qsLayer')
			.appendTo('body');

		$qsContent
			.addClass('qsContent')
			.appendTo($qsLayer);

		$h3
			.appendTo('.qsContent')
			.text('Choose the correct answer to record answer explanation');

		$('<i>')
			.appendTo($h3)
			.addClass('close')
			.click(function () {
				$qsLayer.remove();
			});

		$('<div>')
			.addClass('qsBackdrop')
			.prependTo($qsLayer);

		config.buttons.forEach(function (text, index, array) {
			$('<button>')
				.addClass('button')
				.appendTo($qsContent)
				.text(text)
				.click(function () {
					$(this).addClass('active');
					setTimeout(function () {
						$qsLayer.fadeOut(function () {
							$qsLayer.remove();
						});
						if ((config || {}).onClose) {
							config.onClose(config.buttons, text);
						}
					}, 1000);
				});
		});
	};	

}


function detectmob() {
	if (navigator.userAgent.match(/Android/i)
		|| navigator.userAgent.match(/webOS/i)
		|| navigator.userAgent.match(/iPhone/i)
		|| navigator.userAgent.match(/iPad/i)
		|| navigator.userAgent.match(/iPod/i)
		|| navigator.userAgent.match(/BlackBerry/i)
		|| navigator.userAgent.match(/Windows Phone/i)
	) {
		return true;
	}
	else {
		return false;
	}
}


function formatDate(timestamp) {
	var date = new Date(timestamp);
	return date.toLocaleString("en-US", {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric'
	})
}

