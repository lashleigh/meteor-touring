var rendererOptions = {
  draggable: true,
  suppressInfoWindows: true,
  preserveViewport: false,
  markerOptions: {draggable: false}
};
var map;
var markers = {};
var directionsDisplay;
var directionsService;
var directions_change_listener;
var geocoder;
var bounds;
function munge_insert(attributes) {
  attributes.created_at = Date.now();
  attributes.updated_at = Date.now();
  attributes.trip_id = Session.get('trip_id');
  //TODO best way to maintain order => Days.find().count()+1 || _.max(_.pluck(Days.find().fetch(), 'order'))+1
  attributes.order = attributes.order || Days.find().count()+1;
  return Days.insert(attributes);
}
function munge_update(select, updates, multi) {
  updates.$set = updates.$set || {};
  updates.$set.updated_at = Date.now();
  Days.update(select, updates, multi);
}
function adjust_order_after_remove(old_day) {
  munge_update({order: {$gte: old_day.order}}, {$inc : {order: -1}}, {multi: true});
  if(Days.find({order: {$gt: old_day.order}}).count() === 0) {
    var d = Days.findOne({order: old_day.order-1});
    console.log(d)
    if(d) {
      Days.update(d._id, {$set : {polyline: null, waypoints: null, distance: null}});
      markers[d._id].polyline.setMap(null);
    } else {
      //TODO what to do when there are no days remaining?
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
function calc_route_for_first_day(day) {
  var next_day = Days.findOne({order: day.order+1});
  if(!next_day) { console.log('there must be only one day...'); return;}
  markers[day._id].polyline.setMap(map);
  var request = {
    origin: latlng_from_day(day),
    destination: latlng_from_day(next_day),  
    waypoints: coords_to_google_waypoints(day),
    optimizeWaypoints: true,
    travelMode: google.maps.TravelMode[day.travelMode || 'BICYCLING'],
    unitSystem: google.maps.UnitSystem['IMPERIAL']
  }
  directionsService.route(request, standardDirectionsDisplay);
  google.maps.event.removeListener(directions_change_listener);
  directionsDisplay.setOptions({markerOptions: {draggable: true}, preserveViewport: true});

  directions_change_listener = google.maps.event.addListener(directionsDisplay, 'directions_changed', function() {
    var route = directionsDisplay.directions.routes[0];
    if((Session.get('directions').routes[0].legs[0].end_address !== route.legs[0].end_address)) {
      console.log('illegal drag of end location');
      directionsDisplay.setDirections(Session.get('directions'));
    } else {
      var waypoints = route.legs[0].via_waypoints.map(function(p) {return {lat: p.lat(), lng: p.lng()};}) 
      var polyline  = route.overview_polyline.points;
      var latlng = route.legs[0].start_location;
      munge_update(day._id, {$set: {polyline: polyline, waypoints: waypoints, lat: latlng.lat(), lng:latlng.lng(), distance: route.legs[0].distance.value }});
      Session.set('directions', directionsDisplay.directions);
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
    travelMode: google.maps.TravelMode[day.travelMode || 'BICYCLING'],
    unitSystem: google.maps.UnitSystem['IMPERIAL']
  }
  directionsService.route(request, standardDirectionsDisplay);
  google.maps.event.removeListener(directions_change_listener);
  directionsDisplay.setOptions({markerOptions: {draggable: true}, preserveViewport: true})
  directions_change_listener = google.maps.event.addListener(directionsDisplay, 'directions_changed', function() {
    var route = directionsDisplay.directions.routes[0];
    if((Session.get('directions').routes[0].legs[0].start_address !== route.legs[0].start_address) ||
       (Session.get('directions').routes[0].legs[1].end_address   !== route.legs[1].end_address )) {
      console.log('innapropriate drag');
      directionsDisplay.setDirections(Session.get('directions'))
    } else {
      var legs_0 = route.legs[0]; var legs_1 = route.legs[1];
      var waypoints_0 = legs_0.via_waypoints.map(function(p) {return {lat: p.lat(), lng: p.lng()};}) 
      var waypoints_1 = legs_1.via_waypoints.map(function(p) {return {lat: p.lat(), lng: p.lng()};}) 
      var polyline_0  = google.maps.geometry.encoding.encodePath(_.flatten(_.pluck(legs_0.steps, 'path')));
      var polyline_1  = google.maps.geometry.encoding.encodePath(_.flatten(_.pluck(legs_1.steps, 'path')));
      munge_update(prev_day._id, {$set: {polyline: polyline_0, waypoints: waypoints_0, distance: legs_0.distance.value}});
      munge_update(Session.get('current'), {$set: {polyline: polyline_1, 
                                                   waypoints: waypoints_1, 
                                                   lat:legs_0.end_location.lat(), 
                                                   lng: legs_0.end_location.lng(), 
                                                   distance: legs_1.distance.value}});
      Session.set('directions', directionsDisplay.directions);
    }
  });
}
function calc_route_for_last_day(day) {
  var prev_day = Days.findOne({order: day.order-1});
  if(!prev_day) { console.log('there must be only one day...'); return;}
  markers[prev_day._id].polyline.setMap(map);
  var request = {
    origin: latlng_from_day(prev_day),  
    destination: latlng_from_day(day),
    waypoints: coords_to_google_waypoints(prev_day),
    optimizeWaypoints: true,
    travelMode: google.maps.TravelMode[day.travelMode || 'BICYCLING'],
    unitSystem: google.maps.UnitSystem['IMPERIAL']
  }
  directionsService.route(request, standardDirectionsDisplay);
  google.maps.event.removeListener(directions_change_listener);
  directionsDisplay.setOptions({markerOptions: {draggable: true}, preserveViewport: true});

  directions_change_listener = google.maps.event.addListener(directionsDisplay, 'directions_changed', function() {
    var route = directionsDisplay.directions.routes[0];
    if((Session.get('directions').routes[0].legs[0].start_address !== route.legs[0].start_address)) {
      console.log('illegal drag of start location');
      directionsDisplay.setDirections(Session.get('directions'));
    } else {
      var waypoints = route.legs[0].via_waypoints.map(function(p) {return {lat: p.lat(), lng: p.lng()};}) 
      var polyline  = route.overview_polyline.points;
      munge_update(prev_day._id, {$set: {polyline: polyline, waypoints: waypoints, distance: route.legs[0].distance.value}});
      if(!_.isEqual(Session.get('directions').routes[0].legs[0].end_location, route.legs[0].end_location)) {
        munge_update(day._id, {$set: {lat: route.legs[0].end_location.lat(), lng:route.legs[0].end_location.lng() }});
      }
      Session.set('directions', directionsDisplay.directions);
    }
  });
}
function calc_route(day) {
  var next_day = Days.findOne({order: day.order+1});
  if(!next_day) {  calc_route_for_last_day(next_day); return};
  markers[day._id].polyline.setMap(map);
  var request = {
    origin: latlng_from_day(day),  
    destination: latlng_from_day(next_day),
    waypoints: coords_to_google_waypoints(day),
    optimizeWaypoints: true,
    travelMode: google.maps.TravelMode[day.travelMode || 'BICYCLING'],
    unitSystem: google.maps.UnitSystem['IMPERIAL']
  }
  directionsService.route(request, standardDirectionsDisplay);
  google.maps.event.removeListener(directions_change_listener);
  directionsDisplay.setOptions({markerOptions: {draggable: false}, preserveViewport: false})
  directions_change_listener = google.maps.event.addListener(directionsDisplay, 'directions_changed', function() {
    var route = directionsDisplay.directions.routes[0];
    var waypoints = route.legs[0].via_waypoints.map(function(p) {return {lat: p.lat(), lng: p.lng()};}) 
    var polyline  = route.overview_polyline.points;
    munge_update(day._id, {$set: {polyline: polyline, waypoints: waypoints, distance: route.legs[0].distance.value}});
  });
}
function standardDirectionsDisplay(response, status) {
  if (status == google.maps.DirectionsStatus.OK) {
    Session.set('directions', response);
    directionsDisplay.setMap(map)
    directionsDisplay.setDirections(response);
    directionsDisplay.setPanel($('.day_details')[0]);
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
function geocode(day) {
  geocoder.geocode({address: day.stop}, function(res, req) {
    console.log(res, req);
    munge_update(day._id, {$set: {lat: res[0].geometry.location.lat(), lng:res[0].geometry.location.lng()}});
  })
}
function reverse_geocode(day, latlng) {
  geocoder.geocode({location: latlng}, function(res, req) {
    console.log(res, req);
    var result = res[0].address_components;
    var info=[];
    for(var i=0;i<result.length;++i) {
        if(result[i].types[0]=="administrative_area_level_1"){info.push(result[i].short_name)}
        if(result[i].types[0]=="locality"){info.unshift(result[i].long_name)}
    }
    munge_update(day._id, {$set: {address: info.join(', ')}})
  })
}
function markers_on_waypoints() {
  var waypoint = directionsDisplay.directions.routes[0].legs[0].via_waypoints;
}
