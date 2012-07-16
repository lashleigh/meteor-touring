var ToursRouter = Backbone.Router.extend({
  routes: {
    "": "trips",
    "trips": "trips",
    "trips/new": "newTrip",
    "trips/:trip_id": "main",
    "trips/:trip_id/days/:day_id": "day"
  },
  main: function (trip_id) {
    Session.set("trip_id", trip_id);
  },
  day: function(trip_id, day_id) {
         Session.set("trip_id", trip_id);
         Session.set("current", day_id);
       },
  trips: function() {
            Session.set('trip_id', null);
            Session.set('current', null);
            Session.set('hovered', null);
            $('body').css({height: '', width: '', overflow: ''});
            this.navigate('trips', {trigger: false});
          },
  newTrip: function() {
    Meteor.call('trips_insert', function(err, res) {
      console.log(err, res);
      if(err || !res) return;
      Router.setTrip(res);
    });
  },
  setTrip: function (trip_id) {
    this.navigate('trips/'+trip_id, true);
  }
});

Router = new ToursRouter;

Meteor.startup(function() {
  Backbone.history.start({pushState: true});
});


