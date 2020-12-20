"use strict";
var http = (function() {

	function loadHTML(url) {
		return new Promise((resolve, reject) => {
			var xhr = new XMLHttpRequest();			
			xhr.onload = xhr.onerror = function() {
				if (xhr.status === 200) {
					resolve(xhr.responseText);
				} else {
					reject(xhr.statusText);
				}
			};

			xhr.open('GET', url);
			xhr.setRequestHeader('Content-type', 'text/html');
			xhr.send();	
		});
	}

	function get(url, options) {
		return new Promise((resolve, reject) => {
			var xhr = new XMLHttpRequest();			
			xhr.onload = xhr.onerror = function() {
				if (xhr.status === 200) {
					resolve(JSON.parse(xhr.responseText));
				} else {
					reject(xhr.statusText);
				}
			};

			if (options && options.onprogress) {
				xhr.onprogress = function(event) {
					options.onprogress(event);
				};					
			};

			xhr.open('GET', url);
			xhr.send();		
		});
	};

	function post(url, body, options) {

		return new Promise((resolve, reject) => {
			var xhr = new XMLHttpRequest();	

			xhr.onload = xhr.onerror = function() {
			    if (xhr.status > 300) {
			    	reject(xhr.statusText);
			    } else {
			        resolve(xhr.status);
			    }
			};				

			if (options && options.onprogress) {
				xhr.upload.onprogress = function(event) {
					options.onprogress(event);
				};					
			};

			xhr.open('POST', url);
			if (options && options.headers) {
				for(let key in options.headers){
					xhr.setRequestHeader(key, options.headers[key]);
				}
			}
			xhr.send(body);	
		});			
	}

	return {
		get: get,
		post: post,
		loadHTML: loadHTML
	}

})();