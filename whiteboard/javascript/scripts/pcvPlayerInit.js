"use strict";

// (function() {

// 	function createElementFromHTML(htmlString) {
// 	  var div = document.createElement('div');
// 	  div.innerHTML = htmlString.trim();
// 	  // return div.firstChild; 
// 	  return div;
// 	}

// 	function preloadComponent(name, callback) {
// 		http.loadHTML('./javascript/components/' + name + '/' + name + '.html').then(data => {
// 			let element = createElementFromHTML(data);
// 			element.id = name + 'Component';
// 			document.getElementById('main').appendChild(element);
// 			require('./javascript/components/' + name + '/' + name + '.js', callback);
// 		}, err => {
// 			console.error(err);
// 		});
// 	};

// 	preloadComponent('feedback');

// })();


var whiteboardSettings = {
	minWidth: 1,
	maxWidth: 1,
	penColor: '#fff200'
}

var pageDefaultSettings = {
	grid: {
		size: 16,
		show: true
	}
}

var canvasSize = {
	width: 904,
	height: 509
}

var boardColor = '#000000';

var toolbar = {
	size: {
		LS_1: 1,
		LS_2: 2,
		LS_3: 3
	},
	tool: {
		penTool: 'pen',
		lineTool: 'line',
		circleTool: 'circle',
		rectangleTool: 'rectangle'
	},
	color: {
		LC_ff0000: '#d64263',
		LC_0000ff: '#38a7d2',
		LC_00a651: '#00a651',
		LC_fff200: '#fff200',
		LC_ffffff: '#ffffff',
		LC_000000: '#000000'

	}
};

var resources;
var pcvTokenData;
var self = this;


$(document).ready(function () {

	var mousedown = false;

	var gridCanvas = document.getElementById("grid");

	setCanvasSize(canvasSize);


	var penCanvas = document.getElementById('penCanvas'),
		whiteboard = penCanvas && new Whiteboard('penCanvas', whiteboardSettings);

	if (!whiteboard) {
		whiteboard = new DrawingBoard.Board('drawingboard', {
			controls: false,
			background: false,
			webStorage: false,
			color: whiteboardSettings.penColor,
			size: whiteboardSettings.maxWidth * 1.5
		});
		penCanvas = $('.drawing-board-canvas').get(0);
	}

	whiteboard.off();


	var $mainCanvas = addWhiteboard();
	var mainCanvasCtx = $mainCanvas.get(0).getContext('2d');

	resetWhiteboard();


	function handleEvent(event, context, seekLoop) {

		if (event.action.sender === 'iframe') {
			iframeDelegate.handleEvent(event.action);
		}
		else {
			if (event.action.selector === 'selectTool') {
				selectTool(event.action.argument);
			}
			else if (event.action.selector === 'selectLineColor') {
				selectLineColor(event.action.argument);
			}
			else if (event.action.selector === 'selectLineWidth') {
				selectLineWidth(event.action.argument);
			}
			else if (event.action.selector === 'addNewWhiteboard') {
				addNewWhiteboard();
			}
			else if (event.action.selector === 'switchWhiteboard') {
				switchWhiteboard(event.action.argument);
			}
			else if (event.action.selector === 'setBackgroundMedia') {
				selectBackgroundMedia(event.action.argument, seekLoop);
			}
			else if (event.action.selector === 'selectBackgroundMedia') {
				selectBackgroundMedia(event.action.argument);
			}
			else if (event.action.selector === 'setBackgroundMediaParams') {
				setBackgroundMediaParams(event.action.argument);
			}
			else if (event.action.selector === 'handleGridChange') {
				handleGridChange(event.action.argument);
			}
			else if (event.action.selector === 'handleUndoRedo') {
				handleUndoRedo(event.action.argument);
				return true;
			}
			else if (event.action.selector === 'handleClear') {
				handleClear();
			}
			else if (event.action.selector === 'handleRemove') {
				handleRemove(event.action.argument);
			}
			else if (event.action.selector === 'handleMousedown') {
				handleMousedown(event.action.argument);
			}
			else if (event.action.selector === 'handleMousemove') {
				handleMousemove(event.action.argument);
			}
			else if (event.action.selector === 'handleMouseup') {
				handleMouseup(event.action.argument);
			}
			else if (event.action.selector === 'showQuizOptions') {
				showQuizOptions();
			}
			else if (event.action.selector === 'showQuestion') {
				if (!seekLoop) {
					PCV_api.pause()
					showQuestion(event.action.argument, context.questions);
				}

				// mergeDrawing();
				// cloneWhiteboard($('.whiteboards canvas:visible').index());					

				// return true;
			}
			else if (event.action.selector === 'recordingComplete') {
				if ($('.lerningMeter').length) {
					var $lerningMeter = $('.lerningMeter').clone();
					$lerningMeter
						.prependTo('.videoMenu');
				};
			}
		}
	};


	function setCanvasSize(size) {
		$(penCanvas).attr('width', size.width);
		$(penCanvas).attr('height', size.height);

		$(gridCanvas).attr('width', size.width);
		$(gridCanvas).attr('height', size.height);
	}


	function setBackgroundMediaParams(params) {
		var backgroundMedia = $mainCanvas.data('backgroundMedia');

		backgroundMedia.align = params.align;
		backgroundMedia.width = params.width;

		var $image = $('.backgroundMedia .image');
		var $img = $image.find('img');

		$image
			.attr('class', 'image')
			.addClass(backgroundMedia.align)

		$img
			.css({
				width: 'auto',
				height: 'auto'
			});

		if ($img.height() > $img.width()) {
			$img.css({
				height: backgroundMedia.width + '%'
			});
		}
		else {
			$img.css({
				width: backgroundMedia.width + '%'
			});
		}
	};


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

		if (!$mainCanvas.hasClass('changed')) {
			$mainCanvas.addClass('changed');
		};
	};


	function handleGridChange(flag) {

	};


	function handleClear() {
		$mainCanvas
			.data('whiteboardImage', 'none')
			.addClass('changed')

		clearCanvas($mainCanvas);
		clearCanvas($(penCanvas));
	};


	function handleRemove(index) {
		$('.whiteboards canvas').eq(index).remove();
		if ($('.whiteboards canvas').length > 0) {
			switchWhiteboard(0, true);
		}
		else {
			$('.board').hide();
		}
	};


	function handleUndoRedo(argument) {
		if (!whiteboard.isEmpty()) {
			whiteboard.clear();
		};
		renderImage(argument.imgData, $mainCanvas);
	};


	function showQuizOptions() {
		$('.optionsPane').addClass('visible');
	};

	function showQuestion(argument, questions) {
		$('.board')
			.addClass('inactive');

		var $qsLayer = $('<div>'),
			$qsContent = $('<div>');

		$qsLayer
			.addClass('qsLayer')
			.appendTo('.board');

		$qsContent
			.addClass('qsContent')
			.appendTo($qsLayer);

		argument.options.forEach(function (option, index) {
			var $button = $('<button>');

			$button
				.addClass('button')
				.appendTo('.qsContent')
				.text(option.txt)
				.click(function () {
					if (option.correct) {
						addSkipButton(argument.endTime);
					}

					setTimeout(function () {
						$qsLayer.fadeOut(function () {
							$qsLayer.remove();
						});
						$('.board')
							.removeClass('inactive');
						PCV_api.play();
					}, 3000);

					$button
						.addClass(option.correct ? 'correct' : 'wrong');

					setTimeout(function () {
						showQsAnsAnimation(argument);
					}, 500);
					argument.correct = option.correct;
					argument.attempt = (argument.attempt || 0) + 1;
				});

			setTimeout(function () {
				$button.addClass('shown');
			}, (index + 1) * 300);
		});
	}



	function showQsAnsAnimation(argument) {

		var $qsOverlay = $('<div>');

		$qsOverlay
			.addClass('qsOverlay')
			.appendTo('.qsLayer')

		setTimeout(function () {
			$qsOverlay
				.addClass('presented');
		}, 50);

		setTimeout(function () {
			if (argument.attempt == 1) {
				showLerningMeter(argument);
			}
			if (argument.correct) {
				return showTickAnimation();
			}
			showCrossAnimation();
		}, 150);
	}


	function showLerningMeter(argument) {

		var $lerningMeter = $('.lerningMeter').clone();

		$lerningMeter
			.prependTo('.qsOverlay');

		setTimeout(function () {
			$lerningMeter
				.addClass('shown');
			setTimeout(function () {
				argument.evaluteSelf();
			}, 700);
		}, 500);

	}




	function createLerningMeter(questions) {

		var $lerningMeter = $('<div>');

		$lerningMeter
			.addClass('lerningMeter')
			.prependTo('.board')

		$('<p>')
			.text('Number of questions: ' + questions.length)
			.appendTo($lerningMeter);

		questions.forEach(function (q) {
			var $span = $('<span>');

			$span
				.addClass('ans')
				.appendTo($lerningMeter)

			if (q.action.argument.hasOwnProperty('correct')) {
				$span.addClass(q.action.argument.correct ? 'correct' : 'wrong')
			}

			q.action.argument.evaluteSelf = function () {
				$('.lerningMeter').each(function () {
					var $span = $(this).find('.ans').eq(q.action.argument.index);
					if (!($span.hasClass('correct') || $span.hasClass('wrong'))) {
						$span.addClass(q.action.argument.correct ? 'correct' : 'wrong')
					}
				});
			}
		});

		var $clone = $lerningMeter.clone(true);
		$clone
			.appendTo('.poster');
	}




	function showCrossAnimation() {

		var $icon = $('<div>');
		$icon
			.addClass('qsIcon')
			.appendTo('.qsOverlay')

		var $tick = $('.SVGCross').clone();

		$tick
			.prependTo($icon)

		setTimeout(function () {
			$icon
				.addClass('shown1')
			setTimeout(function () {
				$icon
					.addClass('shown2')
			}, 500);
		}, 300);
	}


	function showTickAnimation() {

		var $icon = $('<div>');
		$icon
			.addClass('qsIcon')
			.appendTo('.qsOverlay')

		var $tick = $('.SVGTick').clone();

		$tick
			.prependTo($icon)

		setTimeout(function () {
			$icon
				.addClass('shown')
		}, 300);
	}


	function addSkipButton(endTime) {

		var $skip = $('<div>'),
			$timer = $('<span>');

		$skip
			.addClass('skipExp')
			.appendTo('.board');

		$timer
			.addClass('timer')
			.appendTo($skip)
			.text(PCV_api.getExplTime(endTime)['mm:ss'])
			.data('terminate', function () {
				clearInterval($timer.data('timer'));
				$skip.remove();
			})
			.data('timer', setInterval(function () {
				let remainTime = PCV_api.getExplTime(endTime);
				if (remainTime.ms <= 0) {
					return $timer.data('terminate')();
				}
				$timer.text(remainTime['mm:ss']);
			}, 1000));

		$('<button>')
			.text('Skip')
			.appendTo($skip)
			.addClass('button')
			.click(function () {
				$timer.data('terminate')();
				PCV_api.seekTime(endTime);
			});
	}



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

				$canvas
					.data('backgroundMedia', backgroundMedia)
					.data('whiteboardImage', whiteboardImage)

				renderImage(getImageSource(whiteboardImage), $canvas);
			}

			switchWhiteboard(currentIndex, true);
		};
	};


	function addNewWhiteboard() {
		if ($mainCanvas.hasClass('changed')) {
			$mainCanvas.removeClass('changed');
			mergeDrawing();
		};

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
	};


	function addWhiteboard() {
		$('.whiteboards canvas').hide();

		var canvas = createWhiteboard();
		canvas.appendTo($('.whiteboards'));

		return canvas;
	};


	function createWhiteboard() {
		var canvas = $('<canvas>')
			.attr('width', canvasSize.width)
			.attr('height', canvasSize.height)
			.data('options', {
				grid: {
					size: pageDefaultSettings.grid.size,
					show: pageDefaultSettings.grid.show
				}
			})
			.data('backgroundMedia', {
				type: 'none',
				bgColor: boardColor
			})

		return canvas;
	};


	function cloneWhiteboard(index) {
		var $whiteboardClone = cloneCanvas($('.whiteboards canvas').eq(index));

		$whiteboardClone
			.insertAfter($('.whiteboards canvas').eq(index));

		switchWhiteboard(index + 1);
	};


	function switchWhiteboard(index, ignoreMerge) {
		if (!ignoreMerge && $mainCanvas.hasClass('changed')) {
			$mainCanvas.removeClass('changed');
			mergeDrawing();
		};

		$('.whiteboards canvas').hide();
		$('.whiteboards canvas').eq(index).show();

		$mainCanvas = $('.whiteboards canvas').eq(index);
		mainCanvasCtx = $mainCanvas.get(0).getContext('2d');

		setBackgroundMedia($mainCanvas.data('backgroundMedia'));
	};


	function resetWhiteboard() {
		$('.whiteboards').empty();
		$('.backgroundMedia').empty();

		mousedown = false;
		whiteboard.clear();

		selectLineColor('LC_0000ff');
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


	function setupToolbar(settings) {
		selectTool(settings.tool);
		selectLineColor(settings.penColor);
		selectLineWidth(settings.penSize);
	};


	function selectLineColor(color_id) {
		whiteboard.setPenColor(toolbar.color[color_id]);
		whiteboardSettings.penColor = toolbar.color[color_id];
	};


	function selectLineWidth(size_id) {
		whiteboard.setDotSize(toolbar.size[size_id]);
		whiteboardSettings.minWidth = toolbar.size[size_id];
		whiteboardSettings.maxWidth = toolbar.size[size_id];
	};


	function selectTool(tool_id) {

	};

	function selectBackgroundMedia(config) {
		saveBackgroundMediaConfig(config)
		if (config.type === 'none') {
			clearBackgroundMedia();
		}
		else {
			setBackgroundMedia(config);
		}
	};

	function saveBackgroundMediaConfig(config) {
		$mainCanvas.data('backgroundMedia', config);
	};


	var bgChangeDelay;
	function setBackgroundMedia(config, seekLoop) {
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
			clearTimeout(bgChangeDelay);
			bgChangeDelay = setTimeout(function () {
				setSlideBgImage(config);
			});
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

	function clearCanvas(canvas) {
		canvas.get(0).getContext('2d').clearRect(0, 0, canvas.width(), canvas.height());
	};


	function clearBackgroundMedia() {
		$('.backgroundMedia').empty();
		$('.board').css({
			background: boardColor
		});
	};


	function mergeDrawing() {
		mainCanvasCtx.drawImage(penCanvas, 0, 0);
		whiteboard.clear();
	};


	function getImageSource(imgageSource) {
		if (typeof imgageSource === 'object') {
			return resources.images[imgageSource.id]
		} else {
			return imgageSource;
		}
	};


	function renderImage(imgData, $canvas) {
		if (!imgData || imgData === 'none') {
			return;
		}

		var img = new Image();
		img.src = imgData;
		img.onload = function () {
			clearCanvas($canvas);
			$canvas.get(0).getContext('2d').drawImage(img, 0, 0);
		};
	};



	scaleWhiteboard();
	$(window).resize(scaleWhiteboard);

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


	var PCV_api = {
		loadPCV: function (data) {
			read_PCV(data);
		},
		downloadPcv: function (url) {
			downloadPcv(url, bytesLoaded).then(data => {
				read_PCV(data);
			});
		},
		bytesLoaded: bytesLoaded,
		ratingChanged: ratingChanged,
		fullscreenChanged: fullscreenChanged,
	};


	var WB_api = {
		handleEvent: function (event, context, seekLoop) {
			return handleEvent(event, context, seekLoop)
		},
		contextReady: function (context) {
			if (context.questions && context.questions.length) {
				createLerningMeter(context.questions);
			}
		},
		renderCanvas: function (toolbarSetup, whiteboardSetup) {
			resetWhiteboard();
			setupToolbar(toolbarSetup);
			setupWhiteboardSession(whiteboardSetup);
		},
		updateResources: function (data) {
			resources = data;
		},
		connect: function (api) {
			PCV_api.play = api.play;
			PCV_api.pause = api.pause;
			PCV_api.bytesLoaded = api.bytesLoaded;
			PCV_api.seekTime = api.seekTime;
			PCV_api.getExplTime = api.getExplTime;
		},
		getImageSource: getImageSource,
		setBackgroundMedia: setBackgroundMedia
	};


	function read_PCV(pcv) {
		if (!pcv) {
			return;
		}

		if (pcv.resources) {
			resources = pcv.resources;
		};

		if (pcv.canvasSize) {
			canvasSize = pcv.canvasSize;
			setCanvasSize(canvasSize);
		};

		if (pcvTokenData && pcvTokenData.url) {
			pcvTokenData.name = pcv.projectName;
			if (pcvTokenData.usr && pcvTokenData.ts && pcvTokenData.code && progressData) {
				uaData.setUserId(pcvTokenData.usr.id);
				progressData.createNewRecord(pcvTokenData);
			}
		};

		window.dispatchEvent(new CustomEvent('onDataReady', {
			'detail': {
				api: WB_api,
				pcv: pcv
			}
		}));
	};


	function ratingChanged(rating) {
		$('.videoMenu .rating')
			.attr('class', '')
			.addClass('rating')
			.addClass('s' + rating);
	};


	function fullscreenChanged(isFullscreen) {
		if (isFullscreen) {
			$('.addons .screensize').addClass('full');
		}
		else {
			$('.addons .screensize').removeClass('full');
		}
	};


	function bytesLoaded(loaded, total) {
		var pct = Math.round(100 * loaded / total) + '%';
		$('.loadingbar i').css({
			width: pct
		});
		$('.loadingbar u').text(pct);

		var mb = {
			total: (total / 1024 / 1024).toFixed(1),
			loaded: (loaded / 1024 / 1024).toFixed(1)
		};

		$('.loadingbar b').text(mb.loaded + ' / ' + mb.total + ' Mb');
	}

	try {

		$('.addons .rating').click(function () {
			// PCV_api.pause();
			// WB_api.appApi.showFeedbackModal();
			if (typeof FeedbackModal === undefined) {
				return;
			};

			PCV_api.pause();
			let feedback = new FeedbackModal({
				pcvTokenData: pcvTokenData,
				onDismiss: function () {
					PCV_api.play();
				}
			});
			feedback.present();
		});

		if (parent && typeof parent.connectIFrameAPI === 'function') {
			WB_api.appApi = parent.connectIFrameAPI(PCV_api);

			if (typeof WB_api.appApi.updateLernitySession === 'function') {
				window.addEventListener('pcvSping', function (event) {
					WB_api.appApi.updateLernitySession();
				}, false);
			}

			$('.topPane .ion-close').click(function () {
				WB_api.appApi.navigateBack();
				if (screenfull.isEnabled && screenfull.isFullscreen) {
					screenfull.exit();
				};
			});
		}
		else {
			$('.topPane .ion-close').click(function () {
				window.close();
			});
		}
	} catch (e) {
		$('.board')
			.addClass('error');

		$('<div>')
			.addClass('errMsg')
			.appendTo($('.board'))
			.text(e.name + ': ' + e.message);

		$('.topPane .ion-close').click(function () {
			window.history.back();
		});

		return console.log(e);
	}

	// $('.ion-close').click(function() {
	//	$('#file').click();
	// });			    

	// document.getElementById('file').onchange = function(){
	// 	var reader = new FileReader();
	// 	reader.onload = function(progressEvent) {  
	// 		read_PCV(JSON.parse(this.result));
	// 	};
	// 	reader.readAsText(this.files[0]);
	// };						

	// if (false) {
	// 	setTimeout(function() {
	// 		$.ajax({
	// 			url: 'test.pcv',
	// 			dataType: "json",
	// 			success: function(data) {
	// 				read_PCV(data);
	// 			}
	// 		});
	// 	}, 100);							
	// }	


	try {
		if (parent && screenfull) {
			screenfull.setDocument(parent.document);
		};

		if (screenfull.isEnabled) {
			$('.addons .screensize')
				.show()
				.click(function () {
					if ($(this).hasClass('full')) {
						screenfull.exit();
					}
					else {
						screenfull.request();
					}
				});
		};

		screenfull.onchange(function () {
			if (screenfull.isFullscreen) {
				$('.addons .screensize').addClass('full');
			}
			else {
				$('.addons .screensize').removeClass('full');
			}
		});
	} catch (e) {
		console.log(e);
	}


	// if (!window.location.hash) {
	// 	var pcvUrl = window.location.toString().replace('player.html', 'files/test1.pcv');
	// 	var pcvToken = encodeURIComponent(btoa(pcvUrl));        
	// 	window.location.hash = pcvToken;			
	// };


	function encodeFileName(url) {
		let urlParts = url.split('/');
		urlParts[urlParts.length - 1] = encodeURIComponent(urlParts[urlParts.length - 1]);
		return urlParts.join('/');
	}


	if (window.location.hash) {
		var url, token = window.location.hash.replace('#', '');
		var decodedToken = atob(decodeURIComponent(token));

		try {
			pcvTokenData = JSON.parse(decodedToken);
		}
		catch (e) {
			pcvTokenData = {
				url: decodedToken
			}
		}

		downloadPcv(pcvTokenData.url, bytesLoaded).then(data => {
			uaData.ev_pcvLoadSuccess(pcvTokenData.url);
			data.url = pcvTokenData.url;
			read_PCV(data);
		}, (err) => {
			uaData.ev_pcvLoadFail(pcvTokenData.url);
		});
	};

	if (window.opener && window.opener.pcv) {
		read_PCV(JSON.parse(JSON.stringify(window.opener.pcv)));
	};

	// let src = 'https://lpcv.s3.amazonaws.com/11/K/K110010/K110010-learn-thermal-properties-of-matter.pcv'
	// downloadPcv(src, bytesLoaded).then(data => {
	// 	read_PCV(data);
	// });	

	function downloadPcv(url, onprogress) {
		if (window.lhost) {
			//https://lpcv.s3.amazonaws.com/12/B/B120050/B120050010010-heredity-&-variation.pcv
			//https://s3.ap-south-1.amazonaws.com/lpcv/12/P/P120040/P120040-gaalvanometer.pcv
			if (url.indexOf("s3.ap-south-1.amazonaws.com/lpcv") != -1) {
				url = window.lhost + 'lpcv' + url.split('s3.ap-south-1.amazonaws.com/lpcv')[1];
			} else if (url.indexOf("lpcv.s3.amazonaws.com") != -1) {
				url = window.lhost + 'lpcv' + url.split('lpcv.s3.amazonaws.com')[1];
			} else {
				console.log('ERROR: invalid pcv URL ' + url);
			}
		}

		// url = 'https://lpcv.s3.amazonaws.com/11/B/B110160/B110160010010-what-is-digestion?.pcv';
		url = encodeFileName(url);

		return new Promise((resolve, reject) => {
			let pcvSize = {
				compressed: null,
				uncompressed: null
			}
			let xhr = new XMLHttpRequest();

			xhr.onprogress = event => {
				if (pcvSize.compressed && pcvSize.uncompressed) {
					onprogress(event.loaded, event.lengthComputable ? pcvSize.compressed : pcvSize.uncompressed);
				}
			};

			xhr.onload = xhr.onerror = () => {
				if (xhr.status == 200) {
					resolve(JSON.parse(xhr.responseText));
				} else {
					reject(xhr.status);
				}
			};

			xhr.onreadystatechange = () => {
				if (xhr.readyState == xhr.HEADERS_RECEIVED) {
					var headers = {};
					var arr = xhr.getAllResponseHeaders().trim().split(/[\r\n]+/);
					arr.forEach(function (line) {
						var parts = line.split(': ');
						headers[parts[0]] = parts[1];
					});
					pcvSize.compressed = headers['x-amz-meta-compressed-length'];
					pcvSize.uncompressed = headers['x-amz-meta-uncompressed-length'];

					if (headers['x-amz-meta-pcv-title'] && headers['x-amz-meta-pcv-duration']) {
						window.dispatchEvent(new CustomEvent('metadataReceived', {
							'detail': {
								title: headers['x-amz-meta-pcv-title'],
								duration: headers['x-amz-meta-pcv-duration']
							}
						}));
					};
				}
			}

			xhr.open('GET', url, true);
			xhr.send();
		});
	};


});
