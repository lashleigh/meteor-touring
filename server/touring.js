Meteor.publish('trips', function(trip_id) {
  return trip_id ? Trips.find({_id: trip_id}) : Trips.find({hidden: false});
});

Meteor.publish('days', function(trip_id) {
  return Days.find({trip_id: trip_id});
});

Meteor.methods({
  pluck: function(name) {
    //console.log(Meteor._RemoteCollectionDriver.mongo.db);
    return _.pluck(Trips.find().fetch(), name);
  },
  geocode: function(options) {
    var url = 'https://maps.googleapis.com/maps/api/geocode/json?'
    options = _.defaults(options, {
      address: '21760 francis lane, mount vernon', 
      sensor: false
    })
    _.each(options, function(v, k) { url = url+k+'='+v+'&';})
    url = url.replace(/ /g, '%20');
    var result = Meteor.http.get(url);
    if(result.statusCode === 200) {
      var c = JSON.parse(result.content);
      return c;
    }
  },
  places: function(options) {
    var url = 'https://maps.googleapis.com/maps/api/place/search/json?'
    options = _.defaults(options, {
      key: 'AIzaSyDEljhoD7LjZfNplwV2zAjx1onw6rMjj6o', 
      location: [45,-120], 
      radius: 10000,
      sensor: false
    })
    options.location = options.location.join(',');
    _.each(options, function(v, k) { url = url+k+'='+v+'&';})
    url = url.replace(/ /g, '%20');
    var result = Meteor.http.get(url);
    if(result.statusCode === 200) {
      var c = JSON.parse(result.content);
      return c;
    }
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
