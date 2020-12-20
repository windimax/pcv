"use strict";
var dbUtils = (function() {

    var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB,
        IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction,
        baseName = "filesBase",
        storeName = "filesStore";

    function logerr(err) {
        console.log(err);
    }

    function connectDB(f) {
        var request = indexedDB.open(baseName, 1);
        request.onerror = logerr;
        request.onsuccess = function() {
            f(request.result);
            request.result.close();
        }
        request.onupgradeneeded = function(e) {
            e.currentTarget.result.createObjectStore(storeName, {
                autoIncrement: true
            });
            connectDB(f);
        }
    }

    function getFile(file, f) {
        connectDB(function(db) {
            var request = db.transaction([storeName], "readonly").objectStore(storeName).get(file);
            request.onerror = logerr;
            request.onsuccess = function() {
                f(request.result ? request.result : -1);
            }
        });
    }

    function getStorage(f) {
        connectDB(function(db) {
            var rows = [],
                store = db.transaction([storeName], "readonly").objectStore(storeName);

            if (store.mozGetAll)
                store.mozGetAll().onsuccess = function(e) {
                    f(e.target.result);
                };
            else
                store.openCursor().onsuccess = function(e) {
                    var cursor = e.target.result;
                    if (cursor) {
                        rows.push(cursor.value);
                        cursor.continue();
                    } else {
                        f(rows);
                    }
                };
        });
    }

    function setFile(file, callback) {
        connectDB(function(db) {
            var transaction = db.transaction([storeName], "readwrite");

            transaction.onerror = logerr;
            transaction.oncomplete = function(event) {
                db.close();
            }

            var objectStore = transaction.objectStore(storeName);
            var objectStoreRequest = objectStore.put(file);

            objectStoreRequest.onerror = logerr;
            objectStoreRequest.onsuccess = function(event) {
                callback();
            }
        });
    };

    function delFile(file) {
        connectDB(function(db) {
            var request = db.transaction([storeName], "readwrite").objectStore(storeName).delete(file);
            request.onerror = logerr;
            request.onsuccess = function() {
                console.log("File delete from DB:", file);
            }
        });
    };

    function clearDB(callback) {
        connectDB(function(db) {                
            var transaction = db.transaction([storeName], "readwrite");

            transaction.onerror = logerr;
            transaction.oncomplete = function(event) {
                console.log('Transaction completed: database modification finished');
            };

            var objectStore = transaction.objectStore(storeName);
            var objectStoreRequest = objectStore.clear();

            objectStoreRequest.onsuccess = function(event) {
                callback(); 
            };
        });
    };     

    function dropDB(callback) {
        var request = indexedDB.deleteDatabase(baseName);
        request.onerror = logerr;
        request.onsuccess = function(event) {
            callback(); 
        };
    }; 

	return {
        dropDB: dropDB,
        clearDB: clearDB,
        setFile: setFile,        
        getStorage: getStorage
	};

})();


if (typeof module !== 'undefined' && module.exports) {
	module.exports = dbUtils;	
};
