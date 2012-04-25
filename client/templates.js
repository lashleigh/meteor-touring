Template.content.has_trip = function() {
  return !!Session.get('trip_id');
};
Template.content.events = {
  'click button.home': function() {
    Router.trips();
  },
  'click button.danger': function() {
    if(confirm('are you sure?')) {
      Trips.remove(Session.get('trip_id'));
      Days.remove({trip_id: Session.get('trip_id')});
      Router.trips();
    } 
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
Template.trip.miles = function() {
  return this.distance ? toMiles(this.distance)+'les in' : '';
}
Template.trip.events = {
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
Template.show_trip.many_days = function() {
  return Days.find().count() >= 4;
};
Template.show_trip.three_days = function() {
  return Days.find().count() === 3;
};
Template.show_trip.two_days = function() {
  return Days.find().count() === 2;
};
Template.show_trip.one_day = function() {
  return Days.find().count() === 1;
};
Template.show_trip.no_days = function() {
  return Days.find().count() === 0;
};

Template.show_trip.events = {
  'dblclick .title': function() {
    $('.title').attr({contentEditable: true, title: 'Press enter to save'}).focus();
  },
  'blur .title': function() {
    $('.title').attr({contentEditable: null, title: 'Double click to edit'});
  },
  'keydown .title': function(e) {
    if(e.keyCode === 13) {
      e.preventDefault();
      var trip = Trips.findOne(Session.get('trip_id'));
      var new_title = $('.title').text().replace(/(^\s+|\s+$)/g,'');
      if(new_title.length > 3) {
        Trips.update(trip._id, {$set : {title: new_title}});
      } else {
        if_console('too short');
        $('.title').text(trip.title).blur();
      }
    }
  }
}

Template.days.days = function() {
  return Days.find({}, {sort: Session.get('sort')});
};
Template.days.any_days = function() {
  return !!Days.find().count();
}
Template.days.events = {
  'mouseout': function() {
    if(Session.get('hovered') && (Session.get('hovered') !== Session.get('current'))) markers[Session.get('hovered')].setIcon(null);
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
  'click' : function (e) {
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
    e.stopPropagation();
    Days.remove({_id: this._id});
    adjust_order_after_remove(this);
  },
  'click .directions_wrap': function(e) {
    calc_route_with_stopover(this);
  },
  'click .insert_wrap': function(e) {
    e.stopPropagation();
    var day = this;
    if(Days.find({order: {$gt: day.order}}).count() !== 0) {
      if(day.polyline) {
        var path = decodePath(day.polyline);
        if(path.length > 2) {
          var midpoint = path[Math.floor(path.length/2)];
          munge_update({order: {$gte: day.order+1}}, {$inc: {order: 1}}, {multi: true});
          munge_update(day._id, {$set: {waypoints: []}}); //TODO Unfortunate but how else would I keep the waypoint order straight?
          var d = munge_insert({lat: midpoint.lat(), lng:midpoint.lng(), order: day.order+1});
          make_current(d);
          calc_route_with_stopover(Days.findOne(d));
        } else {
          var next_day = Days.findOne({order: day.order + 1});
          var half_lat = day.lat - (day.lat - next_day.lat) / 2;
          var half_lng = day.lng - (day.lng - next_day.lng) / 2;
          munge_update({order: {$gte: day.order+1}}, {$inc: {order: 1}}, {multi: true});
          munge_update(day._id, {$set: {waypoints: []}}); //TODO Unfortunate but how else would I keep the waypoint order straight?
          var d = munge_insert({lat: half_lat, lng:half_lng, order: day.order+1});
          make_current(d);
          calc_route_with_stopover(Days.findOne(d));
        }
      }
    } else {
      if_console('inserting on the last day doesnt make sense');
    }
  },
  'blur .stop': function() {
    $('#'+this._id+' .stop').attr({contentEditable: null, title: 'Double click to edit'})
  },
  'keydown .stop': function(e) {
    if(e.keyCode === 13) {
      e.preventDefault();
      var new_stop = $('#'+this._id+' .stop').text().replace(/(^\s+|\s+$)/g,'');
      if(new_stop.length === 0) {
        update_by_merging(this, {stop: ''})
      } else if(new_stop.length > 3) {
        update_by_merging(this, {stop: new_stop})
      } else {
        if_console('too short');
        $('#'+this._id+' .stop').text(this.stop).blur();
      }
    }
  }
};
