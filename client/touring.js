var map;
var handle;
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
      handle = generate_handler();
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
