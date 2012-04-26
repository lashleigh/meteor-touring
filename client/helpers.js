var rendererOptions = {
  draggable: true,
  suppressInfoWindows: true,
  preserveViewport: false,
  markerOptions: {draggable: false}
};
function munge_insert(attributes) {
  attributes.created_at = Date.now();
  attributes.updated_at = Date.now();
  attributes.trip_id = Session.get('trip_id');
  //TODO best way to maintain order => Days.find().count()+1 || _.max(_.pluck(Days.find().fetch(), 'order'))+1
  attributes.order = attributes.order || Days.find().count()+1;
  attributes.waypoints = attributes.waypoints || [];
  return Days.insert(attributes);
}
function munge_update(select, updates, multi) {
  if(_.isString(select)) select = {_id: select};
  select.trip_id = Session.get('trip_id');
  updates.$set = updates.$set || {};
  updates.$set.updated_at = Date.now();
  Days.update(select, updates, multi);
}
function adjust_order_after_remove(old_day) {
  var prev_day = Days.findOne({order: old_day.order -1});
  var next_day = Days.findOne({order: old_day.order +1});
  munge_update({order: {$gte: old_day.order}}, {$inc : {order: -1}}, {multi: true});
  if(!next_day && prev_day) {
    munge_update(prev_day._id, {$set : {polyline: '', waypoints: [], distance: 0}});
  } else if(next_day && prev_day) {
    var new_path = decodePath(prev_day.polyline).concat(decodePath(old_day.polyline));
    var new_poly = google.maps.geometry.encoding.encodePath(new_path);
    markers[prev_day._id].polyline.setPath(new_path);
    munge_update(prev_day._id, {$set: {waypoints: prev_day.waypoints.concat(old_day.waypoints), polyline: new_poly, distance: prev_day.distance + old_day.distance}});
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
  if(!next_day) { if_console('there must be only one day...'); return;}
  markers[day._id].polyline.setMap(map);
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
    if((Session.get('directions').routes[0].legs[0].end_address !== route.legs[0].end_address)) {
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
    travelMode: google.maps.TravelMode[day.travelMode || Session.get('travelMode')],
    unitSystem: google.maps.UnitSystem['IMPERIAL']
  }
  directionsService.route(request, standardDirectionsDisplay);
  google.maps.event.removeListener(directions_change_listener);
  directionsDisplay.setOptions({markerOptions: {draggable: true}, preserveViewport: false})
  directions_change_listener = google.maps.event.addListener(directionsDisplay, 'directions_changed', function() {
    var route = directionsDisplay.directions.routes[0];
    if((Session.get('directions').routes[0].legs[0].start_address !== route.legs[0].start_address) ||
       (Session.get('directions').routes[0].legs[1].end_address   !== route.legs[1].end_address )) {
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
  if(!prev_day) { if_console('there must be only one day...'); return;}
  markers[prev_day._id].polyline.setMap(map);
  var request = {
    origin: latlng_from_day(prev_day),  
    destination: latlng_from_day(day),
    waypoints: coords_to_google_waypoints(prev_day),
    optimizeWaypoints: true,
    travelMode: google.maps.TravelMode[day.travelMode || Session.get('travelMode')],
    unitSystem: google.maps.UnitSystem['IMPERIAL']
  }
  directionsService.route(request, standardDirectionsDisplay);
  google.maps.event.removeListener(directions_change_listener);
  directionsDisplay.setOptions({markerOptions: {draggable: true}, preserveViewport: true});

  directions_change_listener = google.maps.event.addListener(directionsDisplay, 'directions_changed', function() {
    var route = directionsDisplay.directions.routes[0];
    if((Session.get('directions').routes[0].legs[0].start_address !== route.legs[0].start_address)) {
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
    //Days.remove(Session.get('current'));
    if_console(status);
    var day = Days.findOne(Session.get('current'));
    var next_day = Days.findOne({order: day.order +1});
    var prev_day = Days.findOne({order: day.order -1});
    if(next_day) {
      var polyline = encodePath([coords_to_google_point(day), coords_to_google_point(next_day)]);
      var distance = distanceBetweenShort(day, next_day); 
      munge_update(day._id, {$set: {distance: distance, polyline: polyline}});
    } 
    if(prev_day) {
      var polyline = encodePath([coords_to_google_point(prev_day), coords_to_google_point(day)]);
      var distance = distanceBetweenShort(prev_day, day); 
      munge_update(prev_day._id, {$set: {distance: distance, polyline: polyline}});
    }
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
  if(Session.get('current') && markers[Session.get('current')]) {
    markers[Session.get('current')].setIcon(null);
    markers[Session.get('current')].setDraggable(false);
  }
  Session.set('current', id);
  markers[id].setIcon(current_icon);
  markers[id].setDraggable(true);
  map.panTo( markers[id].getPosition());
  directionsDisplay.setMap(null);
  directionsDisplay.setPanel(null);
  //TODO if the height of a day changes I should definitely change the 52 to $('.day').outerHeight()
  $("#content").stop().animate({scrollTop: $('.not_days').outerHeight()-$('body').outerHeight()/2+(Days.findOne(id).order)*52}, 400);
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
  geocoder.geocode({address: day.stop}, function(res, status) {
    if(status === google.maps.GeocoderStatus.OK) {
      munge_update(day._id, {$set: {lat: res[0].geometry.location.lat(), lng:res[0].geometry.location.lng()}});
      static_map();
    } else {
      if_console(status);
    }
  })
}
function reverse_geocode(day, latlng) {
  geocoder.geocode({location: latlng}, function(res, status) {
    if(status === google.maps.GeocoderStatus.OK) {
      var result = res[0].address_components;
      var info=[];
      for(var i=0;i<result.length;++i) {
          if(result[i].types[0]=="administrative_area_level_1"){info.push(result[i].short_name)}
          if(result[i].types[0]=="locality"){info.unshift(result[i].long_name)}
      }
      munge_update(day._id, {$set: {address: info.join(', ')}})
      static_map();
    } else {
      if_console(status);
    }
  })
}
function markers_on_waypoints() {
  var waypoint = directionsDisplay.directions.routes[0].legs[0].via_waypoints;
}
function decodePath(path) {
  path = path || '';
  return google.maps.geometry.encoding.decodePath(path);
}
function encodePath(path) {
  return google.maps.geometry.encoding.encodePath(path);
}
function distanceBetween(p1, p2) {
  var R = 6371; // km
  var dLat = toRadians(p2.lat-p1.lat);
  var dLon = toRadians(p2.lng-p1.lng);
  var lat1 = toRadians(p1.lat);
  var lat2 = toRadians(p2.lat);

  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2); 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c;
  return d;
}
function midpoint(d1, d2) {
  var lat1 = toRadians(d1.lat);
  var lon1 = toRadians(d1.lng);
  var lat2 = toRadians(d2.lat);
  var dLon = toRadians(d2.lng-d1.lng);

  var Bx = Math.cos(lat2) * Math.cos(dLon);
  var By = Math.cos(lat2) * Math.sin(dLon);

  var lat3 = Math.atan2(Math.sin(lat1)+Math.sin(lat2),
      Math.sqrt( (Math.cos(lat1)+Bx)*(Math.cos(lat1)+Bx) + By*By) );
  var lon3 = lon1 + Math.atan2(By, Math.cos(lat1) + Bx);
  lon3 = (lon3+3*Math.PI) % (2*Math.PI) - Math.PI;  // normalise to -180..+180º

  return new google.maps.LatLng(toDegrees(lat3), toDegrees(lon3));
}
/*function midpoint(day, next_day) {
  var p1 = path[0];
  var p2 = path[1];
  var dLon = p2.lng() - p1.lng();
  var Bx = Math.cos(p2.lat()) * Math.cos(dLon);
  var By = Math.cos(p2.lat()) * Math.sin(dLon);
  var lat3 = Math.atan2(Math.sin(p1.lat())+Math.sin(p2.lat()),
      Math.sqrt( (Math.cos(p1.lat())+Bx)*(Math.cos(p1.lat())+Bx) + By*By) ); 
  var lon3 = p1.lng() + Math.atan2(By, Math.cos(p1.lat()) + Bx); 
  return (new google.maps.LatLng(lat3, lon3));
}*/
function distanceBetweenShort(p1, p2) {
  var R = 6378100.0; // m
  var x = toRadians(p2.lng-p1.lng) * Math.cos(toRadians(p1.lat+p2.lat)/2);
  var y = toRadians(p2.lat-p1.lat);
  var d = Math.sqrt(x*x + y*y) * R;
  return d;
}
function toRadians(num) {
  return num * Math.PI / 180;
}
function toDegrees(num) {
  return num * 180 / Math.PI;
}
function toMiles(num) {
  return (num*0.000621371192).toFixed(1)+' mi';
}
function toKilometer(num) {
  return num / 1000.0;
}
function static_map() {
  var basic = 'http://maps.googleapis.com/maps/api/staticmap?size=300x250&path=weight:5|color:0x00000099|enc:';
  var days = Days.find({}, {sort: {order: 1}}).fetch();
  var mod = Math.ceil( days.length / 200.0) || 1;
  var path = encodePath(_.map(_.filter(days, function(d) {return d.order % mod === 0;}), function(d) {return latlng_from_day(d)}));
  var full_path =  basic+path+"&sensor=false";
  var distance = _.reduce(_.pluck(_.filter(days, function(d) {return !!d.distance}), 'distance'), function(a, b) {return a+ b; }, 0);
  Trips.update(Session.get('trip_id'), {$set: {path: full_path, num_days: days.length, distance: distance}});
}
//#TODO make sure that indexes never get out of whack
//_.each(d, function(day, idx) {munge_update(day._id, {$set: {order: idx+1}}); })
