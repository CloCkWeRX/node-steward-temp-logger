#!/usr/bin/env node

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"

var util = require("util");
var WebSocket = require('ws');
var Forecast = require('forecast.io');
var sqlite3 = require('sqlite3').verbose();
var fs = require('fs');
var config = require('./config.js');
var ws_console = new WebSocket('ws://' + config.host + ':8887/console');


// https://api.forecast.io/forecast/053099b89f5af1170d940ff4a4d1a20f/-34.849482,138.521756
function as_celcius(temp) {
  return 5/9 * (temp - 32);
}

function notify_humans(text) {
  var ws_manage = new WebSocket('ws://' + config.host + ':8887/manage');

  
  ws_manage.onopen = function(event) {
    console.log("Opened websocket to steward.");
    
    var json = JSON.stringify({ path      :'/api/v1/actor/perform/device/indicator/nma/text', 
                                requestID :'1', 
                                perform   : 'growl',
                                parameter : JSON.stringify({message: text, priority: 'notice'})
                              });
      ws_manage.send(json);

    };

  ws_manage.onmessage = function(event) {
      console.log("Socket message: " + event.data);
    ws_manage.close(); 
    };

    ws_manage.onclose = function(event) {
      console.log("Socket closed: " + event.wasClean );
    };

    ws_manage.onerror = function(event) {
      console.log("Socket error: " + util.inspect(event, { depth: null}));
      try { 
      ws_manage.close(); 
      console.log("Closed websocket.");
    } catch (ex) {}
  };

}

var options = {
  APIKey: config.key,
  requestTimeout: 1000
},
forecast = new Forecast(options);



var db = new sqlite3.Database('temperature.sqlite3');

db.run("CREATE TABLE IF NOT EXISTS climate_history (id INTEGER PRIMARY KEY, temperature NUMERIC,     goalTemperature NUMERIC,     name VARCHAR(255),     device_id VARCHAR(255), updated_at INTEGER)");


console.log("Created websocket.");

ws_console.onopen = function(event) {
	console.log("Opened websocket to steward.");

};

ws_console.onmessage = function(event) {
  var content = JSON.parse(event.data);
	var str = JSON.stringify(content, null, 2);
  if (content[".updates"] === undefined) {
    return;
  }

  var stmt = db.prepare("INSERT INTO climate_history(temperature, goalTemperature, name, device_id, updated_at) VALUES (?, ?, ?, ?, ?)");
  content[".updates"].forEach(function (update) {
    // TODO Make more generic for any device/climate
    if (update["whatami"] == '/device/climate/samsung/control') {
      db.serialize(function () {
        // Update everything
        stmt.run(update.info.temperature, update.info.goalTemperature, update.name, update.whoami, update.updated);
        // db.all("SELECT rowid AS id, temperature, updated_at FROM climate_history WHERE device_id = '" + update.whoami + '"', function(err, rows) {
        // db.all("SELECT rowid AS id, temperature, updated_at FROM climate_history", function(err, rows) {          
          db.all("SELECT * FROM climate_history WHERE name = '" + update.name + "' ORDER BY updated_at DESC", function(err, rows) {

          if (rows.length < 2) {
            return;
          }

          // First, determine the trend. Sort of. Lazily. Assuming the data is reguarly collected.
          if (rows[0].temperature > rows[1].temperature) {
            notify_humans("Rising from " + rows[1].temperature + " to " + rows[0].temperature);
          }

          if (rows[0].temperature == rows[1].temperature) {
            // notify_humans("Steady at " + rows[0].temperature);
          }

          if (rows[0].temperature < rows[1].temperature) {
            notify_humans("Falling from " + rows[1].temperature + " to " + rows[0].temperature);
          }

          // TODO This should probably push into steward via the simple reporting protocol majigger
          forecast.get(config.lat, config.lon, function (err, res, data) {
            if (err) throw err;
            var outside_temperature = as_celcius(data.currently.temperature);
            if (rows[0].temperature > outside_temperature) {
              notify_humans("It's cooler outside: " + outside_temperature);
            }
            if (rows[0].temperature == outside_temperature) {
              console.log("It's the same outside: " + outside_temperature);
            }            
            if (rows[0].temperature < outside_temperature) {
              notify_humans("It's warmer outside: " + outside_temperature);
            }
          });


          // Then render a temperature chart
          var temps = [];
          rows.forEach(function (row) {
            temps.push(row.temperature);
          });

          console.log('https://chart.googleapis.com/chart?cht=lc&chs=200x100&chd=t:' + temps.join(",") + '&chxt=y&chds=a');
          //



        });
      });


    }
    
  });
  

};

ws_console.onclose = function(event) {
	console.log("Socket closed: " + event.wasClean );
  db.close();
};

ws_console.onerror = function(event) {
	console.log("Socket error: " + util.inspect(event, {depth: null}));
    try { 
		ws.close (); 
		console.log("Closed websocket.");
	} catch (ex) {}
};
