Meteor.publish('trips', function(trip_id) {
  return trip_id ? Trips.find({_id: trip_id}) : Trips.find({hidden: false});
});

Meteor.publish('days', function(trip_id) {
  return Days.find({trip_id: trip_id});
});
Meteor.methods({
  pluck: function(name) {
    return _.pluck(Trips.find().fetch(), name);
  },
  days_insert: function(attributes) {
                 if(!attributes.trip_id) return;
                 var id = Days.insert(attributes);
                 return Days.findOne(id);
               }
});
Meteor.startup(function () {
// Insert left out intentionally
// There are async bugs in the way I'm handing day insertion
  _.each(['trips', 'days'], function(collection) {
    _.each(['update', 'remove'], function(method) {
      Meteor.default_server.method_handlers['/' + collection + '/' + method] = function() {};
    });
  });
});
