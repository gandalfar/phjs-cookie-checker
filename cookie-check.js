// This is free software/open source, and is distributed under the BSD license.
/*jshint evil:true */
/*global phantom:false, require:false, console:false, document:false, window:false */

var fs = require('fs'),
    system = require('system'),
    parseURI = require("./jslib/parseuri.js"),
    _ = require("./jslib/underscore-min.js");
    _.str = require('./jslib/underscore.string.min.js');
    _.mixin(_.str.exports());

var getRandomUrls, getCookies, initial_url;

// input settings

if (_(system.args[1]).startsWith('http')) {
    initial_url = system.args[1];
} else {
    var input_settings_path = system.args[1];
    var input_settings = fs.read(input_settings_path);
    input_settings = eval( '(' + input_settings + ')' );
    initial_url = input_settings.url;

    var output_file = system.args[2];
}
var host = parseURI.parse(initial_url).host;
console.log('loading ' + initial_url);

getRandomUrls = function(url, callbackPerUrl, callbackFinal) {
    var to_check = [url];
    var to_check_processed = [];

    var processedUrl = function(result){
        to_check_processed.push(result);
    };

    var buildLinks = function() {
        var page = require('webpage').create();

        page.open(url, function (status) {
            if (status !== 'success') {
                console.log(status);
                console.log('Unable to access network');
            } else {
                // https://groups.google.com/d/msg/phantomjs/lFbKlzn_k-E/bXh6a70HYKEJ
                var links = page.evaluate(function (){
                    var a = [],
                        l = document.getElementsByTagName("a");

                    for (var i=0; i<l.length; i++) {
                        a.push(l[i].href);
                    }
                    return a;
                });

                links = links.filter(function (el) {
                    var link = _(el.toLowerCase());

                    var donot_follow_extensions = ['jpg','jpeg','gif','png','xml','pdf','bmp','iso','zip','rar','gz','tar'];
                    for (var k = donot_follow_extensions.length - 1; k >= 0; k--) {
                        if (link.endsWith(donot_follow_extensions[k]) === true) { 
                            return false; 
                        }
                    }
                    if (link.startsWith('mailto') === true) { 
                        return false; 
                    }
                    
                    return parseURI.parse(el).host === host;
                });

                to_check = (_.take(_.shuffle(links), 10));
                page.close();

                var wait = function(){
                    window.setTimeout(function(){
                        if (to_check.length !== to_check_processed.length) {
                            wait();    
                        } else {
                            callbackFinal(to_check_processed);
                        }
                    }, 500);
                };
                
                to_check.forEach(function(el) {
                    callbackPerUrl(el, processedUrl);
                });
                wait();
            }
        });
    };

    buildLinks();
};

var getCookies = function(url, processedUrlCallback) {
    var page = require('webpage').create();
    page.open(url, function () {

        var result = {};
        result.cookies = [];
        result.url = url;
        
        console.log('-------- ' + url);

        phantom.cookies.forEach(function (cookie) {
            result.cookies.push(cookie);
        });

        page.close();
        processedUrlCallback(result);
    });
};

var showCookies = function (results) {
    var cookie_list = [],
        url_list = [],
        seen_cookies = [];

    results.forEach(function(res) {
        url_list.push(res.url);

        res.cookies.forEach(function (cookie) {
            if (seen_cookies.indexOf(cookie.name) === -1) {
                seen_cookies.push(cookie.name);
                cookie_list.push(cookie);
            }
        });
    });

    var data = {'urls': url_list, 'cookies': cookie_list};

    if (output_file !== undefined) {
        fs.write(output_file, JSON.stringify(data), 'w');
    } else {
        console.log('-------------------');
        cookie_list.forEach(function(cookie) {
            console.log(cookie.name+'('+cookie.domain+') '+cookie.value);
        });
    }

    return phantom.exit();    
};

getRandomUrls(initial_url, getCookies, showCookies);
