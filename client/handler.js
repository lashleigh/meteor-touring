function generate_handler() {
  return Days.find().observe({
    added: added,
    changed: changed, 
    removed: function(old_doc, at_index) {
      Session.set('hovered', null);
      if(is_current(old_doc._id)) {Session.set('current', null)}
      directionsDisplay.setMap(null);
      Session.set('directions', null);
      var marker = markers[old_doc._id];
      if(!marker) return;
      marker.setMap(null);
      marker.polyline.setMap(null);
      google.maps.event.clearInstanceListeners(marker);
      delete markers[old_doc._id];
    }
  });
}

function added(new_doc, prior_count) {
  console.log('added', new_doc, prior_count);
  if(markers[new_doc._id]) return;
  add_locally(new_doc);
}
function changed(day, at_index, old_doc) {
  if(day.lat !== old_doc.lat || day.lng !== old_doc.lng) {
    var latlng = new google.maps.LatLng(day.lat, day.lng);
    markers[day._id].setPosition(latlng);
    reverse_geocode(day, latlng); 
  }
  if(day.polyline && (day.polyline !== old_doc.polyline)) {
    markers[day._id].polyline.setPath(myDecodePath(day.polyline)); 
    markers[day._id].polyline.setMap(map);
  } else if(!day.polyline) {
    markers[day._id].polyline.setMap(null);
  }
}
function add_locally(new_doc) {
  var marker = new google.maps.Marker({
    map: map, 
    draggable: false, 
    title: new_doc.stop, 
    icon: Session.get('current') === new_doc._id ? current_icon : null,
    icon: Session.get('hovered') === new_doc._id ? current_icon : null
  });
  markers[new_doc._id] = marker;
  marker.day_id = new_doc._id;
  marker.polyline = new google.maps.Polyline({
    map: map,
    strokeOpacity: 0.5,
    strokeWeight: 3
  });
  if(new_doc.polyline) { marker.polyline.setPath(myDecodePath(new_doc.polyline)); }
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
  if(new_doc.lat && new_doc.lng) {
    var latlng = new google.maps.LatLng(new_doc.lat, new_doc.lng)
    marker.setPosition(latlng);
    if(!new_doc.address) {
      reverse_geocode(new_doc, latlng);
    }
  } else {
    geocode(new_doc);
  }
}

function places_handler() {
  Places.find().observe({
    added: function(new_doc, prior_count) {
      console.log(new_doc);
      var marker = new google.maps.Marker({
        position: latlng_from_day(new_doc.geometry.location),
        map: map,
        draggable: false,
        title: new_doc.name,
        icon: icon('ff0', '0')
      });
      places[new_doc._id] = marker;
      marker.day_id = new_doc._id;
      var b = map.getBounds();
      if(!b.contains(marker.getPosition())) {
        map.fitBounds(b.extend(marker.getPosition()))
      }
    },
    removed: function(old_doc, idx) {
      places[old_doc._id].setMap(null);
      delete places[old_doc._id];
    }
  });
}
