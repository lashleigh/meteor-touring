var Days = new Meteor.Collection('days');
var rendererOptions = {
  draggable: true,
  suppressInfoWindows: true,
  preserveViewport: false,
  markerOptions: {draggable: false}
};
var directionsDisplay = new google.maps.DirectionsRenderer(rendererOptions);
var directionsService = new google.maps.DirectionsService();
var directions_change_listener = google.maps.event.addListener(directionsDisplay, 'directions_changed', function() {}) ;
var map;
var markers = {};
var geocoder = new google.maps.Geocoder;
var bounds = new google.maps.LatLngBounds;

Meteor.startup(function() {
  Session.set('sort', {order: 1});
  Session.set('current', false);
  $(function() {
    var myOptions = {
      center: new google.maps.LatLng(45.9931636, -123.9226385),
      zoom: 8,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);
    new google.maps.BicyclingLayer().setMap(map);
  });
  var handle = Days.find().observe({
    added: function(new_day, prior_count) {
      if_console('added', new_day, prior_count);
      if(markers[new_day._id]) return;
      var marker = new google.maps.Marker({
        animation: google.maps.Animation.DROP,
        map: map, 
        draggable: false, 
        title: new_day.stop, 
        icon: Session.get('current') === new_day._id ? current_icon : null,
        icon: Session.get('hovered') === new_day._id ? current_icon : null
      })
      markers[new_day._id] = marker;
      marker.day_id = new_day._id;
      if(new_day.polyline) {
        marker.polyline = new google.maps.Polyline({
          path: google.maps.geometry.encoding.decodePath(new_day.polyline),
          map: map
        })
      }
      new google.maps.event.addListener(marker, 'click', function(e) {
        //Session.set('current', marker.day_id);
        make_current(marker.day_id);
      });
      new google.maps.event.addListener(marker, 'dragend', function(e) {
        var day = Days.findOne({_id:marker.day_id});
        update_by_merging(day, {lat: e.latLng.lat(), lng: e.latLng.lng()})
      });
      if(new_day.lat && new_day.lng) {
        marker.setPosition(new google.maps.LatLng(new_day.lat, new_day.lng));
        bounds.extend(marker.getPosition());
        map.fitBounds(bounds);
      } else {
        geocoder.geocode({address: new_day.stop}, function(res, req) {
          var best_match = res[0].geometry.location;
          update_by_merging(new_day, {lat: best_match.lat(), lng: best_match.lng()})
          marker.setPosition(res[0].geometry.location);
          
          bounds.extend(marker.getPosition());
          map.fitBounds(bounds);
        })
      }
    }, 
    changed: function(day, at_index, old_day) {
      if_console('changed', day, old_day);
      if(day.lat !== old_day.lat || day.lng !== old_day.lng) {
        markers[day._id].setPosition(new google.maps.LatLng(day.lat, day.lng));
        calc_route_with_stopover(day);
      }
      if(day.polyline && (day.polyline !== old_day.polyline)) {
        markers[day._id].polyline.setPath(google.maps.geometry.encoding.decodePath(day.polyline)); 
      }
    },
    moved: function(day, old_index, new_index) {
      if_console('moved', day, old_index, new_index);
    }, 
    removed: function(old_day, at_index) {
      Session.set('hovered', null);
      if(is_current(old_day._id)) {Session.set('current', null)}
      var marker = markers[old_day._id];
      marker.setMap(null);
      marker.polyline.setMap(null);
      google.maps.event.clearInstanceListeners(marker);
      delete markers[old_day._id];
    }
  });
});

