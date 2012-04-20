function munge_update(select, updates, multi) {
  updates.$set = updates.$set || {};
  updates.$set.updated_at = Date.now();
  Days.update(select, updates, multi);
}
function move_one(day, direction) {
  munge_update({order: day.order+direction}, {$inc: {order: -1*direction}});
  munge_update({_id:day._id}, {$inc: {order: direction}});
}
function adjust_order_after_remove(old_day) {
  munge_update({order: {$gte: old_day.order}}, {$inc : {order: -1}}, {multi: true});
}
function coords_to_google_point(coords) {
  return new google.maps.LatLng(coords.lat, coords.lng);
}
function coords_to_google_waypoints(day) {
  day = day || Days.findOne(Session.get('current'));
  if(!day.waypoints) return [];
  return day.waypoints.map(function(c){return {location: coords_to_google_point(c), stopover:false}}); 
}
function calc_route_with_stopover(day) {
  var prev_day = Days.findOne({order: day.order-1});
  var waypoints = coords_to_google_waypoints(prev_day).concat({location: latlng_from_day(day), stopover: true}, coords_to_google_waypoints(day));
  var request = {
    origin: latlng_from_day(prev_day),  
    destination: latlng_from_day(Days.findOne({order: day.order+1})),
    waypoints: waypoints,
    optimizeWaypoints: true,
    travelMode: google.maps.TravelMode[day.travelMode || 'BICYCLING'],
    unitSystem: google.maps.UnitSystem['IMPERIAL']
  }
  directionsService.route(request, standardDirectionsDisplay);
  google.maps.event.removeListener(directions_change_listener);
  directionsDisplay.setOptions({markerOptions: {draggable: true}})
  directions_change_listener = google.maps.event.addListener(directionsDisplay, 'directions_changed', function() {
    var legs_0 = directionsDisplay.directions.routes[0].legs[0];
    var legs_1 = directionsDisplay.directions.routes[0].legs[1];
    var waypoints_0 = legs_0.via_waypoints.map(function(p) {return {lat: p.lat(), lng: p.lng()};}) 
    var waypoints_1 = legs_1.via_waypoints.map(function(p) {return {lat: p.lat(), lng: p.lng()};}) 
    var polyline_0  = google.maps.geometry.encoding.encodePath(_.flatten(_.pluck(legs_0.steps, 'path')));
    var polyline_1  = google.maps.geometry.encoding.encodePath(_.flatten(_.pluck(legs_1.steps, 'path')));
    var day_1 = Days.findOne({order: Days.findOne(Session.get('current')).order - 1})
    munge_update(day_1._id, {$set: {polyline: polyline_0, waypoints: waypoints_0}});
    munge_update(Session.get('current'), {$set: {polyline: polyline_1, waypoints: waypoints_1, lat:legs_0.end_location.lat(), lng: legs_0.end_location.lng()}});
  });

}
function calc_route(day) {
  var request = {
    origin: latlng_from_day(day),  
    destination: latlng_from_day(Days.findOne({order: day.order+1})),
    waypoints: coords_to_google_waypoints(),
    optimizeWaypoints: true,
    travelMode: google.maps.TravelMode[day.travelMode || 'BICYCLING'],
    unitSystem: google.maps.UnitSystem['IMPERIAL']
  }
  directionsService.route(request, standardDirectionsDisplay);
  google.maps.event.removeListener(directions_change_listener);
  directionsDisplay.setOptions({markerOptions: {draggable: false}})
  directions_change_listener = google.maps.event.addListener(directionsDisplay, 'directions_changed', function() {
    var waypoints = directionsDisplay.directions.routes[0].legs[0].via_waypoints.map(function(p) {return {lat: p.lat(), lng: p.lng()};}) 
    var polyline  = directionsDisplay.directions.routes[0].overview_polyline.points;
    munge_update(Session.get('current'), {$set: {polyline: polyline, waypoints: waypoints}});
  });
}
function standardDirectionsDisplay(response, status) {
  if (status == google.maps.DirectionsStatus.OK) {

    Session.set('directions', response.routes[0]);
    directionsDisplay.setMap(map)
    directionsDisplay.setDirections(response);
    directionsDisplay.setPanel($('.day_details')[0]);
    
  } else {
    alert(status);
  }
}
function customDirectionsDisplay(response, status) {
  if (status == google.maps.DirectionsStatus.OK) {
    var route = response.routes[0];
    console.log(response);
    var polyline = new google.maps.Polyline({
      path: route.overview_path,
      strokeColor: '#FF0000',
      strokeWeight: 1,
      editable: true,
      map: map
    });
  } else {
    alert(status);
  }
}
function icon(color, symbol) {
  return new google.maps.MarkerImage("http://chart.apis.google.com/chart?chst=d_map_pin_letter_withshadow&chld="+symbol+"|"+color,
  new google.maps.Size(40, 37),
  new google.maps.Point(0, 0),
  new google.maps.Point(12, 35));
}
var current_icon = icon('8D2D8D', '');
var hover_icon = icon('59308F', '');
function is_current(id) {
  return Session.get('current') && (Session.get('current') === id)
}
function make_current(id) {
  console.log('current', id);
  if(Session.get('current') && markers[Session.get('current')]) {
    markers[Session.get('current')].setIcon(null);
    markers[Session.get('current')].setDraggable(false);
  }
  Session.set('current', id)
  markers[id].setIcon(current_icon);
  markers[id].setDraggable(true);
  map.panTo( markers[id].getPosition());
  directionsDisplay.setMap(null);
  directionsDisplay.setPanel(null);
}
function print_days() {
  Days.find().forEach(function(d) {if_console(d);});
}
function geocode(address) {
  geocoder.geocode({address: address}, function(res, req) {
    return res[0].geometry.location;
  })
}
function if_console(message) {
  if (typeof console !== 'undefined')
    console.log(message);
}
function update_by_merging(day, data) {
  munge_update(day._id, {$set : data});
}
function latlng_from_day(day) {
  return new google.maps.LatLng(day.lat, day.lng);
}
