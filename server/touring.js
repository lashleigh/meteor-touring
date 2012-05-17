// Trip -- {title: String}
Trips = new Meteor.Collection('trips');

Meteor.publish('trips', function() {
  return Trips.find();
});

// Day -- {stop: String,
//         lat:  Float,
//         lng:  Float,
//         order: Integer,
//         polyline: String,
//         waypoints: [{lat:Float, lng:Float}, ...],
//         trip_id: String,
//         created_at: Integer,
//         updated_at: Integer}

Days = new Meteor.Collection('days');

Meteor.publish('days', function(trip_id) {
  return Days.find({trip_id: trip_id});
});

Meteor.methods({
  auth: function(provider) {
    console.log(provider);
    return 'no auth yet, sorry';
  }, 
  reset: function() {
    Trips.remove({});
    Days.remove({});
    var trip_id = Trips.insert({title: 'Seattle to San Francisco'})
    var stops = ["Port Angeles, WA",
                 "Forks, WA",
                 "Hoquim, WA",
                 "Raymond, WA",
                 "Long Beach, WA",
                 "Seaside, OR",
                 "Tillamook, OR",
                 "Cape Lookout State Park, OR" ];
    for (var i = 0; i < stops.length; i++)
      Days.insert({stop: stops[i], order: i+1, trip_id: trip_id, created_at: Date.now(), updated_at: Date.now()});
  }
})
Meteor.startup(function () {
  var require = __meteor_bootstrap__.require;
  var path = require('path');
  var fs = require('fs');

  var base = path.resolve('.');
  if (base == '/') {
    base = path.dirname(global.require.main.filename);
  }
  everyauth = require(path.resolve(base+'/public/node_modules/everyauth'));
  connect = require(path.resolve(base+'/public/node_modules/connect'));
  everyauth.twitter
    .consumerKey('fQourbIsaUU9OcTSdk4LlQ')
    .consumerSecret('Tbb1xxF0w5wBjFX3zPVpCznbc68EApPE3pklmIY5U')
    .findOrCreateUser( function (session, accessToken, accessTokenSecret, twitterUserMetadata) {
      // find or create user logic goes here
      console.log(session, accessToken, accessTokenSecret, twitterUserMetadata);
    })
    .redirectPath('/');

  if (Trips.find().count() === 0) {
    Meteor.call('reset');
  }
});
