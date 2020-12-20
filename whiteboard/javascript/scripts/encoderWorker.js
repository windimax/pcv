// manually rewritten from CoffeeScript output
// (see dev-coffee branch for original source)
// importScripts('Mp3LameEncoder.min.js');

importScripts('../lib/lame.js');


var gLame = null; //The LAME encoder library
var gEncoder = null; //The MP3 encoder object
var gStrmMp3 = []; //Collection of MP3 buffers
var gCfg = { //Encoder configuration
  chnlCt: 1, //1=mono, 2=stereo
  // bufSz: 0, //input buffer size (bytes), 16bit signed int.
  bufSz: 4096, //input buffer size (bytes), 16bit signed int.
  sampleRate: 44100, //Input sample rate (samples per second)
  bitRate: 32 //Output bit rate (9-128)
};
var gPcmCt = 0; //Total input bytes
var gMp3Ct = 0; //Total output bytes

var selfDiagnosis = {
  data: {}
};


self.onmessage = function (event) {
  var data = event.data;
  switch (data.command) {
    case 'start':
      LameCreate();
      self.postMessage({
        command: 'onStart'
      });
      break;

    case 'runSelfDiagnosis':
      selfDiagnosis = {
          data: {
              gMp3Ct: gMp3Ct
          },
          timer: setInterval(() => {
              if (selfDiagnosis.data.gMp3Ct !== gMp3Ct) {
                  selfDiagnosis.data.gMp3Ct = gMp3Ct;
              } else {
                  clearInterval(selfDiagnosis.timer);
                  self.postMessage({
                    command: 'onAudioError'
                  });                                  
              }
          }, 5000)
      };
      break;

    case 'record':
      var samples16 = convertFloatToInt16(data.samples);
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

      break;

    case 'finish':

      var mp3 = gEncoder.flush();
      if (mp3.length > 0)
          gStrmMp3.push(mp3);
      //Present the mp3 stream on the page.
      var blob = createMp3Blob(gStrmMp3);
      gStrmMp3 = [];
      clearInterval(selfDiagnosis.timer);
      console.log("STOP");

      self.postMessage({
        command: 'onFinish',
        blob: blob
      });

      break;

    case 'cancel':

  }
};


function LameCreate(callback) {
  if (!(gEncoder = Mp3Create())) {
    console.log("ERR: Unable to create MP3 encoder.");
  } else {
    gStrmMp3 = [];
    gPcmCt = 0;
    gMp3Ct = 0;
    console.log("Power ON.");
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

function createMp3Blob(mp3) {
  //Consolidate the collection of MP3 buffers into a single data Blob.
  return new Blob(gStrmMp3, {
    type: 'audio/mp3'
  });
}    
