Mp3LameEncoder.prototype.runSelfDiagnose = function(warn) {
  let gMp3Ct = this.mp3Buffers.length;
  this.timer = setInterval(() => {
      if (gMp3Ct < this.mp3Buffers.length) {
          gMp3Ct = this.mp3Buffers.length;
      } else {
          clearInterval(this.timer);
          warn();
      }
  }, 5000);
};

Mp3LameEncoder.prototype.finishEncoding = function() {
  clearInterval(this.timer);
  return this.finish();
};