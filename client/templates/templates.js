Template.content.has_trip = function() {
  return !!Session.get('trip_id');
};
Template.content.events = {
  'click button.home': function() {
    Router.trips();
  },
  'click button.danger': function() {
    if(confirm('are you sure?')) {
      Meteor.call('trips_remove', Session.get('trip_id'));
      Router.trips();
    } 
  },
  'click #search button.search-places': function(ev) {
    Places.remove({});
    Meteor.call('places', {keyword: $('#search input').val(), location: array_from_google_point(map.getCenter())}, function(err, res) {
      _.each(res.results, function(r) { Places.insert(r);});
    }); 
  },
  'click #search button.search-geocode': function(ev) {
    Places.remove({});
    var address = $('#search input').val();
    var radius = google.maps.geometry.spherical.computeDistanceBetween(map.getBounds().getSouthWest(), map.getCenter());
    Math.min(50000, radius);
    if(address.length < 4) return;
    Meteor.call('geocode', {address: address, bounds: stringify_bounds(), radius: radius}, function(err, res) {
      _.each(res.results, function(r) { Places.insert(r);});
    }); 
  }
}
Template.trips.trips = function() {
  return Trips.find().fetch();
};
Template.trips.events = {
  'click #new_trip': function() {
    Router.newTrip();
  } 
}
Template.trip_thumbnail.miles = function() {
  return this.distance ? toMiles(this.distance)+'les in' : '';
}
Template.trip_thumbnail.events = {
  'click': function() {
    Session.set('trip_id', this._id);
  }
}
Template.show_trip.greeting = function () {
  var trip = Trips.findOne(Session.get('trip_id'));
  if(trip) {
    return trip.title;
  } else {
    return 'Loading...';
  }
};
Template.show_trip.messages = function() {
  var num_days = Days.find().count();
  switch(num_days) {
    case 0: 
      return ['Click anywhere on the map to start your trip.'];
      break;
    case 1: 
      return ['Each day gets an automatic address.', 'Keep clicking on the map to append days.'];
      break;
    case 2: 
      return ['Drag the directions to add waypoints to a route.'];
      break;
    case 3: 
      return ['Double click the trip title to make it editable and press enter to save your changes.'];
      break;
    default:
      return [];
  }
}
Template.show_trip.events = {
  'dblclick .title': function() {
    $('.title').attr({contentEditable: true, title: 'Press enter to save'}).focus();
  },
  'focusout .title, keydown .title': function(e) {
    if(e.keyCode && e.keyCode !== 13) return;
    e.preventDefault();
    var trip = Trips.findOne(Session.get('trip_id'));
    var new_title = $('.title').text().replace(/(^\s+|\s+$)/g,'');
    if(new_title.length > 3) {
      Meteor.call('trips_update', trip._id, {$set : {title: new_title}});
    } else {
      $('.title').text(trip.title).attr({contentEditable: null, title: 'Double click to edit'});
    }
  }
}

Template.days.days = function() {
return Days.find({}, {sort: {order: 1}});
};
Template.days.any_days = function() {
  return !!Days.find().count();
}
Template.days.directions = function() {
  return !!Session.get('directions') ? '0px' : '-100px';
}
Template.days.zIndex = function() {
  return !!Session.get('directions') ? 999 : 0;
}
Template.days.selected = function() {
  return Session.equals('travelMode', this.toString()) ? 'selected' : '';
}
Template.days.travelMode = function() {
  return ['DRIVING', 'BICYCLING', 'WALKING'];
}
Template.days.events = {
  'mouseout': function() {
    if(Session.get('hovered') && (Session.get('hovered') !== Session.get('current'))) markers[Session.get('hovered')].setIcon(null);
  },
  'click .exit': function(e) {
    exit_directions();
  },
  'click .mode': function(e) {
    if(Session.equals('travelMode', e.srcElement.id)) return;
    Session.set('travelMode', e.srcElement.id);
    manageTrip.updateDay(Session.get('current'), {$set: {travelMode: Session.get('travelMode')}});
    calc_route_with_stopover(Days.findOne(Session.get('current')));
  }
}
Template.day.current = function() {
  return Session.get('current') === this._id ? ' current' : '';
}
Template.day.stop_or_address = function() {
  return !!this.stop ? this.stop : this.address;
}
Template.day.is_current = function() {
  return !!(Session.get('current') === this._id);
}
Template.day.miles = function() {
  return this.distance ? toMiles(this.distance) : '';
}
Template.day.total_distance = function() {
  return toMiles(_.reduce(_.pluck(Days.find().fetch(), 'distance'), function(a, b) {return a + b;}, 0));
}
Template.day.events = {
  'click' : function () {
    make_current(this._id)
  },
  'mouseover': function() {
    Session.set('hovered', this._id);
    markers[this._id].setIcon(hover_icon);
    markers[this._id].polyline.setOptions({strokeOpacity: 0.9})
  },
  'mouseout': function() {
    Session.set('hovered', null);
    var marker = markers[this._id];
    if(marker) {
      marker.polyline.setOptions({strokeOpacity: 0.5})
      if(Session.get('current') == this._id) {
        marker.setIcon(current_icon);
      } else {
        marker.setIcon(null);
      }
    }
  },
  'dblclick .stop': function() {
    $('#'+this._id+' .stop').attr({contentEditable: true, title: 'Press enter to save'}).focus();
  },
  'click .destroy_wrap': function(e) {
    manageTrip.removeDay(this);
  },
  'click .directions_wrap': function() {
    calc_route_with_stopover(this);
  },
  'click .insert_wrap': function(e) {
    manageTrip.insertDayAfter(this);
  },
  'blur .stop, keydown .stop': function(e) {
    if(e.keyCode && e.keyCode !== 13) return;
    e.preventDefault();
    var new_stop = $('#'+this._id+' .stop').text().replace(/(^\s+|\s+$)/g,'');
    if(new_stop.length === 0) {
      manageTrip.updateDay(this._id, {$set : {stop: ''}});
    } else if(new_stop.length > 3) {
      manageTrip.updateDay(this._id, {$set : {stop: new_stop}});
    } else {
      $('#'+this._id+' .stop').text(this.stop).attr({contentEditable: null, title: 'Double click to edit'});
    }
  }
};
