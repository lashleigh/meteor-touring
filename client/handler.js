function generate_handler() {
  return Days.find().observe({
    added: added,
    changed: changed, 
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
  console.log('added', new_day, prior_count);
  if(markers[new_day._id]) return;
  add_locally(new_day);
}
function changed(day, at_index, old_day) {
  if(day.lat !== old_day.lat || day.lng !== old_day.lng) {
    var latlng = new google.maps.LatLng(day.lat, day.lng);
    markers[day._id].setPosition(latlng);
    reverse_geocode(day, latlng); 
  }
  if(day.polyline && (day.polyline !== old_day.polyline)) {
    markers[day._id].polyline.setPath(myDecodePath(day.polyline)); 
    markers[day._id].polyline.setMap(map);
  } else if(!day.polyline) {
    markers[day._id].polyline.setMap(null);
  }
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
