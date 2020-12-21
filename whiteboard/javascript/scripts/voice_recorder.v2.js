"use strict";

window.Mp3LameEncoderConfig = { memoryInitializerPrefixURL: "javascript/lib/" };
require("/lib/Mp3LameEncoder.min.js", function() {
    require("/lib/Mp3LameEncoder.ext.js");
});	

var worker,
    useWorker = true;

var VoiceRecorder = function () {

    var defaults = {
        bitRate: 32,
        sampleRate: 44100
    }

    if (arguments[0] && typeof arguments[0] === "object") {
        this.options = extendDefaults(defaults, arguments[0]);
    }

    if (useWorker) {
        worker = new Worker('javascript/scripts/encoderWorker.v2.js');

        worker.onmessage = function (event) {
            var data = event.data;
            switch (data.command) {
                case 'onStart':
                    callbacks.success();
                    break;

                case 'onFinish':
                    callbacks.onStop(data.blob)
                    break;

                case 'onAudioError':
                    audioRecAlert();
                    break;
            }
        }
    }

};

function extendDefaults(source, properties) {
    for (var property in properties) {
        if (properties.hasOwnProperty(property)) {
            source[property] = properties[property];
        }
    }
    return source;
};

VoiceRecorder.prototype.powerOnMic = function (cfg, success, failure) {
    callbacks = {
        success: success,
        failure: failure
    };
    gCfg.bitRate = cfg.bitRate;
    PowerOn();
};

VoiceRecorder.prototype.getAudioCfg = function () {
    return JSON.parse(JSON.stringify(gCfg));
}

VoiceRecorder.prototype.start = function (onStartSuccess, onStartFailure) {
    callbacks.onStartSuccess = onStartSuccess;
    callbacks.onStartFailure = onStartFailure;
    startRecording();
};

VoiceRecorder.prototype.stop = function (onStop) {
    callbacks.onStop = onStop;
    stopRecording();
};


//(C)2016 nlited systems inc. http://nlited.org
var gAudio = null; //Audio context
var gAudioSrc = null; //Audio source
var gNode = null; //The audio processor node
var gEncoder = null; //The MP3 encoder object
var gStrmMp3 = []; //Collection of MP3 buffers
var gIsRecording = false;
var gCfg = { //Encoder configuration
    chnlCt: 2, //1=mono, 2=stereo
    // bufSz: 0, //input buffer size (bytes), 16bit signed int.
    bufSz: 4096, //input buffer size (bytes), 16bit signed int.
    sampleRate: 44100, //Input sample rate (samples per second)
    bitRate: 32 //Output bit rate (9-128)
};

var callbacks;

var selfDiagnosis = {
    data: {}
};

//Power button
function onPower() {
    if (!gAudio) {
        PowerOn();
    } else {
        PowerOff();
    }
}


function PowerOn() {
    console.log("Powering up...");

    window.AudioContext = window.AudioContext || window.webkitAudioContext || AudioContext;
    if (!(gAudio = new window.AudioContext())) {
        callbacks.failure();
        return console.log("ERR: Unable to create AudioContext.");
    }

    if (navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === 'function') {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(onUserMedia)
            .catch(onFail);
    }
    else {
        onFail('not supported');
    }

    function onUserMedia(stream) {
        window.streamReference = stream;
        if (!(gAudioSrc = gAudio.createMediaStreamSource(stream))) {
            console.log("ERR: Unable to create audio source.");
        } else {
            if (!!worker) {
                worker.postMessage({
                    command: 'start',
                    bitRate: gCfg.bitRate
                });
            } else {
                Mp3Create();
            }
        }
    }

    function onFail(ex) {
        gAudio = null;
        callbacks.failure();
        console.log("ERR: getUserMedia failed: %s", ex);
    }
}

//Shut everything down.
function PowerOff() {
    console.log("Power down...");
    if (gIsRecording) {
        console.log("ERR: PowerOff: You need to stop recording first.");
    } else {
        gAudio.close().then(function () {
            gEncoder = null;
            gNode = null;
            gAudioSrc = null;
            gAudio = null;

            if (window.streamReference) {
                window.streamReference.getAudioTracks().forEach(function (track) {
                    track.stop();
                });
                window.streamReference = null;
            }
            console.log("Power OFF.");
        });
    }
}


//Create the mp3 encoder object.
function Mp3Create() {
    if (!(gEncoder = new Mp3LameEncoder(gCfg.sampleRate, gCfg.bitRate))) {
        console.log("ERR: Unable to create MP3 encoder.");
    } else {
        console.log("MP3 encoder created.");
        console.log("Power ON.");
        gEncoder.runSelfDiagnose(() => {
            audioRecAlert();
        });
        callbacks.success();
    }
}

//Begin recording.
function startRecording() {
    var creator;
    console.log("Start recording...");
    if (!gAudio) {
        console.log("ERR: No Audio source.");
        callbacks.onStartFailure("ERR: No Audio source.");
    } else if (!gEncoder && !worker) {
        console.log("ERR: No encoder.");
        callbacks.onStartFailure("ERR: No encoder.");
    } else if (gIsRecording) {
        console.log("ERR: Already recording.");
        callbacks.onStartFailure("ERR: Already recording.");
    } else {
        //Create the audio capture node.
        if (!gNode) {
            if (!(creator = gAudioSrc.context.createScriptProcessor || gAudioSrc.createJavaScriptNode)) {
                console.log("ERR: No processor creator?");
                callbacks.onStartFailure("ERR: No processor creator?");
            } else if (!(gNode = creator.call(gAudioSrc.context, gCfg.bufSz, gCfg.chnlCt, gCfg.chnlCt))) {
                console.log("ERR: Unable to create processor node.");
                callbacks.onStartFailure("ERR: Unable to create processor node.");
            }
        }
        if (!gNode) {
            console.log("ERR: startRecording: No processor node.");
            callbacks.onStartFailure("ERR: startRecording: No processor node.");
        } else {
            callbacks.onStartSuccess(function () {
                //Set callbacks, connect the node between the audio source and destination.
                gNode.onaudioprocess = onAudioProcess;
                gAudioSrc.connect(gNode);
                gNode.connect(gAudioSrc.context.destination);
                gIsRecording = true;
                console.log("RECORD");

                if (!!worker) {
                    return worker.postMessage({
                        command: 'runSelfDiagnosis'
                    });
                }

                // selfDiagnosis = {
                //     data: {
                //         gMp3Ct: gMp3Ct
                //     },
                //     timer: setInterval(() => {
                //         if (selfDiagnosis.data.gMp3Ct !== gMp3Ct) {
                //             selfDiagnosis.data.gMp3Ct = gMp3Ct;
                //         } else {
                //             clearInterval(selfDiagnosis.timer);
                //             audioRecAlert();                                
                //         }
                //     }, 5000)
                // };

            });
        }
    }
}

//Stop recording.
function stopRecording() {
    var blob;
    console.log("Stop recording...");
    if (!gAudio) {
        console.log("ERR: stopRecording: No audio.");
    } else if (!gAudioSrc) {
        console.log("ERR: stopRecording: No audio source.");
    } else if (!gIsRecording) {
        console.log("ERR: stopRecording: Not recording.");
    } else {
        //Disconnect the node
        gNode.onaudioprocess = null;
        gAudioSrc.disconnect(gNode);
        gNode.disconnect();
        gIsRecording = false;

        if (!!worker) {
            worker.postMessage({
                command: 'finish'
            });
        }
        else {
            blob = gEncoder.finishEncoding();
            console.log("STOP");
            callbacks.onStop(blob)
        }
    }
    PowerOff();
}

function onAudioProcess(e) {
    if (!!worker) {
        return worker.postMessage({
            command: 'record',
            buffers: getBuffers(e)
        });
    }
    gEncoder.encode(getBuffers(e));
}

function getBuffers(event) {
    var buffers = [];
    for (var ch = 0; ch < 2; ++ch)
        buffers[ch] = event.inputBuffer.getChannelData(ch);
    return buffers;
}

function audioRecAlert() {
    window.dispatchEvent(new CustomEvent('audioRecAlert'));
}





