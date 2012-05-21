var map;
Session.set('trip_id', null);
Session.set('current', null);
Session.set('travelMode', 'DRIVING');
Session.set('unit', 'IMPERIAL');
Session.set('directions', null);

// Always be subscribed to the days for the selected trip.
Meteor.autosubscribe(function () {
  var trip_id = Session.get('trip_id');
  if (trip_id) {
    Meteor.subscribe('trips', trip_id);
    Router.setTrip(Session.get('trip_id'));
    Meteor.subscribe('days', trip_id, function() {
      initialize_map();
      handle = theHandle();
      if(Days.find().count() >= 2 && map) {
        var bounds = new google.maps.LatLngBounds;
        _.each(Days.find().fetch(), function(d) {bounds.extend(latlng_from_day(d));})
        map.fitBounds(bounds);
        return;
      } else {
        var d = Days.findOne();
        if(d) {
          map.setCenter(new google.maps.LatLng(d.lat, d.lng));
          return;
        } 
      }
    });
  } else {
    $('body').css({height: null, width: null, overflow: null}) 
    Meteor.subscribe('trips');
  }
});

////////// Tracking selected list in URL //////////

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
    var t = Trips.insert({title: 'something awesome'});
    Router.setTrip(t);
  },
  setTrip: function (trip_id) {
    this.navigate('trips/'+trip_id, true);
  }
});

Router = new ToursRouter;

Meteor.startup(function() {
  Backbone.history.start({pushState: true});
});
function initialize_map() {
  $('body').css({height: window.innerHeight+'px', width: window.innerWidth+'px', overflow: 'hidden'});
  $(window).resize(function(e) {
    $('body').css({height: window.innerHeight+'px', width: window.innerWidth+'px', overflow: 'hidden'});
  });
  var myOptions = {
    center: new google.maps.LatLng(45.9931636, -123.9226385),
    zoom: 8,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  };
  map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);
  new google.maps.BicyclingLayer().setMap(map);

  google.maps.event.addListener(map, 'click', function(evt) {
    manageTrip.appendDay(evt.latLng);
  });
  markers = {};
  directionsDisplay = new google.maps.DirectionsRenderer(rendererOptions);
  directionsService = new google.maps.DirectionsService();
  directions_change_listener = google.maps.event.addListener(directionsDisplay, 'directions_changed', function() {}) ;
  geocoder = new google.maps.Geocoder;
  elevator = new google.maps.ElevationService();
  current_icon = icon('59308F', '');
  hover_icon = icon('8D2D8D', '');
}
function theHandle() {
  return Days.find().observe({
    added: added,
    changed: function(day, at_index, old_day) {
      if(day.lat !== old_day.lat || day.lng !== old_day.lng) {
        var latlng = new google.maps.LatLng(day.lat, day.lng);
        markers[day._id].setPosition(latlng);
        reverse_geocode(day, latlng); 
        //TODO figure out a better way to limit when calc_route can happen
      }
      if(day.polyline && (day.polyline !== old_day.polyline)) {
        markers[day._id].polyline.setPath(myDecodePath(day.polyline)); 
        markers[day._id].polyline.setMap(map);
      } 
    },
    removed: function(old_day, at_index) {
      Session.set('hovered', null);
      if(is_current(old_day._id)) {Session.set('current', null)}
      directionsDisplay.setMap(null);
      Session.set('directions', null);
      var marker = markers[old_day._id];
      if(!marker) return;
      marker.setMap(null);
      marker.polyline.setMap(null);
      google.maps.event.clearInstanceListeners(marker);
      delete markers[old_day._id];
    }
  });
}

function added(new_day, prior_count) {
  if(markers[new_day._id]) return;
  add_locally(new_day);
}
 
function add_locally(new_day) {
  var marker = new google.maps.Marker({
    map: map, 
    draggable: false, 
    title: new_day.stop, 
    icon: Session.get('current') === new_day._id ? current_icon : null,
    icon: Session.get('hovered') === new_day._id ? current_icon : null
  });
  markers[new_day._id] = marker;
  marker.day_id = new_day._id;
  marker.polyline = new google.maps.Polyline({
    map: map,
    strokeOpacity: 0.5,
    strokeWeight: 3
  });
  if(new_day.polyline) { marker.polyline.setPath(myDecodePath(new_day.polyline)); }
  new google.maps.event.addListener(marker, 'click', function(e) {
    make_current(marker.day_id);
  });
  new google.maps.event.addListener(marker, 'dragend', function(e) {
    var day = Days.findOne(marker.day_id);
    if(!day) return; 
    //TODO no day should throw a big error
    //Changing the day object explicitly means the route calculation can proceed 
    //without wating for the database to finish updating
    day.lat = e.latLng.lat();
    day.lng = e.latLng.lng();
    manageTrip.updateDay(day._id, {$set : {lat: day.lat, lng: day.lng}});
    calc_route_with_stopover(day);
  });
  if(new_day.lat && new_day.lng) {
    var latlng = new google.maps.LatLng(new_day.lat, new_day.lng)
    marker.setPosition(latlng);
    if(!new_day.address) {
      reverse_geocode(new_day, latlng);
    }
  } else {
    geocode(new_day);
  }
}
