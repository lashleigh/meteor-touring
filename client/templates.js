Template.content.has_trip = function() {
  return !!Session.get('trip_id');
};
Template.content.events = {
  'click button.home': function() {
  console.log('going home');
    Router.trips();
  }
}
Template.trips.trips = function() {
  return Trips.find().fetch();
};
Template.trip.events = {
  'click': function() {
    console.log('clicked on ', this)
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
Template.show_trip.events = {
  'dblclick h1': function() {
    $('.title h1').attr('contentEditable', true).focus();
  },
  'blur h1': function() {
    $('.title h1').attr('contentEditable', null);
  },
  'keydown h1': function(e) {
    if(e.keyCode === 13) {
      e.preventDefault();
      var trip = Trips.findOne(Session.get('trip_id'));
      var new_title = $('.title h1').text().replace(/(^\s+|\s+$)/g,'');
      if(new_title.length > 3) {
        Trips.update(trip._id, {$set : {title: new_title}});
      } else {
        if_console('too short');
        $('.title h1').text(trip.title).blur();
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
    console.log('wtf');
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
    $('#'+this._id+' .stop').attr('contentEditable', true).focus();
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
      if(!!day.polyline) {
        var path = decodePath(day.polyline);
        var midpoint = path[Math.floor(path.length/2)];
        munge_update({order: {$gte: day.order+1}}, {$inc: {order: 1}}, {multi: true});
        munge_update(day._id, {$set: {waypoints: []}}); //TODO Unfortunate but how else would I keep the waypoint order straight?
        var d = munge_insert({lat: midpoint.lat(), lng:midpoint.lng(), order: day.order+1});
        make_current(d);
        calc_route_with_stopover(Days.findOne(d));
      } else {
        console.log('the day doesnt have a polyline yet...');
      }
    } else {
      console.log('inserting on the last day doesnt make sense');
    }
  },
  'blur .stop': function() {
    $('#'+this._id+' .stop').attr('contentEditable', null)
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
