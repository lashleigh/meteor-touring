// Trip -- {title: String}
var Trips = new Meteor.Collection('trips');

// Day -- {address: String,
//         stop: String, overrides the autoupdated address string in views
//         lat:  Float,
//         lng:  Float,
//         order: Integer,
//         polyline: String,
//         distance: Integer, the length of the route in meters
//         waypoints: [{lat:Float, lng:Float}, ...],
//         trip_id: String,
//         created_at: Integer,
//         updated_at: Integer}

var Days = new Meteor.Collection('days');

Meteor.methods({
  trips_insert: function(attributes) {
                  return Trips.insert(attributes);
                },
  trips_update: function(id, updates) {
                  if(!id) return;
                  Trips.update({_id: id}, updates);
                },
  trips_remove: function(id) {
                  if(!id) return;
                  Trips.remove({_id: id});
                  Days.remove({trip_id: id});
                },
  days_update: function(selector, updates, multi) {
                 if(!selector.trip_id) return;
                 Days.update(selector, updates, multi);
               },
  days_remove: function(selector) {
                 if(!selector.trip_id) return;
                 Days.remove(selector);
               }
})
