var rendererOptions = {
  draggable: true,
  suppressInfoWindows: true,
  preserveViewport: false,
  markerOptions: {draggable: false}
};
function calc_route_for_first_day(day) {
  var next_day = Days.findOne({order: day.order+1});
  if(!next_day) { console.log('there must be only one day...'); return;}
  var request = {
    origin: latlng_from_day(day),
    destination: latlng_from_day(next_day),  
    waypoints: coords_to_google_waypoints(day),
    optimizeWaypoints: true,
    travelMode: google.maps.TravelMode[day.travelMode || Session.get('travelMode')],
    unitSystem: google.maps.UnitSystem['IMPERIAL']
  }
  directionsService.route(request, standardDirectionsDisplay);
  google.maps.event.removeListener(directions_change_listener);
  directionsDisplay.setOptions({markerOptions: {draggable: true}, preserveViewport: true});

  directions_change_listener = google.maps.event.addListener(directionsDisplay, 'directions_changed', function() {
    var route = directionsDisplay.directions.routes[0];
    if(!_.isEqual(Session.get('directions').routes[0].legs[0].end_location, route.legs[0].end_location)) {
      directionsDisplay.setDirections(Session.get('directions'));
    } else {
      var waypoints = route.legs[0].via_waypoints.map(function(p) {return {lat: p.lat(), lng: p.lng()};}) 
      var polyline  = route.overview_polyline.points;
      var latlng = route.legs[0].start_location;
      manageTrip.updateDay(day._id, {$set: {polyline: polyline, waypoints: waypoints, lat: latlng.lat(), lng:latlng.lng(), distance: route.legs[0].distance.value }});
      Session.set('directions', directionsDisplay.directions);
      drawPath();
    }
  }); 
}
function calc_route_with_stopover(day) {
  var prev_day = Days.findOne({order: day.order-1});
  var next_day = Days.findOne({order: day.order+1});
  if(!prev_day) { calc_route_for_first_day(day); return;}
  if(!next_day) { calc_route_for_last_day(day); return};
  var waypoints = coords_to_google_waypoints(prev_day).concat({location: latlng_from_day(day), stopover: true}, coords_to_google_waypoints(day));
  var request = {
    origin: latlng_from_day(prev_day),  
    destination: latlng_from_day(next_day),
    waypoints: waypoints,
    optimizeWaypoints: true,
    travelMode: google.maps.TravelMode[day.travelMode || Session.get('travelMode')],
    unitSystem: google.maps.UnitSystem['IMPERIAL']
  }
  directionsService.route(request, standardDirectionsDisplay);
  google.maps.event.removeListener(directions_change_listener);
  directionsDisplay.setOptions({markerOptions: {draggable: true}, preserveViewport: false})
  directions_change_listener = google.maps.event.addListener(directionsDisplay, 'directions_changed', function() {
    var route = directionsDisplay.directions.routes[0];
    if(!_.isEqual(Session.get('directions').routes[0].legs[0].start_location, route.legs[0].start_location)) {
      if(prev_day.order === 1) {
        var legs_0 = route.legs[0]; 
        var waypoints_0 = legs_0.via_waypoints.map(function(p) {return {lat: p.lat(), lng: p.lng()};}) 
        var polyline_0  = myEncodePath(_.flatten(_.pluck(legs_0.steps, 'path')));
        manageTrip.updateDay(prev_day._id, {$set: {polyline: polyline_0, 
                                                   waypoints: waypoints_0, 
                                                   lat:legs_0.start_location.lat(), 
                                                   lng: legs_0.start_location.lng(), 
                                                   distance: legs_0.distance.value}});
        Session.set('directions', directionsDisplay.directions);
        drawPath();
      } else {
        directionsDisplay.setDirections(Session.get('directions'))
      }
    } else if(!_.isEqual(Session.get('directions').routes[0].legs[1].end_location, route.legs[1].end_location)) {
      if(next_day.order === Days.find().count()) {
        var legs_1 = route.legs[1];
        var waypoints_1 = legs_1.via_waypoints.map(function(p) {return {lat: p.lat(), lng: p.lng()};}) 
        var polyline_1  = myEncodePath(_.flatten(_.pluck(legs_1.steps, 'path')));
        manageTrip.updateDay(day._id, {$set: {polyline: polyline_1, waypoints: waypoints_1, distance: legs_1.distance.value}});
        manageTrip.updateDay(next_day._id, {$set: {lat: legs_1.end_location.lat(), lng: legs_1.end_location.lng()}});
        Session.set('directions', directionsDisplay.directions);
        drawPath();
      } else {
        directionsDisplay.setDirections(Session.get('directions'))
      }
    } else {
      var legs_0 = route.legs[0]; var legs_1 = route.legs[1];
      var waypoints_0 = legs_0.via_waypoints.map(function(p) {return {lat: p.lat(), lng: p.lng()};}) 
      var waypoints_1 = legs_1.via_waypoints.map(function(p) {return {lat: p.lat(), lng: p.lng()};}) 
      var polyline_0  = myEncodePath(_.flatten(_.pluck(legs_0.steps, 'path')));
      var polyline_1  = myEncodePath(_.flatten(_.pluck(legs_1.steps, 'path')));
      manageTrip.updateDay(prev_day._id, {$set: {polyline: polyline_0, waypoints: waypoints_0, distance: legs_0.distance.value}});
      manageTrip.updateDay(day._id, {$set: {polyline: polyline_1, 
                                                   waypoints: waypoints_1, 
                                                   lat:legs_0.end_location.lat(), 
                                                   lng: legs_0.end_location.lng(), 
                                                   distance: legs_1.distance.value}});
      Session.set('directions', directionsDisplay.directions);
      drawPath();
    }
  });
}
function calc_route_for_last_day(day) {
  var prev_day = Days.findOne({order: day.order-1});
  if(!prev_day) { console.log('there must be only one day...'); return;}
  var request = {
    origin: latlng_from_day(prev_day),  
    destination: latlng_from_day(day),
    waypoints: coords_to_google_waypoints(prev_day),
    optimizeWaypoints: true,
    travelMode: google.maps.TravelMode[prev_day.travelMode || Session.get('travelMode')],
    unitSystem: google.maps.UnitSystem['IMPERIAL']
  }
  directionsService.route(request, standardDirectionsDisplay);
  google.maps.event.removeListener(directions_change_listener);
  directionsDisplay.setOptions({markerOptions: {draggable: true}, preserveViewport: true});

  directions_change_listener = google.maps.event.addListener(directionsDisplay, 'directions_changed', function() {
    var route = directionsDisplay.directions.routes[0];
    if(!_.isEqual(Session.get('directions').routes[0].legs[0].start_location, route.legs[0].start_location)) {
      directionsDisplay.setDirections(Session.get('directions'));
    } else {
      var waypoints = route.legs[0].via_waypoints.map(function(p) {return {lat: p.lat(), lng: p.lng()};}) 
      var polyline  = route.overview_polyline.points;
      manageTrip.updateDay(prev_day._id, {$set: {polyline: polyline, waypoints: waypoints, distance: route.legs[0].distance.value}});
      if(!_.isEqual(Session.get('directions').routes[0].legs[0].end_location, route.legs[0].end_location)) {
        manageTrip.updateDay(day._id, {$set: {lat: route.legs[0].end_location.lat(), lng:route.legs[0].end_location.lng() }});
      }
      Session.set('directions', directionsDisplay.directions);
      drawPath();
    }
  });
}
function calc_route(day) {
  var next_day = Days.findOne({order: day.order+1});
  if(!next_day) {  calc_route_for_last_day(next_day); return};
  var request = {
    origin: latlng_from_day(day),  
    destination: latlng_from_day(next_day),
    waypoints: coords_to_google_waypoints(day),
    optimizeWaypoints: true,
    travelMode: google.maps.TravelMode[day.travelMode || Session.get('travelMode')],
    unitSystem: google.maps.UnitSystem['IMPERIAL']
  }
  directionsService.route(request, standardDirectionsDisplay);
  google.maps.event.removeListener(directions_change_listener);
  directionsDisplay.setOptions({markerOptions: {draggable: false}, preserveViewport: false})
  directions_change_listener = google.maps.event.addListener(directionsDisplay, 'directions_changed', function() {
    var route = directionsDisplay.directions.routes[0];
    var waypoints = route.legs[0].via_waypoints.map(function(p) {return {lat: p.lat(), lng: p.lng()};}) 
    var polyline  = route.overview_polyline.points;
    manageTrip.updateDay(day._id, {$set: {polyline: polyline, waypoints: waypoints, distance: route.legs[0].distance.value}});
  });
}
function standardDirectionsDisplay(response, status) {
  if (status == google.maps.DirectionsStatus.OK) {
    Session.set('directions', response);
    directionsDisplay.setMap(map)
    directionsDisplay.setDirections(response);
    directionsDisplay.setPanel($('.day_details')[0]);
  } else {
    console.log('directions failure', status);
    var day = Days.findOne(Session.get('current'));
    if(!day) return;
    //if(day.travelMode !== 'DRIVING') { manageTrip.updateDay(day._id, {$set: {travelMode: 'DRIVING'}}); return; }
    var next_day = Days.findOne({order: day.order +1});
    var prev_day = Days.findOne({order: day.order -1});
    if(next_day) {
      var polyline = myEncodePath([coords_to_google_point(day), coords_to_google_point(next_day)]);
      var distance = distanceBetweenShort(day, next_day); 
      manageTrip.updateDay(day._id, {$set: {distance: distance, polyline: polyline}});
    } 
    if(prev_day) {
      var polyline = myEncodePath([coords_to_google_point(prev_day), coords_to_google_point(day)]);
      var distance = distanceBetweenShort(prev_day, day); 
      manageTrip.updateDay(prev_day._id, {$set: {distance: distance, polyline: polyline}});
    }
  }
}
function coords_to_google_point(coords) {
  return new google.maps.LatLng(coords.lat, coords.lng);
}
function coords_to_google_waypoints(day) {
  day = day || Days.findOne(Session.get('current'));
  if(!day.waypoints) return [];
  return day.waypoints.map(function(c){return {location: coords_to_google_point(c), stopover:false}}); 
}
function latlng_from_day(day) {
  return new google.maps.LatLng(day.lat, day.lng);
}
