"use strict";

var FeedbackModal = (function() {

  let callbacks = {
    onPresent: null,
    onDismiss: null
  };

  let pcvTokenData, isPresented = false;

  let feedbackComponent = document.querySelector('.feedbackComponent');
  let componentContent = feedbackComponent.querySelector('.componentContent');

  let stars = feedbackComponent.querySelector('.stars');
  let message = feedbackComponent.querySelector('.message');
  let cancel = feedbackComponent.querySelector('.cancel');
  let submit = feedbackComponent.querySelector('.submit');

  feedbackComponent.classList.remove('hidden');

  var FeedbackModal = function(options) {
    pcvTokenData = options.pcvTokenData;

    if (options && options.onPresent) {
      callbacks.onPresent = options.onPresent;
    }
    if (options && options.onDismiss) {
      callbacks.onDismiss = options.onDismiss;
    }
  }

  var present = function() {
    feedbackComponent.classList.add('shown');
    feedbackComponent.classList.add('present');
  }

  var dismiss = function() {
    submit.disabled = false;
    feedbackComponent.classList.remove('busy');
    feedbackComponent.classList.remove('present');
  }

  FeedbackModal.prototype.present = function() {
    present();
  }

  FeedbackModal.prototype.dismiss = function() {
    dismiss();
  }

  setTimeout(() => {
    feedbackComponent.classList.add('ready');
  }, 300);

  cancel.addEventListener('click', (event) => {
    dismiss();
  })

  cancel.addEventListener('click', (event) => {
    dismiss();
  })

  submit.addEventListener('click', (event) => {
    let star = stars.querySelector('input:checked');
    if (!message.value.trim() && !star) {
      return alert('Please rate the video or enter your feedback');
    };

    let data = {
      pcv: {
        url: pcvTokenData.url,
        name: pcvTokenData.name || 'N/A'
      }
    };

    if (pcvTokenData.usr) {
      data.user = pcvTokenData.usr;
    }
    if (message.value.trim()) {
      data.message = message.value.trim();
    }
    if (star) {
      data.rating = star.value;
    }

    if (platform !== undefined) {
      data.platform = platform.description;
    }

    submit.disabled = true;
    feedbackComponent.classList.add('busy');

    sendFeedback(data).then((res) => {
      dismiss();
      uaData.ev_pcvFeedback(data.pcv.url);
      setTimeout(() => {
        alert('Thank you for your feedback');
      }, 300);
    }, (err) => {
      dismiss();
      setTimeout(() => {
        alert('ERROR: ' + err);
      }, 300);
    });

  })  

  componentContent.addEventListener("transitionend", (event) => {
    if (event.target !== componentContent) {
      return;
    }
    isPresented = !isPresented;
    if (isPresented && callbacks.onPresent) {
      callbacks.onPresent();
    } 
    else if (!isPresented && callbacks.onDismiss) {
      callbacks.onDismiss();
    }
    if (!isPresented) {
      feedbackComponent.classList.remove('shown');
      message.value = '';
    }


  });  

  function sendFeedback(data) {
    let body = JSON.stringify(data);
    let options = {
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    };
    return new Promise((resolve, reject) => {
      http.post(window.host + 'feedback', body, options)
        .then((data) => {
          resolve(data);
        }, (rej) => {
          reject(rej);
        });
    });    
  }  

  return FeedbackModal;

})();