self.Mp3LameEncoderConfig = {
  memoryInitializerPrefixURL: "../lib/"
};

importScripts('../lib/Mp3LameEncoder.min.js', '../lib/Mp3LameEncoder.ext.js');

var gEncoder = null; //The MP3 encoder object
var gCfg = { //Encoder configuration
  chnlCt: 2, //1=mono, 2=stereo
  // bufSz: 0, //input buffer size (bytes), 16bit signed int.
  bufSz: 4096, //input buffer size (bytes), 16bit signed int.
  sampleRate: 44100, //Input sample rate (samples per second)
  bitRate: 32 //Output bit rate (9-128)
};

self.onmessage = function (event) {
  var data = event.data;
  switch (data.command) {
    case 'start':
      Mp3Create();
      self.postMessage({
        command: 'onStart'
      });
      break;

    case 'record':
      gEncoder.encode(data.buffers);
      break;

    case 'finish':
      var blob = gEncoder.finishEncoding();
      console.log("STOP");
      self.postMessage({
        command: 'onFinish',
        blob: blob
      });
      break;

    case 'cancel':

  }
};


//Create the mp3 encoder object.
function Mp3Create() {
  if (!(gEncoder = new Mp3LameEncoder(gCfg.sampleRate, gCfg.bitRate))) {
      console.log("ERR: Unable to create MP3 encoder.");
  } else {
      console.log("MP3 encoder created.");
      console.log("Power ON.");
      gEncoder.runSelfDiagnose(() => {
        self.postMessage({
          command: 'onAudioError'
        });                                  
      });
  }
}
