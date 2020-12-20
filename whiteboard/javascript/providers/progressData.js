"use strict";
var progressData = (function() {

  var counter = 0;
	var completed, pcvTokenData, pcvProgreesEvent;

  function reset() {
    counter = 0;
    completed = false;
  }

	function createNewRecord(tokenData) {
		pcvTokenData = tokenData;
		buildModule(pcvTokenData);
	}

	function getModuleCode(url) {
		const fileName = url.split('/').reverse()[0];
	  const code = fileName.split('-')[0];
	  if (code.length === 13) {
	  	return Promise.resolve(code);
	  }		
		return new Promise(resolve => {
			digestMessage(fileName).then(digestValue => {
				resolve((code + hexString(digestValue)).substring(0,13).toUpperCase());
			});
	  });	
	}

  function buildModule() {
  	let moduleCode = pcvTokenData.code;
    let subj = moduleCode.substring(0,1);
    let topic = moduleCode.substring(0,7);
    let subTopic = moduleCode.substring(0,10);

    pcvProgreesEvent = pcvProgreesEvent || {
		  type: "progress",
		  version: "1.0.0",
    	id: pcvTokenData.usr.id,
    	update_time: new Date()
    };
    
    pcvProgreesEvent.records = pcvProgreesEvent.records || {};
    pcvProgreesEvent.records[subj] = pcvProgreesEvent.records[subj] || {};
    pcvProgreesEvent.records[subj][topic] = pcvProgreesEvent.records[subj][topic] || {};
    pcvProgreesEvent.records[subj][topic][subTopic] = pcvProgreesEvent.records[subj][topic][subTopic] || {};
    pcvProgreesEvent.records[subj][topic][subTopic][moduleCode] = pcvProgreesEvent.records[subj][topic][subTopic][moduleCode] || {
    	name: pcvTokenData.name, 
    	type: 'Video', 
    	events: [{
        url: pcvTokenData.url,
        moduleName: pcvTokenData.name,
        moduleCode: moduleCode,
        moduleType: 'Video',
        timestamp: pcvTokenData.ts,
        status: 'STARTED',		
    	}]
    };
    return pcvProgreesEvent.records[subj][topic][subTopic][moduleCode];
  }

  function trackPlayback(watchedTime, time, duration) {
    if (duration - time <= 10000 && !completed) {
      sendPcvCancelEvent(watchedTime);
      completed = true;
      return;
    }

    counter += 100;
    if (!(counter % 120000)) {
      sendPcvProgressEvent(watchedTime);
    }
  }  

  function sendPcvStartEvent() {
  	if (!pcvProgreesEvent) {
  		return;
  	}
		sendProgressEvent();
  }  

  function sendPcvCancelEvent(pcvTime) {
    if (!pcvProgreesEvent) {
      return;
    }

    pcvProgreesEvent.update_time = new Date();
    
    let event = buildModule().events[0];
    event.pcvTime = pcvTime;
    event.status = 'COMPLETED';
    event.updateTime = pcvProgreesEvent.update_time.getTime();

    sendProgressEvent();
  }

  function sendPcvProgressEvent(pcvTime) {
    if (!pcvProgreesEvent) {
      return;
    }

    pcvProgreesEvent.update_time = new Date();
    
    let event = buildModule().events[0];
    event.pcvTime = pcvTime;
    event.updateTime = pcvProgreesEvent.update_time.getTime();

    sendProgressEvent();
    window.dispatchEvent(new CustomEvent('pcvSping')); 
  }

  function sendProgressEvent() {
    let body = JSON.stringify(pcvProgreesEvent);
    let options = {
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    };
    http.post(window.host + 'pevent', body, options)
      .then((data) => {
        // console.log(data);
      }, (rej) => {
        // console.error(rej);
      });
  }  

	return {
    reset: reset,
    trackPlayback: trackPlayback,
		createNewRecord: createNewRecord,
		sendPcvStartEvent: sendPcvStartEvent,
		sendPcvCancelEvent: sendPcvCancelEvent
	}

})();