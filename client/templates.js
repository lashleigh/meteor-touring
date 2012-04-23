Template.header.greeting = function () {
  var trip = Trips.findOne(Session.get('trip_id'));
  if(trip) {
    return trip.title;
  } else {
    return 'Loading...';
  }
};

Template.days.days = function() {
  return Days.find({}, {sort: Session.get('sort')});
};
Template.days.events = {
  'mouseout': function() {
    if(Session.get('hovered') && (Session.get('hovered') !== Session.get('current'))) markers[Session.get('hovered')].setIcon(null);
  },
  'click #reset_days': function() {
    Days.remove({});
    Meteor.call('reset');
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
  return this.distance ? Math.floor(this.distance * 0.00621371192)/10.0 : '';
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
    markers[this._id].polyline.setOptions({strokeOpacity: 0.5})
    if(Session.get('current') == this._id) {
      markers[this._id].setIcon(current_icon);
    } else {
      markers[this._id].setIcon(null);
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
    calc_route(this);
  },
  'click .insert_wrap': function(e) {
    e.stopPropagation();
    var day = this;
    var path = decodePath(day.polyline);
    var midpoint = path[Math.floor(path.length/2)];
    munge_update({order: {$gte: day.order+1}}, {$inc: {order: 1}}, {multi: true});
    munge_update(day._id, {$set: {waypoints: []}}); //TODO Unfortunate but how else would I keep the waypoint order straight?
    var d = munge_insert({lat: midpoint.lat(), lng:midpoint.lng(), order: day.order+1});
    make_current(d);
    calc_route_with_stopover(Days.findOne(d));
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
