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
function calc_route(day) {
  var request = {
    origin: latlng_from_day(day),  
    destination: latlng_from_day(Days.findOne({order: day.order+1})),
    travelMode: google.maps.TravelMode.DRIVING,
    unitSystem: google.maps.UnitSystem['IMPERIAL']
  }
  directionsService.route(request, function(response, status) {
    if (status == google.maps.DirectionsStatus.OK) {
      directionsDisplay.setMap(map)
      directionsDisplay.setDirections(response);
    } else {
      alert(status);
    }
  });
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
  if(Session.get('current') && markers[Session.get('current')]) markers[Session.get('current')].setIcon(null);
  Session.set('current', id)
  markers[id].setIcon(icon('8D2D8D', ' '));
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
