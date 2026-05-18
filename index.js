const https = require('https');
const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient(); 

const googleKey1='<Google-Geo-Code-API-key>'; //Geo Code API key
const googleKey2='<Google-Timezone-API-key>'; //Timezone API key
const greet = 'AsSalaam Alaikum';

function PrayTimes(method) { var timeNames = { imsak: 'Imsak', fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', sunset: 'Sunset', maghrib: 'Maghrib', isha: 'Isha', midnight: 'Midnight' }, methods = { MWL: { name: 'Muslim World League', params: { fajr: 18, isha: 17 } }, ISNA: { name: 'Islamic Society of North America (ISNA)', params: { fajr: 15, isha: 15 } }, Egypt: { name: 'Egyptian General Authority of Survey', params: { fajr: 19.5, isha: 17.5 } }, Makkah: { name: 'Umm Al-Qura University, Makkah', params: { fajr: 18.5, isha: '90 min' } }, Karachi: { name: 'University of Islamic Sciences, Karachi', params: { fajr: 18, isha: 18 } }, Tehran: { name: 'Institute of Geophysics, University of Tehran', params: { fajr: 17.7, isha: 14, maghrib: 4.5, midnight: 'Jafari' } }, Jafari: { name: 'Shia Ithna-Ashari, Leva Institute, Qum', params: { fajr: 16, isha: 14, maghrib: 4, midnight: 'Jafari' } } }, defaultParams = { maghrib: '0 min', midnight: 'Standard' }, calcMethod = 'MWL', setting = { imsak: '10 min', dhuhr: '0 min', asr: 'Standard', highLats: 'NightMiddle' }, timeFormat = '24h', timeSuffixes = ['am', 'pm'], invalidTime = '-----', numIterations = 1, offset = {}, lat, lng, elv, timeZone, jDate; var defParams = defaultParams; for (var i in methods) { var params = methods[i].params; for (var j in defParams) if ((typeof(params[j]) == 'undefined')) params[j] = defParams[j]; } calcMethod = methods[method] ? method : calcMethod; params = methods[calcMethod].params; for (var id in params) setting[id] = params[id]; for (i in timeNames) offset[i] = 0; return { setMethod: function(method) { if (methods[method]) { this.adjust(methods[method].params); calcMethod = method; } }, adjust: function(params) { for (var id in params) setting[id] = params[id]; }, tune: function(timeOffsets) { for (var i in timeOffsets) offset[i] = timeOffsets[i]; }, getMethod: function() { return calcMethod; }, getSetting: function() { return setting; }, getOffsets: function() { return offset; }, getDefaults: function() { return methods; }, getTimes: function(date, coords, timezone, dst, format) { lat = 1 * coords[0]; lng = 1 * coords[1]; elv = coords[2] ? 1 * coords[2] : 0; timeFormat = format || timeFormat; if (date.constructor === Date) date = [date.getFullYear(), date.getMonth() + 1, date.getDate()]; if (typeof(timezone) == 'undefined' || timezone == 'auto') timezone = this.getTimeZone(date); if (typeof(dst) == 'undefined' || dst == 'auto') dst = this.getDst(date); timeZone = 1 * timezone + (1 * dst ? 1 : 0); jDate = this.julian(date[0], date[1], date[2]) - lng / (15 * 24); return this.computeTimes(); }, getFormattedTime: function(time, format, suffixes) { if (isNaN(time)) return invalidTime; if (format == 'Float') return time; suffixes = suffixes || timeSuffixes; time = DMath.fixHour(time + 0.5 / 60); var hours = Math.floor(time); var minutes = Math.floor((time - hours) * 60); var suffix = (format == '12h') ? suffixes[hours < 12 ? 0 : 1] : ''; var hour = (format == '24h') ? this.twoDigitsFormat(hours) : ((hours + 12 - 1) % 12 + 1); return hour + ':' + this.twoDigitsFormat(minutes) + (suffix ? ' ' + suffix : ''); }, midDay: function(time) { var eqt = this.sunPosition(jDate + time).equation; var noon = DMath.fixHour(12 - eqt); return noon; }, sunAngleTime: function(angle, time, direction) { var decl = this.sunPosition(jDate + time).declination; var noon = this.midDay(time); var t = 1 / 15 * DMath.arccos((-DMath.sin(angle) - DMath.sin(decl) * DMath.sin(lat)) / (DMath.cos(decl) * DMath.cos(lat))); return noon + (direction == 'ccw' ? -t : t); }, asrTime: function(factor, time) { var decl = this.sunPosition(jDate + time).declination; var angle = -DMath.arccot(factor + DMath.tan(Math.abs(lat - decl))); return this.sunAngleTime(angle, time); }, sunPosition: function(jd) { var D = jd - 2451545.0; var g = DMath.fixAngle(357.529 + 0.98560028 * D); var q = DMath.fixAngle(280.459 + 0.98564736 * D); var L = DMath.fixAngle(q + 1.915 * DMath.sin(g) + 0.020 * DMath.sin(2 * g)); var R = 1.00014 - 0.01671 * DMath.cos(g) - 0.00014 * DMath.cos(2 * g); var e = 23.439 - 0.00000036 * D; var RA = DMath.arctan2(DMath.cos(e) * DMath.sin(L), DMath.cos(L)) / 15; var eqt = q / 15 - DMath.fixHour(RA); var decl = DMath.arcsin(DMath.sin(e) * DMath.sin(L)); return { declination: decl, equation: eqt }; }, julian: function(year, month, day) { if (month <= 2) { year -= 1; month += 12; } var A = Math.floor(year / 100); var B = 2 - A + Math.floor(A / 4); var JD = Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5; return JD; }, computePrayerTimes: function(times) { times = this.dayPortion(times); var params = setting; var imsak = this.sunAngleTime(this.eval(params.imsak), times.imsak, 'ccw'); var fajr = this.sunAngleTime(this.eval(params.fajr), times.fajr, 'ccw'); var sunrise = this.sunAngleTime(this.riseSetAngle(), times.sunrise, 'ccw'); var dhuhr = this.midDay(times.dhuhr); var asr = this.asrTime(this.asrFactor(params.asr), times.asr); var sunset = this.sunAngleTime(this.riseSetAngle(), times.sunset); var maghrib = this.sunAngleTime(this.eval(params.maghrib), times.maghrib); var isha = this.sunAngleTime(this.eval(params.isha), times.isha); return { imsak: imsak, fajr: fajr, sunrise: sunrise, dhuhr: dhuhr, asr: asr, sunset: sunset, maghrib: maghrib, isha: isha }; }, computeTimes: function() { var times = { imsak: 5, fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, maghrib: 18, isha: 18 }; for (var i = 1; i <= numIterations; i++) times = this.computePrayerTimes(times); times = this.adjustTimes(times); times.midnight = (setting.midnight == 'Jafari') ? times.sunset + this.timeDiff(times.sunset, times.fajr) / 2 : times.sunset + this.timeDiff(times.sunset, times.sunrise) / 2; times = this.tuneTimes(times); return this.modifyFormats(times); }, adjustTimes: function(times) { var params = setting; for (var i in times) times[i] += timeZone - lng / 15; if (params.highLats != 'None') times = this.adjustHighLats(times); if (this.isMin(params.imsak)) times.imsak = times.fajr - this.eval(params.imsak) / 60; if (this.isMin(params.maghrib)) times.maghrib = times.sunset + this.eval(params.maghrib) / 60; if (this.isMin(params.isha)) times.isha = times.maghrib + this.eval(params.isha) / 60; times.dhuhr += this.eval(params.dhuhr) / 60; return times; }, asrFactor: function(asrParam) { var factor = { Standard: 1, Hanafi: 2 }[asrParam]; return factor || this.eval(asrParam); }, riseSetAngle: function() { var angle = 0.0347 * Math.sqrt(elv); return 0.833 + angle; }, tuneTimes: function(times) { for (var i in times) times[i] += offset[i] / 60; return times; }, modifyFormats: function(times) { for (var i in times) times[i] = this.getFormattedTime(times[i], timeFormat); return times; }, adjustHighLats: function(times) { var params = setting; var nightTime = this.timeDiff(times.sunset, times.sunrise); times.imsak = this.adjustHLTime(times.imsak, times.sunrise, this.eval(params.imsak), nightTime, 'ccw'); times.fajr = this.adjustHLTime(times.fajr, times.sunrise, this.eval(params.fajr), nightTime, 'ccw'); times.isha = this.adjustHLTime(times.isha, times.sunset, this.eval(params.isha), nightTime); times.maghrib = this.adjustHLTime(times.maghrib, times.sunset, this.eval(params.maghrib), nightTime); return times; }, adjustHLTime: function(time, base, angle, night, direction) { var portion = this.nightPortion(angle, night); var timeDiff = (direction == 'ccw') ? this.timeDiff(time, base) : this.timeDiff(base, time); if (isNaN(time) || timeDiff > portion) time = base + (direction == 'ccw' ? -portion : portion); return time; }, nightPortion: function(angle, night) { var method = setting.highLats; var portion = 1 / 2; if (method == 'AngleBased') portion = 1 / 60 * angle; if (method == 'OneSeventh') portion = 1 / 7; return portion * night; }, dayPortion: function(times) { for (var i in times) times[i] /= 24; return times; }, getTimeZone: function(date) { var year = date[0]; var t1 = this.gmtOffset([year, 0, 1]); var t2 = this.gmtOffset([year, 6, 1]); return Math.min(t1, t2); }, getDst: function(date) { return 1 * (this.gmtOffset(date) != this.getTimeZone(date)); }, gmtOffset: function(date) { var localDate = new Date(date[0], date[1] - 1, date[2], 12, 0, 0, 0); var GMTString = localDate.toGMTString(); var GMTDate = new Date(GMTString.substring(0, GMTString.lastIndexOf(' ') - 1)); var hoursDiff = (localDate - GMTDate) / (1000 * 60 * 60); return hoursDiff; }, eval: function(str) { return 1 * (str + '').split(/[^0-9.+-]/)[0]; }, isMin: function(arg) { return (arg + '').indexOf('min') != -1; }, timeDiff: function(time1, time2) { return DMath.fixHour(time2 - time1); }, twoDigitsFormat: function(num) { return (num < 10) ? '0' + num : num; } } }
var DMath = { dtr: function(d) { return (d * Math.PI) / 180.0; }, rtd: function(r) { return (r * 180.0) / Math.PI; }, sin: function(d) { return Math.sin(this.dtr(d)); }, cos: function(d) { return Math.cos(this.dtr(d)); }, tan: function(d) { return Math.tan(this.dtr(d)); }, arcsin: function(d) { return this.rtd(Math.asin(d)); }, arccos: function(d) { return this.rtd(Math.acos(d)); }, arctan: function(d) { return this.rtd(Math.atan(d)); }, arccot: function(x) { return this.rtd(Math.atan(1 / x)); }, arctan2: function(y, x) { return this.rtd(Math.atan2(y, x)); }, fixAngle: function(a) { return this.fix(a, 360); }, fixHour: function(a) { return this.fix(a, 24); }, fix: function(a, b) { a = a - b * (Math.floor(a / b)); return (a < 0) ? a + b : a; } };
var prayTimes = new PrayTimes();

var PArray = ["fajr","dhuhr","asr","maghrib","isha"],
    PTArray = ["imsak","fajr","sunrise","dhuhr","asr","sunset","maghrib","isha","midnight"],
    calMetArr = ['MWL','ISNA','Egypt','Makkah','Karachi','Tehran','Jafari'],
    asrJurArr = ['Standard', 'Hanafi'], midArr = ['Standard', 'Jafari'];

var Prayers = {}, PTimes = {}, PTS = {}, PnextDayTimes = {}, PTSnextDay = {}, cityTime="", cityDay = '', cityTS = "",
    userZip = '', dateGiven = false, cityGiven = true, dataFound = true, metGiven = 0, prayerType = '', countryCode = '',
    calMethod='', asrJuristic='', midnight='', context = '', fnType = '', SessionEnd = false,
    userAdd="", userLat="", userLng="", usTimeZoneId="", usTimeZoneOff = "", userCity = "", 
    cityAdd="", cityLat="", cityLng="", ciTimeZoneId="", ciTimeZoneOff = "",  outCity = "", locale = '',
    repromptDefault = "";

var getUserData=(obj)=> {
    if(SessionEnd) return;
    
    //console.log('\Obj1='+JSON.stringify(obj));
    
    var params = {TableName: "PrayerTimes", Key:{userid: obj.sys.user.userId, type: "userinfo"}};
                
    docClient.get(params, (err, data) => {
        
        if (err) console.error("Unable to read item. Error JSON:", JSON.stringify(err));
        else {
            console.log('\nDB Info ='+JSON.stringify(data));
            
            if(typeof data.Item=='undefined') {
                dataFound = false;
                calMethod = calMethod || 'ISNA';
                asrJuristic = asrJuristic || 'Standard';
                midnight = midnight || 'Standard';
                
                if(userCity) getGeoData(obj, userCity);
                else getUserCity(obj);
            }    
            else {
                var info = data.Item.info;
                if(fnType=='setPreferences' && userCity) {
                    calMethod = info.method.calMethod; 
                    asrJuristic = info.method.asrjuristic;
                    midnight = info.method.midnight;
                    
                    getGeoData(obj, userCity);
                }    
                else {
                    userCity =  info.location.city;
                    userLat = info.location.lat;
                    userLng = info.location.lng;
                    userAdd = info.location.address;
                    usTimeZoneId = info.location.timeZoneId;
                    usTimeZoneOff = info.location.timeZoneOff;
                    calMethod = calMethod || info.method.calMethod; 
                    asrJuristic = asrJuristic || info.method.asrjuristic;
                    midnight = midnight || info.method.midnight;
                    
                    console.log('\nfnType='+fnType+' || '+ calMethod+' || '+ asrJuristic+' || '+ midnight);
                    //console.log('\Obj2='+JSON.stringify(obj));
                    
                    if(fnType=='setPreferences' && metGiven>0) {
                        console.log('\nGoing to save data');
                        putUserData(obj);
                    }    
                    else {
                        if(outCity && outCity==userCity){
                            cityAdd=userAdd; cityLat=userLat; cityLng=userLng; ciTimeZoneId=usTimeZoneId; ciTimeZoneOff = usTimeZoneOff;
                        }
                        
                        getData(obj);
                    }
                }
            }
        }
    });
};

var putUserData=(obj)=>{
    if(SessionEnd) return;
    
    dataFound = true;
    
    console.log('\nSaving to DB object='+JSON.stringify(obj));
    
    if(!userCity) getPrayerTime(obj); 
    
    var params = {
        TableName: "PrayerTimes",
        Item: {
            userid: obj.sys.user.userId,
            type: "userinfo",
            info:  {
                location: {lat: userLat, lng: userLng, timeZoneOff: usTimeZoneOff, timeZoneId: usTimeZoneId, address: userAdd, city: userCity},
                method: {calMethod: calMethod, asrjuristic: asrJuristic, midnight: midnight}, reminder: {}
            }
        }
    };

    docClient.put(params, (err, data) => {
       if (err) console.error("\nUnable to add data. Error JSON:", JSON.stringify(err, null, 2));
       else {
            console.log("\nUser data add to DB succeeded");
    
            if(fnType=='setPreferences') {
                var resp = "";
                
                if(locale=="de-DE"){
                    var resp2 = `Berechnungsmethode wird zu ${calMethod} geändert`;
                    var resp3 = `School of Thought oder Asar Juristische Methode wurde zu ${asrJuristic} geändert`;
                    var resp4 = `Midnight-Methode wird zu ${midnight} geändert.`;
                    var resp1 = `Standort ist auf ${userAdd} eingestellt`; 
                }else {
                    var resp2 = `Your calculation method has been changed to ${calMethod}`;
                    var resp3 = `Your School of Thought or Asar juristic method has been changed to ${asrJuristic}`;
                    var resp4 = `Your midnight method has been changed to ${midnight}`;
                    var resp1 = `Your location has been set as ${userAdd}`; 
                }
                
                if(metGiven==2) resp = resp2; 
                else if(metGiven==3) resp = resp3;
                else if(metGiven==4) resp = resp4; 
                else resp = resp1; 
                
                resp += repromptDefault;
                speak(resp, null, resp, false);
            }   
            else getData(obj);
       }
    });
};

var getData=(obj) => {
        if(SessionEnd) return;
        
        //console.log('\n getData object ='+JSON.stringify(obj));
        
        console.log("\nfnType="+fnType+" | user city="+userCity+" | other city="+outCity+" | prayerType="+prayerType+" | onDate="+obj.onDate);
    
        //userCity = "Dublin, ca"; //for testing only
        
        if(!userCity) getUserCity(obj);
        else {
                //cityGiven = true;
                if(!userLat) getGeoData(obj, userCity);
                else if(outCity && !cityLat) getGeoData(obj, outCity);
                else if(fnType=='QiblaDirection'){
                    if(outCity) Qibla(cityLat, cityLng, cityAdd);
                    else Qibla(userLat,userLng,userAdd);
                }
                else getPrayerTime(obj);
        }
};

var getUserCity = (obj) =>{
    
    if(typeof obj.sys.device.deviceId=='undefined' || typeof obj.sys.user.permissions=='undefined') {
        if(locale=="de-DE"){
            var resp = 'Sie haben dieser skill keine Erlaubnis erteilt, Ihren Standort zu finden. Ihr Standort wird von diesem skill benötigt, um zu funktionieren. '; 
                resp += 'Sie können entweder alexa mobile application verwenden, um diese skill zu genehmigen, oder Ihren Standort festlegen, indem Sie alexa fragen. '; 
                resp += 'Zum Beispiel, Alexa ändere meinen Standort nach Berlin.';
        }else {
            var resp = 'You have not given permission to this skill to find your location. Your location is required by this skill to work. You can either use alexa';
                resp += ' mobile application to give permission to this skill or set your location by asking alexa. For example, Alexa change my location to Berlin.';
        }
        speak(resp, null, 'No permission', false);
    }
    else { 
        var body="";
        var deviceId = obj.sys.device.deviceId;
        var consentToken = obj.sys.user.permissions.consentToken;
        var endPoint = obj.sys.apiEndpoint.replace('https://','');
        //console.log('\nAlexa End Point='+endPoint);
        
        var options = {
          hostname: endPoint,
          port: 443,
          path: '/v1/devices/'+deviceId+'/settings/address/countryAndPostalCode',
          method: 'GET',
          headers: {'Accept': 'application/json', 'Authorization': 'Bearer '+consentToken}
        };
        
        https.get(options, (response) => {
                response.on('data', (d) => {body += d});
                response.on('end', () => {
                        console.log("\nUser info="+JSON.stringify(body));
                        
                        if(locale=="de-DE"){
                            var resp = 'Sie haben Ihren Standort nicht korrekt in Ihrem Konto eingerichtet. Stellen Sie entweder Ihren Standort korrekt in Ihrem Alexa-Konto ein oder legen Sie ihn fest, ';
                            resp += 'indem Sie Alexa sagen, bitten Sie mein Gebet, meinen Standort in eine bestimmte Stadt zu ändern.';
                            var card = 'Ort nicht gefunden';
                        }else {
                            var resp = 'You have not setup your location correctly in your account. Either set your location correctly in your alexa account or ';
                            resp += 'set it by telling alexa, ask my prayer to change my location to specific city.';
                            var card = 'Location not found';
                        }     
                                
                        if(!body) {
                            speak(resp, null, card, false);
                            return;
                        }    
                        else var json = JSON.parse(body);
                        
                        if(!json.postalCode || json.postalCode==undefined || json.postalCode==0 || !json.countryCode || json.countryCode==undefined){
                            speak(resp, null, card, false);
                            return;
                        }
                        else {
                            userZip = json.postalCode;
                            countryCode = json.countryCode;
                            
                            if(countryCode=='GB' || countryCode=='CA'){
                                userZip = userZip.includes(' ') ? userZip : userZip.substr(0,userZip.length-3)+' '+userZip.substr(-3);
                                userZip = userZip.toUpperCase();
                            }else if (countryCode=='IN'){
                                countryCode = 'India';
                            }
                            
                            userCity = userZip+", "+ countryCode;
                            getGeoData(obj, userCity);
                        }
                });
        });
    }    
};

var getGeoData= (obj, city) => {
            var body='', body2='', time='', pray='', resp='', lat='', lng='', add='', timeZoneOff='', timeZoneId='';
            
            var endpoint = "https://maps.googleapis.com/maps/api/geocode/json?key="+googleKey1+"&address="+city;
            
            https.get(endpoint, (response) => {
                response.on('data', (d) => {body += d});
                response.on('end', () => {
                    
                    console.log('\n Google1 called with city='+city);
                    var json = JSON.parse(body);
                    
                    //console.log(json);
                    
                    if(typeof json.results[0]=='undefined' || typeof json.results[0].geometry=='undefined') {
                        console.log('\nGoogle1='+endpoint);
                        console.log(json);
                        
                        if(locale=='de-DE') resp = 'Etwas ist schief gelaufen. Bitte versuche es erneut.';
                        else resp = 'Something went wrong. Please try again.';
                        speak(resp, null, prayerType, false);
                    }
                     
                    lat = JSON.stringify(json.results[0].geometry.location.lat);
                    lng = JSON.stringify(json.results[0].geometry.location.lng);
                    
                    add = JSON.stringify(json.results[0].formatted_address);
                    add = userZip ? add.replace(userZip,''): add;
                    //add = add.replace(/\d+/g, '');      //remove zipcode and all numbers
                    if(add.trim()=='') add = countryCode;
                    
                    //console.log('\Date='+obj.onDate);
                    var timestamp = (obj.onDate.getTime())/1000;
                    var endpoint2 = "https://maps.googleapis.com/maps/api/timezone/json?key="+googleKey2+"&location="+lat+","+lng+"&timestamp="+timestamp;
                    
                    
                    https.get(endpoint2, (response2) => {
                            response2.on('data', (d) => {body2 += d});
                            response2.on('end', () => {
                                //console.log('\nGoogle2='+endpoint2);
                                console.log('\n Google2 called with lat='+lat+' lng='+lng+' timestamp='+timestamp);
                                var json2 = JSON.parse(body2);
                                //console.log(json2);
                                
                                if(typeof json2.rawOffset=='undefined') {
                                    console.log('\nGoogle2='+endpoint2);
                                    console.log(json2);
                                    
                                    if(locale=='de-DE') resp = 'Etwas ist schief gelaufen. Bitte versuche es erneut.';
                                    else resp = 'Something went wrong. Please try again.';
                                    
                                    speak(resp, null, prayerType, false);
                                }
                                else {
                                    
                                    timeZoneOff = (json2.rawOffset)/3600;
                                    timeZoneId = json2.timeZoneId;
                                    
                                    if(city==userCity) {userAdd=add; userLat=lat; userLng=lng; usTimeZoneId=timeZoneId; usTimeZoneOff=timeZoneOff;}
                                    else if(city==outCity) {cityAdd=add; cityLat=lat; cityLng=lng; ciTimeZoneId=timeZoneId; ciTimeZoneOff=timeZoneOff;}
                                    
                                    if(!dataFound || fnType=='setPreferences') putUserData(obj);
                                    else if(fnType=='QiblaDirection'){
                                        if(outCity) Qibla(cityLat, cityLng, cityAdd);
                                        else Qibla(userLat,userLng,userAdd);
                                    }
                                    else getPrayerTime(obj);
                                }
                        });
                });
              });
            }).on('error', (e) => {console.error(e);});
};


var getPrayerTime= (obj) => {
    
        var resp="", time="", pray="", timeRemain = 0, dst = 0;
        
        var lat= outCity ? cityLat: userLat;
        var lng= outCity ? cityLng: userLng;
        var add= outCity ? cityAdd: userAdd;
        var timeZoneId= outCity ? ciTimeZoneId: usTimeZoneId;
        var timeZoneOff= outCity ? ciTimeZoneOff: usTimeZoneOff;
        
        console.log('\nLat='+lat+' lng='+lng+' add='+add+' timeZoneId='+timeZoneId+' timeZoneOff='+timeZoneOff);
        
        var dd = new Date();
        cityTime = dd.toLocaleString('en-US', {hour:'2-digit', minute:'2-digit', hour12: false, timeZone: timeZoneId });
        
        var date = obj.onDate.toDateString();
        
        if(dateGiven){
            cityDay = (date.split(' '))[0];
        }else {
            cityDay = dd.toLocaleString('en-US', {weekday: 'short', timeZone: timeZoneId });
        }
        
        //console.log('\ncity Day='+cityDay);
        
        dst = obj.onDate.dst(timeZoneId) ? 1:0;
        //console.log('\nDate='+obj.onDate+' | Daylight saving calculated='+ dst);
        
        var tomorrow = new Date();
        tomorrow.setDate(obj.onDate.getDate()+1);
        
        calMethod =  calMethod || 'ISNA';
        asrJuristic = asrJuristic || 'Standard';
        midnight = midnight || 'Standard';
        
        //cityTime = "09:00"; //for testing prayer end time
        console.log('\ncalMethod='+calMethod+' asrJuristic='+asrJuristic+' midnight='+midnight);
        
        prayTimes.setMethod(calMethod);
        prayTimes.adjust({asr:asrJuristic, maghrib:'3 min', midnight:midnight});
        PTimes = prayTimes.getTimes(obj.onDate, [lat, lng], timeZoneOff, dst, "24h");
        PnextDayTimes = prayTimes.getTimes(tomorrow, [lat, lng], timeZoneOff, dst, "24h");
        
        Prayers = {fajr:PTimes.fajr, dhuhr:PTimes.dhuhr, asr:PTimes.asr, maghrib:PTimes.maghrib, isha:PTimes.isha}; 
        
        for (var key in PTimes) {PTS[key] = giveTimestamp(PTimes[key]);}
        for (var key in PnextDayTimes) {PTSnextDay[key] = giveTimestamp(PnextDayTimes[key]);}
        cityTS = giveTimestamp(cityTime);
        
        console.log("\nCity Time="+cityTime);
        console.log('\nPrayers='+JSON.stringify(PTimes));
        //console.log('\nPrayers TimeStamp='+JSON.stringify(PTS));
        
        if(fnType=="PrayerTimeEnds"){
			if(    (PTS.midnight > PTS.isha && cityTS > PTS.isha && cityTS <= PTS.midnight) 
			    || (PTS.midnight < PTS.fajr && cityTS > PTS.isha)
			    || (PTS.midnight < PTS.fajr && cityTS <= PTS.midnight)) 
			{
                pray = 'Isha';
                
                time = (parseInt(cityTime)<10) ? PTimes.midnight : PnextDayTimes.midnight;
                
                if(locale=='de-DE') resp = `${pray} Gebetszeit endet um ${fmt12(time)}`;
                else resp = `${pray} prayer time will end at ${fmt12(time)}`;
                
                time = (parseInt(time)<10) ? "-"+time : time;
                cityTime = (parseInt(cityTime)<10) ? "-"+cityTime : cityTime;
                
                timeRemain = timeDiff(cityTime, time);
                resp += ` in ${timeRemain}`;
            }
            else if(   (PTS.midnight > PTS.isha && cityTS > PTS.midnight) 
            		|| (PTS.midnight > PTS.isha && cityTS < PTS.fajr) 
            		|| (PTS.midnight < PTS.fajr && cityTS > PTS.midnight && cityTS < PTS.fajr)) 
            {
                pray = 'Fajr';
                time = (parseInt(cityTime)<10) ? PTimes.fajr : PnextDayTimes.fajr;
                time = (parseInt(time)<10) ? "-"+time : time;
                cityTime = (parseInt(cityTime)<10) ? "-"+cityTime : cityTime;
                
                timeRemain = timeDiff(cityTime, time); 
                
                if(locale=='de-DE') resp = `${pray} Gebetszeit hat noch nicht begonnen. Es beginnt um ${fmt12(PTimes.fajr)} in ${timeRemain}`;
                else resp = `${pray} prayer time has not started yet. It will start at ${fmt12(PTimes.fajr)} in ${timeRemain}`;
            }
            else if(cityTS > PTS.sunrise && cityTS < PTS.dhuhr) {
                pray = (cityDay=='Fri')? 'Juma':'Dhuhr';
                timeRemain = timeDiff(cityTime, PTimes.dhuhr); 
                
                if(locale=='de-DE') resp = `${pray} Gebetszeit hat noch nicht begonnen. Es beginnt um ${fmt12(PTimes.dhuhr)} in ${timeRemain}`;
                else resp = `${pray} prayer time has not started yet. It will start at ${fmt12(PTimes.dhuhr)} in ${timeRemain}`;
            }
            else {
                for (var key in PTimes) {
                    if (PTS[key] > cityTS) {
                        
                        if(key=='fajr' || key=='sunrise') pray = 'fajr';
                        else if(key=='asr') pray = 'dhuhr'; 
                        else if(key=='sunset' || key=='maghrib') pray = 'asr';
                        else if(key=='isha') pray = 'maghrib';
                        
                        time = PTimes[key];
                        timeRemain = timeDiff(cityTime, time);
                        pray =  reSoundAlike(pray);
                        
                        if(locale=='de-DE') resp = `${pray} Gebetszeit endet in ${timeRemain}`;
                        else resp = `${pray} prayer time ends in ${timeRemain}`;
                        break;
                    }
                }
            }
            prayerType = pray;    
        }
        else if(fnType=="GetPrayerTime" || prayerType=='') {
            prayerType = findNextPrayer();
            time = fmt12(Prayers[prayerType]);
            pray = reSoundAlike(prayerType);
            
            if(locale=='de-DE') resp = `${pray} Gebetszeit beginnt um ${time}`;
            else resp = `${pray} prayer time starts at ${time}`;
        }
        else if(!resp && PTArray.indexOf(prayerType) >= 0) {
            time = fmt12(PTimes[prayerType]);
            pray = reSoundAlike(prayerType);
            
            if(PArray.indexOf(prayerType)>=0) {
                if(locale=='de-DE') resp = `${pray} Gebetszeit beginnt um ${time}`;
                else resp = `${pray} prayer time starts at ${time}`;
            }    
            else {
                if(locale=='de-DE') resp = `${pray} Zeit ist um ${time}`;
                else resp = `${pray} time is at ${time}`;
            }    
        }
        
        if(resp) {
            resp = cityGiven ? resp+` in ${add}`:resp;
            resp = dateGiven ? resp+ ((locale=='de-DE')? ' auf': ' on') + ` ${date}`:resp;
            
            resp += repromptDefault;
            speak(resp, null, prayerType, false);
        }
        else notFound(prayerType);
};


exports.handler = (event, cont) => {
    
    context = cont;
    
    //reset global variable again, so that data is not persistance across the sessions.
    Prayers={}; PTimes={}; PTS={}; PnextDayTimes={}; PTSnextDay={}; cityTime=''; cityTS=''; fnType=''; dateGiven=false; metGiven=0;
    cityGiven=true; dataFound=true; userAdd=''; userLat=''; userLng=''; usTimeZoneId=''; usTimeZoneOff=''; cityDay = ''; countryCode = '';
    cityAdd=""; cityLat=""; cityLng=""; ciTimeZoneId=""; ciTimeZoneOff=""; outCity=""; userCity=""; userZip = "";
    calMethod=''; asrJuristic=''; midnight=''; SessionEnd = false; prayerType = ''; locale = ''; repromptDefault = '';
    
    try {

        if (event.session.new) {
          // New Session
          console.log("NEW SESSION");
        }
        locale = event.request.locale;
        
        if(locale=="de-DE") repromptDefault = " ... Kann ich dir mit etwas anderem helfen?";
        else repromptDefault = " ... Is there anything else I can help you with?";
        
        switch (event.request.type) {

            case "LaunchRequest":
                console.log('\nLocale='+locale);
                getWelcome();
                break;
    
            case "IntentRequest":
            
                var intent = event.request.intent;
                var system = event.context.System;
                fnType = intent.name;
                
                console.log('\nEvent='+JSON.stringify(event));
                
                if (intent.slots==undefined || intent.slots.onDate==undefined || intent.slots.onDate.value==undefined) var onDate=new Date();
                else {
                    var onDate=new Date(intent.slots.onDate.value+" 00:00:00");
                    dateGiven = true;
                } 
                
                if(intent.slots==undefined || intent.slots.prayerType==undefined || intent.slots.prayerType.value==undefined) prayerType="";
                else {
                    var pv = intent.slots.prayerType;
                    prayerType = soundAlike(pv.value);
                    
                    if(PTArray.indexOf(prayerType)<0) {
                        if(pv.resolutions){
                            var res =  pv.resolutions.resolutionsPerAuthority;
                            if(res[0].status.code=='ER_SUCCESS_MATCH'){
                                var vs = res[0].values[0].value.name;
                                console.log('\nPrayer possible Values='+vs);
                                prayerType = soundAlike(vs);
                            }
                        }
                        
                        if(PTArray.indexOf(prayerType)<0) notFound(prayerType);
                    }     
                }
                
                if(prayerType) console.log('\nPrayerType='+prayerType);
                
                var iObj = {sys:system, onDate:onDate};
                
                switch(intent.name) {
                    
                    case "GetPrayerTime":
                        getUserData(iObj);
                        break;
        
                    case "GetPrayerTimeByTime":
                        getUserData(iObj);
                        break;
        
                    case "GetPrayerTimeByCity":
                        outCity = intent.slots.City.value;
                        getUserData(iObj);
                        break;
                        
                    case "PrayerTimeEnds":
                        outCity = intent.slots.City.value;
                        getUserData(iObj);
                        break;
                        
                    case "setPreferences":
                        userCity = intent.slots.City.value;
                        if(userCity) metGiven = 1;
                        
                        var cal = intent.slots.calMethod;
                        var asr = intent.slots.asrJuristic;
                        var mid = intent.slots.midnight;
                        
                        if(cal.value) {calMethod = possibleValues(cal, calMetArr, calNotFound); if(!calMethod) break;else metGiven=2;}
                        else if (asr.value) {asrJuristic = possibleValues(asr, asrJurArr, asrNotFound); if(!asrJuristic) break;else metGiven=3;}
                        else if (mid.value) {midnight = possibleValues(mid, midArr, midNotFound); if(!midnight) break;else metGiven=4;}
                        else if(!userCity && !cal.value && !asr.value && !mid.value) {
                            
                            if(locale=='de-DE') var resp = 'Nicht sicher, was du gesagt hast. Bitte versuche es erneut';
                            else var resp = 'Not sure what you said. Please try again';
                            
                            speak(resp, null, "Not found", false);
                            break;
                        }
                        
                        getUserData(iObj);
                        break;
                    
                     case "QiblaDirection":
                        outCity = intent.slots.City.value;
                        getUserData(iObj);
                        break;
                        
                    case "AMAZON.HelpIntent":
                        getWelcome();
                        break;
                        
                    case "AMAZON.StopIntent":
                        //if(locale=='de-DE') var resp = 'Auf Wiedersehen'; else var resp = greet;
                        speak(greet, null, resp, true);
                        break;
                        
                    case "AMAZON.CancelIntent":
                        //if(locale=='de-DE') var resp = 'Auf Wiedersehen'; else var resp = greet;
                        speak(greet, null, resp, true);
                        break;
                    
                    case "AMAZON.PreviousIntent":
                        //if(locale=='de-DE') var resp = 'Auf Wiedersehen'; else var resp = greet;
                        speak(greet, null, resp, true);
                        break;
                        
                    default:
                        throw "Invalid intent";
                }
    
                break;
    
            case "SessionEndedRequest":
                // Session Ended Request
                console.log(`SESSION ENDED REQUEST`);
                break;
    
            default:
                context.fail(`INVALID REQUEST TYPE: ${event.request.type}`);
        }
    } 
    catch(error) { context.fail(`Exception: ${error}`) }
};


var possibleValues = (v, arr, fn) => {
    var val = calSoundLike(v.value);
    
    if(arr.indexOf(val)>=0) return val;
    else {
        if(v.resolutions){
            var res =  v.resolutions.resolutionsPerAuthority;
            if(res[0].status.code=='ER_SUCCESS_MATCH'){
                var vs = res[0].values[0].value.name;
                console.log('\nPossible Values='+vs);
                val = calSoundLike(vs);
            }
        }
        
        if(arr.indexOf(val)>=0) return val;
        else {fn(v.value); return '';}
    }   
};

var calSoundLike = (sound) => {
    if(sound)  sound = (sound.toLowerCase()).trim();
    else return '';
    
    var mwl = ['mwl', 'm w l', 'muslim world league', 'mw l', 'm wl'];
    var isna = ['isna', 'i s n a', 'islamic society of north america', 'is now', 'i sna', 'is na', 'isn a',];
    var egypt = ['egypt', 'egyptian', 'egyptian general suthority of survey'];
    var makkah = ['makkah', 'mecca', 'umm al qura university', 'my car', 'maca', 'macau'];
    var karachi = ['karachi', 'university of islamic sciences', 'university of islamic sciences karachi'];
    var tehran = ['tehran', 'on', 'duran', 'institute of geophysics', 'university of tehran'];
    var jafari = ['jafari', 'shia', 'ithna', 'ashari', 'joffrey', 'geoffrey', 'shia ithna ashari', 'shea', 'defari', 'jeopardy'];
    var hanafi = ['hanafi', 'and fi', 'on fi', 'onavie', 'hana fi'];
    var standard = ['standard', 'shafi', 'maliki', 'hanbali', 'hambali'];
    
    if(mwl.indexOf(sound)>=0 || sound.startsWith('muslim')) return 'MWL';
    else if(isna.indexOf(sound)>=0 || sound.charAt(0)=='i') return 'ISNA';
    else if(egypt.indexOf(sound)>=0) return 'Egypt';
    else if(makkah.indexOf(sound)>=0) return 'Makkah';
    else if(karachi.indexOf(sound)>=0 || sound.charAt(0)=='k') return 'Karachi';
    else if(tehran.indexOf(sound)>=0 || sound.charAt(0)=='t') return 'Tehran';
    else if(jafari.indexOf(sound)>=0 || sound.charAt(0)=='j' || sound.charAt(0)=='g') return 'Jafari';
    else if(hanafi.indexOf(sound)>=0 || sound.charAt(0)=='h' || sound.substr(-3)==' fi') return 'Hanafi';
    else if(standard.indexOf(sound)>=0) return 'Standard';
    else return sound;
};

var soundAlike = (sound) => {

    if(sound)  sound = (sound.toLowerCase()).trim();
    else return '';
    
    var fajrSounds = ['fajr', 'fajar', 'joke', 'there', 'hi', 'father', 'giraffe', 'for', 'other', 'forager', 'forger', 'find', 'pfizer', 'pledger'];
    var zoharSounds = ['dhuhr', 'do her', 'dhuhar', 'duhur', 'zohar', 'zuhar', 'go hire', 'do', 'super', 'uber', 'go', 'door', 'her', 'go her', 'juma', 'july', 'jumah', 'jamar', 'over'];
    var asrSounds = ['asar', 'asr', 'as', 'ask', 'at', 'say', 'also', 'usher', 'surf', 'search', 'summer', 'us', 'asia', 'sun', 'oscar', 'solar'];
    var magribSounds = ['magrib', 'maghrib', 'margarita', 'madrid', 'mother', 'marie', 'many', 'more', 'greek', 'makeit', 'maverick', 'man', 'my', 'marbury', 'mockery', 'mobile', 'market'];
    var ishaSounds = ['into', 'isha', 'she', 'disher', 'shuffle', 'sh', 'issue', 'show', 'shop', 'shh', 'eshop', 'shot', 'easter', 'cha', 'ishah', 'it'];
    //var imsakSounds = ['imsak','im suck', 'him', 'suck', 'some', 'stock', 'him sock', 'him suck', 'in suck', 'in insoc'];

    if(fajrSounds.indexOf(sound)>=0 || sound.charAt(0)=='f') return 'fajr';
    else if(zoharSounds.indexOf(sound)>=0 || sound.charAt(0)=='d' || sound.charAt(0)=='j') return 'dhuhr';
    else if(asrSounds.indexOf(sound)>=0 || sound.charAt(0)=='a' || sound.charAt(0)=='u') return 'asr';
    else if(magribSounds.indexOf(sound)>=0 || sound.charAt(0)=='m') return 'maghrib';
    else if(ishaSounds.indexOf(sound)>=0 || sound.charAt(0)=='i') return 'isha';
    //else if(imsakSounds.indexOf(sound)>=0) return 'imsak';
    else if(sound=='sonnenaufgang') return 'sunrise';
    else if(sound=='sonnenuntergang') return 'sunset';
    else return sound;
};

var getWelcome = () => {
        if(locale=="de-DE"){
            var speechText  = "Willkommen bei Islamic prayer times. Dies ist eine Alexa Skill, um Salah oder Gebetszeit zu finden. Sie können sagen, Alexa fragen mein Gebet, wann ist das nächste Gebet."; 
            speechText += " Oder wann ist heute das Isha-Gebet ... oder wie lange vor dem nächsten Gebet ... oder wann ist das nächste Gebet in Berlin?...";
            speechText += " Nun, wie kann ich dir helfen?";
        
            var repromptText = "Sie können sagen, wann das nächste Gebet ist. Oder wann ist heute Isha-Gebet? oder du kannst sagen Exit ... Nun, womit kann ich dir helfen?";
            var header = "Willkommen zu meinem Gebet !";
        }else {
            var speechText  = "Welcome to Islamic prayer times, This is an Alexa Skill to find Salah or Prayer time. You can say, Alexa ask my prayer, when is the next prayer."; 
            speechText += " Or when is isha prayer today?.. or how long before next prayer starts?.. or when is the next prayer in New York?...";
            speechText += " Now, what can I help you with?";
        
            var repromptText = "You can say, when is the next prayer. Or when is isha prayer today. or you can say exit... Now, what can I help you with?";
            var header = "Welcome to My Prayer !";
        }
        
        speechText = greet + " ! " + speechText;
        
        speak(speechText, repromptText, header, false);
};

var notFound = (prayer) => {
    if(locale=="de-DE"){
        var resp = `Gebetstyp ${prayer} nicht gefunden. Sie können es erneut versuchen. Nun, wie kann ich dir helfen?`;
        var repromptText = "Sie können fragen, wann ist das nächste Gebet, oder wann ist das Isha Gebet heute, oder sagen Sie exit. Nun, wie kann ich dir helfen?";
        var card = "Gebet nicht gefunden";
    }    
    else {
        var resp = `Prayer type ${prayer} not found. You can try again. Now, what can I help you with?`;
        var repromptText = "You can say, when is the next prayer. Or when is isha prayer today. or you can say exit. Now, what can I help you with?";
        var card = "Prayer not found";
    }
    speak(resp, repromptText, card, false);
};

var calNotFound = (met) => {
    if(locale=="de-DE"){
        var resp = `Berechnungsmethode Typ ${met} nicht gefunden. Sie können es erneut versuchen. Nun, womit kann ich Ihnen helfen?`;
        var repromptText = "Sie können sagen, die Berechnungsmethode auf ISNA setzen. Oder legen Sie die Berechnungsmethode auf MWL fest. oder Sie können exit sagen. Nun, womit kann ich Ihnen helfen?";
        var card = "Berechnungsmethode nicht gefunden";
    }else {
        var resp = `Calculation method type ${met} not found. You can try again...Now, what can I help you with?`;
        var repromptText = "You can say, set calculation method to ISNA. Or set calculation method to MWL. or you can say exit... Now, what can I help you with?";
        var card = "Calculation method not found";
    }
    
    speak(resp, repromptText, card, false);
};

var asrNotFound = (asr) => {
    if(locale=="de-DE"){
        var resp = `Ihre Denkschule oder Asar-Berechnungsmethode ${asr} wurde nicht gefunden. Sie können es erneut versuchen. Nun, wie kann ich dir helfen?`;
        var repromptText = "Du kannst sagen, ändere meine Schule zu Standard. Oder ändere meine Schule zu Hanafi. Oder Sie können sagen, verlassen. Nun, womit kann ich Ihnen helfen?";
        var card = "Ihre Schule des Denkens für Asar Juristische Methode nicht gefunden";
    }else {
        var resp = `Your school of thought or Asar calculation method type ${asr} not found. You can try again. Now, what can I help you with?`;
        var repromptText = "You can say, change my school to standard. Or change my school to Hanafi. Or you can say, exit. Well, how can I help you?";
        var card = "Your School of thought for Asar Juristic method not found";
    }
    
    speak(resp, repromptText, card, false);
};

var midNotFound = (mid) => {
    if(locale=="de-DE"){
        var resp = `Mitternacht Methodentyp ${mid} nicht gefunden. Sie können es erneut versuchen. Nun, womit kann ich Ihnen helfen?`;
        var repromptText = "Sie können sagen, ändern Sie Mitternacht-Methode zu Standard. Oder stelle die Mitternachtsmethode auf Jafari ein. oder Sie können sagen, verlassen. Nun, womit kann ich Ihnen helfen?";
        var card = "Mitternachtsmethode nicht gefunden";
    }else {
        var resp = `Midnight method type ${mid} not found. You can try again. Now, what can I help you with?`;
        var repromptText = "You can say, set midnight method to Standard. Or set midnight method to Jafari. or you can say exit. Now, what can I help you with?";
        var card = "Midnight method not found";
    }   
    
    speak(resp, repromptText, card, false);
};

var speak = (res, reprompt, card, end) => {
    if(SessionEnd) return;else SessionEnd = true;
    
    console.log("\n"+res);
    reprompt = reprompt ? reprompt : repromptDefault;
    context.succeed(buildSpeechletResponse(res, reprompt, card, end));
};

var buildSpeechletResponse = (outputText, repromptText, card, shouldEndSession) => {
    if(card=='') card = outputText;

    var resObj =  {
                      "version": "1.0",
                      "sessionAttributes": {},
                      "response": {
                        "outputSpeech": {
                          "type": "PlainText",
                          "text": outputText,
                          "playBehavior": "REPLACE_ENQUEUED"      
                        },
                        "card": {
                          "type": "Standard",
                          "title": card,
                          "text": outputText,
                          "image": {
                            "smallImageUrl": "https://simple.wikipedia.org/wiki/Islam#/media/File:Kaaba_mirror_edit_jj.jpg",
                            "largeImageUrl": "https://en.wikipedia.org/wiki/Islam#/media/File:The_Kaaba_during_Hajj.jpg"
                          }
                        },
                        "shouldEndSession": shouldEndSession
                      }
                    };
    
    if(repromptText) resObj.response.reprompt = {
                                                    "outputSpeech": {
                                                        "type": "PlainText",
                                                        "text": repromptText,
                                                        "playBehavior": "REPLACE_ENQUEUED"
                                                    }
                                                };
    return resObj;
};

var fmt12 = (time) => {
    var hms = time.split(':'),
        h = +hms[0],
        suffix = (h < 12) ? ' am' : ' pm';
    hms[0] = h % 12 || 12;        
    return hms.join(':') + suffix;
};

var giveTimestamp=(t)=>{
    return new Date("1/1/70 "+t).getTime();
};

var timeDiff= (t1,t2)=>{
    var x = (t1.charAt(0)=='-') ? (t1).substring(1) : t1;
    var y = (t2.charAt(0)=='-') ? (t2).substring(1) : t2;
    var s = new Date("1/2/70 00:00").getTime();
    var a = new Date("1/1/70 "+x).getTime();
    var b = new Date("1/1/70 "+y).getTime();

    if ((t1.charAt(0)!='-' && t2.charAt(0)!='-') || (t1.charAt(0)=='-' && t2.charAt(0)=='-')) var diff = b - a;
    else if (t1.charAt(0)!='-' && t2.charAt(0)=='-') var diff = (s-a) + b;
    else if (t1.charAt(0)=='-' && t2.charAt(0)!='-') var diff = (-1)*(a + (s-b));
    
    if(diff <= 0) return 0;
    else {
        var hh = Math.floor(diff / 1000 / 60 / 60);
        diff -= hh * 1000 * 60 * 60;
        var mm = Math.floor(diff / 1000 / 60);
        
        if(locale=='de-DE'){
            if(hh>0) return hh+' Stunde' + ((hh>1)?'n':'')+' and '+mm+' Minute'+((mm>1)?'n':'');
            else return mm+' Minute'+((mm>1)?'n':'');
        }else {
            if(hh>0) return hh+' hour' + ((hh>1)?'s':'')+' and '+mm+' minute'+((mm>1)?'s':'');
            else return mm+' minute'+((mm>1)?'s':'');
        }
    }
};

var reSoundAlike = (pray) => {
    if(pray=="dhuhr" && cityDay=='Fri') return 'Juma';
    else if(pray=="dhuhr" && cityDay!='Fri') return 'Dhuhr';
    else if(pray=="asr") return 'Asar';
    else if(pray=="maghrib") return 'Magrib';
    else if(locale=="de-DE" && pray=="sunset") return 'Sonnenuntergang';
    else if(locale=="de-DE" && pray=="sunrise") return 'Sonnenaufgang';
    else return pray;
};

var findNextPrayer = () => {
    if(cityTS > PTS.isha || cityTS <= PTS.fajr) {
        return 'fajr';
    }
    else {
        for (var key in Prayers) {
            if (PTS[key] > cityTS) {
                return key;
            }    
        }
    }  
};

if (Number.prototype.toRadians === undefined) {
    Number.prototype.toRadians = function() { return this * Math.PI / 180; };
}

/** Extend Number object with method to convert radians to numeric (signed) degrees */
if (Number.prototype.toDegrees === undefined) {
    Number.prototype.toDegrees = function() { return this * 180 / Math.PI; };
}


var Qibla = (lat, lon, add) => {
	//var lat1 = 37.709901, lon1 = -121.864118;
	
	var lat1 = Number(lat), lon1 = Number(lon);
	var lat2 = 21.422483, lon2 = 39.826170; //Kaaba geo
	
	var φ1 = lat1.toRadians(), φ2 = lat2.toRadians(), λ1 = lon1.toRadians(), λ2 = lon2.toRadians();
    var y = Math.sin(λ2-λ1) * Math.cos(φ2);
	var x = Math.cos(φ1)*Math.sin(φ2) -Math.sin(φ1)*Math.cos(φ2)*Math.cos(λ2-λ1);
    var θ = Math.atan2(y, x);
    
    var deg = (θ.toDegrees()+360) % 360;    // normalise -ve values to 180°..360°
    var brng = deg.toFixed();
        brng = brng.replace('360', '0');  // just in case rounding took us up to 360°!
        
    var card = compassPoint(brng,2);
    
    if(locale=="de-DE") var dir = 'Qibla liegt '+card+' von '+add;
    else var dir = 'Qibla is located at '+card+' of '+add;
    
    speak(dir, null, card, false);
};

var compassPoint = (bearing, precision) => {
     if (precision === undefined) precision = 3;
    bearing = ((bearing%360)+360)%360; // normalise to range 0..360°
    
    var cardinals = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW' ];
    var cdArr = {'N':'North', 'NNE':'North northeast', 'NE':'Northeast', 'ENE':'East northeast', 'E':'East', 'ESE':'East southeast', 'SE':'Southeast', 'SSE':'South southeast', 'S':'South', 'SSW':'South southwest', 'SW':'Southwest', 'WSW':'West southwest', 'W':'West', 'WNW':'West northwest', 'NW':'Northwest', 'NNW':'North northwest'};
    var cdArrDe = { 'N':'Norden', 'NNE':'Nord Nordost', 'NE':'Nordost', 'ENE':'Ost Nordost', 'E':'Osten', 'ESE':'Ost Südost', 'SE':'Südost', 'SSE':'Süd Südosten', 'S':'Süden', 'SSW':'Süd Südwesten', 'SW':'Südwesten', 'WSW':'West Südwesten', 'W':'Westen', 'WNW':'West Nordwesten', 'NW':'Nordwest', 'NNW':'Nord Nordwesten'};


    var n = 4 * Math.pow(2, precision-1); // no of compass points at req’d precision (1=>4, 2=>8, 3=>16)
    var cardinal = cardinals[Math.round(bearing*n/360)%n * 16/n];
	
	if(locale=="de-DE") {
	    var dir = bearing+' Grad nördlich';
        dir += (cardinal!='N') ? ' bis '+cdArrDe[cardinal] : '';
	}else {
	    var dir = bearing+' degrees North';
        dir += (cardinal!='N') ? ' to '+cdArr[cardinal] : '';
	}
    
    return dir;
};

Date.prototype.dst = function(tz) {
    var jan = new Date(Date.UTC(this.getFullYear(), 0, 1, this.getHours(), this.getMinutes(), this.getSeconds()));
    var jn = jan.toLocaleString('en-US', {hour:'2-digit', minute:'2-digit', hour12: false, timeZone: tz});
    var a = jn.split(':');
    var n = parseInt(a[0])+parseInt(a[1])*60;
    
    var jul = new Date(Date.UTC(this.getFullYear(), 6, 1, this.getHours(), this.getMinutes(), this.getSeconds()));
    var jl = jul.toLocaleString('en-US', {hour:'2-digit', minute:'2-digit', hour12: false, timeZone: tz});
    var b = jl.split(':');
    var m = parseInt(b[0])+parseInt(b[1])*60;
    
    var now = new Date(Date.UTC(this.getFullYear(), this.getMonth(), this.getDate(), this.getHours(), this.getMinutes(), this.getSeconds()));
    var nw = now.toLocaleString('en-US', {hour:'2-digit', minute:'2-digit', hour12: false, timeZone: tz});
    var c = nw.split(':');
    var o = parseInt(c[0])+parseInt(c[1])*60;
    
    var min = Math.min(n, m);
    
    return min < o;
};
