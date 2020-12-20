"use strict";
var fileUtils = (function() {

    var mimes = [{
            ext: 'gif',
            mime: 'image/gif',
            pattern: [0x47, 0x49, 0x46, 0x38],
            mask: [0xFF, 0xFF, 0xFF, 0xFF]            
        }, {
            ext: 'png',
            mime: 'image/png',
            pattern: [0x89, 0x50, 0x4E, 0x47],
            mask: [0xFF, 0xFF, 0xFF, 0xFF]
        }, {
            ext: 'jpg',
            mime: 'image/jpeg',
            pattern: [0xFF, 0xD8, 0xFF, 0xE0],
            mask: [0xFF, 0xFF, 0xFF, 0xFF]                
        }, {
            ext: 'svg',
            mime: 'image/svg+xml',
            pattern: [0x3C, 0x3F, 0x78, 0x6D],
            mask: [0xFF, 0xFF, 0xFF, 0xFF]                
        }
    ];    

    function checkMimeType(file, callback) {
        var reader = new FileReader();
        reader.onload = function(progressEvent) {  
            var bytes = new Uint8Array(this.result);
            for (var i = 0; i < mimes.length; ++i) {
                if (check(bytes, mimes[i])) {
                    return callback(true)
                };
            }
            return callback(false);
        };
        reader.readAsArrayBuffer(file.slice(0, 4));

        function check(bytes, mime) {
            for (var i = 0; i < mime.mask.length; ++i) {
                if ((bytes[i] & mime.mask[i]) - mime.pattern[i] !== 0) {
                    return false;
                }
            }
            return true;
        };        
    };

    function imgExtForFile(base64String) {
        var base64Obj = parseBase64(base64String);
        return mimes.filter(function(item) {
            return item.mime === base64Obj.mimeType
        })[0].ext;
    };

    function base64toBlobUrl(base64String) {
        var base64Obj = parseBase64(base64String);
		var blob = base64toBlob(base64Obj.realData, base64Obj.mimeType);

    	return URL.createObjectURL(blob);
    };

	function base64toBlob(b64Data, mimeType, sliceSize) {
        mimeType = mimeType || '';
        sliceSize = sliceSize || 512;

        var byteCharacters = atob(b64Data);
        var byteArrays = [];

        for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
            var slice = byteCharacters.slice(offset, offset + sliceSize);

            var byteNumbers = new Array(slice.length);
            for (var i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }

            var byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
        }

      return new Blob(byteArrays, {type: mimeType});
	};

    function parseBase64(base64String) {
        var block = base64String.split(";");
        return {
            mimeType: block[0].split(":")[1],
            realData: block[1].split(",")[1]
        }
    };

	return {
        imgExtForFile: imgExtForFile,
        checkMimeType: checkMimeType,
		base64toBlobUrl: base64toBlobUrl
	};

})();


if (typeof module !== 'undefined' && module.exports) {
	module.exports = fileUtils;	
};
