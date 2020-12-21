"use strict";

require("/lib/lame.js");	

    var worker,
        useWorker = true;

        
    var VoiceRecorder = function() {

        var defaults = {
            bitRate: 32,
            sampleRate: 44100
        }

        if (arguments[0] && typeof arguments[0] === "object") {
            this.options = extendDefaults(defaults, arguments[0]);
        }

        if (useWorker) {
            worker = new Worker('javascript/scripts/encoderWorker.js');

            worker.onmessage = function(event) {
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

    VoiceRecorder.prototype.powerOnMic = function(cfg, success, failure) {
        callbacks = {
            success: success,
            failure: failure
        };
        gCfg.bitRate = cfg.bitRate;
        PowerOn();
    };

    VoiceRecorder.prototype.getAudioCfg = function() {
        return JSON.parse(JSON.stringify(gCfg));
    }

    VoiceRecorder.prototype.start = function(onStartSuccess, onStartFailure) {
        callbacks.onStartSuccess = onStartSuccess;
        callbacks.onStartFailure = onStartFailure;
        startRecording();
    };

    VoiceRecorder.prototype.stop = function(onStop) {
        callbacks.onStop = onStop;
        stopRecording();
    };


    //(C)2016 nlited systems inc. http://nlited.org
    var gAudio = null; //Audio context
    var gAudioSrc = null; //Audio source
    var gNode = null; //The audio processor node
    var gIsLame = false; //Has lame.min.js been loaded?
    var gLame = null; //The LAME encoder library
    var gEncoder = null; //The MP3 encoder object
    var gStrmMp3 = []; //Collection of MP3 buffers
    var gIsRecording = false;
    var gCfg = { //Encoder configuration
            chnlCt: 1, //1=mono, 2=stereo
            // bufSz: 0, //input buffer size (bytes), 16bit signed int.
            bufSz: 4096, //input buffer size (bytes), 16bit signed int.
            sampleRate: 44100, //Input sample rate (samples per second)
            bitRate: 32 //Output bit rate (9-128)
    };
    var gPcmCt = 0; //Total input bytes
    var gMp3Ct = 0; //Total output bytes

    var callbacks;
    var maxSamples = 1152;

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
            navigator.mediaDevices.getUserMedia({audio: true})
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
                    LameCreate();
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
            gAudio.close().then(function() {
                gEncoder = null;
                gLame = null;
                gNode = null;
                gAudioSrc = null;
                gAudio = null;

                if (window.streamReference) {
                    window.streamReference.getAudioTracks().forEach(function(track) {
                        track.stop();
                    });
                    window.streamReference = null;
                }
                console.log("Power OFF.");                
            });            
        }
    }

    //Called when the lame library has been loaded.
    function LameCreate() {
        if (!(gEncoder = Mp3Create())) {
            console.log("ERR: Unable to create MP3 encoder.");
        } else {
            gStrmMp3 = [];
            gPcmCt = 0;
            gMp3Ct = 0;
            console.log("Power ON.");
            callbacks.success();
        }
    }

    //Create the mp3 encoder object.
    function Mp3Create() {
        if (!(gLame = new lamejs())) {
            console.log("ERR: Unable to create LAME object.");
        } else if (!(gEncoder = new gLame.Mp3Encoder(gCfg.chnlCt, gCfg.sampleRate, gCfg.bitRate))) {
            console.log("ERR: Unable to create MP3 encoder.");
        } else {
            console.log("MP3 encoder created.");
        }
        return (gEncoder);
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
                callbacks.onStartSuccess(function() {
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

                    selfDiagnosis = {
                        data: {
                            gMp3Ct: gMp3Ct
                        },
                        timer: setInterval(() => {
                            if (selfDiagnosis.data.gMp3Ct !== gMp3Ct) {
                                selfDiagnosis.data.gMp3Ct = gMp3Ct;
                            } else {
                                clearInterval(selfDiagnosis.timer);
                                audioRecAlert();                                
                            }
                        }, 5000)
                    };
                         
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
            //Flush the last mp3 buffer.

            if (!!worker) {
                worker.postMessage({
                    command: 'finish'
                });            
            }
            else {
                var mp3 = gEncoder.flush();
                if (mp3.length > 0)
                    gStrmMp3.push(mp3);
                //Present the mp3 stream on the page.
                blob = createMp3Blob(gStrmMp3);
                gStrmMp3 = [];
                clearInterval(selfDiagnosis.timer);
                console.log("STOP");
                callbacks.onStop(blob)
            }
        }

        PowerOff();
    }

    //Process a single audio buffer.
    //Input is an array of floating-point samples.
    function onAudioProcess(e) {
        //Cap output stream size
        // if (gMp3Ct > 200 * 10000)
        //     return;
        var inBuf = e.inputBuffer;
        var samples = inBuf.getChannelData(0);
        var sampleCt = samples.length;
        //Convert floating-point to 16bit signed int.
        //This may modify the number of samples.

        if (!!worker) {
            return worker.postMessage({
                command: 'record',
                samples: samples
            });
        }

        var samples16 = convertFloatToInt16(samples);
        if (samples16.length > 0) {
            // var remaining = samples16.length;
            // for (var i = 0; remaining >= 0; i += maxSamples) {
            //   var left = samples16.subarray(i, i + maxSamples);
            //   var mp3buf = gEncoder.encodeBuffer(left);
            //   gStrmMp3.push(mp3buf);
            //   remaining -= maxSamples;
            // }

            gPcmCt += samples16.length * 2;
            //Encode PCM to mp3
            var mp3buf = gEncoder.encodeBuffer(samples16);
            var mp3Ct = mp3buf.length;
            if (mp3Ct > 0) {
                //Add buffer to in-memory output stream.
                gStrmMp3.push(mp3buf);
                gMp3Ct += mp3Ct;
            }
            // console.log("%d / %d: %2.2f%%", gPcmCt, gMp3Ct, (gMp3Ct * 100) / gPcmCt);
        }

    }

    //Convert floating point to 16bit signed int.
    function convertFloatToInt16(inFloat) {
        var sampleCt = inFloat.length;
        var outInt16 = new Int16Array(sampleCt);
        for (var n1 = 0; n1 < sampleCt; n1++) {
            //This is where I can apply waveform modifiers.
            var sample16 = 0x8000 * inFloat[n1];
            //Clamp value to avoid integer overflow, which causes audible pops and clicks.
            sample16 = (sample16 < -32767) ? -32767 : (sample16 > 32767) ? 32767 : sample16;
            outInt16[n1] = sample16;
        }
        return (outInt16);
    }

    //Create the output mp3 stream 
    function createMp3Blob(mp3) {
        //Consolidate the collection of MP3 buffers into a single data Blob.
        return new Blob(gStrmMp3, {
            type: 'audio/mp3'
        });
    }    


    function audioRecAlert() {
        window.dispatchEvent(new CustomEvent('audioRecAlert')); 
    }
    




