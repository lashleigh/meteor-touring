function icon(color, symbol) {
  return new google.maps.MarkerImage("http://chart.apis.google.com/chart?chst=d_map_pin_letter_withshadow&chld="+symbol+"|"+color,
  new google.maps.Size(40, 37),
  new google.maps.Point(0, 0),
  new google.maps.Point(12, 35));
}
function is_current(id) {
  return Session.equals('current', id);
}
function exit_directions() {
  directionsDisplay.setMap(null);
  directionsDisplay.setPanel(null);
  Session.set('directions', null);
}
function make_current(id) {
  if(Session.get('current') && markers[Session.get('current')]) {
    markers[Session.get('current')].setIcon(null);
    markers[Session.get('current')].setDraggable(false);
  }
  Session.set('current', id);
  var m = markers[id];
  m.setIcon(current_icon);
  m.setDraggable(true);
  if(!map.getBounds().contains(m.getPosition())) { map.panTo(m.getPosition());}
  exit_directions();
  //TODO if the height of a day changes I should definitely change the 52 to $('.day').outerHeight()
  //$("#content").stop().animate({scrollTop: $('.not_days').outerHeight()-$('body').outerHeight()/2+(Days.findOne(id).order)*52}, 400);
}
function geocode(day) {
  geocoder.geocode({address: day.stop}, function(res, status) {
    if(status === google.maps.GeocoderStatus.OK) {
      manageTrip.updateDay(day._id, {$set: {lat: res[0].geometry.location.lat(), lng:res[0].geometry.location.lng()}});
      static_map();
    } else {
      console.log(status);
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
      manageTrip.updateDay(day._id, {$set: {address: info.join(', ')}})
      static_map();
    } else {
      console.log(status);
    }
  })
}
function myDecodePath(path) {
  path = path || '';
  return google.maps.geometry.encoding.decodePath(path);
}
function myEncodePath(path) {
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
function distanceBetweenGooglePointsShort(p1, p2) {
  var R = 6378100.0; // m
  var x = toRadians(p2.lng()-p1.lng()) * Math.cos(toRadians(p1.lat()+p2.lat())/2);
  var y = toRadians(p2.lat()-p1.lat());
  var d = Math.sqrt(x*x + y*y) * R;
  return d;
}
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
function meters2miles(num) {
  return num*0.000621371192;
}
function toMiles(num) {
  return meters2miles(num).toFixed(1)+' mi';
}
function toKilometer(num) {
  return num / 1000.0;
}
function static_map() {
  var basic = 'http://maps.googleapis.com/maps/api/staticmap?size=300x250&path=weight:5|color:0x00000099|enc:';
  var days = Days.find({}, {sort: {order: 1}}).fetch();
  var mod = Math.ceil( days.length / 200.0) || 1;
  var path = myEncodePath(_.map(_.filter(days, function(d) {return d.order % mod === 0;}), function(d) {return latlng_from_day(d)}));
  var full_path =  basic+path+"&sensor=false";
  var distance = _.reduce(_.pluck(_.filter(days, function(d) {return !!d.distance}), 'distance'), function(a, b) {return a+ b; }, 0);
  Meteor.call('trips_update', Session.get('trip_id'), {$set: {path: full_path, num_days: days.length, distance: distance}});
}
function drawPath() {
  // Create a PathElevationRequest object using the encoded overview_path
  var path = Session.get('directions').routes[0].overview_path;
  var pathRequest = {
    'path': path, 
    'samples': Math.min(path.length*2, 512)
  }
  // Initiate the path request.
  elevator.getElevationAlongPath(pathRequest, draw_with_flot);
}
function draw_with_flot(results, status) {
  if (status !== google.maps.ElevationStatus.OK) {console.log('elevation failure', status); return;}
  var data = [];
  var verticals = [];
  var i, delta, y, max;
  var dist = 0;
  var route = Session.get('directions').routes[0];
  
  // The elevation request returns equidistant points
  delta = distanceBetweenGooglePointsShort(results[0].location, results[1].location); 
  for (i = 0; i < results.length-1; i++) {
    y = (results[i].elevation + results[i+1].elevation) /2;
    dist += delta;
    data.push([meters2miles(dist), y, results[i].location]);
  }
  max = _.max(data, function(d) {return d[1];})[1];
  if(max < 200) { max = 200;} else { max = max+100;}
  if(route.legs.length >= 2) {
    var x = meters2miles(route.legs[0].distance.value);
    verticals = [[x, 0], [x, max]];
  }
  make_flot_plot(data, max, verticals);
}
function make_flot_plot(data, max, verticals) {
  var tempMarker = new google.maps.Marker({map: map});
  plot = $.plot($("#elevator"), [ data, verticals], 
    {
      xaxis : {
        noTicks : 7,
        //tickFormatter : function (n) { return '('+n+')'; },
        axisLabel: 'distance ( mi )'
      },
      yaxis : {
        max: max,
        axisLabel: 'elevation ( ft )'
      },
      grid : {
        backgroundColor : 'white',
        hoverable: true,
        clickable: true
      }
  });
  $('#elevator').unbind();
  $("#elevator").bind("mouseout", function(e) {
    tempMarker.setMap(null);
  });
  $("#elevator").bind("mouseover", function(e) {
    tempMarker.setMap(map);
  });
  $("#elevator").bind("plothover", function (event, pos, item) {
    if (item) {
      var pos = plot.getData()[0].data[item.dataIndex][2];
      tempMarker.setPosition(pos);
    }
  });

  $("#elevator").bind("plotclick", function (event, pos, item) {
    if (item) {
      var elevation = plot.getData()[0].data; //[0].data[item.dataIndex];
      var verticals = plot.getData()[1].data;
      var data = elevation[item.dataIndex];
      var day = Days.findOne(Session.get('current'));
      if(verticals.length === 2) {
        if(data[0] < verticals[0][0]) {
          day = Days.findOne({order: day.order -1});
        }
      }
      manageTrip.insertDayAfter(day, data[2]);
    }
  });
}

